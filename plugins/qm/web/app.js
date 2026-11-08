// Browser-only UI; the authoritative queue lives in the Claude Code mod.
// A localhost dashboard queues operations for the mod to validate and commit.
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.hash.slice(1));
const token = query.get('token') || '';
const selected = new Set();
let snapshot = null;
let revision = -1;
let pendingActionId = null;
let searchTerm = '';
let dragging = null;
let locale = 'en';
let toastTimer;

const labels = {
  en: {
    headline: 'One task at a time.', subtitle: 'Your current Claude task keeps running. Future tasks wait their turn.',
    pending: 'PENDING', active: 'ACTIVE', done: 'COMPLETED', mode: 'QUEUE STATUS', tasks: 'Pending tasks',
    ready: 'Ready', paused: 'Paused', working: 'Working', running: 'Running', pause: 'Pause', resume: 'Resume',
    search: 'Filter tasks…', selectAll: 'Select visible', selected: 'selected', deselect: 'Clear selection',
    drag: 'Drag ⠿ to reorder', filtered: 'Clear the filter to drag and reorder.',
    top: '↑ Top', bottom: '↓ Bottom', remove: 'Delete selected',
    empty: 'No pending tasks. Paste tasks in the panel to the right.', noMatch: 'No tasks match this filter.',
    waiting: 'Waiting for Claude Code to apply change…', connected: 'Local · Connected', disconnected: 'Disconnected',
    taskList: 'TASK BACKLOG', countHint: 'pending tasks', queueHint: 'Drag multiple selected rows together',
    activeSection: 'CURRENT TURN', activeEmpty: 'No active queue task', activeDesc: 'The browser cannot interrupt your running task.',
    addSection: 'ADD TASKS', addTitle: 'Batch entry', addDesc: 'Paste one task per line or separate with ||.',
    add: '+ Add to queue', limit: 'Up to 200 per addition • 500 pending total', privacySection: 'LOCAL ONLY',
    privacy: 'This dashboard runs on 127.0.0.1. Queue data stays inside your Claude Code session. No cloud relay.',
    confirm: 'Delete selected tasks?', confirmText: 'Only selected pending tasks will be removed. The active task is untouched.',
    cancel: 'Cancel', delete: 'Delete', invalid: 'Enter 1–200 non-empty tasks.',
    applied: 'Queue updated', failed: 'Change rejected', stale: 'Queue changed; retry after refreshing',
    busy: 'Waiting for the previous change', auth: 'Invalid dashboard token. Open the URL shown by /qm web.',
    noDragFilter: 'Clear the filter before dragging tasks.',
  },
  tr: {
    headline: 'Görevler tek tek çalışır.', subtitle: 'Claude mevcut işine devam eder. Sonraki görevler sırayla bekler.',
    pending: 'BEKLEYEN', active: 'AKTİF', done: 'TAMAMLANAN', mode: 'KUYRUK DURUMU', tasks: 'Bekleyen görevler',
    ready: 'Hazır', paused: 'Duraklatıldı', working: 'Meşgul', running: 'Çalışıyor', pause: 'Duraklat', resume: 'Devam ettir',
    search: 'Görevlerde ara…', selectAll: 'Görünenleri seç', selected: 'seçili', deselect: 'Seçimi kaldır',
    drag: '⠿ simgesini sürükleyerek sırala', filtered: 'Sıralama için arama filtresini temizle.',
    top: '↑ En üste', bottom: '↓ En alta', remove: 'Seçilenleri sil',
    empty: 'Bekleyen görev yok. Sağ panelden görev ekleyebilirsin.', noMatch: 'Aramaya uyan görev yok.',
    waiting: 'Claude Code değişikliği uyguluyor…', connected: 'Yerel · Bağlı', disconnected: 'Bağlantı kesildi',
    taskList: 'GÖREV KUYRUĞU', countHint: 'bekleyen görev', queueHint: 'Birden fazla seçili görevi birlikte sürükle',
    activeSection: 'ÇALIŞAN TUR', activeEmpty: 'Kuyrukta çalışan görev yok', activeDesc: 'Tarayıcı, Claude’un çalışan görevini kesmez.',
    addSection: 'GÖREV EKLE', addTitle: 'Toplu ekleme', addDesc: 'Her satıra bir görev yaz veya || ile ayır.',
    add: '+ Kuyruğa ekle', limit: 'Tek seferde 200 • Toplamda 500 bekleyen görev', privacySection: 'YEREL BAĞLANTI',
    privacy: 'Bu panel 127.0.0.1 üzerinden çalışır. Kuyruk Claude Code oturumunda tutulur, bulut aktarımı yoktur.',
    confirm: 'Seçili görevler silinsin mi?', confirmText: 'Yalnızca seçili bekleyen görevler silinir. Aktif görev etkilenmez.',
    cancel: 'Vazgeç', delete: 'Sil', invalid: '1–200 boş olmayan görev gir.',
    applied: 'Kuyruk güncellendi', failed: 'İşlem reddedildi', stale: 'Kuyruk değişti; yenileyip tekrar dene',
    busy: 'Önceki işlem tamamlanıyor', auth: 'Geçersiz panel anahtarı. /qm web bağlantısını aç.',
    noDragFilter: 'Sürüklemek için arama filtresini temizle.'
  }
};
const t = () => labels[locale];
function toast(message, bad = false) {
  const el = $('toast'); el.textContent = message;
  el.style.borderColor = bad ? '#ba6271' : '#557388';
  el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}
async function request(path, options = {}) {
  const result = await fetch(path, {
    ...options,
    headers: { 'X-QM-Token': token, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store', credentials: 'omit', redirect: 'error'
  });
  const data = await result.json();
  if (!result.ok) { const err = new Error(data.error || `HTTP ${result.status}`); err.status = result.status; throw err; }
  return data;
}
function markConnected(ok) {
  $('conn').textContent = '● ' + (ok ? t().connected : t().disconnected);
  $('conn').classList.toggle('offline', !ok);
}
function translated() {
  const m = t();
  $('headline').textContent = m.headline; $('subtitle').textContent = m.subtitle;
  $('metric-pending').textContent = m.pending; $('metric-active').textContent = m.active;
  $('metric-done').textContent = m.done; $('metric-mode').textContent = m.mode;
  $('tasks-title').firstChild.textContent = m.tasks + ' ';
  $('eyebrow-tasks').textContent = m.taskList; $('eyebrow-active').textContent = m.activeSection;
  $('eyebrow-add').textContent = m.addSection; $('eyebrow-privacy').textContent = m.privacySection;
  $('privacy').textContent = m.privacy; $('add-title').textContent = m.addTitle;
  $('add-help').textContent = m.addDesc; $('add-tasks').textContent = m.add;
  $('limit').textContent = m.limit; $('search').placeholder = m.search;
  $('select-all').textContent = m.selectAll; $('undo-selection').textContent = m.deselect;
  $('move-top').textContent = m.top; $('move-bottom').textContent = m.bottom;
  $('delete-selected').textContent = m.remove; $('confirm-title').textContent = m.confirm;
  $('confirm-text').textContent = m.confirmText; $('cancel-confirm').textContent = m.cancel;
  $('confirm-delete').textContent = m.delete; $('queue-hint').textContent = m.queueHint;
  document.documentElement.lang = locale;
}
function el(tag, classes, text) {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text !== undefined) e.textContent = text;
  return e;
}
function taskIds() { return snapshot?.pending.map(p => p.id) || []; }
function selectedIds() { return taskIds().filter(id => selected.has(id)); }
function render() {
  const m = t(); const s = snapshot;
  $('pending-count').textContent = s ? s.pending.length : '—';
  $('active-count').textContent = s ? Number(Boolean(s.running)) : '—';
  $('done-count').textContent = s ? s.done.length : '—';
  $('status').textContent = s ? s.paused ? m.paused : s.running ? m.running : s.busy ? m.working : m.ready : '—';
  $('toggle-pause').textContent = s?.paused ? m.resume : m.pause;
  $('toggle-pause').disabled = !s || Boolean(pendingActionId);
  $('add-tasks').disabled = !s || Boolean(pendingActionId);
  $('active-title').textContent = s?.running?.text || m.activeEmpty;
  $('active-subtitle').textContent = m.activeDesc;
  $('drag-tip').textContent = searchTerm ? m.filtered : m.drag;
  const items = s?.pending || [];
  for (const id of selected) if (!items.some(x => x.id === id)) selected.delete(id);
  const selection = selectedIds();
  $('selected-badge').textContent = selection.length ? `(${selection.length})` : '';
  $('selected-label').textContent = `${selection.length} ${m.selected}`;
  $('batch-actions').classList.toggle('hidden', !selection.length);
  for (const button of ['move-top','move-bottom','delete-selected']) $(button).disabled = !selection.length || Boolean(pendingActionId);
  $('queue-count').textContent = `${items.length} ${m.countHint}${pendingActionId ? ' · ' + m.waiting : ''}`;
  const filtered = items.filter(x => x.text.toLocaleLowerCase().includes(searchTerm));
  const holder = $('task-list'); holder.replaceChildren();
  if (!filtered.length) {
    holder.append(el('p','empty',!items.length ? m.empty : m.noMatch));
    return;
  }
  for (const task of filtered) {
    const index = items.findIndex(x => x.id === task.id) + 1;
    const row = el('div', `row-task${selected.has(task.id) ? ' is-selected' : ''}`);
    row.dataset.taskId = task.id;
    row.draggable = !searchTerm && !pendingActionId;
    const grip = el('button', 'grab' + (searchTerm ? ' disabled' : ''), '⠿');
    grip.type = 'button'; grip.title = m.drag; grip.setAttribute('aria-label',m.drag);
    const check = el('input','task-check'); check.type = 'checkbox'; check.checked = selected.has(task.id);
    check.setAttribute('aria-label',`Select task ${index}`);
    check.addEventListener('change', () => {
      if (check.checked) selected.add(task.id); else selected.delete(task.id);
      render();
    });
    const label = el('span','number',String(index).padStart(2,'0'));
    const content = el('div','task-content',task.text);
    const actions = el('div','row-actions');
    const moveUp = el('button','icon-button','↑'); moveUp.title = m.top;
    moveUp.disabled = pendingActionId || index === 1;
    moveUp.onclick = () => moveOne(task.id, -1);
    const moveDown = el('button','icon-button','↓'); moveDown.title = m.bottom;
    moveDown.disabled = pendingActionId || index === items.length;
    moveDown.onclick = () => moveOne(task.id, +1);
    actions.append(moveUp,moveDown);
    row.append(grip,check,label,content,actions);
    if (!searchTerm) {
      row.addEventListener('dragstart', e => {
        dragging = selected.has(task.id) ? selectedIds() : [task.id];
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain',String(task.id));
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => { dragging = null; holder.querySelectorAll('.row-task').forEach(x => x.classList.remove('dragging','over-before','over-after')); });
      row.addEventListener('dragover', e => {
        if (!dragging || dragging.includes(task.id)) return;
        e.preventDefault();
        const isBefore = e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
        row.classList.toggle('over-before',isBefore);row.classList.toggle('over-after',!isBefore);
      });
      row.addEventListener('dragleave', () => row.classList.remove('over-before','over-after'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragging || dragging.includes(task.id)) return;
        const before = e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
        const moved = new Set(dragging);
        const rest = taskIds().filter(id => !moved.has(id));
        const position = rest.indexOf(task.id) + (before ? 0 : 1);
        const newOrder = [...rest.slice(0,position),...taskIds().filter(id => moved.has(id)),...rest.slice(position)];
        dragging = null;
        void action({type:'reorder',ids:newOrder});
      });
    }
    holder.append(row);
  }
}
async function refresh() {
  if (!token) { markConnected(false); return; }
  try {
    const data = await request('/api/state');
    markConnected(true);
    revision = data.revision;
    snapshot = data.state;
    if (pendingActionId && data.lastAck?.id === pendingActionId) {
      const ack = data.lastAck; pendingActionId = null;
      toast(ack.ok ? t().applied : `${t().failed}: ${ack.error}`,!ack.ok);
    }
    // A running drag must not be interrupted by a periodic rerender.
    if (!dragging) render();
  } catch (error) {
    markConnected(false);
    if (error.status === 401) toast(t().auth,true);
  }
}
async function action(operation) {
  if (pendingActionId) { toast(t().busy,true);return; }
  if (!snapshot) { toast(t().disconnected,true);return; }
  try {
    const data = await request('/api/action',{method:'POST',body:JSON.stringify({revision,operation})});
    pendingActionId = data.accepted;
    render();
  } catch (error) { toast(error.status === 409 ? t().stale : error.message,true); await refresh(); }
}
function moveOne(id, delta) {
  const ordered = taskIds(); const at = ordered.indexOf(id); const target = at + delta;
  if (at < 0 || target < 0 || target >= ordered.length) return;
  [ordered[at],ordered[target]] = [ordered[target],ordered[at]];
  void action({type:'reorder',ids:ordered});
}
function moveGroup(place) {
  const chosen = new Set(selectedIds()); const ordered = taskIds();
  const picked = ordered.filter(id => chosen.has(id)); const other = ordered.filter(id => !chosen.has(id));
  void action({type:'reorder',ids:place==='top'?[...picked,...other]:[...other,...picked]});
}
function addTasks() {
  const texts = $('tasks-input').value.split(/\r?\n|\s+\|\|\s+/).map(x => x.trim()).filter(Boolean);
  if (!texts.length || texts.length > 200 || texts.some(x => x.length > 20000)) { toast(t().invalid,true);return; }
  void action({type:'add',texts});
  $('tasks-input').value = '';
}
function confirmDelete() { $('overlay').classList.remove('hidden'); }
function dismissDelete() { $('overlay').classList.add('hidden'); }
$('toggle-pause').onclick = () => void action({type:snapshot?.paused?'resume':'pause'});
$('undo-selection').onclick = () => { selected.clear(); render(); };
$('select-all').onclick = () => {
  const items=snapshot?.pending.filter(x=>x.text.toLocaleLowerCase().includes(searchTerm))||[];
  for(const x of items) selected.add(x.id);
  render();
};
$('move-top').onclick=()=>moveGroup('top');
$('move-bottom').onclick=()=>moveGroup('bottom');
$('delete-selected').onclick=confirmDelete;
$('cancel-confirm').onclick=dismissDelete;
$('confirm-delete').onclick=()=>{dismissDelete();void action({type:'remove',ids:selectedIds()});};
$('overlay').onclick=e=>{if(e.target===$('overlay'))dismissDelete();};
$('search').oninput=e=>{searchTerm=String(e.target.value).toLocaleLowerCase().trim();render();};
$('add-tasks').onclick=addTasks;
$('locale').onchange=e=>{locale=e.target.value==='tr'?'tr':'en';translated();render();markConnected(Boolean(snapshot));};
if (!token) toast('Open the private URL from /qm web (missing token).',true);
translated();
void refresh();
setInterval(refresh,1200);
