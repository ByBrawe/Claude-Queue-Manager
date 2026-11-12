import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,enqueue} from '../src/queue.mjs';
import {host,find,flush} from './helpers.mjs';

async function orphan(){
 const h=await host();h.switchId('orphan-ui');
 const state=enqueue(initialState('orphan-ui'),['pending A','pending B']);
 state.running={id:3,text:'unfinished work',attempts:1,startedAt:1};state.nextId=4;
 h.memory.set('claude-queue-manager:queue:orphan-ui',state);await h.cmd('');return h;
}
const render=(h,component='Pane')=>h.emit('ui.render',{component,surface:'desktop',props:{bodyColumns:48}},component==='Pane'?{component,requestId:'qm'}:{component});

test('restart recovery is prominent, distinct from active work and stays paused after requeue',async()=>{
 const h=await orphan();
 for(const surface of ['Pane','AbovePrompt']){
  const ui=await render(h,surface);assert.ok(find(ui,'qm-recovery-notice'));assert.ok(find(ui,'qm-recover'));assert.equal(find(ui,'qm-toggle'),undefined);
  assert.match(JSON.stringify(ui),/0 Aktif/);assert.match(JSON.stringify(ui),/Kurtarma bekliyor/);
 }
 const ui=await render(h);await find(ui,'qm-recover').onPress();await flush();
 assert.equal(h.state().running,null);assert.equal(h.state().recoverable,false);assert.equal(h.state().paused,true);
 assert.deepEqual(h.state().pending.map(x=>x.text),['unfinished work','pending A','pending B']);assert.equal(h.sent.length,0);
 const recovered=await render(h);assert.equal(find(recovered,'qm-recover'),undefined);assert.ok(find(recovered,'qm-toggle'));
 await find(recovered,'qm-toggle').onPress();await flush();assert.equal(h.sent.length,1);assert.equal(h.sent[0].text,'unfinished work');
});

test('recovery stays available during a live turn and waits before dispatch',async()=>{
 const h=await orphan();await h.cmd('clear');const old=await render(h);await h.emit('turn.start',{turnId:'still-working'});
 const busy=await render(h);assert.ok(find(busy,'qm-recover'));assert.equal(find(busy,'qm-undo'),undefined);
 await find(old,'qm-recover').onPress();assert.equal(h.state().running,null);assert.equal(h.state().pending.length,1);assert.equal(h.state().busy,true);assert.equal(h.state().paused,true);
 await h.cmd('resume');await flush();assert.equal(h.sent.length,0,'never dispatch into a live turn');
 await h.emit('turn.complete',{reason:'answer',answer:'User turn complete'});await flush();assert.equal(h.sent.length,1);assert.equal(h.sent[0].text,'unfinished work');
});

test('failed recovery retains orphan and unrelated turn completion cannot finish it',async()=>{
 const b=await orphan(),ui=await render(b);b.tools.store.set=async()=>{throw new Error('disk write failed');};
 await find(ui,'qm-recover').onPress();assert.equal(b.state().running.text,'unfinished work');assert.equal(b.state().pending.length,2);assert.equal(b.sent.length,0);
 const h=await orphan();await h.emit('turn.start',{turnId:'unrelated'});await h.emit('turn.complete',{reason:'answer',answer:'Finished unrelated work'});await flush();
 assert.equal(h.state().recoverable,true);assert.equal(h.state().history.length,0);assert.equal(h.state().running.text,'unfinished work');assert.ok(find(await render(h),'qm-recover'));
});

test('undo is distinguished from recovery and requires a preview before changing tasks',async()=>{
 const h=await orphan();assert.equal(find(await render(h),'qm-undo'),undefined);
 await find(await render(h),'qm-recover').onPress();await h.cmd('batch C || D');
 const before=h.state().pending.length;let ui=await render(h);assert.match(find(ui,'qm-undo').label,/Son kuyruk/);
 await find(ui,'qm-undo').onPress();assert.equal(h.state().pending.length,before);
 ui=await render(h);assert.match(JSON.stringify(ui),new RegExp(before+' →'));
 await find(ui,'qm-undo').onPress();assert.equal(h.state().pending.length,before-2);assert.equal(h.sent.length,0);
});

test('a stale undo confirmation cannot remove newly queued work',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add A');let ui=await render(h);
 await find(ui,'qm-undo').onPress();ui=await render(h);await h.cmd('add B');
 await find(ui,'qm-undo').onPress();assert.deepEqual(h.state().pending.map(x=>x.text),['A','B']);assert.equal(h.sent.length,0);
});

