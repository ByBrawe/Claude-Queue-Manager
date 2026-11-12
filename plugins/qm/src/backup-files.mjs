// Isolated Node helper: atomic, private files outside the bounded plugin store.
import { mkdir,open,rename,readdir,readFile,stat,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash,randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArchive,ARCHIVE_LIMIT } from './backups.mjs';
export const backupRoot=()=>join(homedir(),'.claude','qm-backups');
const sessionDir=(root,id)=>join(root,createHash('sha256').update(id).digest('hex'));
export async function backupFiles(action,session,payload=null,root=backupRoot()) {
  const dir=sessionDir(root,session);
  if(action==='list') {
    let listing;try{listing=await readdir(dir);}catch(error){if(error.code==='ENOENT')return [];throw error;}
    const names=listing.filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse();
    return Promise.all(names.slice(0,50).map(async id=>{const x=parseArchive(await readFile(join(dir,id),'utf8'));return {id,createdAt:x.createdAt,count:x.pending.length,preview:x.pending.slice(0,3).map(t=>t.text.slice(0,100))};}));
  }
  if(action==='read') {
    if(!/^\d+-[a-f0-9-]+\.json$/.test(payload))throw new Error('archiveInvalid');
    return parseArchive(await readFile(join(dir,payload),'utf8'));
  }
  if(action==='import') {
    if(typeof payload!=='string'||!payload.endsWith('.json'))throw new Error('archiveInvalid');
    if((await stat(payload)).size>ARCHIVE_LIMIT)throw new Error('archiveInvalid');
    return parseArchive(await readFile(payload,'utf8'));
  }
  if(!['write','export'].includes(action))throw new Error('archiveInvalid');
  await mkdir(dir,{recursive:true,mode:0o700});
  const x=parseArchive(payload),data=JSON.stringify(x);
  const name=`${Date.now()}-${randomUUID()}.json`,target=join(dir,(action==='export'?'export-':'')+name),temp=target+'.tmp';
  const handle=await open(temp,'wx',0o600);
  try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}
  await rename(temp,target);
  // Never prune manual exports. Bound automatic snapshots to 50 / 32 MiB per session.
  const names=(await readdir(dir)).filter(n=>/^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse();
  let bytes=0;
  for(let i=0;i<names.length;i++){const path=join(dir,names[i]);bytes+=(await stat(path)).size;if(i>=50||bytes>32*1024*1024)await unlink(path);}
  return {path:target};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>ARCHIVE_LIMIT+4096)throw new Error('archiveInvalid');}
    const {action,session,payload}=JSON.parse(input);
    console.log(JSON.stringify(await backupFiles(action,session,payload)));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

