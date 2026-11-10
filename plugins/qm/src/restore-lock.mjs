// Restore is optional and requires Node, just like the optional web dashboard.
// Exclusive filesystem creation serializes restores across separate Claude processes.
import { mkdirSync, openSync, writeFileSync, readFileSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const lockPath = (dir, source) => join(dir, createHash('sha256').update(source).digest('hex') + '.lock');
export function acquireLock(dir, source, owner) {
  mkdirSync(dir, { recursive: true });
  const path = lockPath(dir, source);
  let fd;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another restore owns this queue. If the previous restore crashed, inspect and remove the stale lock only after closing its sessions: ${path}`);
    throw error;
  }
  try { writeFileSync(fd, JSON.stringify({ owner, createdAt: Date.now() })); }
  finally { closeSync(fd); }
}
export function releaseLock(dir, source, owner) {
  const path = lockPath(dir, source);
  if (JSON.parse(readFileSync(path, 'utf8')).owner !== owner) throw new Error('Restore lock owner changed');
  unlinkSync(path);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, source, owner] = process.argv.slice(2);
    if (!source || !owner || !['acquire', 'release'].includes(action)) throw new Error('Invalid restore lock request');
    const dir = process.argv[5] || join(homedir(), '.claude', 'qm-restore-locks');
    if (action === 'acquire') acquireLock(dir, source, owner);
    else releaseLock(dir, source, owner);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

