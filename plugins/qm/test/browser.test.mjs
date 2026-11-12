import { LANGUAGES, EXTRA_MESSAGES, RECOVERY_MESSAGES, canonicalLocale } from '../src/locales.mjs';
import {configDraft,parseSettings,configSignature,FORM_KEYS} from '../src/settings.mjs';
import {settingsStrings} from '../src/settings-locales.mjs';
import {DEFAULT_CONFIG} from '../src/queue.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { flush } from './helpers.mjs';

function element() {
 return {value:'',textContent:'',style:{},className:'',firstChild:{textContent:''},children:[],
  classList:{add(){},remove(){},toggle(){}},append(...xs){this.children.push(...xs);},
  replaceChildren(...xs){this.children=xs;},setAttribute(){},addEventListener(){}};
}
test('browser keeps rejected drafts, clears only acknowledged unchanged drafts',async()=>{
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 let refresh, ack=null, reject=false;
 const document={getElementById:get,createElement:element,documentElement:{}};
 const state={pending:[],done:[],running:null,paused:true,busy:false};
 const context={LANGUAGES,EXTRA_MESSAGES,RECOVERY_MESSAGES,canonicalLocale,configDraft,parseSettings,configSignature,FORM_KEYS,settingsStrings,document,location:{hash:'#token='+'a'.repeat(48)},URLSearchParams,
  setInterval:fn=>{refresh=fn;},setTimeout:()=>1,clearTimeout(){},
  fetch:async(path,init)=>{
   if(path==='/api/action')return{ok:!reject,status:reject?409:202,json:async()=>reject?{error:'stale'}:{accepted:1}};
   return{ok:true,status:200,json:async()=>({state,revision:1,lastAck:ack})};
  }};
 vm.runInNewContext((await readFile(new URL('../web/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,''),context);
 await flush();get('tasks-input').value='keep me';reject=true;await get('add-tasks').onclick();
 assert.equal(get('tasks-input').value,'keep me');
 reject=false;await get('add-tasks').onclick();assert.equal(get('tasks-input').value,'keep me');
 ack={id:1,ok:false,error:'capacity'};await refresh();assert.equal(get('tasks-input').value,'keep me');
 ack=null;await get('add-tasks').onclick();ack={id:1,ok:true};await refresh();assert.equal(get('tasks-input').value,'');
 ack=null;get('tasks-input').value='original';await get('add-tasks').onclick();get('tasks-input').value='new draft';
 ack={id:1,ok:true};await refresh();assert.equal(get('tasks-input').value,'new draft');
});

test('browser settings keep drafts until durable ack and preserve rejected edits',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 let refresh,ack=null,operation=null,accepted=0,rejectSettings=false;
 const state={pending:[],done:[],running:null,paused:true,busy:false,config:{...DEFAULT_CONFIG},defaults:{...DEFAULT_CONFIG}};
 const context={LANGUAGES,EXTRA_MESSAGES,RECOVERY_MESSAGES,canonicalLocale,configDraft,parseSettings,configSignature,FORM_KEYS,settingsStrings,
 document:{getElementById:get,createElement:element,documentElement:{}},location:{hash:'#token='+'a'.repeat(48)},URLSearchParams,
 setInterval:fn=>{refresh=fn;},setTimeout:()=>1,clearTimeout(){},
 fetch:async(path,init)=>{
   if(path==='/api/action'){operation=JSON.parse(init.body).operation;if(rejectSettings)return{ok:false,status:400,json:async()=>({error:'stale'})};return{ok:true,status:202,json:async()=>({accepted:++accepted})};}
   return{ok:true,status:200,json:async()=>({state,revision:1,lastAck:ack})};
 }};
 vm.runInNewContext((await readFile(new URL('../web/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,''),context);
 await flush();get('setting-retries').oninput({target:{value:'2'}});await get('settings-form').onsubmit({preventDefault(){}});
 assert.equal(operation.type,'configure');assert.equal(operation.updates.retries,2);assert.equal(state.config.retries,0);
 assert.equal(get('settings-fields').disabled,true);assert.equal(get('setting-retries').value,'2');
 ack={id:1,ok:false,error:'stale'};await refresh();assert.equal(get('setting-retries').value,'2');assert.ok(get('settings-status').textContent);
 get('settings-reset').onclick();assert.equal(get('setting-retries').value,'0');
 get('setting-retries').oninput({target:{value:'3'}});await get('settings-form').onsubmit({preventDefault(){}});
 state.config={...state.config,retries:3};ack={id:2,ok:true};await refresh();assert.equal(get('setting-retries').value,'3');
 assert.equal(get('settings-fields').disabled,false);assert.equal(get('settings-status').textContent,'');
 rejectSettings=true;get('setting-retries').oninput({target:{value:'4'}});await get('settings-form').onsubmit({preventDefault(){}});
 assert.equal(get('setting-retries').value,'4');assert.equal(get('settings-status').textContent,settingsStrings('tr').stale);
 rejectSettings=false;await get('settings-defaults').onclick();
 assert.deepEqual(operation.updates,DEFAULT_CONFIG);assert.equal(state.config.retries,3,'reset is not saved before acknowledgement');
 state.config={...DEFAULT_CONFIG};ack={id:3,ok:true};await refresh();
 assert.equal(get('setting-retries').value,'0');assert.equal(state.paused,true);
});

