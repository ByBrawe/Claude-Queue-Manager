import { canonicalLocale } from './locales.mjs';
import { MAX_BATCH } from './queue.mjs';

const num = text => /^\d+$/.test(text) ? Number(text) : NaN;
const taskSplit = text => text.split(/\r?\n|\s+\|\|\s+/).map(s => s.trim()).filter(Boolean);
export function parseDuration(text, allowOff = true) {
  if (allowOff && /^off$/i.test(text)) return 0;
  const match = /^(\d+)(s|m|h)?$/i.exec(String(text || ''));
  if (!match) throw new Error('Duration must be 30s, 5m, 1h, or off');
  const n = Number(match[1]), mult = { s: 1000, m: 60000, h: 3600000 }[(match[2] || 's').toLowerCase()];
  if (!Number.isSafeInteger(n) || n < 0 || n * mult > 86400000) throw new Error('Duration out of range (max 24h)');
  return n * mult;
}
export function parseCommand(raw = '') {
  const args = String(raw ?? '').trim();
  if (!args) return { type: 'open' };
  if (/^(side|panel\s+side)$/i.test(args)) return { type: 'side' };
  if (/^(inline|panel\s+inline)$/i.test(args)) return { type: 'open' };
  if (/^(close|hide)$/i.test(args)) return { type: 'close' };
  if (/^(help|\?)$/i.test(args)) return { type: 'help' };
  if (/^(list|ls|status|show)$/i.test(args)) return { type: 'list' };
  if (/^(pause|hold)$/i.test(args)) return { type: 'pause' };
  if (/^(resume|start|go)$/i.test(args)) return { type: 'resume' };
  if (/^clear$/i.test(args)) return { type: 'clear' };
  if (/^undo$/i.test(args)) return { type: 'undo' };
 if(/^redo$/i.test(args))return {type:'redo'};
 if(/^backups?$/i.test(args))return {type:'backups'};
 if(/^export$/i.test(args))return {type:'export'};
 const imported=/^import\s+([\s\S]+)$/i.exec(args);
 if(imported)return {type:'import',path:imported[1].replace(/^"|"$/g,'')};
  if(/^run\s+cancel$/i.test(args))return {type:'cancel-one'};
  const run=/^run\s+(\d+)$/i.exec(args);
  if(run){const position=Number(run[1]);if(!Number.isSafeInteger(position)||position<1)throw new Error('Use: /qm run <pending position>');return {type:'run-one',position};}
  if (/^recover$/i.test(args)) return { type: 'recover' };
  if (/^web$/i.test(args)) return { type: 'web' };
  if (/^(?:web\s+stop)$/i.test(args)) return { type: 'web-stop' };
  if (/^(?:stats|analytics)$/i.test(args)) return { type: 'stats' };
  if (/^(?:history|log)(?:\s+(\d+))?$/i.test(args)) {
    const n = /(?:history|log)\s+(\d+)/i.exec(args)?.[1];
    if (n && (Number(n) < 1 || Number(n) > 50)) throw new Error('History limit must be 1-50');
    return { type: 'history', count: n ? Number(n) : 15 };
  }
  if (/^settings$/i.test(args)) return { type: 'settings' };
  if (/^sessions$/i.test(args)) return { type: 'sessions' };
  const restore = /^restore\s+([^\s]+)(?:\s+(recover))?$/i.exec(args);
  if (restore) {
    if (!/^[a-zA-Z0-9._:-]{1,150}$/.test(restore[1])) throw new Error('Invalid session ID');
    return { type: 'restore', sessionId: restore[1], recover: Boolean(restore[2]) };
  }
  const lang = /^lang(?:uage)?\s+(\S+)$/i.exec(args);
  if (lang) {
    const code = canonicalLocale(lang[1]);
    if (!code) throw new Error('Unsupported language; /qm lang <code>');
    return { type: 'lang', code };
  }
  if (/^next$/i.test(args)) return { type: 'next' };
  const verify = /^verify\s+(off|marker|ai)(?:\s+([\w.-]+))?$/i.exec(args);
  if (verify) {
    if (verify[2] && verify[1].toLowerCase() !== 'ai') throw new Error('Model name applies to AI verification only');
    return { type: 'config', updates: { verify: verify[1].toLowerCase(), ...(verify[2] ? { model: verify[2] } : {}) } };
  }
  if (/^retry\s+last$/i.test(args)) return { type: 'retry-last' };
  const retry = /^retry\s+([0-5])(?:\s+(\S+))?$/i.exec(args);
  if (retry) return { type: 'config', updates: { retries: Number(retry[1]), ...(retry[2] ? { retryDelayMs: parseDuration(retry[2]) } : {}) } };
  const timeout = /^timeout\s+(\S+)$/i.exec(args);
  if (timeout) return { type: 'config', updates: { timeoutMs: parseDuration(timeout[1]) } };
  const context = /^context(?:\s+(off|status|\d+))?$/i.exec(args);
  if (context) {
    if (!context[1] || /^status$/i.test(context[1])) return { type: 'context-status' };
    const n = /^off$/i.test(context[1]) ? 0 : Number(context[1]);
    if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error('Context threshold must be 1-99 or off');
    return { type: 'config', updates: { contextPercent: n } };
  }
  const onFail = /^onfail\s+(pause|continue)$/i.exec(args);
  if (onFail) return { type: 'config', updates: { onFail: onFail[1].toLowerCase() } };
  const conditional = /^if\s+(success|failure|always)\s+([\s\S]+)$/i.exec(args);
  if (conditional) return { type: 'add', when: conditional[1].toLowerCase(), texts: [conditional[2]] };
  if (/^(?:--|add)\s+([\s\S]+)$/i.test(args)) return { type: 'add', texts: [args.replace(/^(?:--|add)\s+/i, '')] };
  const rep = /^repeat\s+(\S+)(?:\s+([\s\S]+))?$/i.exec(args);
  if (rep) {
    const count = num(rep[1]);
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH || !rep[2]?.trim()) throw new Error(`Usage: /qm repeat <1-${MAX_BATCH}> <task>`);
    return { type: 'add', texts: Array(count).fill(rep[2].trim()) };
  }
  const batch = /^batch(?:\s+([\s\S]+))?$/i.exec(args);
  if (batch) {
    const tasks = taskSplit(batch[1] ?? '');
    if (!tasks.length || tasks.length > MAX_BATCH) throw new Error(`Usage: /qm batch task 1 || task 2 (1-${MAX_BATCH} tasks)`);
    return { type: 'add', texts: tasks };
  }
  const front = /^(?:front|before)\s+([\s\S]+)$/i.exec(args);
  if (front) return { type: 'add', where: 'front', texts: [front[1]] };
  const rm = /^(?:rm|remove|delete)\s+(\S+)$/i.exec(args);
  if (rm) return { type: 'rm', position: num(rm[1]) };
  const mv = /^(?:mv|move)\s+(\S+)\s+(\S+)$/i.exec(args);
  if (mv) return { type: 'mv', from: num(mv[1]), to: num(mv[2]) };
  const edit = /^edit\s+(\S+)\s+([\s\S]+)$/i.exec(args);
  if (edit) return { type: 'edit', position: num(edit[1]), text: edit[2] };
  if (/^(redo|backup|backups|export|import|run|repeat|batch|mv|move|rm|remove|delete|edit|front|before|verify|retry|timeout|context|onfail|if|restore|history|lang|web)\b/i.test(args)) {
    throw new Error('Incomplete command; see /qm help. Use /qm -- <text> to queue literal text.');
  }
  return { type: 'add', texts: [args] };
}
export function brief(state, pageSize = 12) {
  const status = state.paused ? 'PAUSED' : state.running ? 'RUNNING' : state.busy ? 'WORKING' : 'READY';
  const lines = [`QM ${status} | pending ${state.pending.length} | finished ${state.history.length}`];
  if (state.running) lines.push(` > ${state.running.id}: ${state.running.text.slice(0, 100)}`);
  state.pending.slice(0, pageSize).forEach((task, i) => lines.push(` ${i + 1}. ${task.when !== 'always' ? `[if ${task.when}] ` : ''}${task.text.slice(0, 130)}`));
  if (state.pending.length > pageSize) lines.push(` ... ${state.pending.length - pageSize} more`);
  return lines.join('\n');
}
export const HELP = [
  '/qm backups | export | import <file.json> — Preview / export / import pending work',
  '/qm redo — Redo an undone queue edit, stay paused',
  '/qm                          Open manager above the prompt',
  '/qm side | inline | close     Choose side pane, inline manager, or close',
  '/qm add <task>               Queue one task',
  '/qm repeat 20 devam et      Queue 20 separate turns (max 200)',
  '/qm batch A || B || C       Queue tasks in order (max 200)',
  '/qm run 2 | run cancel     Run only pending position 2, then pause / cancel request',
  '/qm if success <task>       Run only after the last executed task succeeded',
  '/qm if failure <task>       Run only after the last executed task failed',
  '/qm verify off|marker|ai    Opt-in completion verification (AI adds cost)',
  '/qm verify ai haiku         Verify with a separate Haiku classification',
  '/qm retry 2 5s              Retry errors at most twice, waiting 5s',
  '/qm retry last              Requeue most recent failed/unknown task manually',
  '/qm timeout 10m|off        Soft timeout, checked after a turn ends',
  '/qm context 85|off         Pause before next task at 85% context',
  '/qm context                Show context reading (when available)',
  '/qm onfail pause|continue  Pause on final failure or run conditional branches',
  '/qm history [1-50]         Show recent outcomes and durations',
  '/qm stats                  Show cumulative local session analytics',
  '/qm sessions               List recoverable local queue sessions',
  '/qm restore <session-id> [recover] Transfer a paused queue into this empty session',
  '/qm settings               Show automation settings',
  '/qm pause | resume         Pause / resume',
  '/qm mv 3 1                 Reorder pending tasks',
  '/qm edit 2 <text>          Edit pending task',
  '/qm rm 2                  Delete pending task',
  '/qm clear | undo           Clear pending tasks / undo',
  '/qm recover                Requeue orphaned in-flight task (paused)',
  '/qm web | web stop         Optional localhost drag-and-drop dashboard',
  '/qm lang tr | en           Switch panel language',
  '/qm -- <text>              Queue literal reserved words'
].join('\n');

export const HELP_TR = [
  '/qm backups | export | import <dosya.json> — Yedekleri önizle / dışa veya içe aktar',
  '/qm redo — Geri alınan değişikliği yinele; kuyruk duraklatılır',
'/qm — Mesaj kutusunun üstünde yönetimi aç',
'/qm side | inline | close — Yan panel / satır içi görünüm / kapat',
'/qm add <görev> — Tek görev ekle',
'/qm repeat <1-200> <görev> — Ayrı turlarda tekrarla',
'/qm batch A || B — Sıralı toplu ekleme',
'/qm run 2 | run cancel — Yalnızca bekleyen 2. görevi çalıştır / isteği iptal et',
'/qm pause | resume — Sonraki görevi beklet / devam ettir',
'/qm mv 3 1 | rm 2 | edit 2 <metin> — Sırala / sil / düzenle',
'/qm clear | undo — Bekleyenleri sil / son değişikliği geri al',
'/qm verify off|marker|ai [model] — Tamamlanma doğrulaması',
'/qm retry 2 5s | retry last — Sınırlı tekrar / son başarısız işi yeniden ekle',
'/qm timeout 10m|off — Tur sonunda değerlendirilen yumuşak süre sınırı',
'/qm context [85|off] — Gerçek bağlam verisi / eşik',
'/qm if success|failure <görev> — Son sonuca bağlı görev',
'/qm onfail pause|continue — Başarısızlık politikası',
'/qm history [1-50] | stats | settings — Geçmiş / istatistik / ayarlar',
'/qm sessions | restore <oturum> [recover] — Oturumları göster / taşı',
'/qm recover — Yeniden açılan oturumda sahipsiz görevi geri al',
'/qm web | web stop — Yerel web panelini aç / durdur',
'/qm lang tr|en — Arayüz dili',
'/qm -- <metin> — Ayrılmış sözcükleri görev olarak ekle'
].join('\n');

