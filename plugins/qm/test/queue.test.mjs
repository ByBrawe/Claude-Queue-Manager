import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/commands.mjs';
import { filteredPage, parseRepeatForm, splitPaste, uiStrings } from '../src/view.mjs';
import { MAX_BATCH, initialState, enqueue, remove, move, edit, clear, undo,
  canStart, claim, completeTurn, normalizeState, rejectSubmission, recover } from '../src/queue.mjs';

test('repeat is deterministic, bounded, and each entry has its own id', () => {
  const intent = parseCommand('repeat 200 devam et');
  assert.equal(intent.type, 'add');
  const state = enqueue(initialState('session'), intent.texts);
  assert.equal(state.pending.length, MAX_BATCH);
  assert.equal(new Set(state.pending.map(task => task.id)).size, 200);
  assert.ok(state.pending.every(task => task.text === 'devam et'));
  for (const bad of ['repeat 0 x', 'repeat 201 x', 'repeat 3', 'repeat no x']) {
    assert.throws(() => parseCommand(bad));
  }
});

test('batch handles newlines and separators in listed order', () => {
  const { texts } = parseCommand('batch Fix tests || Run lint\nWrite README');
  assert.deepEqual(texts, ['Fix tests', 'Run lint', 'Write README']);
  assert.deepEqual(enqueue(initialState('x'), texts).pending.map(t => t.text), texts);
  assert.throws(() => parseCommand('batch'));
});

test('position edits, pause, undo, and FIFO task claiming', () => {
  let state = enqueue(initialState('x'), ['A', 'B', 'C']);
  state = move(state, 3, 1);
  assert.deepEqual(state.pending.map(t => t.text), ['C', 'A', 'B']);
  state = edit(state, 2, 'AA');
  state = remove(state, 3);
  assert.deepEqual(state.pending.map(t => t.text), ['C', 'AA']);
  state = undo(state);
  assert.deepEqual(state.pending.map(t => t.text), ['C', 'AA', 'B']);
  assert.equal(canStart(state), true);
  const first = claim(state);
  assert.equal(first.task.text, 'C');
  assert.equal(canStart(first.state), false);
  state = completeTurn(first.state, true);
  assert.equal(canStart(state), true);
  assert.equal(claim(state).task.text, 'AA');
  state = clear(state);
  assert.equal(state.pending.length, 0);
});

test('interruption and dropped submission never lose work', () => {
  let state = claim(enqueue(initialState('x'), ['A', 'B'])).state;
  state = completeTurn(state, false);
  assert.equal(state.paused, true);
  assert.deepEqual(state.pending.map(t => t.text), ['A', 'B']);
  state.paused = false;
  state = claim(state).state;
  state = rejectSubmission(state, state.running.id);
  assert.equal(state.paused, true);
  assert.deepEqual(state.pending.map(t => t.text), ['A', 'B']);
});

test('load preserves an active task; recovery must be explicit', () => {
  const state = claim(enqueue(initialState('sid'), ['A', 'B'])).state;
  const loaded = normalizeState(state, 'sid');
  assert.equal(loaded.running.text, 'A');
  assert.deepEqual(loaded.pending.map(t => t.text), ['B']);
  const restored = recover(loaded);
  assert.equal(restored.paused, true);
  assert.deepEqual(restored.pending.map(t => t.text), ['A', 'B']);
});

test('capacity, invalid positions, and empty tasks are rejected atomically', () => {
  const original = enqueue(initialState('x'), ['First']);
  assert.throws(() => enqueue(original, Array(200).fill('')));
  assert.equal(original.pending.length, 1);
  assert.throws(() => move(original, 2, 1));
  assert.throws(() => remove(original, 0));
  assert.throws(() => edit(original, 1, ''));
  assert.throws(() => enqueue(original, Array(201).fill('x')));
});


test('UI filter keeps original queue positions when searched/paginated', () => {
  const tasks = Array.from({length: 35}, (_, i) => ({id: i + 1, text: `task-${i + 1} ${i % 3 ? 'beta' : 'alpha'}`}));
  const v = filteredPage(tasks, 'beta', 1, 10);
  assert.equal(v.totalMatches, 23);
  assert.equal(v.totalPages, 3);
  assert.equal(v.rows[0].position, 17);
  assert.equal(filteredPage(tasks, 'not-found').rows.length, 0);
  assert.equal(filteredPage(tasks, '', 99).page, 2);
});

test('repeat form, pasted tasks and UI translations are bounded', () => {
  assert.deepEqual(parseRepeatForm('200 | devam et'), { count: 200, task: 'devam et' });
  for (const invalid of ['0 | go', '201 | go', 'abc | go', '20 |', '20 go']) {
    assert.throws(() => parseRepeatForm(invalid));
  }
  assert.deepEqual(splitPaste(`First\nSecond || Third\n\nFourth`), ['First', 'Second', 'Third', 'Fourth']);
  assert.equal(uiStrings('tr').pause, 'Duraklat');
  assert.equal(uiStrings('en').pause, 'Pause');
});
