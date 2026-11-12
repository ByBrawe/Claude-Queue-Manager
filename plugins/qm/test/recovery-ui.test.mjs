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

test('recovery UI refuses a tracked live turn and retains orphan on storage error',async()=>{
 const h=await orphan(),old=await render(h);await h.emit('turn.start',{turnId:'still-working'});
 const busy=await render(h);assert.equal(find(busy,'qm-recover'),undefined);
 await find(old,'qm-recover').onPress();assert.equal(h.state().running.text,'unfinished work');assert.equal(h.state().pending.length,2);
 const b=await orphan(),ui=await render(b);b.tools.store.set=async()=>{throw new Error('disk write failed');};
 await find(ui,'qm-recover').onPress();assert.equal(b.state().running.text,'unfinished work');assert.equal(b.state().pending.length,2);assert.equal(b.sent.length,0);
});

