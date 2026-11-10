import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../hooks/register.mjs';

let seq = 0;
function host({ registrationError = null, loadError = null, placement = undefined } = {}) {
  const events = [], calls = [], notices = [], displayedLogs = [], openings = [], sent = [];
  const memory = new Map();
  const id = `startup-041-${++seq}`;
  const tools = {
    command: { register: async spec => {
      calls.push('register:' + spec.name);
      if (registrationError) throw registrationError;
    } },
    session: { id: async () => { calls.push('session.id'); return id; } },
    store: { get: async key => {
      calls.push('store.get');
      if (loadError && key.includes(':queue:')) throw loadError;
      return memory.get(key);
    }, set: async (k,v) => memory.set(k,structuredClone(v)) },
    clock: { now: async () => 1000 },
    ui: {
      log: message => displayedLogs.push(message),
      toast: message => notices.push(message),
      invalidate: () => calls.push('invalidate'),
      open: async options => { openings.push(options); return placement; },
      resolve: () => ({Box: v => v, Text: v => v, Button: v => v})
    },
    prompt: {submit: async options => { sent.push(options); return {}; }}
  };
  register((name, optsOrCallback, cb) => events.push({name,
    opts: typeof optsOrCallback === 'function' ? {} : optsOrCallback,
    fn: typeof optsOrCallback === 'function' ? optsOrCallback : cb}));
  async function emit(name, e = {}, opts = {}) {
    const handler = events.find(x => x.name === name && Object.entries(opts).every(([k,v]) => x.opts[k] === v));
    assert.ok(handler, `handler ${name} is registered`);
    return handler.fn(tools, e, x => x);
  }
  return {emit,calls,notices,displayedLogs,openings,sent};
}
function findButton(tree, key) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.key === key && typeof tree.onPress === 'function') return tree;
  for (const x of tree.children ?? []) {
    const match = findButton(x,key);
    if (match) return match;
  }
  return undefined;
}

test('registers /qm before reading session/store and survives later initialization failure', async () => {
  const h = host({loadError:new Error('test store failure')});
  await h.emit('session.start');
  assert.equal(h.calls[0], 'register:qm');
  assert.ok(h.calls.indexOf('session.id') > 0);
  assert.ok(h.notices.some(s => /QM startup \(session state\).*test store failure/.test(s)));
  assert.ok(h.displayedLogs.some(s => s.includes('test store failure')));
  assert.ok(h.calls.includes('invalidate'));
});

test('registration failure is visible instead of silently hidden', async () => {
  const h = host({registrationError:new Error('command not available')});
  await h.emit('session.start');
  assert.equal(h.calls[0], 'register:qm');
  assert.ok(h.notices.some(s => /QM startup \(command \/qm\).*command not available/.test(s)));
  assert.ok(h.displayedLogs.some(s => s.includes('command not available')));
});

test('native QM button exists with empty queue and opens panel without a model turn', async () => {
  const h = host();
  await h.emit('session.start');
  const band = await h.emit('ui.render', {props:{},surface:'desktop'}, {component:'AbovePrompt'});
  const btn=findButton(band,'qm-open');
  assert.ok(btn,'QM always visible even without queued messages');
  assert.equal(btn.label,'QM');
  await btn.onPress();
  assert.equal(h.openings.length,1);
  assert.equal(h.openings[0].id,'qm');
  assert.equal(h.sent.length,0);
});

test('persistent button remains accessible if /qm registration fails', async () => {
  const h=host({registrationError:new Error('desktop composer bug')});
  await h.emit('session.start');
  const band=await h.emit('ui.render',{props:{},surface:'terminal'},{component:'AbovePrompt'});
  assert.ok(findButton(band,'qm-open'));
  await findButton(band,'qm-open').onPress();
  assert.equal(h.openings.length,1);
});

test('persistent button still renders when queue storage is unavailable', async () => {
  const h=host({loadError:new Error('state not readable')});
  await h.emit('session.start');
  const band=await h.emit('ui.render',{props:{}},{component:'AbovePrompt'});
  assert.ok(findButton(band,'qm-open'));
});

test('panel placement failure is visible, without sending a model prompt', async () => {
  const h=host({placement:{isPlaced:false,reason:'host does not show a pane'}});
  await h.emit('session.start');
  const band=await h.emit('ui.render',{props:{}},{component:'AbovePrompt'});
  await findButton(band,'qm-open').onPress();
  assert.ok(h.notices.some(s=>s.includes('host does not show a pane')));
  assert.equal(h.sent.length,0);
});
