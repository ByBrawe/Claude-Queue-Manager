// Presentation-only helpers. No Claude Code API calls, model prompts, or IO.
export const SUPPORTED_UI_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' }
];

const messages = {
  en: {
    title: 'QUEUE MANAGER', ready: 'READY', paused: 'PAUSED', running: 'RUNNING', working: 'WORKING',
    pending: 'pending', finished: 'recently done', active: 'Active', waiting: 'Waiting for previous turn',
    empty: 'No pending tasks. Paste tasks below to begin.',
    oneAtTime: 'Tasks run one by one in separate turns. Existing work is never steered.',
    add: 'Paste tasks (one per line, or separated by ||)', addButton: 'Add to queue',
    repeat: 'Repeat: count | instruction (example: 5 | continue)', repeatButton: 'Repeat',
    search: 'Search pending tasks', edit: 'Edit selected pending task', save: 'Save edit',
    selected: 'Selected', selectedCount: 'selected', selectAll: 'Select page', deselectAll: 'Deselect', moveTop: 'Move selected to top', moveBottom: 'Move selected to bottom', removeSelected: 'Delete selected', openWeb: 'Web dashboard', select: 'Edit', up: 'Up', down: 'Down', remove: 'Remove',
    pause: 'Pause', resume: 'Resume', undo: 'Undo', clear: 'Clear pending',
    confirmClear: 'Confirm clear', cancel: 'Cancel', page: 'Page', prev: 'Previous', next: 'Next',
    show: 'Showing', of: 'of', match: 'matching', language: 'Language', done: 'Completed',
    recover: 'Recover in-flight task (may repeat work)',
    clearWarn: 'Click Confirm clear to remove pending tasks. The running task is unaffected.',
    editHint: 'Choose Edit on a pending row, then change the text here.',
    repeatHint: 'Example: 5 | continue. Maximum 200 per action.',
    addHint: 'Paste up to 200 tasks at once. Blank lines are ignored.',
    help: '/qm help for commands · Docs: github.com/ByBrawe/Claude-Queue-Manager',
    noMatch: 'No tasks match your search.', noActive: 'No task is running.',
    invalidRepeat: 'Use: count | task (count from 1 to 200).'
  },
  tr: {
    title: 'KUYRUK YÖNETİCİSİ', ready: 'HAZIR', paused: 'DURAKLATILDI', running: 'ÇALIŞIYOR', working: 'MEŞGUL',
    pending: 'bekleyen', finished: 'son tamamlanan', active: 'Aktif', waiting: 'Önceki görev bekleniyor',
    empty: 'Bekleyen görev yok. Aşağıya görevleri ekleyebilirsin.',
    oneAtTime: 'Görevler ayrı turlarda tek tek çalışır. Mevcut görev yönlendirilmez.',
    add: 'Görevleri yapıştır (satır satır veya || ile)', addButton: 'Kuyruğa ekle',
    repeat: 'Tekrar: sayı | görev (örnek: 5 | devam et)', repeatButton: 'Tekrarla',
    search: 'Bekleyen görevlerde ara', edit: 'Seçilen bekleyen görevi düzenle', save: 'Değişikliği kaydet',
    selected: 'Seçilen', selectedCount: 'seçili', selectAll: 'Sayfayı seç', deselectAll: 'Seçimi kaldır', moveTop: 'Seçilenleri üste taşı', moveBottom: 'Seçilenleri alta taşı', removeSelected: 'Seçilenleri sil', openWeb: 'Web paneli', select: 'Düzenle', up: 'Yukarı', down: 'Aşağı', remove: 'Sil',
    pause: 'Duraklat', resume: 'Devam ettir', undo: 'Geri al', clear: 'Bekleyenleri sil',
    confirmClear: 'Silmeyi onayla', cancel: 'Vazgeç', page: 'Sayfa', prev: 'Önceki', next: 'Sonraki',
    show: 'Gösterilen', of: '/', match: 'eşleşen', language: 'Dil', done: 'Tamamlanan',
    recover: 'Aktif görevi geri getir (tekrarlanabilir)',
    clearWarn: 'Bekleyen görevleri silmek için onayla. Aktif görev etkilenmez.',
    editHint: 'Bekleyen görevde Düzenle seç, sonra metni burada değiştir.',
    repeatHint: 'Örnek: 5 | devam et. Tek seferde en fazla 200.',
    addHint: 'Tek seferde 200 göreve kadar ekleyebilirsin. Boş satırlar atlanır.',
    help: '/qm help: komutlar · Rehber: github.com/ByBrawe/Claude-Queue-Manager',
    noMatch: 'Aramayla eşleşen görev yok.', noActive: 'Çalışan görev yok.',
    invalidRepeat: 'Biçim: sayı | görev (sayı 1 ile 200 arasında olmalı).'
  }
};

export const uiStrings = locale => messages[locale] ?? messages.en;

export function filteredPage(pending, search = '', requestedPage = 0, pageSize = 12) {
  const needle = String(search).trim().toLocaleLowerCase();
  const matches = pending.map((task, index) => ({ ...task, position: index + 1 }))
    .filter(task => task.text.toLocaleLowerCase().includes(needle));
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(0, requestedPage), totalPages - 1);
  return { page, totalPages, totalMatches: matches.length, rows: matches.slice(page * pageSize, (page + 1) * pageSize) };
}

export function parseRepeatForm(value) {
  const match = /^\s*(\d+)\s*\|\s*([\s\S]+?)\s*$/.exec(String(value ?? ''));
  if (!match) throw new Error('Use: count | task (count 1-200)');
  const count = Number(match[1]);
  if (!Number.isSafeInteger(count) || count < 1 || count > 200 || !match[2].trim()) {
    throw new Error('Use: count | task (count 1-200)');
  }
  return { count, task: match[2].trim() };
}

export function splitPaste(value) {
  return String(value ?? '').split(/\r?\n|\s+\|\|\s+/).map(x => x.trim()).filter(Boolean);
}
