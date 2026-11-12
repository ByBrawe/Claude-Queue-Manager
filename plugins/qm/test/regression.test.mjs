import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { host, find, flush } from './helpers.mjs';
import { initialState, enqueue, configure, claim, settleTurn, undo, normalizeState } from '../src/queue.mjs';
import { acquireLock, releaseLock } from '../src/restore-lock.mjs';

test('long multiline native edits use full-width editor and save only explicitly',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add original');await h.cmd('');
 for(const component of ['Pane','AbovePrompt']){
  const render=()=>h.emit('ui.render',{component,props:{bodyColumns:48},surface:'desktop'},component==='Pane'?{component,requestId:'qm'}:{component});
  let pane=await render();await find(pane,'qm-edit-1').onPress();pane=await render();
  assert.equal(find(pane,'qm-edit-field').width,'100%');assert.ok(find(pane,'qm-edit-input').rows>=6);
  const text=Array.from({length:90},(_,i)=>`Paragraph ${i+1}: Türkçe uzun görev metni.`).join('\n');
  find(pane,'qm-edit-input').onInput(text);await find(pane,'qm-edit-input').onSubmit(text);
  assert.notEqual(h.state().pending[0].text,text,'submit must not save multiline draft');
  await find(pane,'qm-save-edit').onPress();assert.equal(h.state().pending[0].text,text);
  await h.cmd('edit 1 original');
 }
 assert.equal(h.sent.length,0);
});

test('next-pending preview follows global FIFO order across filtering, paging and moves',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch '+Array.from({length:20},(_,i)=>'Task '+(i+1)).join(' || '));
 const render=()=>h.emit('ui.render',{component:'Pane',props:{bodyColumns:48},surface:'desktop'},{component:'Pane',requestId:'qm'});
 let pane=await render();assert.match(find(pane,'qm-next-pending').children[0].children[0],/1\. Task 1$/);
 assert.equal(find(pane,'qm-check-1').hotkey,undefined);
 await find(pane,'qm-next-page').onPress();pane=await render();assert.ok(find(pane,'qm-edit-13'));assert.match(find(pane,'qm-next-pending').children[0].children[0],/Task 1$/);
 find(pane,'qm-search').onInput('Task 20');pane=await render();assert.ok(find(pane,'qm-edit-20'));assert.match(find(pane,'qm-next-pending').children[0].children[0],/Task 1$/);
 await find(pane,'qm-show-next').onPress();pane=await render();assert.equal(find(pane,'qm-search').value,'');assert.ok(find(pane,'qm-edit-1'));
 await find(pane,'qm-up-2').onPress();pane=await render();assert.match(find(pane,'qm-next-pending').children[0].children[0],/1\. Task 2$/);
 await h.cmd('resume');await flush();assert.equal(h.sent[0].text,'Task 2');
 pane=await render();assert.match(find(pane,'qm-next-pending').children[0].children[0],/1\. Task 1$/);
});

test('full composer workspace shows repeats and pending actions without Details',async()=>{
 for(const count of [5,20]){
  const h=await host();await h.cmd('pause');await h.cmd('');
  const pane=await h.emit('ui.render',{component:'Pane',props:{bodyColumns:48},surface:'desktop'},{component:'Pane',requestId:'qm'});
  assert.ok(find(pane,'qm-repeat-count'));assert.ok(find(pane,'qm-repeat-message'));
  const ui=await h.emit('ui.render',{component:'AbovePrompt',props:{bodyColumns:48},surface:'desktop'},{component:'AbovePrompt'});
  for(const key of ['qm-toggle','qm-clear','qm-web-open','qm-side','qm-language','qm-add-tasks','qm-repeat-count','qm-repeat-message'])assert.ok(find(ui,key),key);
  assert.equal(find(ui,'qm-undo'),undefined,'no undo action for an empty edit history');
  find(ui,'qm-repeat-count').onInput(String(count));find(ui,'qm-repeat-message').onInput('continue carefully');
  await find(ui,'qm-repeat-action').onPress();
  assert.equal(h.state().pending.length,count);assert.ok(h.state().pending.every(x=>x.text==='continue carefully'));assert.equal(h.sent.length,0);
  const queued=await h.emit('ui.render',{component:'AbovePrompt',props:{bodyColumns:48},surface:'desktop'},{component:'AbovePrompt'});
  assert.ok(find(queued,'qm-search'));assert.ok(find(queued,'qm-edit-1'));assert.ok(find(queued,'qm-rm-1'));assert.ok(find(queued,'qm-undo'));
  await find(queued,'qm-details').onPress();
  const detailed=await h.emit('ui.render',{component:'AbovePrompt',props:{bodyColumns:48},surface:'desktop'},{component:'AbovePrompt'});
  assert.ok(find(detailed,'qm-repeat-count'));assert.ok(find(detailed,'qm-rm-1'));
 }
});

test('summary band has separate side, expand and web actions',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add A');
 const band=await h.emit('ui.render',{component:'AbovePrompt',props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.ok(find(band,'qm-band-side'));assert.ok(find(band,'qm-open'));assert.ok(find(band,'qm-band-web'));
 await find(band,'qm-band-web').onPress();
 const unchanged=await h.emit('ui.render',{component:'AbovePrompt',props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.equal(find(unchanged,'qm-close'),undefined,'web action must not expand native manager');
 await find(unchanged,'qm-open').onPress();
 const expanded=await h.emit('ui.render',{component:'AbovePrompt',props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.ok(find(expanded,'qm-close'));
});

test('language is visible in compact UI; Turkish defaults and saved English persists',async()=>{
 for(const saved of [undefined,'en']){
  const memory=new Map();if(saved)memory.set('claude-queue-manager:prefs:locale',saved);
  const h=await host({memory});await h.cmd('');
  const ui=await h.emit('ui.render',{component:'AbovePrompt',props:{},surface:'desktop'},{component:'AbovePrompt'});
  const select=find(ui,'qm-language');assert.equal(select.value,saved||'tr');
  await select.onSelect('tr');assert.equal(memory.get('claude-queue-manager:prefs:locale'),'tr');
  const help=await h.cmd('help');assert.match(help.text,/Mesaj kutusunun/);
 }
});

test('Claude queue tool builds and reorders pending work without steering the active turn',async()=>{
 const h=await host();await h.emit('turn.start',{turnId:'user-planning'});
 const call=args=>h.emit('tool.call',{tool:'mcp__qm__queue',...args},{tool:'mcp__qm__queue'});
 let result=await call({action:'add',tasks:['Inspect code','Run tests','Write summary']});
 assert.equal(JSON.parse(result.result).pending.length,3);await flush();assert.equal(h.sent.length,0);
 result=await call({action:'reorder',ids:[2,1,3]});assert.deepEqual(JSON.parse(result.result).pending.map(x=>x.id),[2,1,3]);
 result=await call({action:'remove',ids:[99]});assert.equal(result.isError,true);
 assert.equal(h.state().pending.length,3);
 await h.emit('turn.complete',{turnId:'user-planning',reason:'answer',answer:'Plan ready'});await flush();
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].text,'Run tests');
 result=await call({action:'remove',ids:[2]});assert.equal(result.isError,true);
});

test('user pause survives success, terminal failure, timeout and retry',()=>{
 for(const outcome of ['success','failure','timeout'])for(const retries of [0,2]){
  let s=configure(enqueue(initialState('pause'),['A','B']),{onFail:'continue',retries});
  s=claim(s,100).state;s={...s,paused:true,pauseReason:'user'};
  s=settleTurn(s,outcome,200);
  assert.equal(s.paused,true);assert.equal(s.pauseReason,'user');assert.equal(claim(s,201).task,null);
 }
});
test('undo cannot resurrect completed work after bounded history expires',()=>{
 let s=enqueue(initialState('undo'),Array.from({length:200},(_,i)=>`T${i}`));
 s=enqueue(s,Array.from({length:100},(_,i)=>`T${i+200}`));
 for(let i=0;i<300;i++){s=claim(s,100+i).state;s=settleTurn(s,'success',101+i);}
 assert.equal(undo(s).pending.length,0);
 const migrated=normalizeState({...s,version:2,undo:[{pending:[{id:1,text:'old completed work'}]}]},'undo');
 assert.equal(migrated.undo.length,0);
});
test('stale delete and edit controls resolve stable IDs under the mutation lock',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B || C');
 const pane=await h.emit('ui.render',{props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 const removeB=find(pane,'qm-rm-2');await h.cmd('resume');await flush();await removeB.onPress();assert.deepEqual(h.state().pending.map(x=>x.text),['B','C']);await removeB.onPress();
 assert.deepEqual(h.state().pending.map(x=>x.text),['C']);
 await find(pane,'qm-rm-1').onPress();assert.deepEqual(h.state().pending.map(x=>x.text),['C']);
});
test('oversized add is atomic and the previous queue still resumes',async()=>{
 const h=await host();await h.cmd('pause');
 await h.cmd('repeat 100 '+'x'.repeat(10000));await h.cmd('repeat 100 '+'y'.repeat(10000));
 const before=structuredClone(h.state());
 assert.match((await h.cmd('repeat 100 '+'z'.repeat(10000))).text,/storage limit/);
 assert.deepEqual(h.state(),before);
 assert.doesNotMatch((await h.cmd('resume')).text,/error/i);await flush();assert.equal(h.sent.length,1);
});
test('ordinary store failure does not publish a phantom in-memory edit',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add A');
 const set=h.tools.store.set;h.tools.store.set=async()=>{throw new Error('disk write failed');};
 assert.match((await h.cmd('add B')).text,/disk write failed/);
 h.tools.store.set=set;await h.cmd('resume');await flush();assert.deepEqual(h.sent.map(x=>x.text),['A']);
 assert.equal(h.state().pending.length,0);
});
test('live recover is refused and cannot send the current task twice',async()=>{
 const h=await host();await h.cmd('batch A || B');await flush();await h.emit('turn.start',{turnId:'A'});
 assert.match((await h.cmd('recover')).text,/still live/);await h.cmd('resume');await flush();
 assert.deepEqual(h.sent.map(x=>x.text),['A']);
});
test('/clear carries pending work paused and preserves the retired source copy',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B');const old=h.id();
 await h.emit('session.end',{reason:'clear'});h.switchId('after-clear');await h.cmd('stats');
 assert.deepEqual(h.state().pending.map(x=>x.text),['A','B']);assert.equal(h.state().paused,true);
 assert.equal(h.memory.get(`claude-queue-manager:queue:${old}`).transferredTo,'after-clear');
 assert.equal(h.sent.length,0);
});
test('filesystem restore lock excludes another owner and refuses wrong-owner release',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'qm-lock-unit-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 acquireLock(dir,'source','first');assert.throws(()=>acquireLock(dir,'source','second'),/Another restore/);
 assert.throws(()=>releaseLock(dir,'source','second'),/owner changed/);
 releaseLock(dir,'source','first');acquireLock(dir,'source','second');releaseLock(dir,'source','second');
});
test('separate modules/processes cannot restore one source to two targets',async t=>{
 const lockDir=await mkdtemp(join(tmpdir(),'qm-restore-race-'));t.after(()=>rm(lockDir,{recursive:true,force:true}));
 const memory=new Map();memory.set('claude-queue-manager:queue:source',{...enqueue(initialState('source'),['A','B']),paused:true});
 const a=await host({memory,lockDir}),b=await host({memory,lockDir});
 const replies=await Promise.all([a.cmd('restore source'),b.cmd('restore source')]);
 assert.equal(replies.filter(x=>/source.*2/.test(x.text)).length,1);
 assert.equal([a,b].filter(x=>x.state()?.pending.length===2).length,1);
});
test('failed restore retains a frozen source and never publishes tasks to the target cache',async t=>{
 const lockDir=await mkdtemp(join(tmpdir(),'qm-restore-fail-'));t.after(()=>rm(lockDir,{recursive:true,force:true}));
 const memory=new Map();memory.set('claude-queue-manager:queue:source',{...enqueue(initialState('source'),['A']),paused:true});
 const h=await host({memory,lockDir});const set=h.tools.store.set;
 h.tools.store.set=async(k,v)=>{if(k.endsWith(h.id()))throw new Error('target disk failure');return set(k,v);};
 assert.match((await h.cmd('restore source')).text,/target disk failure/);
 h.tools.store.set=set;await h.cmd('resume');await flush();assert.equal(h.sent.length,0);
 assert.equal(memory.get('claude-queue-manager:queue:source').pending[0].text,'A');
 assert.equal(memory.get('claude-queue-manager:queue:source').transferredTo,null);
});
test('a user turn starting during AI verification prevents dispatch into that turn',async()=>{
 const h=await host();let finish;h.tools.model={complete:()=>new Promise(r=>finish=r)};
 await h.cmd('pause');await h.cmd('verify ai');await h.cmd('batch A || B');await h.cmd('resume');await flush();
 await h.emit('turn.start',{turnId:'A'});
 const completion=h.emit('turn.complete',{turnId:'A',reason:'answer',answer:'Done',durationMs:100});await flush();
 await h.emit('turn.start',{turnId:'manual'});finish({isAnswered:true,text:'QM_VERDICT:PASS'});await completion;await flush();
 assert.equal(h.sent.length,1);assert.equal(h.state().busy,true);
 await h.emit('turn.complete',{turnId:'manual',reason:'answer',answer:'Done',durationMs:100});await flush();
 assert.equal(h.sent.length,2);
});

