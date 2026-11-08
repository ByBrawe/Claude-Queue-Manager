import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboard } from '../web/server.mjs';
import http from 'node:http';
import { initialState, enqueue, reorderByIds, removeByIds, moveSelected } from '../src/queue.mjs';

const TOKEN = 'a'.repeat(48);
const api = (port, path) => `http://127.0.0.1:${port}/api/${path}`;
const options = (method = 'GET', data, auth = true) => ({
  method,
  headers: { ...(auth ? { 'x-qm-token': TOKEN } : {}), ...(data ? { 'content-type': 'application/json' } : {}) },
  ...(data ? { body: JSON.stringify(data) } : {})
});

test('stable-ID reorder and multi-select remove cannot corrupt active task', () => {
  let s = enqueue(initialState('session'), ['A','B','C','D']);
  s = { ...s, running: { id: 20, text: 'ACTIVE' }, busy: true };
  const b = s.pending.map(x => x.id);
  const rearranged = reorderByIds(s, [b[2],b[0],b[3],b[1]]);
  assert.deepEqual(rearranged.pending.map(x => x.text), ['C','A','D','B']);
  assert.equal(rearranged.running.text, 'ACTIVE');
  const moved = moveSelected(rearranged, [b[1],b[0]], 'front');
  assert.deepEqual(moved.pending.map(x => x.text), ['A','B','C','D']);
  assert.deepEqual(removeByIds(moved, [b[1],b[3]]).pending.map(x => x.text), ['A','C']);
  assert.throws(() => reorderByIds(moved, [b[1],b[1],b[2],b[3]]),/duplicate/);
  assert.throws(() => reorderByIds(moved, [b[1]]),/every pending/);
  assert.throws(() => removeByIds(moved,[9999]),/stale/);
  assert.throws(() => moveSelected(moved,[b[0],b[0]],'front'),/stale/);
});

test('browser dashboard enforces token, loopback host, origin, revision, operation ack', async t => {
  const app = createDashboard({ token: TOKEN });
  const port = await app.listen();
  t.after(() => app.close());
  const unauthorized = await fetch(api(port,'state'),options('GET',undefined,false));
  assert.equal(unauthorized.status,401);
  const wrongHost = await new Promise(resolve => {
    http.get({ hostname:'127.0.0.1',port,path:'/api/state',headers:{host:'evil.example','x-qm-token':TOKEN}}, response => {
      response.resume(); response.on('end',()=>resolve(response.statusCode));
    });
  });
  assert.equal(wrongHost,403);
  const wrongOrigin = await fetch(api(port,'action'),{
    ...options('POST',{revision:1,operation:{type:'pause'}}),
    headers:{...options('POST',{},true).headers,origin:'https://evil.example'}
  });
  assert.equal(wrongOrigin.status,403);
  const homepage = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(homepage.status,200);
  assert.match(homepage.headers.get('content-security-policy'),/default-src 'none'/);
  assert.match(await homepage.text(),/Queue Manager/);
  const initial = {pending:[{id:1,text:'A'},{id:2,text:'B'}],done:[],running:null,paused:true,busy:false};
  assert.equal((await fetch(api(port,'state'),options('POST',{revision:1,state:initial}))).status,200);
  assert.equal((await fetch(api(port,'action'),options('POST',{
    revision:0,operation:{type:'reorder',ids:[2,1]}
  }))).status,409);
  const queued = await fetch(api(port,'action'),options('POST',{
    revision:1,operation:{type:'reorder',ids:[2,1]}
  }));
  assert.equal(queued.status,202);
  assert.equal((await fetch(api(port,'action'),options('POST',{
    revision:1,operation:{type:'remove',ids:[1]}
  }))).status,409);
  const action = (await (await fetch(api(port,'action'),options())).json()).action;
  assert.deepEqual(action.operation,{type:'reorder',ids:[2,1]});
  const acknowledged = await fetch(api(port,'state'),options('POST',{
    revision:2,state:{...initial,pending:[initial.pending[1],initial.pending[0]]},
    ack:{id:action.id,ok:true}
  }));
  assert.equal(acknowledged.status,200);
  const current = await (await fetch(api(port,'state'),options())).json();
  assert.deepEqual(current.state.pending.map(x=>x.id),[2,1]);
  assert.equal(current.waiting,false);
  assert.equal(current.lastAck.id,action.id);
  assert.equal((await fetch(api(port,'state'),options('POST',{revision:1,state:initial}))).status,400);
});
