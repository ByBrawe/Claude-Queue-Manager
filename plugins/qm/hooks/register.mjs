// Queue Manager is a self-contained Claude Code mod.
// It never injects queued text into the current turn. Each item is submitted
// as a new user turn after a successful main turn.complete event.
import { initialState, normalizeState, enqueue, remove, move, edit, clear, undo,
  canStart, claim, completeTurn, rejectSubmission, recover } from '../src/queue.mjs';
import { parseCommand, HELP } from '../src/commands.mjs';

const PANE_ID = 'qm';
const STORE_PREFIX = 'claude-queue-manager:queue:';
const MAX_PAGE = 20;
let cached = null;
let cachedSessionId = null;
let chain = Promise.resolve();
let page = 0;

function exclusive(work) {
  const next = chain.then(work, work);
  chain = next.catch(() => {});
  return next;
}

async function load($) {
  const id = await $.session.id();
  if (cached && id === cachedSessionId) return cached;
  const raw = await $.store.get(STORE_PREFIX + id);
  cached = raw ? normalizeState(raw, id, await $.clock.now()) : initialState(id, await $.clock.now());
  cachedSessionId = id;
  return cached;
}

async function save($, next) {
  cached = next;
  await $.store.set(STORE_PREFIX + cachedSessionId, next);
  $.ui.invalidate('ui.render');
}

async function change($, fn) {
  return exclusive(async () => {
    const before = await load($);
    const after = fn(before, await $.clock.now());
    if (after !== before) await save($, after);
    return after;
  });
}

function logError($, err) {
  try { $.ui.log('Queue Manager: ' + String(err?.message ?? err), { to: 'debug' }); } catch {}
}

function scheduleNext($) {
  // Claim one, save it, then submit. Never claim multiple messages at once.
  void exclusive(async () => {
    const state = await load($);
    if (!canStart(state)) return null;
    const result = claim(state, await $.clock.now());
    await save($, result.state);
    return result.task;
  }).then(task => { if (task) void submitOne($, task); }).catch(error => logError($, error));
}

async function submitOne($, task) {
  let dropped;
  try {
    const result = await $.prompt.submit({ text: task.text, asUser: true });
    dropped = result?.drop;
  } catch (error) {
    dropped = String(error?.message ?? error);
  }
  if (dropped === undefined) return;
  await change($, state => rejectSubmission(state, task.id));
  $.ui.toast('QM: task not started; queue paused. /qm resume to retry');
  logError($, dropped);
}

async function perform($, text) {
  const intent = parseCommand(text);
  if (intent.type === 'open' || intent.type === 'list') {
    await $.ui.open({ id: PANE_ID, title: 'Queue Manager', focus: true, closeOnEscape: true });
    return '';
  }
  if (intent.type === 'help') return HELP;
  if (intent.type === 'next') {
    const state = await change($, state => ({ ...state, paused: false }));
    scheduleNext($);
    return `QM: ${state.pending.length} pending`;
  }
  const updated = await change($, (state, now) => {
    switch (intent.type) {
      case 'add': return enqueue(state, intent.texts, intent.where ?? 'end', now);
      case 'rm': return remove(state, intent.position);
      case 'mv': return move(state, intent.from, intent.to);
      case 'edit': return edit(state, intent.position, intent.text);
      case 'clear': return clear(state);
      case 'undo': return undo(state);
      case 'recover': return recover(state);
      case 'pause': return { ...state, paused: true };
      case 'resume': return { ...state, paused: false };
      default: throw new Error('Unsupported queue action');
    }
  });
  if (intent.type === 'add' || intent.type === 'resume') scheduleNext($);
  if (intent.type === 'add') return `QM: ${intent.texts.length} added; ${updated.pending.length} pending`;
  if (intent.type === 'recover') return 'QM: in-flight task recovered; queue paused. Review then /qm resume';
  return `QM: ${intent.type} OK; ${updated.pending.length} pending${updated.paused ? ' (paused)' : ''}`;
}

async function safePerform($, args) {
  try { return await perform($, args); }
  catch (error) { return 'QM error: ' + String(error?.message ?? error); }
}

const shortened = (text, limit = 92) => text.length <= limit ? text : text.slice(0, limit - 3) + '...';
function textNode(Text, value, other = {}) { return Text({ ...other, children: [String(value)] }); }

async function drawBand($, e, next) {
  if (e.props.hasSurvey) return next(e);
  const state = await load($);
  if (!state.pending.length && !state.running) return next(e);
  const { Box, Text, Button } = $.ui.resolve(e);
  const label = state.paused ? 'PAUSED' : state.running ? 'RUNNING' : 'WAITING';
  const nextName = state.pending.length ? shortened(state.pending[0].text, 45) : 'Last task running';
  return Box({ flexDirection: 'row', columnGap: 2, children: [
    textNode(Text, ` QM ${label} `, { color: state.paused ? 'yellow' : 'cyan', bold: true }),
    textNode(Text, `${state.pending.length} queued | ${nextName}`, { wrap: 'truncate-end', dimColor: true }),
    Button({ key: 'qm-open', label: 'Manage', plain: true,
      onPress: () => $.ui.open({ id: PANE_ID, title: 'Queue Manager', focus: true, closeOnEscape: true }) })
  ] });
}

async function drawPane($, e) {
  const { Box, Text, Button, Input } = $.ui.resolve(e);
  const state = await load($);
  const pages = Math.max(1, Math.ceil(state.pending.length / MAX_PAGE));
  page = Math.min(page, pages - 1);
  const start = page * MAX_PAGE;
  const actions = [
    Button({ key: 'qm-pause', label: state.paused ? 'Resume' : 'Pause',
      onPress: async () => { await safePerform($, state.paused ? 'resume' : 'pause'); } }),
    Button({ key: 'qm-undo', label: 'Undo', onPress: async () => {
      const result = await safePerform($, 'undo'); if (result.startsWith('QM error')) $.ui.toast(result);
    } }),
    Button({ key: 'qm-clear', label: 'Clear pending', onPress: async () => {
      const result = await safePerform($, 'clear'); if (result.startsWith('QM error')) $.ui.toast(result);
    } })
  ];
  const taskRows = state.pending.slice(start, start + MAX_PAGE).map((task, index) => {
    const n = start + index + 1;
    return Box({ key: 'qm-row-' + task.id, flexDirection: 'row', columnGap: 1, children: [
      textNode(Text, `${n}. ${shortened(task.text, 85)}`, { wrap: 'truncate-end' }),
      Button({ key: 'qm-up-' + task.id, label: '^', plain: true, onPress: () => safePerform($, `mv ${n} ${n - 1}`) }),
      Button({ key: 'qm-down-' + task.id, label: 'v', plain: true, onPress: () => safePerform($, `mv ${n} ${n + 1}`) }),
      Button({ key: 'qm-rm-' + task.id, label: 'x', plain: true, onPress: () => safePerform($, `rm ${n}`) })
    ] });
  });
  const pageBar = Box({ flexDirection: 'row', columnGap: 2, children: [
    Button({ key: 'qm-prev', label: 'Prev', onPress: () => { page = Math.max(0, page - 1); $.ui.invalidate('ui.render'); } }),
    textNode(Text, `Page ${page + 1}/${pages}`),
    Button({ key: 'qm-next-page', label: 'Next', onPress: () => { page = Math.min(pages - 1, page + 1); $.ui.invalidate('ui.render'); } })
  ] });
  const input = Input ? Input({ key: 'qm-batch', label: 'Add tasks', rows: 3, value: '',
    placeholder: 'One task per line or separate with ||', submitLabel: 'Queue',
    onSubmit: async value => {
      const str = String(value ?? '').trim();
      if (!str) return;
      const cmd = str.includes('\n') || /\s\|\|\s/.test(str) ? `batch ${str}` : `add ${str}`;
      const result = await safePerform($, cmd);
      $.ui.toast(result);
    } }) : textNode(Text, 'Use /qm batch task1 || task2 to add tasks');
  return Box({ flexDirection: 'column', rowGap: 1, children: [
    textNode(Text, `QUEUE MANAGER | ${state.paused ? 'PAUSED' : state.running ? 'RUNNING' : 'READY'} | ${state.pending.length} pending | ${state.done.length} recent done`, { bold: true }),
    state.running ? textNode(Text, `Active: ${shortened(state.running.text)}`, { color: 'green' }) : textNode(Text, 'Each task starts as a separate turn after the previous task finishes.', { dimColor: true }),
    Box({ flexDirection: 'row', columnGap: 2, children: actions }),
    input,
    ...taskRows,
    pageBar,
    textNode(Text, '/qm repeat 100 continue | /qm edit 2 task | /qm help', { dimColor: true })
  ] });
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await load($);
    try {
      await $.command.register({ name: 'qm', description: 'Queue Manager: run tasks one by one without steering',
        argumentHint: 'add | batch | repeat | list | pause | resume | mv | edit', immediate: true });
    } catch (error) { logError($, error); }
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await change($, state => ({ ...state, busy: true }));
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    if (e.agentId !== undefined) return result;
    const success = e.isAborted !== true && (!e.reason || e.reason === 'answer');
    const updated = await change($, (state, now) => completeTurn(state, success, now));
    if (success && !updated.paused) scheduleNext($);
    if (!success) $.ui.toast('QM: task interrupted; pending queue paused');
    return result;
  });

  on('command.run', { command: 'qm' }, async ($, e) => {
    const result = await safePerform($, e.args ?? '');
    return result ? { text: result } : {};
  });

  // Remove queued command arguments from the model-readable transcript.
  // Queue text appears only when submitted as its own future user turn.
  on('session.append', { door: 'command' }, ($, e, next) => {
    const isQm = e.message.content.some(b => typeof b.text === 'string' &&
      /<command-name>\/(?:qm:)?qm<\/command-name>/.test(b.text));
    if (!isQm) return next(e);
    const content = e.message.content.map(b => typeof b.text === 'string'
      ? { ...b, text: b.text.replace(/<command-args>[\s\S]*?<\/command-args>/g, '<command-args></command-args>') }
      : b);
    return next({ ...e, message: { ...e.message, content } });
  });

  on('ui.render', { component: 'AbovePrompt' }, drawBand);
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, drawPane);
}
