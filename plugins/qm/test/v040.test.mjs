import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState, enqueue, claim, settleTurn, recordContext,
  normalizeUsage, configure, statsText, retryLast } from '../src/queue.mjs';
import { parseCommand, parseDuration } from '../src/commands.mjs';
import { MARKER_NOTE, verdictFromText, parseAiVerdict, buildVerificationPrompt } from '../src/verification.mjs';
import { register } from '../hooks/register.mjs';

const flush = async () => { for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)); };
let seq=0;
function fakeHost(shared = new Map(), id = `v040-session-${++seq}`) {
  const handlers=[]; const sent=[]; const notices=[]; const clock={now:Date.now()};
  let tokens=50000, window=200000, modelAnswer='QM_VERDICT:PASS';
  const tools={
    plugin:{root:fileURLToPath(new URL('../',import.meta.url))},
    process:{run:async(argv)=>{if(argv[1]?.endsWith('backup-files.mjs'))return{exitCode:0,stdout:'{}'};try{return {exitCode:0,stdout:execFileSync(argv[0],argv.slice(1),{encoding:'utf8',stdio:['ignore','pipe','pipe']}),stderr:''};}catch(e){return {exitCode:e.status||1,stdout:e.stdout||'',stderr:e.stderr||String(e)};}}},
    session:{id:async()=>id,usage:async()=>({context:{tokens,window}})},
    store:{ get:async k=>shared.get(k),set:async(k,v)=>{shared.set(k,structuredClone(v));},keys:async()=>[...shared.keys()] },
    clock:{now:async()=>clock.now,after:(ms,cb)=>({cancel(){},call:cb,ms})},
    ui:{invalidate(){},toast:s=>notices.push(s),log(){},open:async()=>{},resolve:()=>({Box:x=>x,Text:x=>x,Button:x=>x,Input:x=>x,Select:x=>x})},
    command:{register:async()=>{}},
    prompt:{submit:async({text,asUser})=>{sent.push({text,asUser});return {};}},
    model:{complete:async()=>({text:modelAnswer,isAnswered:true})}
  };
  register((name,optsOrFn,fn)=>handlers.push({name,opts:typeof optsOrFn==='function'?{}:optsOrFn,fn:typeof optsOrFn==='function'?optsOrFn:fn}));
  async function emit(name,e={},filter={}) {const h=handlers.find(x=>x.name===name&&Object.entries(filter).every(([k,v])=>x.opts[k]===v));assert.ok(h,`missing ${name}`);return h.fn(tools,e,x=>x);}
  const cmd = async (args)=>emit('command.run',{args},{command:'qm'});
  const getState=()=>shared.get(`claude-queue-manager:queue:${id}`);
  return {emit,cmd,getState,tools,notices,sent,shared,id,clock,usage:(n)=>tokens=n,modelAnswer:(s)=>modelAnswer=s};
}

test('v0.3 state upgrades in place, preserving queued tasks and history',()=>{
  const prior={version:1,pending:[{id:9,text:'keep me',createdAt:7}],running:null,done:[{id:1,text:'done',finishedAt:3}],nextId:10,paused:true,undo:[]};
  const newer=normalizeState(prior,'id');
  assert.equal(newer.version,3);assert.equal(newer.pending[0].text,'keep me');assert.equal(newer.done[0].text,'done');
  assert.equal(newer.pending[0].when,'always');assert.equal(newer.nextId,10);assert.equal(newer.history.length,1);
});

test('config validation blocks unbounded retries, invalid model strings and excessive timeouts',()=>{
  let s=initialState('cfg');s=configure(s,{retries:5,timeoutMs:86400000,contextPercent:85});
  assert.equal(s.config.retries,5);
  for(const bad of [{retries:6},{contextPercent:101},{timeoutMs:86400001},{model:'a b'},{verify:'maybe'}]) assert.throws(()=>configure(s,bad));
});

test('retry budget is finite; records only terminal failure and attempt count',()=>{
  let s=configure(enqueue(initialState('r'),['A','B']),{retries:2,onFail:'pause'});
  for(let attempt=1;attempt<=3;attempt++){
    s=claim(s,1000*attempt).state;
    assert.equal(s.running.attempts,attempt);
    s=settleTurn(s,'failure',1000*attempt+300,{durationMs:300});
    if(attempt<3){assert.equal(s.paused,false);assert.equal(s.pending[0].text,'A');assert.equal(s.history.length,0);}
  }
  assert.equal(s.paused,true);assert.deepEqual(s.pending.map(x=>x.text),['B']);
  assert.equal(s.history[0].status,'failure');assert.equal(s.history[0].attempts,3);
  assert.equal(s.stats.retried,2);assert.equal(s.stats.failure,1);
});

test('retry delay is honored and no subsequent task leapfrogs the delayed task',()=>{
  let s=configure(enqueue(initialState('delay'),['A','B']),{retries:1,retryDelayMs:5000});
  s=claim(s,1000).state;s=settleTurn(s,'failure',1500);
  assert.equal(claim(s,2000).task,null);assert.equal(claim(s,2000).waitMs,4500);
  assert.equal(claim(s,6500).task.text,'A');
});

test('soft timeout is classified as a failed turn after completion rather than aborting it',()=>{
  let s=configure(enqueue(initialState('soft'),['A']),{timeoutMs:1000});
  s=claim(s,1000).state;s=settleTurn(s,'timeout',3500,{durationMs:2500});
  assert.equal(s.history[0].status,'timeout');assert.equal(s.stats.timeout,1);assert.equal(s.paused,true);
});

test('success/failure conditional branches skip without changing last executed outcome',()=>{
  let s=configure(enqueue(initialState('cond'),['A']),{onFail:'continue'});
  s=enqueue(s,['SUCCESS ONLY'],'end',0,'success');
  s=enqueue(s,['FAILURE ONLY'],'end',0,'failure');
  s=enqueue(s,['ALWAYS'],'end',0,'always');
  s=claim(s,1).state;s=settleTurn(s,'failure',2);
  const result=claim(s,3);s=result.state;
  assert.equal(result.task.text,'FAILURE ONLY');
  assert.equal(s.stats.skipped,1);assert.equal(s.history.find(x=>x.text==='SUCCESS ONLY').status,'skipped');
  s=settleTurn(s,'success',4);
  assert.equal(claim(s,5).task.text,'ALWAYS');
});

test('conditions without a prior result skip explicitly, rather than assuming success',()=>{
  let s=enqueue(initialState('n'),['conditional'],'end',0,'success');
  const result=claim(s,100);
  assert.equal(result.task,null);assert.equal(result.state.stats.skipped,1);
});

test('unverified answer stops automatically without replaying potential successful work',()=>{
  let s=claim(enqueue(initialState('u'),['A'])).state;
  s=settleTurn(s,'unknown');
  assert.equal(s.paused,true);assert.equal(s.pending.length,0);assert.equal(s.history[0].status,'unknown');
  s=retryLast(s);assert.equal(s.paused,true);assert.equal(s.pending.length,1);assert.notEqual(s.pending[0].id,s.history[0].id);
});

test('context usage reads real numbers and pauses at threshold only when enabled',()=>{
  let s=enqueue(initialState('c'),['A']);
  s=recordContext(s,{context:{tokens:179000,window:200000}});
  assert.equal(s.paused,false);assert.equal(s.context.percent,89.5);
  assert.equal(normalizeUsage({context:{tokens:null,window:200000}}),null);
  assert.equal(normalizeUsage({context:{window:200000}}),null);
  s=configure(s,{contextPercent:85});s=recordContext(s,{context:{tokens:179000,window:200000}});
  assert.equal(s.paused,true);assert.match(s.pauseReason,/context:85/);
  assert.equal(normalizeUsage({context:{tokens:NaN,window:0}}),null);
});

test('history and analytics keep statuses, durations and bounded records',()=>{
  let s=enqueue(initialState('h'),Array.from({length:200},(_,i)=>`A${i}`));
  for(let i=0;i<200;i++){s=claim(s,100+i).state;s=settleTurn(s,'success',110+i,{durationMs:10});}
  assert.equal(s.stats.success,200);assert.equal(s.history.length,200);assert.equal(s.done.length,20);
  assert.match(statsText(s),/200 finished/);
  s=enqueue(s,Array(100).fill('B'));
  for(let i=0;i<100;i++){s=claim(s,400+i).state;s=settleTurn(s,'success',410+i,{durationMs:10});}
  assert.equal(s.history.length,250);assert.equal(s.stats.success,300);
});

test('marker verifier prefers QM_FAIL and treats missing marker as unknown',()=>{
  assert.equal(verdictFromText('Finished\nQM_PASS'),'success');
  assert.equal(verdictFromText('QM_PASS\nQM_FAIL'),'failure');
  assert.equal(verdictFromText('Task complete but no marker'),'unknown');
  assert.match(MARKER_NOTE,/QM_FAIL/);
  assert.equal(parseAiVerdict('QM_VERDICT:PASS'),'success');
  assert.equal(parseAiVerdict('QM_VERDICT:FAIL'),'failure');
  assert.equal(parseAiVerdict('maybe'),'unknown');
  assert.match(buildVerificationPrompt('hello','world').system,/untrusted/);
});

test('commands: durations, guards, verification, branches, history and session restore',()=>{
  assert.equal(parseDuration('30s'),30000);assert.equal(parseDuration('5m'),300000);assert.equal(parseDuration('1h'),3600000);
  assert.equal(parseDuration('off'),0);assert.throws(()=>parseDuration('25h'));
  assert.deepEqual(parseCommand('verify ai haiku'),{type:'config',updates:{verify:'ai',model:'haiku'}});
  assert.equal(parseCommand('verify marker').updates.verify,'marker');
  assert.equal(parseCommand('retry 3 5s').updates.retryDelayMs,5000);
  assert.equal(parseCommand('retry last').type,'retry-last');
  assert.equal(parseCommand('timeout off').updates.timeoutMs,0);
  assert.equal(parseCommand('context 85').updates.contextPercent,85);
  assert.equal(parseCommand('if failure fix tests').when,'failure');
  assert.equal(parseCommand('history 10').count,10);
  assert.equal(parseCommand('restore sid recover').recover,true);
  assert.throws(()=>parseCommand('restore ../../secrets'));
  assert.throws(()=>parseCommand('context 200'));
});

test('mod: marker verification retries one item then advances to next separate turn',async()=>{
  const h=fakeHost();await h.emit('session.start');await h.cmd('pause');await h.cmd('verify marker');await h.cmd('retry 1');
  await h.cmd('batch A || B');await h.cmd('resume');await flush();
  assert.equal(h.sent.length,1);assert.match(h.sent[0].text,/QM_PASS/);
  await h.emit('turn.start');await h.emit('turn.complete',{reason:'answer',answer:'QM_FAIL',durationMs:1000});await flush();
  assert.equal(h.sent.length,2);assert.match(h.sent[1].text,/^A/);
  await h.emit('turn.start');await h.emit('turn.complete',{reason:'answer',answer:'QM_PASS',durationMs:1000});await flush();
  assert.equal(h.sent.length,3);assert.match(h.sent[2].text,/^B/);
  assert.equal(h.getState().stats.retried,1);
});

test('mod: AI verification is opt-in and conservative unknown pauses',async()=>{
  const h=fakeHost();await h.emit('session.start');await h.cmd('verify ai haiku');await h.cmd('pause');
  await h.cmd('add A');h.modelAnswer('QM_VERDICT:UNKNOWN');await h.cmd('resume');await flush();
  await h.emit('turn.start');await h.emit('turn.complete',{reason:'answer',answer:'Done.'});await flush();
  assert.equal(h.getState().paused,true);assert.equal(h.getState().history[0].status,'unknown');
});

test('mod: context threshold blocks next dispatch and records exact value',async()=>{
  const h=fakeHost();h.usage(180000);await h.emit('session.start');await h.cmd('pause');
  await h.cmd('context 85');await h.cmd('add A');await h.cmd('resume');await flush();
  assert.equal(h.sent.length,0);assert.equal(h.getState().paused,true);assert.equal(h.getState().pauseReason,'context:85');
  assert.equal(h.getState().context.percent,90);
});

test('mod: conditional branch after failure and continuation policy',async()=>{
  const h=fakeHost();await h.emit('session.start');await h.cmd('pause');await h.cmd('verify marker');await h.cmd('onfail continue');
  await h.cmd('add A');await h.cmd('if success B');await h.cmd('if failure C');await h.cmd('resume');await flush();
  assert.equal(h.sent.length,1);
  await h.emit('turn.start');await h.emit('turn.complete',{reason:'answer',answer:'QM_FAIL'});await flush();
  assert.equal(h.sent.length,2);assert.match(h.sent[1].text,/^C/);assert.equal(h.getState().stats.skipped,1);
});

test('mod: paused session can be transferred once into another empty session',async()=>{
  const store=new Map();const a=fakeHost(store,'save-session');await a.emit('session.start');await a.cmd('pause');await a.cmd('batch A || B');
  const b=fakeHost(store,'new-session');await b.emit('session.start');
  const sessions=await b.cmd('sessions');assert.match(sessions.text,/save-session/);
  const restore=await b.cmd('restore save-session');assert.match(restore.text,/save-session.*2/);
  assert.deepEqual(b.getState().pending.map(x=>x.text),['A','B']);assert.equal(b.getState().paused,true);
  assert.equal(a.getState().pending.length,2);assert.equal(a.getState().transferredTo,'new-session');
  await a.cmd('resume'); await flush();
  assert.equal(a.sent.length,0,'original session must not replay transferred tasks');
  const repeat=await b.cmd('restore save-session');assert.match(repeat.text,/error/i);
});

test('mod: restore rejects active source and requires explicit acknowledgement of in-flight work',async()=>{
  const store=new Map();const src=fakeHost(store,'old-running');await src.emit('session.start');await src.cmd('add A');await flush();
  const dst=fakeHost(store,'next');await dst.emit('session.start');
  assert.match((await dst.cmd('restore old-running')).text,/in-flight/);
  assert.match((await dst.cmd('restore old-running recover')).text,/old-running/);
  assert.equal(dst.getState().paused,true);assert.equal(dst.getState().pending[0].text,'A');
});

