// Presentation-only helpers. No Claude Code API calls, model prompts, or IO.
import { LANGUAGES, EXTRA_MESSAGES, RECOVERY_MESSAGES } from './locales.mjs';
export const SUPPORTED_UI_LANGUAGES = LANGUAGES;

const messages = {
  en: {
    details:'Details',expand:'Expand',hideDetails:'Hide details',side:'Side panel',tasks:'Tasks',
    close:'Close', count:'Count', repeatMessage:'Message to repeat', keys:'Tab / Shift+Tab: focus · Enter: activate · p: pause/resume · q: close',
    contextMissing:'Host has not reported usage yet. Refresh Context after a model response.',
    addPaused:'Tasks stay pending until you resume.', addStarts:'When idle, adding tasks starts the first one immediately.', pauseHint:'Pause stops the next dispatch; the current turn finishes.',
    analytics: 'Analytics', contextLabel: 'Context', verifyLabel: 'Verification', retryLabel: 'Retries', timeoutLabel: 'Timeout', historyLabel: 'History', sessionsLabel: 'Sessions', unavailable: 'unavailable', off: 'off', pauseReason: 'Paused because',
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
    details:'Ayrıntılar',expand:'Genişlet',hideDetails:'Ayrıntıları gizle',side:'Yan panel',tasks:'Görevler',
    close:'Kapat', count:'Adet', repeatMessage:'Tekrarlanacak mesaj', keys:'Tab / Shift+Tab: odak · Enter: seç · p: duraklat/devam · q: kapat',
    contextMissing:'Host henüz kullanım verisi bildirmedi. Model yanıtından sonra Bağlam ile yenile.',
    addPaused:'Görevler devam ettirene kadar bekler.', addStarts:'Boştayken görev eklemek ilk görevi hemen başlatır.', pauseHint:'Duraklat sonraki görevi bekletir; çalışan tur tamamlanır.',
    analytics: 'İstatistikler', contextLabel: 'Bağlam', verifyLabel: 'Doğrulama', retryLabel: 'Tekrar', timeoutLabel: 'Zaman aşımı', historyLabel: 'Geçmiş', sessionsLabel: 'Oturumlar', unavailable: 'bilinmiyor', off: 'kapalı', pauseReason: 'Duraklatma nedeni',
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

const orderCopy={
 en:'Next pending|Show first task|1 → 2 → 3, top to bottom. Conditional tasks may be skipped.|Edit the multiline text, then choose Save edit to apply.',
 tr:'Sıradaki bekleyen|İlk görevi göster|1 → 2 → 3, yukarıdan aşağıya. Koşullu görevler atlanabilir.|Çok satırlı metni düzenle, ardından Değişikliği kaydet ile uygula.',
 de:'Nächste wartende Aufgabe|Erste Aufgabe anzeigen|1 → 2 → 3, von oben nach unten. Bedingte Aufgaben können übersprungen werden.|Mehrzeiligen Text bearbeiten und mit Speichern übernehmen.',
 fr:'Prochaine tâche en attente|Afficher la première tâche|1 → 2 → 3, de haut en bas. Les tâches conditionnelles peuvent être ignorées.|Modifiez le texte multiligne, puis enregistrez pour appliquer.',
 es:'Siguiente tarea pendiente|Mostrar primera tarea|1 → 2 → 3, de arriba abajo. Se pueden omitir tareas condicionales.|Edita el texto multilínea y guarda para aplicar.',
 it:'Prossima attività in attesa|Mostra prima attività|1 → 2 → 3, dall’alto in basso. Le attività condizionali possono essere saltate.|Modifica il testo su più righe e salva per applicare.',
 'pt-BR':'Próxima tarefa pendente|Mostrar primeira tarefa|1 → 2 → 3, de cima para baixo. Tarefas condicionais podem ser ignoradas.|Edite o texto em várias linhas e salve para aplicar.',
 ru:'Следующая ожидающая задача|Показать первую задачу|1 → 2 → 3, сверху вниз. Условные задачи могут пропускаться.|Измените многострочный текст и сохраните изменения.',
 uk:'Наступне завдання в черзі|Показати перше завдання|1 → 2 → 3, згори вниз. Умовні завдання можуть пропускатися.|Змініть багаторядковий текст і збережіть зміни.',
 pl:'Następne oczekujące zadanie|Pokaż pierwsze zadanie|1 → 2 → 3, od góry do dołu. Zadania warunkowe mogą być pomijane.|Edytuj tekst wielowierszowy i zapisz zmiany.',
 nl:'Volgende wachtende taak|Eerste taak tonen|1 → 2 → 3, van boven naar beneden. Voorwaardelijke taken kunnen worden overgeslagen.|Bewerk de tekst met meerdere regels en sla op.',
 sv:'Nästa väntande uppgift|Visa första uppgiften|1 → 2 → 3, uppifrån och ned. Villkorliga uppgifter kan hoppas över.|Redigera texten på flera rader och spara.',
 ja:'次の待機タスク|最初のタスクを表示|1 → 2 → 3、上から下へ。条件付きタスクはスキップされる場合があります。|複数行のテキストを編集し、保存して適用してください。',
 ko:'다음 대기 작업|첫 작업 표시|1 → 2 → 3, 위에서 아래로. 조건부 작업은 건너뛸 수 있습니다.|여러 줄의 텍스트를 편집한 후 저장하세요.',
 'zh-CN':'下一个待处理任务|显示第一个任务|1 → 2 → 3，从上到下。条件任务可能被跳过。|编辑多行文本后，保存以应用。',
 ar:'المهمة التالية في الانتظار|عرض المهمة الأولى|1 → 2 → 3، من الأعلى إلى الأسفل. قد تُتخطى المهام الشرطية.|عدّل النص متعدد الأسطر ثم احفظ لتطبيق التغيير.',
 hi:'अगला प्रतीक्षारत कार्य|पहला कार्य दिखाएँ|1 → 2 → 3, ऊपर से नीचे। सशर्त कार्य छोड़े जा सकते हैं।|कई पंक्तियों का पाठ संपादित करें और लागू करने के लिए सहेजें।',
 id:'Tugas menunggu berikutnya|Tampilkan tugas pertama|1 → 2 → 3, dari atas ke bawah. Tugas bersyarat dapat dilewati.|Edit teks beberapa baris lalu simpan untuk menerapkan.',
 vi:'Công việc chờ tiếp theo|Hiện công việc đầu tiên|1 → 2 → 3, từ trên xuống dưới. Công việc có điều kiện có thể bị bỏ qua.|Sửa văn bản nhiều dòng rồi lưu để áp dụng.',
 fa:'کار بعدی در انتظار|نمایش اولین کار|1 → 2 → 3، از بالا به پایین. کارهای شرطی ممکن است رد شوند.|متن چندخطی را ویرایش کنید و برای اعمال ذخیره کنید.'
};
export const uiStrings = locale => {
 const base=messages[locale] ?? EXTRA_MESSAGES[locale] ?? messages.en;
 const [nextPending,showNext,orderHint,editHelp]=(orderCopy[locale] ?? orderCopy.en).split('|');
 return {...base,nextPending,showNext,orderHint,editHelp,...(RECOVERY_MESSAGES[locale]??RECOVERY_MESSAGES.en)};
};

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

