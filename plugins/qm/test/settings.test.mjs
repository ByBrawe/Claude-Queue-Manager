import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,initialState,configure} from '../src/queue.mjs';
import {configDraft,parseSettings,configSignature,settingsGuard} from '../src/settings.mjs';
import {SETTINGS_MESSAGES} from '../src/settings-locales.mjs';
import {LANGUAGES} from '../src/locales.mjs';
import {host,find,flush} from './helpers.mjs';

test('settings form preserves milliseconds and rejects malformed or out-of-range fields atomically',()=>{
 const config={...DEFAULT_CONFIG,retryDelayMs:1500,timeoutMs:999};
 assert.deepEqual(parseSettings(configDraft(config)),config);
 const invalid={retries:['','-1','1.5','6','Infinity'],retryDelay:['','601','-1','1e2','0.0001'],timeout:['86401','no'],contextPercent:['100','-1','2.2'],verify:['bogus'],model:['','bad model','a'.repeat(101)],onFail:['stop']};
 for(const [field,values] of Object.entries(invalid))for(const value of values)assert.throws(()=>parseSettings({...configDraft(config),[field]:value}),new RegExp(field));
 const state=initialState('settings');settingsGuard(state,DEFAULT_CONFIG);
 assert.throws(()=>settingsGuard({...state,running:{id:1}},DEFAULT_CONFIG),/running/);
 assert.throws(()=>settingsGuard(configure(state,{retries:1}),DEFAULT_CONFIG),/stale/);
 for(const lang of LANGUAGES)for(const key of Object.keys(SETTINGS_MESSAGES.en))assert.ok(SETTINGS_MESSAGES[lang.value]?.[key],lang.value+'.'+key);
});

async function settingsPanel(h){await h.cmd('');let pane=await h.emit('ui.render',{component:'Pane',surface:'desktop',props:{bodyColumns:48}},{component:'Pane',requestId:'qm'});await find(pane,'qm-details').onPress();return h.emit('ui.render',{component:'Pane',surface:'desktop',props:{bodyColumns:48}},{component:'Pane',requestId:'qm'});}

test('native advanced settings save all fields in one write without starting pending work',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add pending');
 let pane=await settingsPanel(h);
 for(const [key,value] of Object.entries({verify:'marker',model:'haiku',retries:'2',retryDelay:'5',timeout:'600',contextPercent:'85',onFail:'continue'})){
   const field=find(pane,'qm-setting-'+key);(field.onSelect||field.onInput)(value);
 }
 await find(pane,'qm-settings-save').onPress();
 assert.deepEqual(h.state().config,{verify:'marker',model:'haiku',retries:2,retryDelayMs:5000,timeoutMs:600000,contextPercent:85,onFail:'continue'});
 assert.equal(h.state().pending.length,1);assert.equal(h.state().paused,true);assert.equal(h.sent.length,0);
 const b=await host({memory:h.memory});b.switchId(h.id());await b.cmd('settings');assert.equal(b.state()?.config?.retries,2);
});

test('native reset persists engine defaults without changing language, tasks or history',async()=>{
 const h=await host();await h.cmd('verify marker');await h.cmd('add first');await flush();
 await h.emit('turn.start',{turnId:'reset-history'});await h.emit('turn.complete',{turnId:'reset-history',reason:'answer',answer:'QM_FAIL'});await flush();
 await h.cmd('batch A || B');await h.cmd('retry 3 5s');await h.cmd('timeout 10m');await h.cmd('context 80');await h.cmd('onfail continue');await h.cmd('lang de');
 const before=structuredClone(h.state()),locale=h.memory.get('claude-queue-manager:prefs:locale');let pane=await settingsPanel(h);
 await find(pane,'qm-settings-defaults').onPress();
 assert.deepEqual(h.state().config,DEFAULT_CONFIG);
 for(const key of ['pending','history','done','stats','paused'])assert.deepEqual(h.state()[key],before[key],key);
 assert.equal(h.memory.get('claude-queue-manager:prefs:locale'),locale);assert.equal(h.sent.length,1);
 await h.cmd('retry 3');pane=await h.emit('ui.render',{component:'Pane',props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 const original=h.tools.store.set;h.tools.store.set=async()=>{throw new Error('disk full');};
 await find(pane,'qm-settings-defaults').onPress();h.tools.store.set=original;
 assert.equal(h.state().config.retries,3,'failed reset must not replace durable config');
});

test('native invalid, concurrent and storage-rejected settings preserve config and draft',async()=>{
 const h=await host();await h.cmd('pause');let pane=await settingsPanel(h);
 find(pane,'qm-setting-retries').onInput('6');await find(pane,'qm-settings-save').onPress();assert.equal(h.state().config.retries,0);
 find(pane,'qm-setting-retries').onInput('2');await h.cmd('retry 1 2s');await find(pane,'qm-settings-save').onPress();assert.equal(h.state().config.retries,1);
 pane=await h.emit('ui.render',{component:'Pane',props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 assert.equal(find(pane,'qm-setting-retries').value,'2');await find(pane,'qm-settings-reset').onPress();
 pane=await h.emit('ui.render',{component:'Pane',props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 assert.equal(find(pane,'qm-setting-retries').value,'1');find(pane,'qm-setting-retries').onInput('3');
 const original=h.tools.store.set;h.tools.store.set=async()=>{throw new Error('disk full');};
 await find(pane,'qm-settings-save').onPress();h.tools.store.set=original;
 assert.equal(h.state().config.retries,1);
 pane=await h.emit('ui.render',{component:'Pane',props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 assert.equal(find(pane,'qm-setting-retries').value,'3');
});

test('native settings refuse to alter a running queue task',async()=>{
 const h=await host();await h.cmd('pause');let pane=await settingsPanel(h);
 find(pane,'qm-setting-retries').onInput('2');await h.cmd('add work');await h.cmd('resume');
 await new Promise(r=>setImmediate(r));await find(pane,'qm-settings-save').onPress();
 assert.equal(h.state().config.retries,0);
 assert.equal(configSignature(h.state().config),configSignature(DEFAULT_CONFIG));
});

test('native typing during a pending save remains a separate unsaved draft',async()=>{
 const h=await host();await h.cmd('pause');const pane=await settingsPanel(h);
 const field=find(pane,'qm-setting-retries');field.onInput('2');
 const original=h.tools.store.set;let ready,release;
 const waiting=new Promise(resolve=>ready=resolve),gate=new Promise(resolve=>release=resolve);
 h.tools.store.set=async(key,value)=>{ready();await gate;return original(key,value);};
 const saving=find(pane,'qm-settings-save').onPress();await waiting;field.onInput('3');release();await saving;h.tools.store.set=original;
 assert.equal(h.state().config.retries,2);
 const refreshed=await h.emit('ui.render',{component:'Pane',props:{},surface:'desktop'},{component:'Pane',requestId:'qm'});
 assert.equal(find(refreshed,'qm-setting-retries').value,'3');await find(refreshed,'qm-settings-save').onPress();assert.equal(h.state().config.retries,3);
});

test('native retry-last button queues exactly one failed task and leaves it paused',async()=>{
 const h=await host();await h.cmd('verify marker');await h.cmd('add work');await flush();
 await h.emit('turn.start',{turnId:'failed'});await h.emit('turn.complete',{turnId:'failed',reason:'answer',answer:'QM_FAIL'});await flush();
 assert.equal(h.state().history[0].status,'failure');assert.equal(h.sent.length,1);
 const pane=await settingsPanel(h);assert.equal(find(pane,'qm-retry-last').disabled,false);
 await find(pane,'qm-retry-last').onPress();await flush();
 assert.equal(h.state().pending.length,1);assert.equal(h.state().pending[0].text,'work');assert.equal(h.state().paused,true);assert.equal(h.sent.length,1);
});

