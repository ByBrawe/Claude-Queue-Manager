import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../hooks/register.mjs';

function fakeHost() {
  const handlers = [];
  const memory = new Map();
  const sent = [];
  const tools = {
    session: { id: async () => 'session-1' },
    store: { get: async key => memory.get(key), set: async (key, value) => { memory.set(key, structuredClone(value)); } },
    clock: { now: async () => Date.now() },
    ui: {
      invalidate: () => {}, toast: () => {}, log: () => {},
      open: async () => {},
      resolve: () => ({
        Box: x => x, Text: x => x, Button: x => x, Input: x => x
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
