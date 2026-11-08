// Queue Manager is a self-contained Claude Code mod.
// It never injects queued text into the current turn. Each item is submitted
// as a new user turn after a successful main turn.complete event.
import { initialState, normalizeState, enqueue, remove, move, edit, clear, undo,
  canStart, claim, completeTurn, rejectSubmission, recover, removeByIds, reorderByIds, moveSelected } from '../src/queue.mjs';
import { parseCommand, HELP } from '../src/commands.mjs';
import { uiStrings, filteredPage, parseRepeatForm, splitPaste, SUPPORTED_UI_LANGUAGES } from '../src/view.mjs';

const PANE_ID = 'qm';
const STORE_PREFIX = 'claude-queue-manager:queue:';
const MAX_PAGE = 12;
let cached = null;
let cachedSessionId = null;
let chain = Promise.resolve();
let page = 0;
let language = 'en';
let searchText = '';
let bulkDraft = '';
let repeatDraft = '';
let editDraft = '';
let editId = null;
let clearArmed = false;
let groupRemoveArmed = false;
const selectedIds = new Set();
let web = null;
let webRevision = 0;
let webAck = null;
let webHandledId = 0;
let webTimer = null;
const PREFS_KEY = 'claude-queue-manager:prefs:locale';

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
  webRevision++;
  if (web) await sendWebSnapshot($);
  $.ui.invalidate('ui.render');
}

function urlForWeb() { return `http://127.0.0.1:${web.port}`; }

async function webRequest($, path, method = 'GET', data = null) {
  if (!web) throw new Error('Web dashboard not running');
  const headers = { 'X-QM-Token': web.token };
  if (data !== null) headers['Content-Type'] = 'application/json';
  const res = await $.http.fetch(`${urlForWeb()}/api/${path}`, {
    method, headers, ...(data !== null ? { body: JSON.stringify(data) } : {})
  });
  if (!res.ok) throw new Error(`Web dashboard HTTP ${res.status}: ${res.text}`);
  return JSON.parse(res.text);
}

async function sendWebSnapshot($) {
  if (!web) return;
  try {
    await webRequest($, 'state', 'POST', {
      revision: webRevision,
      state: { pending: cached.pending, running: cached.running, done: cached.done,
        paused: cached.paused, busy: cached.busy },
      ...(webAck ? { ack: webAck } : {})
    });
  } catch (error) { logError($, error); }
}

async function syncWebAction($) {
  if (!web) return;
  let message;
  try { message = await webRequest($, 'action'); }
  catch (error) { logError($, error); return; }
  const item = message.action;
  if (!item) return;
  if (item.id === webHandledId) { if (webAck) await sendWebSnapshot($); return; }
  webHandledId = item.id; // Prevent duplicate application after an acknowledgement failure.
  try {
    await change($, state => {
      if (item.revision !== webRevision) throw new Error('Queue changed; refresh before editing');
      const op = item.operation;
      if (op.type === 'reorder') return reorderByIds(state, op.ids);
      if (op.type === 'remove') return removeByIds(state, op.ids);
      if (op.type === 'add') return enqueue(state, op.texts);
      if (op.type === 'pause') return { ...state, paused: true };
      if (op.type === 'resume') return { ...state, paused: false };
      throw new Error('Unknown browser operation');
    });
    webAck = { id: item.id, ok: true };
    // A pause/resume/add may enable the next task if Claude is idle.
    if (['resume', 'add'].includes(item.operation.type)) scheduleNext($);
  } catch (error) {
    webAck = { id: item.id, ok: false, error: String(error.message ?? error) };
  }
  await sendWebSnapshot($);
}

async function stopWeb($) {
  if (webTimer) { webTimer.cancel(); webTimer = null; }
  if (web) {
    try { await webRequest($, 'close', 'POST', {}); } catch {}
    web = null;
  }
}

async function startWeb($) {
  if (web) {
    await sendWebSnapshot($);
    return 'QM: web dashboard is already running. Private link remains in your clipboard.';
  }
  if (!$.plugin?.root || !$.process?.run || !$.http?.fetch) {
    throw new Error('Local Desktop/CLI Mods host with process and HTTP access required');
  }
  const root = $.plugin.root;
  const script = `${root}/web/server.mjs`;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, '0')).join('');
  // No command shell: Node launcher starts a detached local-only dashboard process.
  const launcher = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,process.argv.slice(1),{detached:true,stdio:'ignore'});child.unref()";
  for (let attempt = 0; attempt < 4; attempt++) {
    const port = 20000 + Math.floor(Math.random() * 36000);
    const out = await $.process.run(['node', '-e', launcher, script, String(port), token], { timeoutMs: 6000 });
    if (out.exitCode !== 0) throw new Error('Node.js >=20 is required for /qm web');
    web = { port, token };
    let ready = false;
    for (let ping = 0; ping < 6; ping++) {
      try { await webRequest($, 'state'); ready = true; break; } catch { await $.clock.sleep(120); }
    }
    if (ready) break;
    web = null;
  }
  if (!web) throw new Error('Could not start the local web dashboard. Try /qm in Desktop instead.');
  webRevision = 1;
  webAck = null;
  webHandledId = 0;
  await sendWebSnapshot($);
  webTimer = $.clock.every(1000, async () => { await syncWebAction($); });
  const privateUrl = `${urlForWeb()}/#token=${web.token}`;
  let copied = false;
  try { await $.ui.copy(privateUrl); copied = true; } catch {}
  // Best effort to open the user's default browser, without a shell or remote server.
  try {
    const opener = "const {spawn}=require('node:child_process'); const u=process.argv[1]; const p=process.platform; const bin=p==='darwin'?'open':p==='win32'?'cmd':'xdg-open'; const args=p==='darwin'?[u]:p==='win32'?['/c','start','',u]:[u]; const c=spawn(bin,args,{detached:true,stdio:'ignore'});c.on('error',()=>{});c.unref()";
    await $.process.run(['node', '-e', opener, privateUrl], { timeoutMs: 5000 });
  } catch {}
  return `QM: local web dashboard started on 127.0.0.1:${web.port}. ${copied ? 'Private link copied to clipboard.' : 'Open it in the default browser; clipboard copy unavailable.'} No queued prompts are sent to the active turn.`;
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
  if (intent.type === 'web') return startWeb($);
  if (intent.type === 'web-stop') { await stopWeb($); return 'QM: web dashboard stopped'; }
  if (intent.type === 'lang') {
    language = intent.code;
    await $.store.set(PREFS_KEY, language);
    $.ui.invalidate('ui.render');
    return `QM: language set to ${language}`;
  }
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
const node = (Text, value, props = {}) => Text({ ...props, children: [String(value)] });
const block = (Box, children, props = {}) => Box({ flexDirection: 'column', rowGap: 1, ...props, children });
const button = (Button, key, label, onPress, extra = {}) => Button({ key, label, onPress, ...extra });

function status(state, t) {
  return state.paused ? t.paused : state.running ? t.running : state.busy ? t.working : t.ready;
}

function redraw($) { $.ui.invalidate('ui.render'); }
function notify($, result) { if (result) $.ui.toast(result); }
async function act($, command) {
  clearArmed = false;
  const result = await safePerform($, command);
  notify($, result);
  redraw($);
  return result;
}

async function drawBand($, e, next) {
  if (e.props.hasSurvey) return next(e);
  const state = await load($);
  if (!state.pending.length && !state.running) return next(e);
  const t = uiStrings(language);
  const { Box, Text, Button } = $.ui.resolve(e);
  const nextName = state.pending.length ? shortened(state.pending[0].text, 45) : (state.running ? t.running : t.ready);
  return Box({ flexDirection: 'row', columnGap: 2, children: [
    node(Text, ` QM ${status(state, t)} `, { color: state.paused ? 'yellow' : 'cyan', bold: true }),
    node(Text, `${state.pending.length} ${t.pending} | ${nextName}`, { wrap: 'truncate-end', dimColor: true }),
    button(Button, 'qm-open', 'QM', () => $.ui.open({ id: PANE_ID, title: 'Queue Manager', focus: true, closeOnEscape: true }), { plain: true })
  ] });
}

async function actGroup($, kind) {
  const state = await load($);
  const ids = state.pending.filter(task => selectedIds.has(task.id)).map(task => task.id);
  if (!ids.length) return notify($, 'QM: nothing selected');
  try {
    await change($, state => kind === 'remove'
      ? removeByIds(state, ids)
      : moveSelected(state, ids, kind === 'top' ? 'front' : 'back'));
    groupRemoveArmed = false;
    if (kind === 'remove') selectedIds.clear();
    notify($, `QM: ${ids.length} tasks ${kind === 'remove' ? 'removed' : 'moved'}`);
  } catch (error) { notify($, `QM error: ${error.message}`); }
  redraw($);
}

async function drawPane($, e) {
  const { Box, Text, Button, Input, Select } = $.ui.resolve(e);
  const t = uiStrings(language);
  const state = await load($);
  const view = filteredPage(state.pending, searchText, page, MAX_PAGE);
  page = view.page;
  for (const id of selectedIds) if (!state.pending.some(x => x.id === id)) selectedIds.delete(id);
  const selection = state.pending.filter(x => selectedIds.has(x.id));

  const title = node(Text, `${t.title}   |   ${status(state, t)}`, {
    color: state.paused ? 'yellow' : state.running ? 'green' : 'cyan', bold: true
  });
  const stats = node(Text, `${state.pending.length} ${t.pending}   •   ${state.done.length} ${t.finished}`, { dimColor: true });
  const active = state.running
    ? node(Text, `▶ ${t.active}: #${state.running.id} ${shortened(state.running.text, 115)}`, { color: 'green' })
    : node(Text, state.busy ? t.waiting : t.noActive, { dimColor: true });

  const actionRow = Box({ flexDirection: 'row', columnGap: 1, children: [
    button(Button, 'qm-toggle', state.paused ? t.resume : t.pause,
      () => act($, state.paused ? 'resume' : 'pause')),
    button(Button, 'qm-undo', t.undo, () => act($, 'undo'), { disabled: !state.undo.length }),
    button(Button, 'qm-clear', clearArmed ? t.confirmClear : t.clear, async () => {
      if (!clearArmed) { clearArmed = true; redraw($); return; }
      await act($, 'clear');
    }, { disabled: !state.pending.length }),
    ...(clearArmed ? [button(Button, 'qm-cancel', t.cancel, () => { clearArmed = false; redraw($); })] : []),
    button(Button, 'qm-web-open', t.openWeb, () => act($, 'web'))
  ] });
  const confirmNotice = clearArmed ? node(Text, t.clearWarn, { color: 'yellow' }) : null;

  const langControl = Select
    ? Select({ key: 'qm-language', label: t.language, options: SUPPORTED_UI_LANGUAGES,
      value: language, onSelect: async value => { await act($, `lang ${value}`); } })
    : node(Text, `${t.language}: ${language}`);

  async function queuePasted(value) {
    const items = splitPaste(value);
    if (!items.length) return;
    const result = await act($, `batch ${items.join(' || ')}`);
    if (!result.startsWith('QM error:')) { bulkDraft = ''; redraw($); }
  }
  async function queueRepeated(value) {
    try {
      const { count, task } = parseRepeatForm(value);
      const result = await act($, `repeat ${count} ${task}`);
      if (!result.startsWith('QM error:')) { repeatDraft = ''; redraw($); }
    } catch { $.ui.toast(t.invalidRepeat); }
  }
  const pasteInput = Input
    ? Input({ key: 'qm-add-tasks', label: t.add, rows: 3, value: bulkDraft,
      placeholder: t.addHint, onInput: value => { bulkDraft = String(value ?? ''); },
      onSubmit: queuePasted })
    : node(Text, '/qm batch task 1 || task 2');

  const repeatInput = Input
    ? Input({ key: 'qm-repeat-tasks', label: t.repeat, value: repeatDraft,
      placeholder: t.repeatHint, onInput: value => { repeatDraft = String(value ?? ''); },
      onSubmit: queueRepeated })
    : node(Text, '/qm repeat 5 continue');

  const search = Input
    ? Input({ key: 'qm-search', label: t.search, value: searchText,
      onInput: value => { searchText = String(value ?? ''); page = 0; redraw($); } })
    : node(Text, `${t.search}: ${searchText}`);

  const selectionRow = Box({ flexDirection: 'row', columnGap: 1, children: [
    node(Text, `${selection.length} ${t.selectedCount}`, { color: 'cyan' }),
    button(Button, 'qm-select-page', t.selectAll, () => { view.rows.forEach(x => selectedIds.add(x.id)); groupRemoveArmed = false; redraw($); }),
    button(Button, 'qm-deselect', t.deselectAll, () => { selectedIds.clear(); groupRemoveArmed = false; redraw($); }),
    button(Button, 'qm-move-top', t.moveTop, () => actGroup($, 'top'), { disabled: !selection.length }),
    button(Button, 'qm-move-bottom', t.moveBottom, () => actGroup($, 'bottom'), { disabled: !selection.length }),
    button(Button, 'qm-remove-group', groupRemoveArmed ? t.confirmClear : t.removeSelected, () => {
      if (!groupRemoveArmed) { groupRemoveArmed = true; redraw($); return; }
      return actGroup($, 'remove');
    }, { disabled: !selection.length })
  ] });

  const rows = view.rows.map(task => {
    const activeEdit = editId === task.id;
    return Box({ key: `qm-task-${task.id}`, flexDirection: 'row', columnGap: 1, children: [
      button(Button, `qm-check-${task.id}`, selectedIds.has(task.id) ? '[x]' : '[ ]', () => {
        if (selectedIds.has(task.id)) selectedIds.delete(task.id); else selectedIds.add(task.id);
        groupRemoveArmed = false; redraw($);
      }, { plain: true }),
      node(Text, `${task.position}. ${shortened(task.text, 92)}`, {
        color: activeEdit ? 'cyan' : undefined, bold: activeEdit, wrap: 'truncate-end'
      }),
      button(Button, `qm-edit-${task.id}`, t.select, () => {
        editId = task.id; editDraft = task.text; redraw($);
      }, { plain: true }),
      button(Button, `qm-up-${task.id}`, '↑', () => act($, `mv ${task.position} ${task.position - 1}`),
        { plain: true, disabled: task.position <= 1 }),
      button(Button, `qm-down-${task.id}`, '↓', () => act($, `mv ${task.position} ${task.position + 1}`),
        { plain: true, disabled: task.position >= state.pending.length }),
      button(Button, `qm-rm-${task.id}`, '×', () => act($, `rm ${task.position}`), { plain: true })
    ] });
  });

  const editPosition = state.pending.findIndex(task => task.id === editId);
  const editing = editPosition < 0 ? null : state.pending[editPosition];
  const editBox = editing
    ? block(Box, [
        node(Text, `${t.selected}: #${editPosition + 1}`, { color: 'cyan' }),
        ...(Input ? [Input({ key: 'qm-edit-input', label: t.edit, value: editDraft,
          onInput: value => { editDraft = String(value ?? ''); },
          onSubmit: async value => {
            const position = (await load($)).pending.findIndex(task => task.id === editId) + 1;
            if (!position) return;
            const result = await act($, `edit ${position} ${value}`);
            if (!result.startsWith('QM error:')) { editId = null; editDraft = ''; }
          }
        })] : []),
        Box({ flexDirection: 'row', columnGap: 1, children: [
          button(Button, 'qm-save-edit', t.save, async () => {
            const position = (await load($)).pending.findIndex(task => task.id === editId) + 1;
            if (!position) return;
            const result = await act($, `edit ${position} ${editDraft}`);
            if (!result.startsWith('QM error:')) { editId = null; editDraft = ''; redraw($); }
          }),
          button(Button, 'qm-cancel-edit', t.cancel, () => { editId = null; editDraft = ''; redraw($); })
        ] })
      ])
    : node(Text, t.editHint, { dimColor: true });

  const pages = Box({ flexDirection: 'row', columnGap: 2, children: [
    button(Button, 'qm-prev', t.prev, () => { page = Math.max(0, page - 1); redraw($); }, { disabled: page === 0 }),
    node(Text, `${t.page} ${page + 1}/${view.totalPages}  ·  ${view.totalMatches} ${t.match}`),
    button(Button, 'qm-next-page', t.next, () => { page = Math.min(view.totalPages - 1, page + 1); redraw($); },
      { disabled: page === view.totalPages - 1 })
  ] });
  const recent = state.done.length
    ? node(Text, `✓ ${t.done}: ${state.done.slice(0, 2).map(x => shortened(x.text, 45)).join(' · ')}`, { dimColor: true })
    : null;
  const recover = state.running
    ? button(Button, 'qm-recover', t.recover, () => act($, 'recover'), { plain: true })
    : null;

  return block(Box, [
    Box({ flexDirection: 'row', columnGap: 2, children: [title, langControl] }), stats, active,
    node(Text, t.oneAtTime, { dimColor: true }), actionRow, ...(confirmNotice ? [confirmNotice] : []),
    pasteInput, button(Button, 'qm-add-action', t.addButton, () => queuePasted(bulkDraft)),
    repeatInput, button(Button, 'qm-repeat-action', t.repeatButton, () => queueRepeated(repeatDraft)),
    search, selectionRow,
    ...(view.rows.length ? rows : [node(Text, state.pending.length ? t.noMatch : t.empty, { dimColor: true })]),
    pages, editBox, ...(recent ? [recent] : []), ...(recover ? [recover] : []),
    node(Text, t.help, { dimColor: true })
  ]);
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    const incomingSession = await $.session.id();
    if (cachedSessionId !== incomingSession) {
      page = 0; searchText = ''; bulkDraft = ''; repeatDraft = '';
      editDraft = ''; editId = null; clearArmed = false;
      groupRemoveArmed = false; selectedIds.clear();
      web = null; webTimer = null; webRevision = 0; webAck = null; webHandledId = 0;
    }
    await load($);
    try { language = (await $.store.get(PREFS_KEY)) === 'tr' ? 'tr' : 'en'; } catch {}
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
    if (web) await syncWebAction($);
    if (success && !updated.paused) scheduleNext($);
    if (!success) $.ui.toast('QM: task interrupted; pending queue paused');
    return result;
  });

  on('session.end', ($, e, next) => {
    if (web) void stopWeb($);
    return next(e);
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
