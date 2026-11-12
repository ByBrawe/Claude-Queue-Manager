import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,enqueue,runOne,cancelOne,claim,settleTurn,configure,remove,reorderByIds,normalizeState,recover,recordContext} from '../src/queue.mjs';
import {host,find,flush} from './helpers.mjs';
import {parseCommand} from '../src/commands.mjs';

const queue=()=>enqueue(initialState('one'),['A','B','C']);

test('run commands validate positions and never enqueue malformed command text',()=>{
 assert.deepEqual(parseCommand('run 2'),{type:'run-one',position:2});assert.deepEqual(parseCommand('run cancel'),{type:'cancel-one'});
 for(const command of ['run','run 0','run -1','run text','run 1.5'])assert.throws(()=>parseCommand(command));
});

test('single task uses stable ID after reordering and pauses without dispatching the rest',()=>{
 let s=runOne(queue(),3);s=reorderByIds(s,[1,2,3]);const result=claim(s,100);assert.equal(result.task.text,'C');
 s=settleTurn(result.state,'success',200);assert.equal(s.paused,true);assert.equal(s.singleRun,null);assert.deepEqual(s.pending.map(x=>x.text),['A','B']);assert.equal(claim(s,201).task,null);
 assert.throws(()=>runOne(s,99),/singleMissing/);
});

test('single selection waits for the already running task and its bounded retries',()=>{
 let s=claim(configure(queue(),{retries:1,retryDelayMs:10}),100).state;s=runOne(s,3);
 assert.equal(claim(s,101).task,null);
 s=settleTurn(s,'failure',110);assert.equal(claim(s,115).task,null);
 let attempt=claim(s,120);assert.equal(attempt.task.text,'A');s=settleTurn(attempt.state,'success',130);
 attempt=claim(s,131);assert.equal(attempt.task.text,'C');s=settleTurn(attempt.state,'success',140);
 assert.equal(s.paused,true);assert.deepEqual(s.pending.map(x=>x.text),['B']);
});

test('selected task retries only itself and never consumes the next pending task',()=>{
 let s=runOne(configure(queue(),{retries:2,onFail:'continue'}),2);
 for(let i=0;i<3;i++){const result=claim(s,100+i);assert.equal(result.task.id,2);s=settleTurn(result.state,'failure',100+i);}
 assert.equal(s.paused,true);assert.equal(s.stats.retried,2);assert.equal(s.history.length,1);assert.equal(s.history[0].id,2);assert.deepEqual(s.pending.map(x=>x.id),[1,3]);
});

test('conditions, context, removed selections and cancellation cannot fall through to another task',()=>{
 let s=enqueue(queue(),['conditional'],'end',100,'failure');s=runOne(s,4);const skipped=claim(s,101);assert.equal(skipped.task,null);assert.equal(skipped.state.paused,true);assert.equal(skipped.state.stats.skipped,1);assert.equal(skipped.state.pending.length,3);
 s=runOne(configure(queue(),{contextPercent:50}),2);s=recordContext(s,{tokens:90,window:100});assert.equal(claim(s,101).task,null);
 s=remove(runOne(queue(),2),1);const removed=claim(s,101);assert.equal(removed.task,null);assert.equal(removed.state.paused,true);assert.equal(removed.state.pending.length,2);
 s=cancelOne(runOne(queue(),2));assert.equal(s.singleRun,null);assert.equal(s.paused,true);assert.equal(s.pending.length,3);
});

test('restart and orphan recovery retain one-task intent without auto-execution',()=>{
 const planned=normalizeState(runOne(queue(),2),'one');assert.equal(planned.paused,true);assert.equal(planned.singleRun.taskId,2);
 const loaded=normalizeState(claim(runOne(queue(),2),100).state,'one');assert.equal(loaded.recoverable,true);
 let s=recover(loaded);assert.equal(s.singleRun.taskId,2);assert.equal(s.paused,true);
 s=claim({...s,paused:false},110).state;s=settleTurn(s,'success',120);assert.equal(s.paused,true);assert.equal(s.pending.length,2);
});

test('unknown or interrupted single tasks hold the queue; cancelling a retry clears one-task intent',()=>{
 for(const outcome of ['unknown','aborted']){let s=settleTurn(claim(runOne(queue(),2),100).state,outcome,110);assert.equal(s.paused,true);assert.equal(claim(s,111).task,null);assert.ok(s.pending.some(t=>t.id===1));}
 let s=settleTurn(claim(runOne(configure(queue(),{retries:1}),2),100).state,'failure',110);s=cancelOne(s);
 assert.equal(s.pending[0].singleOnce,undefined);s=claim({...s,paused:false},120).state;s=settleTurn(s,'success',130);assert.equal(s.paused,false);assert.equal(claim(s,131).task.text,'A');
});

test('native selected-task button submits once and holds remaining queue',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B || C');await h.cmd('');
 const render=()=>h.emit('ui.render',{component:'Pane',surface:'desktop',props:{bodyColumns:48}},{component:'Pane',requestId:'qm'});
 let ui=await render();assert.equal(find(ui,'qm-run-selected'),undefined);await find(ui,'qm-check-3').onPress();ui=await render();
 await find(ui,'qm-run-selected').onPress();await flush();assert.equal(h.sent.length,1);assert.equal(h.sent[0].text,'C');
 await h.emit('turn.start',{turnId:'one-C'});await h.emit('turn.complete',{turnId:'one-C',reason:'answer',answer:'Done'});await flush();
 assert.equal(h.sent.length,1);assert.equal(h.state().paused,true);assert.deepEqual(h.state().pending.map(x=>x.text),['A','B']);
});

test('double run clicks and a dropped host submission cannot dispatch other work',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B');
 const submit=h.tools.prompt.submit;h.tools.prompt.submit=async()=>({drop:'host busy'});
 await Promise.all([h.cmd('run 2'),h.cmd('run 2')]);await flush();assert.equal(h.state().paused,true);assert.equal(h.state().singleRun.taskId,2);assert.equal(h.state().pending.length,2);
 h.tools.prompt.submit=submit;await h.cmd('resume');await flush();assert.deepEqual(h.sent.map(x=>x.text),['B']);
 await h.emit('turn.start',{turnId:'retry-B'});await h.emit('turn.complete',{turnId:'retry-B',reason:'answer',answer:'Done'});await flush();assert.equal(h.sent.length,1);assert.equal(h.state().pending[0].text,'A');
});

test('CLI one-task request waits for a live ordinary turn; cancellation never dispatches',async()=>{
 for(const cancel of [false,true]){
  const h=await host();await h.cmd('pause');await h.cmd('batch A || B');await h.emit('turn.start',{turnId:'ordinary'});
  await h.cmd('run 2');await flush();assert.equal(h.sent.length,0);
  if(cancel)await h.cmd('run cancel');
  await h.emit('turn.complete',{turnId:'ordinary',reason:'answer',answer:'Finished'});await flush();
  assert.equal(h.sent.length,cancel?0:1);if(!cancel)assert.equal(h.sent[0].text,'B');else assert.equal(h.state().paused,true);
 }
});

test('failed single-task persistence preserves queue order and sends no prompt',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B');const before=structuredClone(h.state());
 h.tools.store.set=async()=>{throw new Error('disk failed');};const result=await h.cmd('run 2');await flush();assert.match(result.text,/disk failed/);assert.deepEqual(h.state(),before);assert.equal(h.sent.length,0);
});

