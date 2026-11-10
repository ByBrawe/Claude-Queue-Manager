import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../hooks/register.mjs';

let fakeSessionSequence = 0;
function fakeHost() {
  const sessionId = `test-session-${++fakeSessionSequence}`;
  const handlers = [];
  const memory = new Map();
  const sent = [];
  const tools = {
    session: { id: async () => sessionId },
    store: { get: async key => memory.get(key), set: async (key, value) => { memory.set(key, structuredClone(value)); } },
    clock: { now: async () => Date.now() },
    ui: {
      invalidate: () => {}, toast: () => {}, log: () => {},
      open: async () => {},
      resolve: () => ({
        Box: x => x, Text: x => x, Button: x => x, Input: x => x, Select: x => x
      })
    },
    command: { register: async () => {} },
    prompt: { submit: async ({ text, asUser }) => {
      sent.push({ text, asUser });
      return {};
    } }
  };
  register((name, optionsOrCallback, cb) => {
    handlers.push({ name, options: typeof optionsOrCallback === 'function' ? {} : optionsOrCallback,
      fn: typeof optionsOrCallback === 'function' ? optionsOrCallback : cb });
  });
  async function emit(name, e = {}, options = {}) {
    const found = handlers.filter(h => h.name === name &&
      Object.entries(options).every(([k, v]) => h.options[k] === v));
    assert.ok(found.length, 'no handler for ' + name);
    return found[0].fn(tools, e, x => x);
  }
  return { tools, emit, sent, memory };
}
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test('one queued item per completed turn, never all at once', async () => {
  const host = fakeHost();
  await host.emit('session.start');
  await host.emit('turn.start');
  const result = await host.emit('command.run', { args: 'batch first || second || third' }, { command: 'qm' });
  assert.match(result.text, /3 added/);
  await flush();
  assert.equal(host.sent.length, 0, 'active task must not be steered');
  await host.emit('turn.complete', { isAborted: false });
  await flush();
  assert.deepEqual(host.sent.map(x => x.text), ['first']);
  await host.emit('turn.start');
  await host.emit('turn.complete', { isAborted: false });
  await flush();
  assert.deepEqual(host.sent.map(x => x.text), ['first', 'second']);
  await host.emit('turn.start');
  await host.emit('turn.complete', { isAborted: false });
  await flush();
  assert.deepEqual(host.sent.map(x => x.text), ['first', 'second', 'third']);
  assert.ok(host.sent.every(s => s.asUser === true));
});

test('aborted in-flight task goes back to front and queue pauses', async () => {
  const h = fakeHost();
  await h.emit('session.start');
  await h.emit('turn.start');
  await h.emit('command.run', { args: 'batch A || B' }, { command: 'qm' });
  await h.emit('turn.complete', {});
  await flush();
  assert.deepEqual(h.sent.map(x => x.text), ['A']);
  await h.emit('turn.start');
  await h.emit('turn.complete', { isAborted: true });
  await flush();
  assert.equal(h.sent.length, 1);
  const state = [...h.memory.values()][0];
  assert.equal(state.paused, true);
  assert.deepEqual(state.pending.map(x => x.text), ['A', 'B']);
});

test('queue command does not leak queued text to the current model context', async () => {
  const h = fakeHost();
  await h.emit('session.start');
  const commandText = '<command-name>/qm</command-name><command-args>repeat 100 PRIVATE</command-args>';
  const result = await h.emit('session.append', {
    message: { content: [{ text: commandText }] }
  }, { door: 'command' });
  assert.doesNotMatch(result.message.content[0].text, /PRIVATE/);
  assert.match(result.message.content[0].text, /<command-args><\/command-args>/);
});

test('empty /qm opens panel and /qm help works without model calls', async () => {
  const h = fakeHost();
  await h.emit('session.start');
  assert.deepEqual(await h.emit('command.run', { args: '' }, { command: 'qm' }), {});
  const result = await h.emit('command.run', { args: 'help' }, { command: 'qm' });
  assert.match(result.text, /repeat/);
  assert.equal(h.sent.length, 0);
});

function controls(tree, predicate, output = []) {
  if (!tree || typeof tree !== 'object') return output;
  if (predicate(tree)) output.push(tree);
  for (const child of tree.children ?? []) controls(child, predicate, output);
  return output;
}

async function panel(host) {
  return host.emit('ui.render', { props: {} }, { component: 'Pane', requestId: 'qm' });
}

test('TUI/desktop panel renders controls and queue content without model calls', async () => {
  const h = fakeHost();
  await h.emit('session.start');
  await h.emit('command.run', { args: 'pause' }, { command: 'qm' });
  await h.emit('command.run', { args: 'batch fix bug || run tests' }, { command: 'qm' });
  let ui = await panel(h);
  assert.equal(controls(ui, x => x.key === 'qm-repeat-tasks').length,0);
  await controls(ui, x => x.key === 'qm-details')[0].onPress();
  ui = await panel(h);
  const inputs = controls(ui, x => x.key?.startsWith('qm-') && typeof x.onInput === 'function');
  const buttons = controls(ui, x => x.key?.startsWith('qm-') && typeof x.onPress === 'function');
  assert.ok(inputs.some(x => x.key === 'qm-add-tasks'));
  assert.ok(inputs.some(x => x.key === 'qm-repeat-tasks'));
  assert.ok(inputs.some(x => x.key === 'qm-search'));
  assert.ok(buttons.some(x => x.key === 'qm-edit-1'));
  assert.ok(buttons.some(x => x.key === 'qm-rm-2'));
  assert.ok(buttons.some(x => x.key === 'qm-toggle'));
  assert.equal(h.sent.length, 0);
  await buttons.find(x => x.key === 'qm-edit-1').onPress();
  const editUi = await panel(h);
  assert.ok(controls(editUi, x => x.key === 'qm-edit-input').length);
  const save = controls(editUi, x => x.key === 'qm-save-edit')[0];
  const input = controls(editUi, x => x.key === 'qm-edit-input')[0];
  input.onInput('fix the real bug');
  await save.onPress();
  const state = [...h.memory.entries()].find(([key]) => key.includes(':queue:'))[1];
  assert.equal(state.pending[0].text, 'fix the real bug');
});

test('panel paste, repeat, search, language and confirm-to-clear work', async () => {
  const h = fakeHost();
  await h.emit('session.start');
  await h.emit('command.run', { args: 'pause' }, { command: 'qm' });
  let ui = await panel(h);
  const add = controls(ui, x => x.key === 'qm-add-tasks')[0];
  await add.onSubmit('alpha\nbeta\ngamma');
  ui = await panel(h);
  await controls(ui, x => x.key === 'qm-details')[0].onPress();
  ui = await panel(h);
  const repeat = controls(ui, x => x.key === 'qm-repeat-tasks')[0];
  await repeat.onSubmit('3 | continue');
  let state = [...h.memory.entries()].find(([key]) => key.includes(':queue:'))[1];
  assert.deepEqual(state.pending.map(x => x.text), ['alpha','beta','gamma','continue','continue','continue']);
  const search = controls(ui, x => x.key === 'qm-search')[0];
  search.onInput('beta');
  ui = await panel(h);
  const rows = controls(ui, x => String(x.key).startsWith('qm-task-'));
  assert.equal(rows.length, 1);
  const select = controls(ui, x => x.key === 'qm-language')[0];
  await select.onSelect('tr');
  assert.equal(h.memory.get('claude-queue-manager:prefs:locale'), 'tr');
  ui = await panel(h);
  assert.ok(controls(ui, x => x.key === 'qm-clear')[0].label.includes('Bekleyenleri'));
  const clear = controls(ui, x => x.key === 'qm-clear')[0];
  await clear.onPress();
  state = [...h.memory.entries()].find(([key]) => key.includes(':queue:'))[1];
  assert.equal(state.pending.length, 6, 'first click must not delete anything');
  ui = await panel(h);
  await controls(ui, x => x.key === 'qm-clear')[0].onPress();
  state = [...h.memory.entries()].find(([key]) => key.includes(':queue:'))[1];
  assert.equal(state.pending.length, 0);
  assert.equal(h.sent.length, 0);
});

test('native panel multi-selection moves group and requires confirmation for delete', async () => {
  const h=fakeHost();
  await h.emit('session.start');
  await h.emit('command.run',{args:'pause'},{command:'qm'});
  await h.emit('command.run',{args:'batch alpha || beta || gamma || delta'},{command:'qm'});
  let ui=await panel(h);
  await controls(ui,x=>x.key==='qm-check-1')[0].onPress();
  ui=await panel(h);
  await controls(ui,x=>x.key==='qm-check-3')[0].onPress();
  ui=await panel(h);
  await controls(ui,x=>x.key==='qm-move-bottom')[0].onPress();
  let state=[...h.memory.entries()].find(([key])=>key.includes(':queue:'))[1];
  assert.deepEqual(state.pending.map(x=>x.text),['beta','delta','alpha','gamma']);
  ui=await panel(h);
  await controls(ui,x=>x.key==='qm-remove-group')[0].onPress();
  state=[...h.memory.entries()].find(([key])=>key.includes(':queue:'))[1];
  assert.equal(state.pending.length,4);
  ui=await panel(h);
  await controls(ui,x=>x.key==='qm-remove-group')[0].onPress();
  state=[...h.memory.entries()].find(([key])=>key.includes(':queue:'))[1];
  assert.deepEqual(state.pending.map(x=>x.text),['beta','delta']);
  assert.equal(h.sent.length,0);
});

test('web bridge applies a browser reorder to real session queue before resuming FIFO', async t => {
  const { createDashboard } = await import('../web/server.mjs');
  const h = fakeHost();
  let server; let tick; let copied = '';
  h.tools.plugin = { root: '/fake/plugin' };
  h.tools.ui.copy = async url => { copied = url; };
  h.tools.clock.sleep = async () => {};
  h.tools.clock.every = (ms, callback) => { tick = callback; return {cancel: () => {}}; };
  h.tools.process = { run: async argv => {
    if (argv[3]?.endsWith('/web/server.mjs')) {
      server = createDashboard({ port: Number(argv[4]), token: argv[5] });
      await server.listen();
    }
    return {exitCode:0,stdout:'',stderr:''};
  } };
  h.tools.http = { fetch: async (url, init = {}) => {
    const response = await fetch(url,init);
    return {ok:response.ok,status:response.status,text:await response.text()};
  } };
  t.after(async () => { if (server) await server.close(); });
  await h.emit('session.start');
  await h.emit('command.run',{args:'pause'},{command:'qm'});
  await h.emit('command.run',{args:'batch alpha || beta || gamma'},{command:'qm'});
  const launch = await h.emit('command.run',{args:'web'},{command:'qm'});
  assert.match(launch.text,/127\.0\.0\.1/);
  assert.doesNotMatch(launch.text,/token=/);
  assert.match(copied,/token=[0-9a-f]+/);
  const u = new URL(copied);
  const tok = new URLSearchParams(u.hash.slice(1)).get('token');
  const getState = async () => (await (await fetch(u.origin+'/api/state',{headers:{'x-qm-token':tok}})).json());
  let state = await getState();
  assert.deepEqual(state.state.pending.map(x=>x.text),['alpha','beta','gamma']);
  const ids=state.state.pending.map(x=>x.id);
  const reorder=await fetch(u.origin+'/api/action',{
    method:'POST',headers:{'x-qm-token':tok,'content-type':'application/json'},
    body:JSON.stringify({revision:state.revision,operation:{type:'reorder',ids:[ids[1],ids[0],ids[2]]}})
  });
  assert.equal(reorder.status,202);
  await tick();
  state = await getState();
  assert.equal(state.lastAck.ok,true);
  assert.deepEqual(state.state.pending.map(x=>x.text),['beta','alpha','gamma']);
  const resume=await fetch(u.origin+'/api/action',{
    method:'POST',headers:{'x-qm-token':tok,'content-type':'application/json'},
    body:JSON.stringify({revision:state.revision,operation:{type:'resume'}})
  });
  assert.equal(resume.status,202);
  await tick(); await flush();
  assert.deepEqual(h.sent.map(x=>x.text),['beta']);
  const stopped=await h.emit('command.run',{args:'web stop'},{command:'qm'});
  assert.match(stopped.text,/stopped/);
});

