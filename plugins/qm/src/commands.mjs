import { MAX_BATCH } from './queue.mjs';

const num = text => /^\d+$/.test(text) ? Number(text) : NaN;
const taskSplit = text => text.split(/\r?\n|\s+\|\|\s+/).map(s => s.trim()).filter(Boolean);

export function parseCommand(raw = '') {
  const args = String(raw ?? '').trim();
  if (!args) return { type: 'open' };
  if (/^(help|\?)$/i.test(args)) return { type: 'help' };
  if (/^(list|ls|status|show)$/i.test(args)) return { type: 'list' };
  if (/^(pause|hold)$/i.test(args)) return { type: 'pause' };
  if (/^(resume|start|go)$/i.test(args)) return { type: 'resume' };
  if (/^clear$/i.test(args)) return { type: 'clear' };
  if (/^undo$/i.test(args)) return { type: 'undo' };
  if (/^recover$/i.test(args)) return { type: 'recover' };
  const lang = /^lang(?:uage)?\s+(en|tr)$/i.exec(args);
  if (lang) return { type: 'lang', code: lang[1].toLowerCase() };
  if (/^next$/i.test(args)) return { type: 'next' };
  if (/^(?:--|add)\s+([\s\S]+)$/i.test(args)) return { type: 'add', texts: [args.replace(/^(?:--|add)\s+/i, '')] };
  const rep = /^repeat\s+(\S+)(?:\s+([\s\S]+))?$/i.exec(args);
  if (rep) {
    const count = num(rep[1]);
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH || !rep[2]?.trim()) {
      throw new Error(`Usage: /qm repeat <1-${MAX_BATCH}> <task>`);
    }
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
  if (/^(repeat|batch|mv|move|rm|remove|delete|edit|front|before)\b/i.test(args)) {
    throw new Error('Incomplete command; see /qm help. Use /qm -- <text> to queue literal text.');
  }
  // Convenient default: /qm <task> queues one literal task.
  return { type: 'add', texts: [args] };
}

export function brief(state, pageSize = 12) {
  const status = state.paused ? 'PAUSED' : state.running ? 'RUNNING' : state.busy ? 'WORKING' : 'READY';
  const lines = [`QM ${status} | pending ${state.pending.length} | completed ${state.done.length}`];
  if (state.running) lines.push(` > ${state.running.id}: ${state.running.text.slice(0, 100)}`);
  state.pending.slice(0, pageSize).forEach((task, i) => lines.push(` ${i + 1}. ${task.text.slice(0, 130)}`));
  if (state.pending.length > pageSize) lines.push(` ... ${state.pending.length - pageSize} more`);
  return lines.join('\n');
}

export const HELP = [
  '/qm                       Open queue panel',
  '/qm add <task>            Queue one task',
  '/qm repeat 20 devam et   Queue 20 separate turns (max 200)',
  '/qm batch A || B || C    Queue separate tasks in order (max 200)',
  '/qm front <task>         Put task at front',
  '/qm list                 Show pending tasks',
  '/qm pause | resume       Pause or continue automatic execution',
  '/qm mv 3 1               Reorder pending tasks',
  '/qm edit 2 <text>        Edit pending task',
  '/qm rm 2                 Delete pending task',
  '/qm clear | undo         Clear pending tasks or undo last edit',
  '/qm recover              Recover an in-flight task after a host crash',
  '/qm lang tr | en         Change panel language (Turkish / English)',
  '/qm -- <text>            Queue literal text (reserved command words)'
].join('\n');
