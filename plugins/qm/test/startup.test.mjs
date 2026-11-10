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

test('idle band is invisible and /qm opens inline without a model turn', async () => {
 const h=host();await h.emit('session.start');
 const idle=await h.emit('ui.render',{props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.equal(findButton(idle,'qm-open'),undefined);
 await h.emit('command.run',{args:''},{command:'qm'});
 const band=await h.emit('ui.render',{props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.ok(findButton(band,'qm-close'));assert.equal(h.openings.length,0);assert.equal(h.sent.length,0);
 await findButton(band,'qm-close').onPress();
 const closed=await h.emit('ui.render',{props:{},surface:'desktop'},{component:'AbovePrompt'});
 assert.equal(findButton(closed,'qm-close'),undefined);
});

test('fallback opens inline only when command registration has failed',async()=>{
 const h=host({registrationError:new Error('composer bug')});await h.emit('session.start');
 const band=await h.emit('ui.render',{props:{},surface:'terminal'},{component:'AbovePrompt'});
 await findButton(band,'qm-open').onPress();
 const opened=await h.emit('ui.render',{props:{},surface:'terminal'},{component:'AbovePrompt'});
 assert.ok(findButton(opened,'qm-close'));assert.equal(h.openings.length,0);
});

test('storage error keeps a recovery entry point visible',async()=>{
 const h=host({loadError:new Error('state not readable')});await h.emit('session.start');
 const band=await h.emit('ui.render',{props:{}},{component:'AbovePrompt'});
 assert.ok(findButton(band,'qm-open'));
});

test('side panel remains optional and placement failure is visible',async()=>{
 const h=host({placement:{isPlaced:false,reason:'host does not show a pane'}});await h.emit('session.start');
 await h.emit('command.run',{args:'side'},{command:'qm'});
 assert.ok(h.notices.some(s=>s.includes('host does not show a pane')));assert.equal(h.sent.length,0);
});

