// Pure, dependency-free queue state machine. Claude prompts are dispatched by the mod only.
export const MAX_BATCH = 200;
export const MAX_PENDING = 500;
export const VERSION = 3;
export const MAX_HISTORY = 250;
const MAX_DONE = 20;
const MAX_UNDO = 10;

export const DEFAULT_CONFIG = Object.freeze({
  verify: 'off', model: 'haiku', retries: 0, retryDelayMs: 0,
  timeoutMs: 0, contextPercent: 0, onFail: 'pause'
});
const STAT_KEYS = ['success', 'failure', 'timeout', 'unknown', 'skipped', 'interrupted', 'retried', 'durationMs'];
export const initialStats = () => Object.fromEntries(STAT_KEYS.map(k => [k, 0]));
const validTask = task => task && Number.isSafeInteger(task.id) && task.id > 0 && typeof task.text === 'string';
const whenOf = task => ['always', 'success', 'failure'].includes(task?.when) ? task.when : 'always';
export function normalizeConfig(raw) {
  const cfg = { ...DEFAULT_CONFIG };
  if (!raw || typeof raw !== 'object') return cfg;
  if (['off', 'marker', 'ai'].includes(raw.verify)) cfg.verify = raw.verify;
  if (typeof raw.model === 'string' && /^[a-z0-9._-]{1,100}$/i.test(raw.model)) cfg.model = raw.model;
  if (Number.isInteger(raw.retries) && raw.retries >= 0 && raw.retries <= 5) cfg.retries = raw.retries;
  if (Number.isInteger(raw.retryDelayMs) && raw.retryDelayMs >= 0 && raw.retryDelayMs <= 600000) cfg.retryDelayMs = raw.retryDelayMs;
  if (Number.isInteger(raw.timeoutMs) && raw.timeoutMs >= 0 && raw.timeoutMs <= 86400000) cfg.timeoutMs = raw.timeoutMs;
  if (Number.isInteger(raw.contextPercent) && raw.contextPercent >= 0 && raw.contextPercent <= 99) cfg.contextPercent = raw.contextPercent;
  if (['pause', 'continue'].includes(raw.onFail)) cfg.onFail = raw.onFail;
  return cfg;
}

export function initialState(sessionId, now = Date.now()) {
  return {
    version: VERSION, sessionId, pending: [], running: null, done: [], history: [],
    nextId: 1, paused: false, busy: false, undo: [], updatedAt: now,
    config: { ...DEFAULT_CONFIG }, stats: initialStats(), lastOutcome: null,
    context: null, pauseReason: null, transferredTo: null, recoverable: false
  };
}

export function normalizeState(raw, sessionId, now = Date.now()) {
  const state = initialState(sessionId, now);
  if (!raw || typeof raw !== 'object' || ![1, 2, VERSION].includes(raw.version)) return state;
  const pending = Array.isArray(raw.pending) ? raw.pending.filter(validTask).slice(0, MAX_PENDING) : [];
  state.pending = pending.map(t => ({ ...t, when: whenOf(t), attempts: Math.max(0, Math.min(100, Number(t.attempts) || 0)) }));
  state.done = Array.isArray(raw.done) ? raw.done.filter(validTask).slice(0, MAX_DONE) : [];
  state.history = Array.isArray(raw.history) ? raw.history.filter(validTask).slice(0, MAX_HISTORY)
    : [...state.done];
  state.running = validTask(raw.running) ? { ...raw.running, when: whenOf(raw.running), attempts: Math.max(1, Number(raw.running.attempts) || 1) } : null;
  state.paused = raw.paused === true || Boolean(state.running); // A reloaded, in-flight task is never replayed automatically.
  state.recoverable = Boolean(state.running);
  state.busy = Boolean(state.running);
  // Old snapshots did not retire started IDs. Their safety cannot be inferred
  // from the bounded history, so migrate the work but discard old undo entries.
  state.undo = raw.version === VERSION && Array.isArray(raw.undo) ? raw.undo.slice(0, MAX_UNDO) : [];
  state.config = normalizeConfig(raw.config);
  state.stats = { ...initialStats() };
  for (const key of STAT_KEYS) if (Number.isFinite(raw.stats?.[key]) && raw.stats[key] >= 0) state.stats[key] = raw.stats[key];
  state.lastOutcome = ['success', 'failure', 'unknown'].includes(raw.lastOutcome) ? raw.lastOutcome : null;
  state.context = normalizeUsage(raw.context);
  state.pauseReason = typeof raw.pauseReason === 'string' ? raw.pauseReason : state.running ? 'recovery' : null;
  state.transferredTo = typeof raw.transferredTo === 'string' ? raw.transferredTo : null;
  state.nextId = Math.max(1, Number(raw.nextId) || 1,
    ...[...state.pending, ...state.done, ...state.history, state.running].filter(Boolean).map(item => item.id + 1));
  state.updatedAt = now;
  return state;
}

export function normalizeUsage(input) {
  const x = input?.context && typeof input.context === 'object' ? input.context : input;
  if (!x || typeof x !== 'object') return null;
  const tokens = Number(x.tokens), window = Number(x.window);
  if (!Number.isFinite(tokens) || tokens < 0 || !Number.isFinite(window) || window <= 0) return null;
  return { tokens: Math.round(tokens), window: Math.round(window),
    percent: Math.max(0, Math.min(100, Math.round(tokens / window * 1000) / 10)) };
}

function snapshot(state, next) {
  const undo = [{ pending: state.pending, paused: state.paused }, ...state.undo].slice(0, MAX_UNDO);
  return { ...next, undo };
}
export function enqueue(state, texts, where = 'end', now = Date.now(), when = 'always') {
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > MAX_BATCH) throw new Error(`Provide 1-${MAX_BATCH} non-empty tasks`);
  if (!['always', 'success', 'failure'].includes(when)) throw new Error('Condition must be always, success or failure');
  const cleaned = texts.map(text => String(text ?? '').trim());
  if (cleaned.some(text => !text || text.length > 20000)) throw new Error('Tasks must be non-empty and at most 20000 characters');
  if (state.pending.length + cleaned.length > MAX_PENDING) throw new Error(`Queue limit: ${MAX_PENDING} pending tasks`);
  const created = cleaned.map((text, i) => ({ id: state.nextId + i, text, when, attempts: 0, createdAt: now }));
  const pending = where === 'front' ? [...created, ...state.pending] : [...state.pending, ...created];
  return snapshot(state, { ...state, pending, nextId: state.nextId + created.length, updatedAt: now });
}
export function remove(state, position) {
  if (!Number.isInteger(position) || position < 1 || position > state.pending.length) throw new Error('No task at that position');
  return snapshot(state, { ...state, pending: state.pending.filter((_, i) => i !== position - 1) });
}
export function move(state, from, to) {
  const n = state.pending.length;
  if (![from, to].every(Number.isInteger) || from < 1 || to < 1 || from > n || to > n) throw new Error('Invalid task position');
  if (from === to) return state;
  const pending = state.pending.slice();
  pending.splice(to - 1, 0, ...pending.splice(from - 1, 1));
  return snapshot(state, { ...state, pending });
}
export function edit(state, position, text) {
  const value = String(text ?? '').trim();
  if (!value || value.length > 20000) throw new Error('Task text must contain 1-20000 characters');
  if (!Number.isInteger(position) || position < 1 || position > state.pending.length) throw new Error('No task at that position');
  return snapshot(state, { ...state, pending: state.pending.map((t, i) => i === position - 1 ? { ...t, text: value } : t) });
}
export function clear(state) {
  if (!state.pending.length) return state;
  return snapshot(state, { ...state, pending: [] });
}
export function undo(state) {
  if (!state.undo.length) throw new Error('Nothing to undo');
  const [previous, ...rest] = state.undo;
  const started = new Set([...state.history, ...state.done, state.running].filter(Boolean).map(t => t.id));
  return { ...state, pending: previous.pending.filter(t => !started.has(t.id)), paused: previous.paused, undo: rest };
}
function archive(state, record) {
  return { ...state, done: [record, ...state.done].slice(0, MAX_DONE),
    history: [record, ...state.history].slice(0, MAX_HISTORY),
    undo: retireUndo(state.undo, record.id) };
}
// A started/skipped ID must never reappear through an old edit snapshot,
// even after the bounded outcome history has forgotten it.
function retireUndo(entries, id) {
  return entries.map(entry => ({ ...entry, pending: entry.pending.filter(task => task.id !== id) }));
}
export const canStart = (state, now = Date.now()) => !state.transferredTo && !state.paused && !state.busy && !state.running &&
  state.pending.length > 0 && !(state.pending[0].notBefore > now);

// A conditional task is evaluated against the last EXECUTED task's result.
// Skipped tasks do not replace that result, so adjacent success/failure branches work.
export function claim(state, now = Date.now()) {
  if (state.paused || state.busy || state.running || state.transferredTo) return { state, task: null };
  let next = state;
  while (next.pending.length) {
    const [candidate, ...rest] = next.pending;
    if (whenOf(candidate) !== 'always' && whenOf(candidate) !== next.lastOutcome) {
      const skipped = { ...candidate, status: 'skipped', finishedAt: now, reason: `condition:${whenOf(candidate)}` };
      next = archive({ ...next, pending: rest, stats: { ...next.stats, skipped: next.stats.skipped + 1 } }, skipped);
      continue;
    }
    if (candidate.notBefore > now) return { state: next, task: null, waitMs: candidate.notBefore - now };
    const running = { ...candidate, attempts: (candidate.attempts || 0) + 1, startedAt: now,
      contextAtStart: next.context ? { ...next.context } : null };
    next = { ...next, pending: rest, running, busy: true, updatedAt: now, recoverable: false,
      undo: retireUndo(next.undo, running.id) };
    return { state: next, task: running };
  }
  return { state: { ...next, updatedAt: now }, task: null };
}

export function settleTurn(state, outcome, now = Date.now(), details = {}) {
  if (!state.running) return { ...state, busy: false, updatedAt: now };
  const status = ['success','failure','timeout','unknown','aborted'].includes(outcome) ? outcome : 'unknown';
  const running = state.running;
  const durationMs = Math.max(0, Number.isFinite(details.durationMs) ? details.durationMs : now - (running.startedAt || now));
  const base = { ...state, running: null, busy: false, updatedAt: now, recoverable: false };
  if (status === 'aborted') {
    const { startedAt, contextAtStart, notBefore, ...task } = running;
    return { ...base, pending: [{ ...task }, ...state.pending], paused: true,
      pauseReason: 'interrupted', stats: { ...state.stats, interrupted: state.stats.interrupted + 1 } };
  }
  if (['failure','timeout'].includes(status) && running.attempts <= state.config.retries) {
    const { startedAt, contextAtStart, ...task } = running;
    return { ...base, pending: [{ ...task, notBefore: now + state.config.retryDelayMs }, ...state.pending],
      stats: { ...state.stats, retried: state.stats.retried + 1 }, pauseReason: state.paused ? state.pauseReason : null };
  }
  const record = { ...running, status, durationMs, finishedAt: now,
    reason: typeof details.reason === 'string' ? details.reason.slice(0, 300) : null,
    contextAtEnd: state.context ? { ...state.context } : null };
  const stats = { ...state.stats, [status]: state.stats[status] + 1,
    durationMs: state.stats.durationMs + durationMs };
  const resolved = archive({ ...base, stats, lastOutcome: status === 'success' ? 'success' : status === 'unknown' ? 'unknown' : 'failure' }, record);
  if (state.paused) return { ...resolved, paused: true, pauseReason: state.pauseReason };
  if (status === 'success') return { ...resolved, pauseReason: null };
  return { ...resolved, paused: status === 'unknown' || state.config.onFail === 'pause',
    pauseReason: status === 'unknown' ? 'verify-unknown' : state.config.onFail === 'pause' ? status : null };
}

// Preserve backwards compatibility with callers that only know completion boolean.
export function completeTurn(state, successful, now = Date.now()) {
  return settleTurn(state, successful ? 'success' : 'aborted', now);
}
export function recordContext(state, usage) {
  const context = normalizeUsage(usage);
  if (!context) return state;
  const threshold = state.config.contextPercent;
  const exceeded = threshold > 0 && context.percent >= threshold;
  return { ...state, context, paused: state.paused || exceeded,
    pauseReason: exceeded ? `context:${threshold}` : state.pauseReason };
}
export function configure(state, updates) {
  const next = normalizeConfig({ ...state.config, ...updates });
  for (const key of Object.keys(updates)) if (JSON.stringify(next[key]) !== JSON.stringify(updates[key])) throw new Error(`Invalid ${key} setting`);
  return { ...state, config: next };
}
export function statsText(state) {
  const s = state.stats;
  const total = s.success + s.failure + s.timeout + s.unknown;
  const avg = total ? Math.round(s.durationMs / total / 1000) : 0;
  const u = state.context;
  return `QM stats (this session): ${total} finished; ${s.success} success, ${s.failure} failure, ${s.timeout} timeout, ${s.unknown} unverified; ${s.skipped} skipped, ${s.retried} retries, ${s.interrupted} interruptions; avg ${avg}s/finished turn. Context: ${u ? `${u.tokens}/${u.window} (${u.percent}%)` : 'unavailable'}.`;
}
export function retryLast(state, now = Date.now()) {
  const record = state.history.find(t => ['failure','timeout','unknown'].includes(t.status));
  if (!record) throw new Error('No failed/unknown task in recent history');
  const next = enqueue(state, [record.text], 'front', now, record.when || 'always');
  return { ...next, paused: true, pauseReason: 'manual-retry' };
}
export function rejectSubmission(state, taskId) {
  if (state.running?.id !== taskId) return state;
  const { startedAt, contextAtStart, notBefore, ...task } = state.running;
  return { ...state, running: null, pending: [task, ...state.pending], paused: true,
    pauseReason: 'submit-rejected', busy: false };
}
export function recover(state) {
  if (!state.running) throw new Error('No in-flight task to recover');
  if (!state.recoverable) throw new Error('Task is still live. Recover is only for an orphaned task after restarting its session.');
  const { startedAt, contextAtStart, notBefore, ...task } = state.running;
  return { ...state, running: null, busy: false, recoverable: false, paused: true,
    pauseReason: 'recovered-needs-review', pending: [task, ...state.pending] };
}
export function removeByIds(state, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id))) throw new Error('Select one or more pending tasks');
  const wanted = new Set(ids);
  if (wanted.size !== ids.length || !ids.every(id => state.pending.some(task => task.id === id))) throw new Error('Selection is stale; refresh the queue');
  return snapshot(state, { ...state, pending: state.pending.filter(task => !wanted.has(task.id)) });
}
export function reorderByIds(state, ids) {
  if (!Array.isArray(ids) || ids.length !== state.pending.length || ids.some(id => !Number.isSafeInteger(id))) throw new Error('New order must contain every pending task');
  const byId = new Map(state.pending.map(task => [task.id, task]));
  if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) throw new Error('New order is stale or has duplicate IDs');
  if (ids.every((id, i) => id === state.pending[i].id)) return state;
  return snapshot(state, { ...state, pending: ids.map(id => byId.get(id)) });
}
export function moveSelected(state, ids, placement = 'front') {
  if (!['front','back'].includes(placement)) throw new Error('Invalid group position');
  const wanted = new Set(ids);
  if (!ids.length || ids.length !== wanted.size || ids.some(id => !state.pending.some(t => t.id === id))) throw new Error('Selection is stale; refresh the queue');
  const selected = state.pending.filter(t => wanted.has(t.id)).map(t => t.id);
  const remaining = state.pending.filter(t => !wanted.has(t.id)).map(t => t.id);
  return reorderByIds(state, placement === 'front' ? [...selected, ...remaining] : [...remaining, ...selected]);
}
