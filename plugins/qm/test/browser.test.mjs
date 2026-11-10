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
 const context={document,location:{hash:'#token='+'a'.repeat(48)},URLSearchParams,
  setInterval:fn=>{refresh=fn;},setTimeout:()=>1,clearTimeout(){},
  fetch:async(path,init)=>{
   if(path==='/api/action')return{ok:!reject,status:reject?409:202,json:async()=>reject?{error:'stale'}:{accepted:1}};
   return{ok:true,status:200,json:async()=>({state,revision:1,lastAck:ack})};
  }};
 vm.runInNewContext(await readFile(new URL('../web/app.js',import.meta.url),'utf8'),context);
 await flush();get('tasks-input').value='keep me';reject=true;await get('add-tasks').onclick();
 assert.equal(get('tasks-input').value,'keep me');
 reject=false;await get('add-tasks').onclick();assert.equal(get('tasks-input').value,'keep me');
 ack={id:1,ok:false,error:'capacity'};await refresh();assert.equal(get('tasks-input').value,'keep me');
 ack=null;await get('add-tasks').onclick();ack={id:1,ok:true};await refresh();assert.equal(get('tasks-input').value,'');
 ack=null;get('tasks-input').value='original';await get('add-tasks').onclick();get('tasks-input').value='new draft';
 ack={id:1,ok:true};await refresh();assert.equal(get('tasks-input').value,'new draft');
});
