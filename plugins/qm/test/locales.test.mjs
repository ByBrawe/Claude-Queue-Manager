import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES,canonicalLocale} from '../src/locales.mjs';
import {uiStrings,SUPPORTED_UI_LANGUAGES} from '../src/view.mjs';
import {parseCommand} from '../src/commands.mjs';
import {host,find} from './helpers.mjs';

test('all 20 documented languages have complete native keys and canonical commands',()=>{
 assert.equal(LANGUAGES.length,20);assert.equal(SUPPORTED_UI_LANGUAGES.length,20);
 const required=Object.keys(uiStrings('en'));
 for(const {value} of LANGUAGES){
  const strings=uiStrings(value);
  for(const key of required)assert.ok(typeof strings[key]==='string'&&strings[key].length,`${value}.${key}`);
  assert.equal(parseCommand(`lang ${value.toLowerCase()}`).code,value);
 }
 assert.equal(canonicalLocale('PT-br'),'pt-BR');assert.throws(()=>parseCommand('lang xx'));
});
test('all 20 native language choices persist through a fresh mod instance',async()=>{
 for(const {value} of LANGUAGES){
  const memory=new Map(),a=await host({memory});
  await a.cmd(`lang ${value}`);
  const b=await host({memory});await b.cmd('');
  const ui=await b.emit('ui.render',{component:'AbovePrompt',surface:'desktop',props:{bodyColumns:48}},{component:'AbovePrompt'});
  assert.equal(find(ui,'qm-language').value,value);
  assert.equal(find(ui,'qm-language').options.length,20);
 }
});

