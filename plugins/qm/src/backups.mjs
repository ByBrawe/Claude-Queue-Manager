// Portable pending-work archive. Restores are deliberate copies, never dispatches.
import { MAX_PENDING, normalizeConfig } from './queue.mjs';
export const ARCHIVE_LIMIT=3*1024*1024;
export function archiveQueue(state,now=Date.now()) {
  return {format:'qm-backup',version:1,sessionId:state.sessionId,createdAt:now,
    pending:state.pending.map(({text,when})=>({text,when:when||'always'})),
    config:{...state.config},orphan:state.running?{text:state.running.text}:null};
}
export function parseArchive(value) {
  const text=typeof value==='string'?value:JSON.stringify(value);
  if(new TextEncoder().encode(text).length>ARCHIVE_LIMIT)throw new Error('archiveInvalid');
  let x;try{x=JSON.parse(text);}catch{throw new Error('archiveInvalid');}
  if(x?.format!=='qm-backup'||x.version!==1||!Array.isArray(x.pending)||x.pending.length>MAX_PENDING)throw new Error('archiveInvalid');
  if(x.pending.some(t=>!t||typeof t.text!=='string'||!t.text.trim()||t.text.length>20000||!['always','success','failure'].includes(t.when)))throw new Error('archiveInvalid');
  return {format:'qm-backup',version:1,sessionId:String(x.sessionId||'').slice(0,150),
    createdAt:Number.isFinite(x.createdAt)&&Math.abs(x.createdAt)<=8640000000000000?x.createdAt:0,pending:x.pending.map(t=>({text:t.text,when:t.when})),
    config:normalizeConfig(x.config),orphan:x.orphan?{text:String(x.orphan.text||'').slice(0,20000)}:null};
}
export function restoreArchive(state,value,base,now=Date.now()) {
  if(state.running||state.busy||state.recoverable)throw new Error('archiveBusy');
  if(base!==JSON.stringify(state.pending))throw new Error('archiveStale');
  const x=parseArchive(value);
  // Fresh IDs avoid collisions with tasks already executed in this session.
  const nextId=state.nextId||Math.max(1,...state.pending.map(t=>t.id+1));
  const pending=x.pending.map((t,i)=>({...t,id:nextId+i,attempts:0,createdAt:now}));
  return {...state,pending,nextId:nextId+pending.length,paused:true,pauseReason:'restored-needs-review',singleRun:null,
    undo:[{pending:state.pending,paused:state.paused},...(state.undo||[])].slice(0,10),redo:[]};
}
export function stallInfo(state,now) {
  if(!state.running||state.recoverable)return null;
  const elapsed=Math.max(0,now-state.running.startedAt);
  const threshold=state.config.timeoutMs||30*60*1000;
  return Number.isFinite(elapsed)&&elapsed>=threshold?{elapsed,threshold}:null;
}

