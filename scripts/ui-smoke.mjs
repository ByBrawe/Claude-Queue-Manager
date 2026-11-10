import { LANGUAGES } from '../plugins/qm/src/locales.mjs';
// Optional visual QA. Install Playwright outside the plugin, then set
// QM_PLAYWRIGHT_MODULE to its index.mjs file URL if it is not on the module path.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDashboard } from '../plugins/qm/web/server.mjs';
import { initialState, enqueue, reorderByIds, removeByIds } from '../plugins/qm/src/queue.mjs';
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
  if(op.type==='pause'||op.type==='resume')state={...state,paused:op.type==='pause'};
  await post({id:action.id,ok:true});
 }catch(e){await post({id:action.id,ok:false,error:e.message});}
},100);
const browser=await chromium.launch({headless:true});
const errors=[],checks=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of (process.env.QM_QA_FAST?[]:[1440,900,390]))for(const count of [0,3,20,200])for(const locale of ['en','tr']){
  await seed(count);await page.setViewportSize({width,height:1000});await page.goto(base+'/#token='+token);
  await page.selectOption('#locale',locale);await page.waitForFunction(n=>document.querySelectorAll('.row-task').length===n,count);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}/${count}/${locale}`);
  await page.screenshot({path:`${out}/web-${width}-${count}-${locale}.png`,fullPage:true});
  checks.push({width,count,locale,overflow:false});
 }
 for(const lang of LANGUAGES){await seed(3);await page.setViewportSize({width:900,height:1000});await page.goto(base+'/#token='+token);await page.selectOption('#locale',lang.value);await page.waitForFunction(code=>document.documentElement.lang===code,lang.value);assert.equal(await page.locator('#locale option').count(),20);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#add-tasks').innerText().then(x=>x.length>0),true);await page.screenshot({path:`${out}/language-${lang.value}.png`,fullPage:true});}
 await seed(3);await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/#token='+token);await page.waitForFunction(()=>document.querySelectorAll('.row-task').length===3);
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
 await page.route('**/api/state',r=>r.abort());await page.waitForTimeout(1600);assert.equal(await page.locator('#connection-error').isVisible(),true);
 assert.equal(await page.locator('#add-tasks').isDisabled(),true);
 await page.unroute('**/api/state');await page.waitForTimeout(1600);assert.equal(await page.locator('#connection-error').isVisible(),false);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/visual-results.json`,JSON.stringify({checks,interactions:['multi-select','drag reorder','repeat','delete confirmation','disconnect','reconnect'],pageErrors:errors},null,2));
 console.log(`${checks.length} layout captures and 6 interaction checks passed; no browser errors.`);
}finally{clearInterval(timer);await browser.close();await app.close();}

