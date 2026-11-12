import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {initialState,enqueue,undo,redo,claim,settleTurn,normalizeState,edit} from '../src/queue.mjs';
import {archiveQueue,parseArchive,restoreArchive,stallInfo} from '../src/backups.mjs';
import {backupFiles} from '../src/backup-files.mjs';
import {reliabilityStrings} from '../src/reliability-locales.mjs';
import {LANGUAGES} from '../src/locales.mjs';
import {host,find,flush} from './helpers.mjs';
import {parseCommand} from '../src/commands.mjs';

test('redo restores undone text and a new edit invalidates its branch',()=>{
 let s=enqueue(initialState('x'),['A','B']);s=edit(s,1,'edited');s=undo(s);
 assert.equal(s.pending[0].text,'A');s=redo(s);assert.equal(s.pending[0].text,'edited');assert.equal(s.paused,true);
 s=undo(s);s=enqueue(s,['C']);assert.throws(()=>redo(s));
});
test('redo never resurrects started tasks even after history retention expires',()=>{
 let s=enqueue(initialState('x'),['A','B']);s=edit(s,2,'B2');s=undo(s);s=claim(s,1).state;
 s=settleTurn(s,'success',2);s={...s,history:[],done:[]};s=redo(s);
 assert.deepEqual(s.pending.map(x=>x.text),['B2']);
 assert.equal(normalizeState(s,'x').redo.length,0);
});
test('archive validation and deliberate restore preserve settings, conditions and history',()=>{
 let s=enqueue(initialState('x'),['old']);const a=archiveQueue(enqueue(initialState('source'),['new'],'end',1,'success'));
 s.config.retries=4;s.history=[{id:5,text:'done'}];s.nextId=6;
 const r=restoreArchive(s,a,JSON.stringify(s.pending),100);
 assert.equal(r.paused,true);assert.equal(r.pending[0].when,'success');assert.equal(r.pending[0].id,6);
 assert.equal(r.config.retries,4);assert.equal(r.history[0].text,'done');assert.deepEqual(undo(r).pending,s.pending);
 for(const invalid of ['bad','{}',JSON.stringify({...a,pending:[{text:'',when:'always'}]})])assert.throws(()=>parseArchive(invalid));
 assert.throws(()=>restoreArchive({...s,busy:true},a,JSON.stringify(s.pending)),/archiveBusy/);
 assert.throws(()=>restoreArchive(s,a,'[]'),/archiveStale/);
});
test('automatic files survive independent reads, reject traversal and retain manual exports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qm-backup-test-'));
 try{
  const a=archiveQueue(enqueue(initialState('source'),['long\nTürkçe 👋']));
  const saved=await backupFiles('write','source',a,dir),exported=await backupFiles('export','source',a,dir);
  let rows=await backupFiles('list','source',null,dir);assert.equal(rows.length,1);
  assert.equal((await backupFiles('read','source',rows[0].id,dir)).pending[0].text,a.pending[0].text);
  assert.equal((await backupFiles('import','target',exported.path,dir)).pending.length,1);
  await assert.rejects(backupFiles('read','source','../../file.json',dir));
  for(let i=0;i<52;i++)await backupFiles('write','source',a,dir);
  rows=await backupFiles('list','source',null,dir);assert.equal(rows.length,50);
  assert.equal(JSON.parse(await readFile(exported.path,'utf8')).format,'qm-backup');
  assert.equal((await readdir(join(saved.path,'..'))).some(x=>x.endsWith('.tmp')),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('stdin helper handles long payload without exposing task text in argv',async()=>{
 // Exercise the actual CLI in an isolated home; never use the user's backup directory.
 const dir=await mkdtemp(join(tmpdir(),'qm-backup-cli-'));
 try{
  const archive=archiveQueue(enqueue(initialState('x'),['x'.repeat(19000)]));
  const output=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['plugins/qm/src/backup-files.mjs'],{env:{...process.env,USERPROFILE:dir,HOME:dir}});
   let out='',error='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>error+=x);
   child.on('error',reject);child.on('close',code=>code?reject(new Error(error)):resolve(JSON.parse(out)));
   child.stdin.end(JSON.stringify({action:'write',session:'x',payload:archive}));
  });
  assert.ok(output.path.startsWith(dir));assert.equal(JSON.parse(await readFile(output.path,'utf8')).pending[0].text.length,19000);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('native backup restore previews, rejects stale state and redo stays paused',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('batch A || B');await h.cmd('edit 1 edited');await h.cmd('undo');await h.cmd('redo');assert.equal(h.state().pending[0].text,'edited');assert.equal(h.state().paused,true);
 await h.cmd('backups');let ui=await h.emit('ui.render',{component:'Pane',surface:'desktop',props:{bodyColumns:48}},{component:'Pane',requestId:'qm'});
 const button=ui.children.flatMap(function walk(x){return [x,...(x.children||[]).flatMap(walk)]}).find(x=>x.key?.startsWith('qm-backup-')&&!['qm-backup-close','qm-backup-restore'].includes(x.key));
 assert.ok(button);await button.onPress();await h.cmd('add C');
 ui=await h.emit('ui.render',{component:'Pane',surface:'desktop',props:{bodyColumns:48}},{component:'Pane',requestId:'qm'});
 await find(ui,'qm-backup-restore').onPress();assert.equal(h.state().pending.length,3);assert.equal(h.sent.length,0);
});
test('backup failure blocks destructive change without altering committed queue',async()=>{
 const h=await host();await h.cmd('pause');await h.cmd('add keep me');
 h.tools.process.run=async()=>({exitCode:1,stderr:'disk full'});
 const result=await h.cmd('clear');assert.match(result.text,/QM error/);assert.equal(h.state().pending[0].text,'keep me');
});
test('missing Node reports unavailable backups without disabling the existing native queue',async()=>{
 const h=await host();h.tools.process.run=async()=>{throw new Error('spawn node ENOENT');};
 await h.cmd('pause');await h.cmd('add still usable');
 assert.equal(h.state().pending[0].text,'still usable');assert.ok(h.notices.some(x=>/Node.js 20/.test(x)));
 await h.cmd('edit 1 edited');assert.equal(h.state().pending[0].text,'edited');
});
test('stall warning is observational; locales and reserved commands remain complete',()=>{
 let s=claim(enqueue(initialState('x'),['A']),100).state;
 assert.equal(stallInfo(s,1000),null);assert.ok(stallInfo(s,1800100));assert.equal(s.running.text,'A');
 s.config.timeoutMs=2000;assert.ok(stallInfo(s,2100));assert.equal(stallInfo({...s,recoverable:true},9999999),null);
 for(const lang of LANGUAGES)for(const value of Object.values(reliabilityStrings(lang.value)))assert.equal(typeof value,'string');
 assert.equal(parseCommand('redo').type,'redo');assert.equal(parseCommand('backups').type,'backups');assert.equal(parseCommand('import "C:/backup file.json"').path,'C:/backup file.json');assert.throws(()=>parseCommand('import'));
});

