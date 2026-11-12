/** Optional local-only QM dashboard. No external dependencies or network requests. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { configure, DEFAULT_CONFIG, runOne, cancelOne } from '../src/queue.mjs';
import { settingsGuard, CONFIG_KEYS } from '../src/settings.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 12 * 1024 * 1024;
const IDLE_MS = 5 * 60 * 1000;

function sameToken(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createDashboard({ token = randomBytes(32).toString('hex'), port = 0, host = '127.0.0.1', idleMs = IDLE_MS } = {}) {
  if (!/^[a-f0-9-]{32,128}$/i.test(token)) throw new Error('Dashboard token must be at least 32 hex characters');
  if (host !== '127.0.0.1') throw new Error('Dashboard must bind only to loopback');
  let snapshot = null;
  let revision = -1;
  let nextActionId = 1;
  let waitingAction = null;
  let lastAck = null;
  let lastModContact = Date.now();
  let timer;
  const send = (res, status, data, extra = {}) => {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...extra
    });
    res.end(body);
  };
  const readJson = async req => {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw new Error('Request body too large');
      chunks.push(c);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  const server = http.createServer(async (req, res) => {
    const actualPort = server.address()?.port;
    if (req.headers.host !== `127.0.0.1:${actualPort}` && req.headers.host !== `localhost:${actualPort}`) {
      return send(res, 403, { error: 'Invalid host' });
    }
    const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
    const allowed = ['/', '/app.js', '/style.css', '/locales.mjs', '/settings.mjs', '/settings-locales.mjs'];
    if (req.method === 'GET' && allowed.includes(url.pathname)) {
      const kind = url.pathname === '/' ? 'index.html' : ['/locales.mjs','/settings.mjs','/settings-locales.mjs'].includes(url.pathname) ? '../src'+url.pathname : url.pathname.slice(1);
      const type = kind.endsWith('.html') ? 'text/html' : kind.endsWith('.css') ? 'text/css' : 'text/javascript';
      try {
        const data = await readFile(join(here, kind));
        res.writeHead(200, {
          'Content-Type': `${type}; charset=utf-8`,
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store'
        });
        return res.end(data);
      } catch {
        return send(res, 404, { error: 'Page not found' });
      }
    }
    // Every API endpoint requires a per-session secret. No CORS headers.
    if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (!sameToken(req.headers['x-qm-token'], token)) return send(res, 401, { error: 'Unauthorized' });
    const origin = req.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${actualPort}` && origin !== `http://localhost:${actualPort}`) {
      return send(res, 403, { error: 'Cross-origin requests denied' });
    }
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') {
        return send(res, 200, { state: snapshot, revision, waiting: Boolean(waitingAction), lastAck, lastModContact });
      }
      if (req.method === 'GET' && url.pathname === '/api/action') {
        lastModContact = Date.now();
        return send(res, 200, { action: waitingAction });
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const body = await readJson(req);
        const operation = body?.operation;
        if (!snapshot || body.revision !== revision) return send(res, 409, { error: 'Queue changed; refresh and retry' });
        if (waitingAction) return send(res, 409, { error: 'Previous change is still applying' });
        if (!operation || !['reorder', 'remove', 'add', 'pause', 'resume', 'configure', 'retry-last', 'recover', 'run-one', 'cancel-one'].includes(operation.type)) {
          return send(res, 400, { error: 'Unsupported operation' });
        }
        // Limit payload complexity before the mod validates it against actual state.
        if (operation.type === 'reorder' && (!Array.isArray(operation.ids) || operation.ids.length > 500)) {
          return send(res, 400, { error: 'Invalid reordering' });
        }
        if (operation.type === 'remove' && (!Array.isArray(operation.ids) || operation.ids.length > 500)) {
          return send(res, 400, { error: 'Invalid selection' });
        }
        if (operation.type === 'add' && (!Array.isArray(operation.texts) || operation.texts.length > 200)) {
          return send(res, 400, { error: 'Invalid batch' });
        }
        if(operation.type==='configure'){
          for(const obj of [operation.updates,operation.base])if(!obj||Array.isArray(obj)||Object.keys(obj).length!==CONFIG_KEYS.length||CONFIG_KEYS.some(key=>!Object.hasOwn(obj,key)))throw new Error('invalid');
          settingsGuard(snapshot,operation.base);configure({config:snapshot.config},operation.updates);
        }
        if(operation.type==='retry-last'&&snapshot.running)throw new Error('running');
        if(operation.type==='resume'&&snapshot.recoverable)throw new Error('recoveryState');
        if(operation.type==='recover'){
          if(!snapshot.recoverable||!snapshot.running)throw new Error('recoveryState');
        }
        if(operation.type==='run-one')runOne(snapshot,operation.id);
        if(operation.type==='cancel-one')cancelOne(snapshot);
        waitingAction = { id: nextActionId++, revision, operation };
        return send(res, 202, { accepted: waitingAction.id });
      }
      if (req.method === 'POST' && url.pathname === '/api/state') {
        const body = await readJson(req);
        if (!Number.isSafeInteger(body?.revision) || body.revision < revision || !body.state || !Array.isArray(body.state.pending)) {
          return send(res, 400, { error: 'Invalid snapshot' });
        }
        revision = body.revision;
        snapshot = {
          defaults: { ...DEFAULT_CONFIG },
          sessionId: body.state.sessionId ?? null,
          locale: body.state.locale ?? null,
          pending: body.state.pending,
          running: body.state.running ?? null,
          recoverable:Boolean(body.state.recoverable),hostActive:Boolean(body.state.hostActive),
          singleRun:body.state.singleRun??null,
          done: body.state.done ?? [],
          paused: Boolean(body.state.paused),
          busy: Boolean(body.state.busy),
          stats: body.state.stats ?? null,
          context: body.state.context ?? null,
          config: body.state.config ?? null,
          pauseReason: body.state.pauseReason ?? null,
          history: Array.isArray(body.state.history) ? body.state.history.slice(0, 12) : []
        };
        lastModContact = Date.now();
        if (waitingAction && body.ack?.id === waitingAction.id) {
          lastAck = { id: waitingAction.id, ok: Boolean(body.ack.ok), error: String(body.ack.error ?? '') };
          waitingAction = null;
        }
        return send(res, 200, { ok: true, revision });
      }
      if (req.method === 'POST' && url.pathname === '/api/close') {
        send(res, 200, { stopped: true });
        setImmediate(() => server.close());
        return;
      }
      return send(res, 404, { error: 'Unknown API route' });
    } catch (error) {
      return send(res, 400, { error: error.message || 'Bad request' });
    }
  });
  server.on('listening', () => {
    timer = setInterval(() => {
      if (Date.now() - lastModContact > idleMs) server.close();
    }, Math.min(30_000, Math.max(500, idleMs / 2)));
    timer.unref();
  });
  server.on('close', () => clearInterval(timer));
  return {
    server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
    }),
    close: () => new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); }),
    getState: () => ({ snapshot, revision, waitingAction, lastAck })
  };
}

if (process.argv[1] && /(?:^|[\\/])server\.mjs$/.test(process.argv[1])) {
  const port = Number(process.argv[2]);
  const token = process.argv[3];
  if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);
  createDashboard({ port, token }).listen().catch(() => { process.exitCode = 1; });
}

