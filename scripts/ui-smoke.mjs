import { LANGUAGES } from '../plugins/qm/src/locales.mjs';
// Optional visual QA. Install Playwright outside the plugin, then set
// QM_PLAYWRIGHT_MODULE to its index.mjs file URL if it is not on the module path.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDashboard } from '../plugins/qm/web/server.mjs';
import { DEFAULT_CONFIG, initialState, enqueue, reorderByIds, removeByIds, configure, retryLast } from '../plugins/qm/src/queue.mjs';
import { settingsGuard } from '../plugins/qm/src/settings.mjs';
const { chromium } = await import(process.env.QM_PLAYWRIGHT_MODULE || 'playwright');
const out=fileURLToPath(new URL('../artifacts/',import.meta.url));await mkdir(out,{recursive:true});
const token='b'.repeat(48), app=createDashboard({token}), port=await app.listen();
const base=`http://127.0.0.1:${port}`;
let state, revision=0;
const post=async ack=>{
 await fetch(base+'/api/state',{method:'POST',headers:{'X-QM-Token':token,'Content-Type':'application/json'},body:JSON.stringify({revision:++revision,state,ack})});
};
const seed=async n=>{
 state={...initialState('visual-qa-session'),paused:true,context:{tokens:64000,window:200000,percent:32}};
 state=enqueue(state,Array.from({length:Math.max(1,n)},(_,i)=>`Task ${i+1}: Review implementation / Uygulamayı incele`));
 if(n===0)state.pending=[];
 await post();
};
const timer=setInterval(async()=>{
 const action=app.getState().waitingAction;if(!action)return;
 try{
  if(action.revision!==app.getState().revision)throw new Error('Queue changed; refresh');
  const op=action.operation;
  if(op.type==='add')state=enqueue(state,op.texts);
  if(op.type==='reorder')state=reorderByIds(state,op.ids);
  if(op.type==='remove')state=removeByIds(state,op.ids);
  if(op.type==='configure'){settingsGuard(state,op.base);state=configure(state,op.updates);}
  if(op.type==='retry-last')state=retryLast(state);
  if(op.type==='pause'||op.type==='resume')state={...state,paused:op.type==='pause'};
  await post({id:action.id,ok:true});
 }catch(e){await post({id:action.id,ok:false,error:e.message});}
},100);
const browser=await chromium.launch({headless:true});
const errors=[],checks=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of (process.env.QM_QA_FAST?[]:[1440,900,390]))for(const count of [0,3,20,200])for(const locale of ['en','tr']){
  await seed(count);await page.setViewportSize({width,height:1000});await page.goto(base+'/?qa='+revision+'#token='+token);
  await page.selectOption('#locale',locale);await page.waitForFunction(n=>document.querySelectorAll('.row-task').length===n,count);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}/${count}/${locale}`);
  await page.screenshot({path:`${out}/web-${width}-${count}-${locale}.png`,fullPage:true});
  checks.push({width,count,locale,overflow:false});
 }
 for(const lang of LANGUAGES){await seed(3);await page.setViewportSize({width:900,height:1000});await page.goto(base+'/?qa='+revision+'#token='+token);await page.selectOption('#locale',lang.value);await page.waitForFunction(code=>document.documentElement.lang===code,lang.value);assert.equal(await page.locator('#locale option').count(),20);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#add-tasks').innerText().then(x=>x.length>0),true);await page.click('#settings-title');await page.waitForFunction(()=>document.querySelector('#setting-retries').value!=='');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${out}/language-${lang.value}.png`,fullPage:true});}
 await seed(3);await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?qa='+revision+'#token='+token);await page.waitForFunction(()=>document.querySelectorAll('.row-task').length===3);
 await page.selectOption('#locale','en');
 const order=()=>state.pending.map(x=>x.id);
 await page.locator('.task-check').nth(0).check();await page.locator('.task-check').nth(1).check();await page.click('#move-bottom');
 try{await page.waitForFunction(()=>document.querySelector('.row-task')?.dataset.taskId==='3',{},{timeout:5000});}catch(e){console.log(JSON.stringify({server:app.getState(),text:await page.locator('body').innerText(),errors},null,2));throw e;}assert.deepEqual(order(),[3,1,2]);
 await page.click('#undo-selection');
 const old=order();await page.locator('.row-task').first().dragTo(page.locator('.row-task').last());
 await page.waitForTimeout(1500);assert.notDeepEqual(order(),old,'drag reorder');
 await page.fill('#repeat-count','3');await page.fill('#repeat-message','Repeated task');await page.click('#repeat-add');
 await page.waitForFunction(()=>document.querySelectorAll('.row-task').length===6);assert.equal(state.pending.filter(x=>x.text==='Repeated task').length,3);
 await page.click('#select-all');await page.click('#delete-selected');assert.equal(state.pending.length,6,'delete needs confirmation');
 await page.click('#cancel-confirm');assert.equal(state.pending.length,6);
 await page.click('#settings-title');
 await page.fill('#setting-retries','2');await page.fill('#setting-retryDelay','5');
 await page.selectOption('#setting-verify','marker');
 const settingsAck=page.waitForResponse(async response=>{
   if(!response.url().includes('/api/state')||response.request().method()!=='GET')return false;
   const data=await response.json();return data.lastAck?.ok&&data.state?.config?.retries===2;
 });
 await page.click('#settings-save');await settingsAck;
 await page.waitForFunction(()=>!document.querySelector('#settings-fields').disabled&&document.querySelector('#setting-retries').value==='2');
 assert.equal(state.config.retries,2);assert.equal(state.config.retryDelayMs,5000);assert.equal(state.config.verify,'marker');assert.equal(state.paused,true);
 await page.fill('#setting-retries','4');state=configure(state,{retries:3});await post();
 await page.waitForTimeout(1400);await page.click('#settings-save');await page.waitForTimeout(1400);
 assert.equal(state.config.retries,3);assert.equal(await page.inputValue('#setting-retries'),'4');
 await page.click('#settings-reset');assert.equal(await page.inputValue('#setting-retries'),'3');
 const defaultsAck=page.waitForResponse(async response=>{
   if(!response.url().includes('/api/state')||response.request().method()!=='GET')return false;
   const data=await response.json();return data.lastAck?.ok&&data.state?.config?.retries===0;
 });
 await page.click('#settings-defaults');await defaultsAck;
 await page.waitForFunction(()=>!document.querySelector('#settings-fields').disabled&&document.querySelector('#setting-retries').value==='0');
 assert.deepEqual(state.config,DEFAULT_CONFIG);assert.equal(state.pending.length,6);assert.equal(state.paused,true);
 for(const width of [1440,900,390])for(const locale of ['en','tr']){
   await page.setViewportSize({width,height:1000});await page.selectOption('#locale',locale);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'settings overflow '+width);
   await page.screenshot({path:`${out}/settings-${width}-${locale}.png`,fullPage:true});
 }
 await page.route('**/api/state',r=>r.abort());await page.waitForTimeout(1600);assert.equal(await page.locator('#connection-error').isVisible(),true);
 assert.equal(await page.locator('#add-tasks').isDisabled(),true);
 await page.unroute('**/api/state');await page.waitForTimeout(1600);assert.equal(await page.locator('#connection-error').isVisible(),false);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/visual-results.json`,JSON.stringify({checks,settingsCaptures:6,interactions:['multi-select','drag reorder','repeat','delete confirmation','settings save','settings conflict','settings defaults','disconnect','reconnect'],pageErrors:errors},null,2));
 console.log(`${checks.length} queue captures, 6 settings captures and 9 interaction checks passed; no browser errors.`);
}finally{clearInterval(timer);await browser.close();await app.close();}

