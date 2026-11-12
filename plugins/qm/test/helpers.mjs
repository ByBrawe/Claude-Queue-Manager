import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
let sequence = 0;
export const flush = async () => { for (let i=0;i<30;i++) await new Promise(r=>setImmediate(r)); };
export function find(tree,key) { if(tree?.key===key)return tree;for(const x of tree?.children??[]){const r=find(x,key);if(r)return r;} }
export async function host({ memory = new Map(), quota = 4*1024*1024, lockDir } = {}) {
  const {register} = await import(`../hooks/register.mjs?regression=${++sequence}`);
  let id=`regression-${sequence}`;
  const snapshots=[];
  const events=[],sent=[],notices=[];
  const tools={
    plugin:{root:fileURLToPath(new URL('../',import.meta.url))},
    process:{run:async (argv,init)=>{
 if(argv[1]?.endsWith('backup-files.mjs')){try{const x=JSON.parse(init.stdin);if(x.action==='write')snapshots.push(structuredClone(x.payload));return{exitCode:0,stdout:JSON.stringify(x.action==='list'?snapshots.map((v,i)=>({id:String(i),count:v.pending.length,createdAt:v.createdAt,preview:v.pending.slice(0,3).map(t=>t.text)})):x.action==='read'?snapshots[Number(x.payload)]:{path:'test-backup.json'})};}catch(error){return{exitCode:1,stderr:error.message};}}
      const args=argv.slice(1);
      if(lockDir && args[0]?.endsWith('restore-lock.mjs'))args.push(lockDir);
      try { const r=await run(argv[0],args);return{exitCode:0,...r}; }
      catch(e){return{exitCode:e.code||1,stdout:e.stdout||'',stderr:e.stderr||String(e)};}
    }},
    session:{id:async()=>id,usage:async()=>({context:{tokens:1000,window:200000}})},
    store:{get:async k=>structuredClone(memory.get(k)),keys:async()=>[...memory.keys()],set:async(k,v)=>{
      const all=Object.fromEntries(memory);all[k]=v;
      if(new TextEncoder().encode(JSON.stringify(all)).length>quota)throw new Error('Store exceeds 4 MiB');
      memory.set(k,structuredClone(v));
    }},
    clock:{now:async()=>1000,after:()=>({cancel(){}})},
    ui:{invalidate(){},log(){},toast:x=>notices.push(x),close:async()=>{},open:async()=>{},resolve:()=>({Box:x=>x,Text:x=>x,Button:x=>x,Input:x=>x,Select:x=>x})},
    command:{register:async()=>{}},
    prompt:{submit:async x=>{sent.push(x);return{};}}
  };
  register((name,opts,fn)=>events.push({name,filter:typeof opts==='function'?{}:opts,fn:typeof opts==='function'?opts:fn}));
  const emit=async(name,e={},filter={})=>{
    const h=events.find(x=>x.name===name&&Object.entries(filter).every(([k,v])=>x.filter[k]===v));
    if(!h)throw new Error(`Missing hook ${name}`);
    return h.fn(tools,e,x=>x);
  };
  const cmd=args=>emit('command.run',{args},{command:'qm'});
  await emit('session.start');
  return{tools,cmd,emit,sent,notices,memory,state:()=>memory.get(`claude-queue-manager:queue:${id}`),switchId:x=>id=x,id:()=>id};
}

