// Dependency-free queue operations. No messages are sent from this module.
export const MAX_BATCH = 200;
export const MAX_PENDING = 500;
export const VERSION = 1;
const MAX_HISTORY = 20;
const MAX_UNDO = 10;

export function initialState(sessionId, now = Date.now()) {
  return {
    version: VERSION, sessionId, pending: [], running: null, done: [],
    nextId: 1, paused: false, busy: false, undo: [], updatedAt: now
  };
}

export function normalizeState(raw, sessionId, now = Date.now()) {
  const state = initialState(sessionId, now);
  if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return state;
  const valid = task => task && Number.isInteger(task.id) && typeof task.text === 'string';
  state.pending = Array.isArray(raw.pending) ? raw.pending.filter(valid).slice(0, MAX_PENDING) : [];
  state.done = Array.isArray(raw.done) ? raw.done.filter(valid).slice(0, MAX_HISTORY) : [];
  state.running = valid(raw.running) ? raw.running : null;
  state.paused = raw.paused === true;
  state.busy = Boolean(state.running);
  state.undo = Array.isArray(raw.undo) ? raw.undo.slice(0, MAX_UNDO) : [];
  state.nextId = Math.max(1, Number(raw.nextId) || 1,
    ...[...state.pending, ...state.done, state.running].filter(Boolean).map(item => item.id + 1));
  state.updatedAt = now;
  // Preserve an in-flight task across hot reload. If a host process crashed,
  // the user can explicitly /qm recover; automatic replay could duplicate work.
  return state;
}

function snapshot(state, next) {
  const undo = [{ pending: state.pending, paused: state.paused }, ...state.undo].slice(0, MAX_UNDO);
  return { ...next, undo };
}

export function enqueue(state, texts, where = 'end', now = Date.now()) {
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > MAX_BATCH) {
    throw new Error(`Provide 1-${MAX_BATCH} non-empty tasks`);
  }
  const cleaned = texts.map(text => String(text ?? '').trim());
  if (cleaned.some(text => !text || text.length > 20000)) throw new Error('Tasks must be non-empty and at most 20000 characters');
  if (state.pending.length + cleaned.length > MAX_PENDING) {
    throw new Error(`Queue limit: ${MAX_PENDING} pending tasks`);
  }
  const created = cleaned.map((text, i) => ({ id: state.nextId + i, text, createdAt: now }));
  const pending = where === 'front' ? [...created, ...state.pending] : [...state.pending, ...created];
  return snapshot(state, { ...state, pending, nextId: state.nextId + created.length, updatedAt: now });
}

export function remove(state, position) {
  if (!Number.isInteger(position) || position < 1 || position > state.pending.length) throw new Error('No task at that position');
  return snapshot(state, { ...state, pending: state.pending.filter((_, i) => i !== position - 1) });
}

export function move(state, from, to) {
  const n = state.pending.length;
  if (![from, to].every(Number.isInteger) || from < 1 || to < 1 || from > n || to > n) {
    throw new Error('Invalid task position');
  }
  if (from === to) return state;
  const pending = state.pending.slice();
  pending.splice(to - 1, 0, ...pending.splice(from - 1, 1));
  return snapshot(state, { ...state, pending });
}

export function edit(state, position, text) {
  const value = String(text ?? '').trim();
  if (!value || value.length > 20000) throw new Error('Task text must contain 1-20000 characters');
  if (!Number.isInteger(position) || position < 1 || position > state.pending.length) throw new Error('No task at that position');
  return snapshot(state, { ...state, pending: state.pending.map((task, i) => i === position - 1 ? { ...task, text: value } : task) });
}

export function clear(state) {
  if (!state.pending.length) return state;
  return snapshot(state, { ...state, pending: [] });
}

export function undo(state) {
  if (!state.undo.length) throw new Error('Nothing to undo');
  const [previous, ...rest] = state.undo;
  // Never resurrect a task already started or completed.
  const started = new Set([...state.done, state.running].filter(Boolean).map(item => item.id));
  return { ...state, pending: previous.pending.filter(item => !started.has(item.id)), paused: previous.paused, undo: rest };
}

export const canStart = state => !state.paused && !state.busy && state.running === null && state.pending.length > 0;

export function claim(state, now = Date.now()) {
  if (!canStart(state)) return { state, task: null };
  const [task, ...pending] = state.pending;
  return { task, state: { ...state, pending, running: { ...task, startedAt: now }, busy: true, updatedAt: now } };
}

export function completeTurn(state, successful, now = Date.now()) {
  if (!state.running) return { ...state, busy: false, updatedAt: now };
  if (!successful) {
    // Abort/error: leave it pending and pause. Do not continue with task 2.
    const { startedAt, ...task } = state.running;
    return { ...state, pending: [task, ...state.pending], running: null, paused: true, busy: false, updatedAt: now };
  }
  return { ...state, running: null, busy: false, done: [{ ...state.running, finishedAt: now }, ...state.done].slice(0, MAX_HISTORY), updatedAt: now };
}

export function rejectSubmission(state, taskId) {
  if (state.running?.id !== taskId) return state;
  const { startedAt, ...task } = state.running;
  return { ...state, running: null, pending: [task, ...state.pending], paused: true, busy: false };
}

export function recover(state) {
  if (!state.running) throw new Error('No in-flight task to recover');
  const { startedAt, ...task } = state.running;
  return { ...state, running: null, busy: false, paused: true, pending: [task, ...state.pending] };
}

/** Remove a chosen group by stable task ID. Never touches the active task. */
export function removeByIds(state, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id))) {
    throw new Error('Select one or more pending tasks');
  }
  const wanted = new Set(ids);
  if (wanted.size !== ids.length || !ids.every(id => state.pending.some(task => task.id === id))) {
    throw new Error('Selection is stale; refresh the queue');
  }
  return snapshot(state, { ...state, pending: state.pending.filter(task => !wanted.has(task.id)) });
}

/** Apply a full pending-only permutation, for drag and multi-select reorder. */
export function reorderByIds(state, ids) {
  if (!Array.isArray(ids) || ids.length !== state.pending.length ||
      ids.some(id => !Number.isSafeInteger(id))) {
    throw new Error('New order must contain every pending task');
  }
  const byId = new Map(state.pending.map(task => [task.id, task]));
  if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
    throw new Error('New order is stale or has duplicate IDs');
  }
  if (ids.every((id, i) => id === state.pending[i].id)) return state;
  return snapshot(state, { ...state, pending: ids.map(id => byId.get(id)) });
}

/** Keep the relative order of selected items while moving the group. */
export function moveSelected(state, ids, placement = 'front') {
  if (!['front', 'back'].includes(placement)) throw new Error('Invalid group position');
  const wanted = new Set(ids);
  if (!ids.length || ids.length !== wanted.size || ids.some(id => !state.pending.some(t => t.id === id))) {
    throw new Error('Selection is stale; refresh the queue');
  }
  const selected = state.pending.filter(t => wanted.has(t.id)).map(t => t.id);
  const remaining = state.pending.filter(t => !wanted.has(t.id)).map(t => t.id);
  return reorderByIds(state, placement === 'front' ? [...selected, ...remaining] : [...remaining, ...selected]);
}
