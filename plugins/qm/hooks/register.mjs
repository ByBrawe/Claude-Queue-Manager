import { canonicalLocale } from '../src/locales.mjs';
import { configDraft, parseSettings, configSignature, settingsGuard } from '../src/settings.mjs';
import { settingsStrings } from '../src/settings-locales.mjs';
// Queue Manager is a self-contained Claude Code mod.
// It never injects queued text into the current turn. Each item is submitted
// as a new user turn after a successful main turn.complete event.
import { DEFAULT_CONFIG, initialState, normalizeState, normalizeUsage, enqueue, remove, move, edit, clear, undo,
  claim, settleTurn, recordContext, configure, statsText, retryLast, rejectSubmission, recover,
  removeByIds, reorderByIds, moveSelected, runOne, cancelOne } from '../src/queue.mjs';
import { MARKER_NOTE, verdictFromText, parseAiVerdict, buildVerificationPrompt } from '../src/verification.mjs';
import { parseCommand, HELP, HELP_TR } from '../src/commands.mjs';
import { uiStrings, filteredPage, parseRepeatForm, splitPaste, SUPPORTED_UI_LANGUAGES } from '../src/view.mjs';
import { boundedState } from '../src/persistence.mjs';

const PANE_ID = 'qm';
const STORE_PREFIX = 'claude-queue-manager:queue:';
const MAX_PAGE = 12;
let cached = null;
let cachedSessionId = null;
let chain = Promise.resolve();
let page = 0;
let language = 'tr';
let searchText = '';
let bulkDraft = '';
let repeatDraft = '';
let editDraft = '';
let editId = null;
let clearArmed = false;
let undoArmed = false;
let groupRemoveArmed = false;
const selectedIds = new Set();
let web = null;
let webRevision = 0;
let webAck = null;
let webHandledId = 0;
let webTimer = null;
let retryTimer = null;
let verificationRunning = false;
const PREFS_KEY = 'claude-queue-manager:prefs:locale';
// Desktop may show an outdated slash-command list until a live session starts.
// A native button is always rendered as a second, model-free entry point.
let startupWarning = null;
let managerOpen = false;
let detailsOpen = false;
let settingsEditor = null;
let rowRemoveArmed = null;
let repeatCount = '5';

let repeatText = '';
let carryOver = false;
let verificationEpoch = 0;
let activeTurnId = null;
let liveTurnActive = false;

// Recovery only requeues an orphan; it never interrupts or dispatches a live turn.
function recoverWithHost(state) {
  return {...recover(state),busy:liveTurnActive||verificationRunning};
}

function reportStartupIssue($, stage, error) {
  const reason = String(error?.message ?? error);
  const message = `QM startup (${stage}): ${reason}`;
  startupWarning = message;
  // Use a visible log and a toast; debug-only logs hid registration failures.
  try { $.ui.log(message); } catch {}
  try { $.ui.toast(message, { timeoutMs: 10000 }); } catch {}
}

async function openManager($, side = false) {
  if (!side) {
    managerOpen = true;
    $.ui.invalidate('ui.render');
    // Close a side pane left open by an earlier release, if present.
    try { await $.ui.close({ id: PANE_ID }); } catch {}
    return;
  }
  managerOpen = false;
  $.ui.invalidate('ui.render');
  try {
    const outcome = await $.ui.open({ id: PANE_ID, title: 'Queue Manager', focus: true, closeOnEscape: true, rows: 18, columns: 56 });
    if (outcome?.isPlaced === false) {
      reportStartupIssue($, 'panel', outcome.reason ?? 'the host could not place the panel');
    }
  } catch (error) { reportStartupIssue($, 'panel', error); }
}

function exclusive(work) {
  const next = chain.then(work, work);
  chain = next.catch(() => {});
  return next;
}

async function load($) {
  const id = await $.session.id();
  if (cached && id !== cachedSessionId && carryOver) {
    carryOver = false;
    const oldId = cachedSessionId;
    const old = cached;
    const next = boundedState({ ...old, sessionId: id, paused: true, busy: false,
      recoverable: Boolean(old.running), pauseReason: 'session-cleared', undo: [] });
    // Retire first; if the new write fails, restore the old source.
    await $.store.set(STORE_PREFIX + oldId, { ...old,
      undo: [], paused: true, transferredTo: id });
    try { await $.store.set(STORE_PREFIX + id, next); }
    catch (error) { await $.store.set(STORE_PREFIX + oldId, old); throw error; }
    cachedSessionId = id;
    cached = next;
    return cached;
  }
  if (id !== cachedSessionId) carryOver = false;
  if (cached && id === cachedSessionId) {
    // A paused queue may be transferred to another session. Invalidate an old
    // process-local cache so resuming the source cannot replay transferred tasks.
    const persisted = await $.store.get(STORE_PREFIX + id);
    if (persisted?.transferredTo && cached.transferredTo !== persisted.transferredTo) {
      cached = normalizeState(persisted, id, await $.clock.now());
    }
    return cached;
  }
  const raw = await $.store.get(STORE_PREFIX + id);
  cached = raw ? normalizeState(raw, id, await $.clock.now()) : initialState(id, await $.clock.now());
  cachedSessionId = id;
  return cached;
}

function readState($) { return exclusive(() => load($)); }

async function save($, next) {
  const key = STORE_PREFIX + cachedSessionId;
  const persisted = await $.store.get(key);
  if (persisted?.transferredTo && !next.transferredTo) throw new Error('This queue was transferred to another session.');
  let durable = boundedState({ ...next, updatedAt: await $.clock.now() });
  try { await $.store.set(key, durable); }
  catch (error) {
    // Other sessions consume the same store. Retry quota errors without optional
    // history; failed writes must never replace the last durable in-memory state.
    if (!/4\s*MiB|quota|storage|store.*(limit|size|full)/i.test(String(error?.message ?? error))) throw error;
    durable = { ...durable, undo: [], history: [], done: [] };
    try { await $.store.set(key, durable); }
    catch { throw new Error('Plugin storage is full. Shorten this batch or clear old saved queues; existing work is unchanged.'); }
  }
  cached = durable;
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
    const context = normalizeUsage(await readUsage($)) ?? cached.context;
    await webRequest($, 'state', 'POST', {
      revision: webRevision,
      state: { sessionId: cachedSessionId, locale: language, pending: cached.pending, running: cached.running, done: cached.done,
        paused: cached.paused, busy: cached.busy, stats: cached.stats, recoverable:cached.recoverable,
        hostActive:liveTurnActive||verificationRunning, singleRun:cached.singleRun,
        context, config: cached.config, pauseReason: cached.pauseReason,
        history: cached.history.slice(0, 12) },
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
    await change($, (state, now) => {
      if (item.revision !== webRevision) throw new Error('Queue changed; refresh before editing');
      const op = item.operation;
      if (op.type === 'reorder') return reorderByIds(state, op.ids);
      if (op.type === 'remove') return removeByIds(state, op.ids);
      if (op.type === 'add') return enqueue(state, op.texts);
      if (op.type === 'configure') { settingsGuard(state,op.base); return configure(state,op.updates); }
      if (op.type === 'retry-last') { if(state.running)throw new Error('running'); return retryLast(state,now); }
      if (op.type === 'recover') return recoverWithHost(state);
      if (op.type === 'run-one') return runOne({...state,busy:state.busy||liveTurnActive},op.id);
      if (op.type === 'cancel-one') return cancelOne(state);
      if (op.type === 'pause') return { ...state, paused: true };
      if (op.type === 'resume') { if(state.recoverable)throw new Error('recoveryState'); return { ...state, paused: false }; }
      throw new Error('Unknown browser operation');
    });
    webAck = { id: item.id, ok: true };
    // A pause/resume/add may enable the next task if Claude is idle.
    if (['resume', 'add', 'run-one'].includes(item.operation.type)) scheduleNext($);
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
    try {
      await webRequest($, 'state');
      await sendWebSnapshot($);
      return openWebLink($);
    } catch {
      await stopWeb($);
    }
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
  return openWebLink($);
}

async function openWebLink($) {
  const privateUrl = `${urlForWeb()}/#token=${web.token}`;
  let copied = false;
  try { const result = await $.ui.copy(privateUrl); copied = result?.isCopied !== false; } catch {}
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
    if (before.transferredTo) throw new Error(`Queue was transferred to ${before.transferredTo}; edit it in that session.`);
    const after = fn(before, await $.clock.now());
    if (after !== before) await save($, after);
    return after;
  });
}

function logError($, err) {
  try { $.ui.log('Queue Manager: ' + String(err?.message ?? err), { to: 'debug' }); } catch {}
}

// A failed usage read is never converted into a made-up token estimate.
async function readUsage($) {
  try { return await $.session.usage(); }
  catch (error) { logError($, error); return null; }
}

function cancelRetryTimer() {
  if (retryTimer) { try { retryTimer.cancel(); } catch {} retryTimer = null; }
}

function scheduleNext($) {
  cancelRetryTimer();
  const epoch = verificationEpoch;
  // Read the actual context before dispatch, not a stale snapshot from the last turn.
  void (async () => {
    const usage = await readUsage($);
    return exclusive(async () => {
      if (epoch !== verificationEpoch) return { task: null };
      let state = await load($);
      if (usage) {
        const updated = recordContext(state, usage);
        if (updated !== state) { await save($, updated); state = updated; }
      }
      const result = claim(state, await $.clock.now());
      if (result.state !== state) await save($, result.state);
      return result;
    });
  })().then(result => {
    if (epoch !== verificationEpoch) return;
    if (result.task) { void submitOne($, result.task, epoch); return; }
    if (result.waitMs > 0) {
      retryTimer = $.clock.after(result.waitMs, () => { retryTimer = null; scheduleNext($); });
    }
  }).catch(error => logError($, error));
}

async function submitOne($, task, epoch) {
  let dropped;
  try {
    const state = await readState($);
    if (epoch !== verificationEpoch || state.running?.id !== task.id || state.recoverable || state.transferredTo) return;
    if (state.paused) {
      await change($, current => rejectSubmission(current, task.id));
      return;
    }
    const text = state.config.verify === 'marker' ? task.text + MARKER_NOTE : task.text;
    const result = await $.prompt.submit({ text, asUser: true });
    dropped = result?.drop;
  } catch (error) {
    dropped = String(error?.message ?? error);
  }
  if (dropped === undefined) return;
  await change($, state => rejectSubmission(state, task.id));
  $.ui.toast('QM: task not started; queue paused. /qm resume to retry');
  logError($, dropped);
}

async function verifyAnswer($, task, answer, config) {
  if (config.verify === 'off') return 'success';
  if (config.verify === 'marker') return verdictFromText(answer);
  if (config.verify === 'ai') {
    if (!String(answer || '').trim()) return 'unknown';
    const question = buildVerificationPrompt(task.text, answer);
    try {
      const result = await $.model.complete({
        model: config.model, system: question.system, prompt: question.prompt,
        maxTokens: 64, effort: 'low', timeoutMs: 25000
      });
      return result?.isAnswered === false ? 'unknown' : parseAiVerdict(result?.text);
    } catch (error) { logError($, error); return 'unknown'; }
  }
  return 'unknown';
}

function formatHistory(state, count = 15) {
  const records = state.history.slice(0, count);
  if (!records.length) return 'QM: history empty';
  return ['QM history (latest first):', ...records.map(r =>
    `#${r.id} ${r.status || 'success'} ${Number.isFinite(r.durationMs) ? `${Math.round(r.durationMs/1000)}s` : '?'} attempt ${r.attempts || 1} · ${r.text.slice(0, 120)}`)
  ].join('\n');
}

async function listSessions($) {
  let keys;
  try { keys = (await $.store.keys()).filter(k => k.startsWith(STORE_PREFIX)); }
  catch (error) { logError($, error); return 'QM: session listing unavailable in this host'; }
  const sessions = await Promise.all(keys.map(async key => {
    const data = await $.store.get(key);
    return { id: key.slice(STORE_PREFIX.length), data };
  }));
  const rows = sessions.filter(x => x.data?.pending?.length || x.data?.running)
    .sort((a,b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0)).slice(0,20);
  return rows.length ? ['QM saved sessions (restore requires a paused source and empty target):',
    ...rows.map(x => `${x.id} · ${x.data.pending.length} pending${x.data.running ? ' + in-flight' : ''} · ${x.data.paused ? 'paused' : 'active'}`)
  ].join('\n') : 'QM: no non-empty saved queue sessions';
}

async function restoreSession($, sessionId, acknowledgeRunning) {
  return exclusive(async () => {
    const target = await load($);
    const targetId = await $.session.id();
    if (sessionId === targetId) throw new Error('Cannot restore the current session into itself');
    if (target.pending.length || target.running || target.history.length) throw new Error('Target session must have an empty QM queue and history');
    const key = STORE_PREFIX + sessionId;
    const owner = `${targetId}:${await $.clock.now()}:${Math.random().toString(36).slice(2)}`;
    const lockScript = `${$.plugin.root}/src/restore-lock.mjs`;
    const lock = await $.process.run(['node', lockScript, 'acquire', sessionId, owner], { timeoutMs: 6000 });
    if (lock.exitCode !== 0) throw new Error(lock.stderr || 'Could not lock source queue. Restore requires local Node.js 20+.');
    try {
    const raw = await $.store.get(key);
    if (!raw) throw new Error('No saved queue with that session ID');
    if (raw.transferredTo && raw.transferredTo !== targetId) throw new Error(`Queue was already transferred to ${raw.transferredTo}`);
    if (!raw.paused && !raw.running) throw new Error('Source queue is active. Pause it in its original session first.');
    if (raw.running && !acknowledgeRunning) throw new Error('Source has an in-flight task. Use: /qm restore SESSION_ID recover (may duplicate work)');
    let source = normalizeState(raw, sessionId, await $.clock.now());
    if (source.running) source = recover(source);
    if (!source.pending.length) throw new Error('Source has no pending work');
    const transferred = { ...source, sessionId: targetId, paused: true,
      pauseReason: 'restored-needs-review', transferredTo: null, busy: false, running: null, undo: [] };
    // First retire the original queue to prevent two sessions from running copied tasks.
    // Keep a frozen source copy: a crash between the two durable writes cannot
    // destroy the only copy of the work. Only the named target may retry it.
    const retired = { ...source, undo: [], paused: true, transferredTo: targetId };
    await $.store.set(key, retired);
    try { await save($, transferred); }
    catch (error) { await $.store.set(key, raw); throw error; }
    return `QM: transferred ${transferred.pending.length} task(s) from ${sessionId}; queue paused for review. /qm resume when safe.`;
    } finally {
      const unlock = await $.process.run(['node', lockScript, 'release', sessionId, owner], { timeoutMs: 6000 });
      if (unlock.exitCode !== 0) logError($, unlock.stderr || 'Restore lock release failed; inspect the stale lock before retrying.');
    }
  });
}

async function perform($, text) {
  const intent = parseCommand(text);
  if (intent.type === 'open' || intent.type === 'list') {
    await openManager($);
    return '';
  }
  if (intent.type === 'side') { await openManager($, true); return ''; }
  if (intent.type === 'close') {
    managerOpen = false;
    $.ui.invalidate('ui.render');
    try { await $.ui.close({ id: PANE_ID }); } catch {}
    return '';
  }
  if (intent.type === 'help') { if(language==='tr')return HELP_TR; if(language==='en')return HELP; const t=uiStrings(language); return [['/qm',t.title],['/qm add / batch',t.addButton],['/qm repeat',t.repeatButton],['/qm run / run cancel',t.runOne],['/qm pause',t.pause],['/qm resume',t.resume],['/qm edit / rm / mv',t.edit+' / '+t.remove+' / '+t.moveTop],['/qm clear / undo',t.clear+' / '+t.undo],['/qm verify / retry / timeout',t.verifyLabel+' / '+t.retryLabel+' / '+t.timeoutLabel],['/qm context',t.contextLabel],['/qm if success|failure',t.verifyLabel],['/qm history / stats',t.historyLabel+' / '+t.analytics],['/qm sessions / recover / restore',t.sessionsLabel],['/qm web',t.openWeb],['/qm lang',t.language]].map(x=>x.join(' — ')).join('\n'); }
  if (intent.type === 'web') return startWeb($);
  if (intent.type === 'web-stop') { await stopWeb($); return 'QM: web dashboard stopped'; }
  if (intent.type === 'sessions') return listSessions($);
  if (intent.type === 'restore') return restoreSession($, intent.sessionId, intent.recover);
  if (intent.type === 'stats') return statsText(await readState($));
  if (intent.type === 'history') return formatHistory(await readState($), intent.count);
  if (intent.type === 'settings') return `QM settings: ${JSON.stringify((await readState($)).config)}`;
  if (intent.type === 'context-status') {
    const usage = await readUsage($);
    if (usage) await change($, state => recordContext(state, usage));
    const state = await readState($);
    return `QM context: ${state.context ? `${state.context.tokens}/${state.context.window} (${state.context.percent}%)` : 'unavailable'}. Guard: ${state.config.contextPercent || 'off'}%.`;
  }
  if (intent.type === 'lang') {
    language = intent.code;
    await $.store.set(PREFS_KEY, language);
    $.ui.invalidate('ui.render');
    return `QM: language set to ${language}`;
  }
  if (intent.type === 'next') return perform($, 'resume');
  const updated = await change($, (state, now) => {
    switch (intent.type) {
      case 'add': return enqueue(state, intent.texts, intent.where ?? 'end', now, intent.when ?? 'always');
      case 'config': return configure(state, intent.updates);
      case 'retry-last': return retryLast(state, now);
      case 'rm': return remove(state, intent.position);
      case 'mv': return move(state, intent.from, intent.to);
      case 'edit': return edit(state, intent.position, intent.text);
      case 'clear': return clear(state);
      case 'undo': return undo(state);
      case 'recover': return recoverWithHost(state);
      case 'run-one': return runOne({...state,busy:state.busy||liveTurnActive},state.pending[intent.position-1]?.id);
      case 'cancel-one': return cancelOne(state);
      case 'pause': return { ...state, paused: true, pauseReason: 'user' };
      case 'resume': {
        if (state.transferredTo) throw new Error('Queue was transferred to another session.');
        if (state.recoverable) throw new Error('Review the orphaned task, then /qm recover before resuming.');
        return { ...state, paused: false, pauseReason: null };
      }
      default: throw new Error('Unsupported queue action');
    }
  });
  if (intent.type === 'add' || intent.type === 'resume' || intent.type === 'run-one') scheduleNext($);
  if(intent.type==='run-one')return uiStrings(language).singleQueued;
  if(intent.type==='cancel-one')return uiStrings(language).cancelSingle;
  if (intent.type === 'config') return `QM: ${JSON.stringify(updated.config)} (takes effect on subsequent turns)`;
  if (intent.type === 'add') return `QM: ${intent.texts.length} added; ${updated.pending.length} pending${intent.when ? ` (if ${intent.when})` : ''}`;
  if (intent.type === 'recover') return 'QM: in-flight task recovered; queue paused. Review then /qm resume';
  if (intent.type === 'retry-last') return 'QM: last failed/unknown task requeued at front; review then /qm resume';
  return `QM: ${intent.type} OK; ${updated.pending.length} pending${updated.paused ? ' (paused)' : ''}`;
}

async function safePerform($, args) {
  try { return await perform($, args); }
  catch (error) { const key=error?.message;return 'QM error: '+(['singleMissing','singleBusy','recoveryState'].includes(key)?uiStrings(language)[key]:String(key??error)); }
}

const shortened = (text, limit = 92) => text.length <= limit ? text : text.slice(0, limit - 3) + '...';
const node = (Text, value, props = {}) => Text({ ...props, children: [String(value)] });
const block = (Box, children, props = {}) => Box({ flexDirection: 'column', rowGap: 1, ...props, children });
const button = (Button, key, label, onPress, extra = {}) => Button({ key, label, onPress, ...extra });

function status(state, t) {
  if(state.running&&state.recoverable)return t.recoveryState;
  return state.paused ? t.paused : state.running ? t.running : state.busy ? t.working : t.ready;
}

function redraw($) { $.ui.invalidate('ui.render'); }
function notify($, result) { if (result) $.ui.toast(result); }
async function act($, command) {
  clearArmed = false;
  undoArmed = false;
  const result = await safePerform($, command);
  notify($, result);
  redraw($);
  return result;
}

async function runSelected($,id) {
  const t=uiStrings(language);
  try{await change($,state=>runOne({...state,busy:state.busy||liveTurnActive},id));notify($,t.singleQueued);scheduleNext($);}
  catch(error){notify($,'QM: '+(t[error.message]||error.message));}
  redraw($);
}

async function drawBand($, e, next) {
  if (e.props?.hasSurvey) return next(e);
  if (managerOpen) return drawPane($, e);
  const { Box, Text, Button } = $.ui.resolve(e);
  const text = uiStrings(language);
  const openButton = button(Button, 'qm-open', text.expand || text.details, () => openManager($), { plain: true });
  const entries = [
    button(Button,'qm-band-side',text.side,()=>openManager($,true),{plain:true}),
    openButton,
    button(Button,'qm-band-web','Web',()=>act($,'web'),{plain:true})
  ];
  let state;
  try { state = await readState($); }
  catch (error) {
    return Box({ flexDirection: 'row', columnGap: 2, children: [
      node(Text, 'QM !', { color: 'yellow', bold: true }),
      ...entries
    ] });
  }
  if (!state.pending.length && !state.running && !startupWarning) return next(e);
  if (startupWarning) {
    return Box({ flexDirection: 'row', columnGap: 1, children: [
      node(Text, startupWarning, { color: 'yellow', wrap: 'truncate-end' }),
      ...entries
    ] });
  }
  const t = uiStrings(language);
  const nextName = state.pending.length ? shortened(state.pending[0].text, 45) : (state.running ? t.running : t.ready);
  return Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: [
    node(Text, `${state.pending.length} ${t.pending} · ${status(state, t)} · ${nextName}`, { wrap: 'truncate-end', dimColor: true }),
    ...entries
  ] });
}

// Resolve an ID under the same queue mutex as the write. A stale drawing can
// never reinterpret its old row number as a different task.
async function actTask($, id, kind, value) {
  try {
    await change($, state => {
      const at = state.pending.findIndex(task => task.id === id);
      if (at < 0) throw new Error('Task already started or was removed; refresh the queue.');
      if (kind === 'remove') return removeByIds(state, [id]);
      if (kind === 'edit') return edit(state, at + 1, value);
      const target = at + value;
      if (target < 0 || target >= state.pending.length) return state;
      return move(state, at + 1, target + 1);
    });
    redraw($);
    return true;
  } catch (error) { notify($, `QM error: ${error.message}`); return false; }
}

async function actGroup($, kind) {
  const state = await readState($);
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
  try {
    return await buildPane($, e);
  }
  catch (error) {
    const { Box, Text, Button } = $.ui.resolve(e);
    return block(Box, [node(Text, `Queue Manager: ${String(error?.message ?? error)}`, { color: 'yellow' }),
      button(Button, 'qm-close', uiStrings(language).close, () => act($, 'close'))]);
  }
}

async function buildPane($, e) {
  const { Box, Text, Button, Input, Select } = $.ui.resolve(e);
  const inline = e.component === 'AbovePrompt';
  // Opening /qm always exposes the complete queue workspace above the composer.
  // Details controls telemetry only; it must never hide core queue actions.
  const expanded = true;
  const t = uiStrings(language);
  const state = await readState($);
  const needsRecovery=Boolean(state.running&&state.recoverable);
  const liveContext = normalizeUsage(await readUsage($));
  const context = liveContext ?? state.context;
  const narrow = (e.props?.bodyColumns || 60) < 70;
  const view = filteredPage(state.pending, searchText, page, inline ? 4 : MAX_PAGE);
  page = view.page;
  for (const id of selectedIds) if (!state.pending.some(x => x.id === id)) selectedIds.delete(id);
  const selection = state.pending.filter(x => selectedIds.has(x.id));

  const title = node(Text, `Queue Manager · ${status(state, t)}`, {
    color: needsRecovery || state.paused ? 'yellow' : state.running ? 'green' : 'cyan', bold: true
  });
  const stats = node(Text, `${state.pending.length} ${t.pending} · ${state.running&&!needsRecovery ? 1 : 0} ${t.active}${needsRecovery ? ' · 1 '+t.recoveryState : ''} · ${state.stats.success} ${t.done}`, { dimColor: true });
  const contextLine = node(Text, `${t.contextLabel}: ${context ? `${context.percent}% (${context.tokens}/${context.window})` : t.contextMissing} · ${t.verifyLabel}: ${state.config.verify === 'off' ? t.off : state.config.verify} · ${t.retryLabel}: ${state.config.retries} · ${t.timeoutLabel}: ${state.config.timeoutMs ? `${Math.round(state.config.timeoutMs/1000)}s` : t.off}`, { dimColor: true });
  const pauseNames = language === 'tr' ? {user:'kullanıcı duraklattı',interrupted:'tur kesildi',failure:'başarısız görev',timeout:'süre sınırı',unknown:'sonuç bilinmiyor','verify-unknown':'doğrulama belirsiz','session-cleared':'yeni oturumda inceleme bekliyor','submit-rejected':'görev gönderimi reddedildi',recovery:'kurtarma gerekiyor','recovered-needs-review':'kurtarıldı; inceleme bekliyor','restored-needs-review':'taşındı; inceleme bekliyor','manual-retry':'elle yeniden deneme'} : {};
  const genericReason = language!=='en' && language!=='tr' ? ({timeout:t.timeoutLabel,failure:t.failure,'verify-unknown':t.verifyLabel,recovery:t.recover,'session-cleared':t.sessionsLabel,interrupted:t.pause,user:t.pause}[state.pauseReason] || t.paused) : null;
  const singleReason=({'single-task-complete':t.singleDone,'single-task-skipped':t.singleSkipped,'single-task-cancelled':t.singleMissing})[state.pauseReason];
  const reason = singleReason ?? genericReason ?? pauseNames[state.pauseReason] ?? (language === 'tr' && state.pauseReason?.startsWith('context:') ? `bağlam eşiği %${state.pauseReason.split(':')[1]}` : state.pauseReason);
  const pauseInfo = state.pauseReason ? node(Text, `${t.pauseReason}: ${reason}`, { color: 'yellow' }) : null;
  const recentOutcomes = state.history.slice(0, 4).map(item => node(Text,
    `#${item.id} ${({success:t.done,failure:t.failure||t.unavailable,timeout:t.timeoutLabel,unknown:t.unavailable,skipped:t.skipped||t.off})[item.status] || t.done} · ${Math.round((item.durationMs || 0)/1000)}s · ${shortened(item.text, 65)}`,
    { dimColor: true }));
  const st=settingsStrings(language);
  if(!settingsEditor || settingsEditor.sessionId!==state.sessionId || !settingsEditor.dirty){
    settingsEditor={sessionId:state.sessionId,base:{...state.config},draft:configDraft(state.config),dirty:false,error:null,saving:false};
  }
  const editor=settingsEditor;
  const settingField=(key,label,options)=>{
    const update=value=>{editor.draft[key]=String(value);editor.dirty=true;editor.error=null;};
    return block(Box,[node(Text,label),Box({width:'100%',flexDirection:'column',children:[options&&Select
      ? Select({key:'qm-setting-'+key,options,value:editor.draft[key],onSelect:update})
      : Input({key:'qm-setting-'+key,value:editor.draft[key],onInput:update,onSubmit:update})]})],{rowGap:0});
  };
  const saveSettings=async()=>{
    if(editor.saving)return;
    const submitted={...editor.draft};
    editor.dirty=true;editor.saving=true;redraw($);
    try{
      let updates;
      try{updates=parseSettings(submitted);}catch(error){throw new Error(st.invalid+': '+(st[error.message]||error.message));}
      await change($,current=>{
        if(current.sessionId!==editor.sessionId)throw new Error('stale');
        settingsGuard(current,editor.base);return configure(current,updates);
      });
      if(JSON.stringify(editor.draft)===JSON.stringify(submitted))settingsEditor=null;
      else {editor.base={...updates};editor.error=null;settingsEditor=editor;}
      notify($,st.saved);
    }catch(error){editor.error=st[error.message]||st.error+': '+String(error.message);notify($,editor.error);}
    finally{editor.saving=false;redraw($);}
  };
  const settingsForm=block(Box,[node(Text,st.title,{bold:true}),node(Text,st.hint,{dimColor:true}),node(Text,st.defaultsHint,{dimColor:true}),
    settingField('verify',st.verify,[{value:'off',label:t.off},{value:'marker',label:'Marker'},{value:'ai',label:'AI'}]),
    settingField('model',st.model),node(Text,st.aiHint,{dimColor:true}),
    settingField('retries',st.retries),settingField('retryDelay',st.retryDelay),node(Text,st.retryHint,{dimColor:true}),settingField('timeout',st.timeout),
    settingField('contextPercent',st.contextPercent+' · 0–99'),
    settingField('onFail',st.onFail,[{value:'pause',label:t.pause},{value:'continue',label:t.resume}]),
    ...(editor.error?[node(Text,editor.error,{color:'red'})]:[]),
    ...(editor.dirty&&configSignature(editor.base)!==configSignature(state.config)?[node(Text,st.stale,{color:'yellow'})]:[]),
    ...(state.running?[node(Text,st.running,{color:'yellow'})]:[]),
    Box({flexDirection:'row',flexWrap:'wrap',columnGap:1,children:[
      button(Button,'qm-settings-save',st.apply,saveSettings,{variant:'primary',disabled:Boolean(state.running)||editor.saving}),
      button(Button,'qm-settings-reset',st.reset,()=>{settingsEditor=null;redraw($);},{disabled:editor.saving}),
      button(Button,'qm-settings-defaults',st.defaults,async()=>{
        if(editor.saving)return;
        editor.draft=configDraft(DEFAULT_CONFIG);editor.dirty=true;await saveSettings();
      },{disabled:Boolean(state.running)||editor.saving}),
      button(Button,'qm-retry-last',st.retryLast,()=>act($,'retry last'),{disabled:Boolean(state.running)||!state.history.some(x=>['failure','unknown','timeout'].includes(x.status))})]})
  ]);
  const advancedActions = Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, children: [
    button(Button, 'qm-stats', t.analytics, () => act($, 'stats')),
    button(Button, 'qm-context', t.contextLabel, () => act($, 'context')),
    button(Button, 'qm-history', t.historyLabel, () => act($, 'history')),
    button(Button, 'qm-sessions', t.sessionsLabel, () => act($, 'sessions'))
  ] });
  const active = state.running
    ? node(Text, `▶ ${t.active}: ${shortened(state.running.text, 115)}`, { color: 'green' })
    : node(Text, state.busy ? t.waiting : t.noActive, { dimColor: true });

  const actionRow = Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, children: [
    ...(needsRecovery?[button(Button,'qm-recover',t.recoveryAction,async()=>{
      try{
        await change($,current=>recoverWithHost(current));
        notify($,t.recoveryAction+' · '+t.paused);
      }catch(error){notify($,'QM error: '+error.message);}
      redraw($);
    },{variant:'primary'})]:[]),
    ...(!needsRecovery?[button(Button, 'qm-toggle', state.paused ? t.resume : t.pause,
      () => act($, state.paused ? 'resume' : 'pause'), { variant:'primary', hotkey:'p' })]:[]),
    ...(!needsRecovery&&state.undo.length?[button(Button,'qm-undo',undoArmed?t.confirmUndo:t.undoQueue,async()=>{
      if(!undoArmed){undoArmed=JSON.stringify(state.undo[0]);redraw($);return;}
      const expected=undoArmed;
      try{
        await change($,current=>{
          if(current.recoverable||JSON.stringify(current.undo[0])!==expected)throw new Error('stale');
          return {...undo(current),paused:true,pauseReason:'user'};
        });
      }catch(error){notify($,error.message==='stale'?t.undoQueue+' · '+t.cancel:'QM error: '+error.message);}
      undoArmed=false;redraw($);
    }),...(undoArmed?[button(Button,'qm-cancel-undo',t.cancel,()=>{undoArmed=false;redraw($);})]:[])]:[]),
    button(Button, 'qm-clear', clearArmed ? t.confirmClear : t.clear, async () => {
      if (!clearArmed) { clearArmed = true; redraw($); return; }
      await act($, 'clear');
    }, { disabled: !state.pending.length }),
    ...(clearArmed ? [button(Button, 'qm-cancel', t.cancel, () => { clearArmed = false; redraw($); })] : []),
    button(Button, 'qm-web-open', t.openWeb, () => act($, 'web'))
  ] });
  const confirmNotice = clearArmed ? node(Text, t.clearWarn, { color: 'yellow' }) : null;
  const undoNotice=undoArmed&&!needsRecovery&&state.undo.length?node(Text,`${t.undoQueue}: ${state.pending.length} → ${undo(state).pending.length} ${t.pending}`,{color:'yellow'}):null;

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
    ? block(Box, [node(Text, t.tasks || t.pending, { bold: true }),
      Box({ width: '100%', flexDirection: 'column', children: [Input({ key: 'qm-add-tasks', rows: inline ? 2 : 4, value: bulkDraft, ...(editId === null ? {autoFocus:true} : {}),
      placeholder: t.addHint, onInput: value => { bulkDraft = String(value ?? ''); },
      onSubmit: queuePasted })] }), node(Text, state.singleRun||state.running?.singleOnce||state.paused||needsRecovery?t.addPaused:t.addStarts, { dimColor: true })], { rowGap: 0 })
    : node(Text, '/qm batch task 1 || task 2');

  const repeatInput = Input
    ? block(Box, [node(Text, t.repeatButton, { bold: true }),
      Input({ key: 'qm-repeat-tasks', value: repeatDraft,
      placeholder: t.repeatHint, onInput: value => { repeatDraft = String(value ?? ''); },
      onSubmit: queueRepeated })], { rowGap: 0 })
    : node(Text, '/qm repeat 5 continue');

  const search = Input
    ? Input({ key: 'qm-search', placeholder: t.search, value: searchText,
      onSubmit: value => { searchText = String(value ?? ''); page = 0; redraw($); },
      onInput: value => { searchText = String(value ?? ''); page = 0; redraw($); } })
    : node(Text, `${t.search}: ${searchText}`);

  const selectionRow = Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, children: [
    node(Text, `${selection.length} ${t.selectedCount}`, { color: 'cyan' }),
    button(Button, 'qm-select-page', t.selectAll, () => { view.rows.forEach(x => selectedIds.add(x.id)); groupRemoveArmed = false; redraw($); }),
    button(Button, 'qm-deselect', t.deselectAll, () => { selectedIds.clear(); groupRemoveArmed = false; redraw($); }),
    ...(selection.length===1&&!needsRecovery&&!state.singleRun&&!state.running?.singleOnce?[button(Button,'qm-run-selected',t.runOne,()=>runSelected($,selection[0].id),{variant:'primary'})]:[]),
    button(Button, 'qm-move-top', t.moveTop, () => actGroup($, 'top'), { disabled: !selection.length }),
    button(Button, 'qm-move-bottom', t.moveBottom, () => actGroup($, 'bottom'), { disabled: !selection.length }),
    button(Button, 'qm-remove-group', groupRemoveArmed ? t.confirmClear : t.removeSelected, () => {
      if (!groupRemoveArmed) { groupRemoveArmed = true; redraw($); return; }
      return actGroup($, 'remove');
    }, { disabled: !selection.length })
  ] });

  const rows = view.rows.map(task => {
    const activeEdit = editId === task.id;
    const cells = [
      button(Button, `qm-check-${task.id}`, selectedIds.has(task.id) ? '[x]' : '[ ]', () => {
        if (selectedIds.has(task.id)) selectedIds.delete(task.id); else selectedIds.add(task.id);
        groupRemoveArmed = false; redraw($);
      }, { plain: true }),
      node(Text, `${task.position}. ${task.when !== 'always' ? `[if ${task.when}] ` : ''}${shortened(task.text, Math.max(12, (e.props?.bodyColumns || 116) - (narrow ? 10 : 24)))}`, {
        color: activeEdit || task.position === 1 ? 'cyan' : undefined, bold: activeEdit || task.position === 1, wrap: 'truncate-end'
      }),
      button(Button, `qm-edit-${task.id}`, t.select, () => {
        editId = task.id; editDraft = task.text; redraw($);
      }, { plain: true }),
      button(Button, `qm-up-${task.id}`, '↑', () => actTask($, task.id, 'move', -1),
        { plain: true, disabled: task.position <= 1 }),
      button(Button, `qm-down-${task.id}`, '↓', () => actTask($, task.id, 'move', 1),
        { plain: true, disabled: task.position >= state.pending.length }),
      button(Button, `qm-rm-${task.id}`, rowRemoveArmed === task.id ? t.confirmClear : t.remove, () => {
        if (rowRemoveArmed !== task.id) { rowRemoveArmed = task.id; redraw($); return; }
        rowRemoveArmed = null; return actTask($, task.id, 'remove');
      }, { plain: true })
    ];
    return Box({key:`qm-task-${task.id}`,flexDirection:narrow?'column':'row',columnGap:1,children:narrow?[
      Box({key:`qm-heading-${task.id}`,flexDirection:'row',columnGap:1,children:cells.slice(0,2)}),
      Box({key:`qm-controls-${task.id}`,flexDirection:'row',flexWrap:'wrap',columnGap:1,children:cells.slice(2)})
    ]:cells});
  });

  const editPosition = state.pending.findIndex(task => task.id === editId);
  const editing = editPosition < 0 ? null : state.pending[editPosition];
  const editBox = editing
    ? block(Box, [
        node(Text, `${t.edit}: ${editPosition + 1}.`, { color: 'cyan', bold: true }),
        node(Text,t.editHelp,{dimColor:true}),
        ...(Input ? [Box({key:'qm-edit-field',width:'100%',flexDirection:'column',children:[Input({ key: 'qm-edit-input', value: editDraft, rows: inline ? 6 : 10, autoFocus:true,
          onInput: value => { editDraft = String(value ?? ''); },
          onSubmit: value => { editDraft = String(value ?? ''); }
        })]})] : []),
        Box({ flexDirection: 'row', columnGap: 1, children: [
          button(Button, 'qm-save-edit', t.save, async () => {
            if (await actTask($, editing.id, 'edit', editDraft)) { editId = null; editDraft = ''; redraw($); }
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
  const recoveryNotice=needsRecovery?block(Box,[node(Text,`${t.recoveryState}: ${shortened(state.running.text,140)}`,{color:'yellow',bold:true}),
    node(Text,t.recoveryHint,{color:'yellow'}),...(liveTurnActive||verificationRunning?[node(Text,t.recoveryWait,{dimColor:true})]:[])],{key:'qm-recovery-notice'}):null;
  const singleTask=state.singleRun?state.pending.find(task=>task.id===state.singleRun.taskId):state.running?.singleOnce?state.running:null;
  const singleNotice=state.singleRun||state.running?.singleOnce?block(Box,[
    node(Text,`${state.singleRun?t.singleQueued:t.singleActive}: ${shortened(singleTask?.text||t.singleMissing,120)}`,{color:'cyan',bold:true}),
    node(Text,t.singleHint,{dimColor:true}),...(state.singleRun?[button(Button,'qm-cancel-single',t.cancelSingle,()=>act($,'run cancel'))]:[])
  ],{key:'qm-single-notice'}):null;

  return block(Box, [
    Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: [title, langControl,
      button(Button, 'qm-close', t.close, () => act($, 'close'), { plain: true, hotkey: 'q', role: 'dismiss' }),
      button(Button, 'qm-side', t.side || t.openWeb, () => act($, 'side'), { plain: true })] }),
    stats, ...(expanded ? [actionRow] : [button(Button,'qm-toggle',state.paused?t.resume:t.pause,()=>act($,state.paused?'resume':'pause'),{variant:'primary',hotkey:'p'})]), ...(recoveryNotice?[recoveryNotice]:[]),
    ...(singleNotice?[singleNotice]:[]),
    ...(needsRecovery?[]:state.running ? [active] : state.busy ? [node(Text,t.waiting,{dimColor:true})] : !inline && state.pending.length===0 ? [node(Text, t.empty, {dimColor:true})] : []),
    ...(expanded ? [node(Text, t.pauseHint, { dimColor: true })] : []),
    ...(pauseInfo ? [pauseInfo] : []), ...(confirmNotice ? [confirmNotice] : []),...(undoNotice?[undoNotice]:[]),
    ...(state.pending.length ? [Box({key:'qm-next-pending',width:'100%',flexDirection:'column',children:[node(Text,`${t.nextPending}: 1. ${shortened(state.pending[0].text,115)}`,{color:'cyan',bold:true})]}),
      node(Text,t.orderHint,{dimColor:true}),
      button(Button,'qm-show-next',t.showNext,()=>{page=0;searchText='';redraw($);},{plain:true})] : []),
    ...(editing ? [editBox] : []),
    pasteInput, button(Button, 'qm-add-action', t.addButton, () => queuePasted(bulkDraft), {variant:'primary'}),
    ...[
      node(Text,t.repeatButton,{bold:true}),
      Input({key:'qm-repeat-count',label:t.count,value:repeatCount,onInput:v=>repeatCount=v,onSubmit:v=>{repeatCount=v;}}),
      Box({width:'100%',flexDirection:'column',children:[Input({key:'qm-repeat-message',value:repeatText,placeholder:t.repeatMessage,rows:2,onInput:v=>repeatText=v,onSubmit:v=>{repeatText=v;}})]}),
      button(Button, 'qm-repeat-action', t.repeatButton, () => queueRepeated(`${repeatCount} | ${repeatText}`))],
    ...(expanded && state.pending.length ? [search, selectionRow] : []),
    ...(expanded ? (view.rows.length ? rows : state.pending.length ? [node(Text, t.noMatch, { dimColor: true })] : []) : []),
    ...(expanded && view.totalPages > 1 ? [pages] : []),
    button(Button, 'qm-details', detailsOpen ? (t.hideDetails || t.close) : (t.details || t.analytics), () => { detailsOpen = !detailsOpen; redraw($); }, { plain: true }),
    ...(detailsOpen ? [contextLine, settingsForm, node(Text,t.keys,{dimColor:true}), advancedActions,
      ...(recent ? [recent] : []), ...recentOutcomes, node(Text, t.help, { dimColor: true })] : [])
  ], { rowGap: 1 });
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    // Register immediately, before any queue/session/store I/O. Other mods
    // (After, Porthole, Show Me) register first for the same reason.
    startupWarning = null;
    managerOpen = false;
    detailsOpen = false;
    try {
      await $.command.register({ name: 'qm', description: 'Queue Manager: run tasks one by one without steering',
        argumentHint: 'add | batch | run | repeat | verify | retry | timeout | context | if | history', immediate: true });
    } catch (error) {
      // Command registration failure must not silently prevent button access.
      reportStartupIssue($, 'command /qm', error);
    }
    try {
      await $.tool.register({ name: 'queue', description: 'Manage this session\'s Queue Manager when the user asks you to plan or arrange queued work. Read the queue, add tasks, reorder/remove pending IDs, or pause/resume. The current turn is never interrupted. Do not recursively queue queue-management requests.',
        inputSchema: { type: 'object', properties: {
          action: {type:'string',enum:['list','add','reorder','remove','pause','resume']},
          tasks: {type:'array',items:{type:'string'},maxItems:200},
          ids: {type:'array',items:{type:'integer'},maxItems:500}
        }, required:['action'], additionalProperties:false } });
    } catch (error) { logError($, error); }
    try {
      const incomingSession = await $.session.id();
      if (cachedSessionId !== incomingSession) {
        activeTurnId=null;liveTurnActive=false;undoArmed=false;
        page = 0; searchText = ''; bulkDraft = ''; repeatDraft = '';
        editDraft = ''; editId = null; clearArmed = false;
        groupRemoveArmed = false; selectedIds.clear();
        web = null; webTimer = null; webRevision = 0; webAck = null; webHandledId = 0;
        cancelRetryTimer(); verificationRunning = false;
      }
      const resumed = await readState($);
      if (resumed.recoverable) $.ui.toast('QM: previous in-flight task needs review. /qm recover (may repeat work).');
      try { language = canonicalLocale(await $.store.get(PREFS_KEY)) || 'tr'; }
      catch (error) { logError($, error); }
    } catch (error) { reportStartupIssue($, 'session state', error); }
    try { $.ui.invalidate('ui.render'); } catch {}
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      activeTurnId = e.turnId ?? null;
      liveTurnActive = true;
      await change($, state => ({ ...state, busy: true,
        running: state.running && !state.running.turnId && !verificationRunning
          ? { ...state.running, turnId: e.turnId } : state.running }));
    }
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    const result = await next(e);
    if (e.agentId !== undefined) return result;
    if (!e.turnId || !activeTurnId || activeTurnId === e.turnId) { activeTurnId=null;liveTurnActive=false; }
    if (verificationRunning) return result;
    const state = await readState($);
    const epoch = verificationEpoch;
    const sessionId = cachedSessionId;
    const aborted = e.isAborted === true || (e.reason && e.reason !== 'answer');
    // A new main turn cannot report success/failure for an orphan from before restart.
    if(state.running&&state.recoverable){
      await change($,s=>({...s,busy:liveTurnActive,paused:true}));
      return result;
    }
    if (!state.running) {
      await change($, s => ({ ...s, busy: liveTurnActive }));
      if (!aborted) scheduleNext($);
      return result;
    }
    let outcome = 'aborted', detail = '';
    const now = await $.clock.now();
    const durationMs = Number.isFinite(e.durationMs) ? e.durationMs : Math.max(0, now - (state.running.startedAt || now));
    if (!aborted) {
      if (state.config.timeoutMs > 0 && durationMs > state.config.timeoutMs) {
        outcome = 'timeout'; detail = `soft timeout ${state.config.timeoutMs}ms`;
      } else {
        verificationRunning = true;
        try {
          outcome = await verifyAnswer($, state.running, e.answer ?? result?.text ?? '', state.config);
          detail = state.config.verify;
        } finally { if (epoch === verificationEpoch) verificationRunning = false; }
      }
    }
    if (epoch !== verificationEpoch || sessionId !== await $.session.id()) return result;
    const usage = await readUsage($);
    const updated = await change($, (s, t) => {
      const sampled = usage ? recordContext(s, usage) : s;
      if (s.running?.id !== state.running.id) return s;
      const settled = settleTurn(sampled, outcome, t, { durationMs, reason: detail });
      return liveTurnActive ? { ...settled, busy: true } : settled;
    });
    if (web) await syncWebAction($);
    if (!updated.paused) scheduleNext($);
    if (updated.paused && outcome !== 'success') $.ui.toast(`QM: ${outcome}; queue paused. /qm history`);
    if (updated.pauseReason?.startsWith('context:')) $.ui.toast(`QM: context guard ${updated.pauseReason}; /qm context`);
    return result;
  });

  on('session.end', ($, e, next) => {
    carryOver = e.reason === 'clear';
    managerOpen = false;
    detailsOpen = false;
    activeTurnId = null;
    liveTurnActive = false;
    verificationEpoch++;
    verificationRunning = false;
    cancelRetryTimer();
    if (web) void stopWeb($);
    return next(e);
  });

  on('command.run', { command: 'qm' }, async ($, e) => {
    const result = await safePerform($, e.args ?? '');
    return result ? { text: result } : {};
  });

  on('tool.call', { tool: 'mcp__qm__queue' }, async ($, e) => {
    try {
      if (e.action === 'add') {
        await change($, (state, now) => enqueue(state, e.tasks, 'end', now));
        scheduleNext($);
      } else if (e.action === 'reorder' || e.action === 'remove') {
        await change($, state => e.action === 'reorder' ? reorderByIds(state, e.ids) : removeByIds(state, e.ids));
      } else if (e.action === 'pause' || e.action === 'resume') {
        const result = await safePerform($, e.action);
        if (result.startsWith('QM error:')) throw new Error(result);
      } else if (e.action !== 'list') throw new Error('Unsupported queue action');
      const state = await readState($);
      return { result: JSON.stringify({sessionId:state.sessionId,paused:state.paused,busy:state.busy,
        running:state.running,pending:state.pending,config:state.config}) };
    } catch (error) { return { result: JSON.stringify({error:String(error?.message ?? error)}), isError:true }; }
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

