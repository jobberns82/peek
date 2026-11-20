'use strict';
// Peek: netwerkscanner voor thuis. Alleen kijken: Peek stelt niets in op je netwerk.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./lib/store');
const { createOui } = require('./lib/oui');
const { createAuth } = require('./lib/auth');
const { createScanner } = require('./lib/scanner');
const { createLogos } = require('./lib/logos');
const net = require('./lib/netutil');

const VERSION = '1.1.1';
const env = process.env;
const PORT = Number(env.PORT) || 6001;
const DATA_DIR = env.DATA_DIR || '/data';
const DEMO = env.PEEK_DEMO === '1';
const DEMO_NO_LOGOS = DEMO && env.PEEK_LOGO_URL === undefined; // demo zonder internet: geen aanvragen
const PUBLIC = path.join(__dirname, 'public');

function main() {
  const user = env.PEEK_USER || (DEMO ? 'demo' : '');
  const password = env.PEEK_PASSWORD || (DEMO ? 'demo' : '');
  if (!user || !password) {
    console.error('[peek] PEEK_USER en PEEK_PASSWORD zijn verplicht. Zet ze in de compose en start opnieuw.');
    process.exit(1);
  }
  if (password.length < 8 && !DEMO) console.warn('[peek] Let op: kies een wachtwoord van minimaal 8 tekens.');

  const store = createStore(DATA_DIR);
  const oui = createOui(DATA_DIR);
  const demo = DEMO ? require('./lib/demo') : null;
  if (demo) { oui.setDemo(demo.OUI); demo.seed(store); } else { oui.load(); oui.schedule(); }
  const auth = createAuth({ dataDir: DATA_DIR, user, password });
  const scanner = createScanner({ store, oui, env, demo });
  const logos = createLogos({ dataDir: DATA_DIR, enabled: () => scanner.settings().logos && !DEMO_NO_LOGOS, urlTemplate: env.PEEK_LOGO_URL });

  const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  };

  const SEC = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };

  function send(res, code, body, headers) {
    const h = Object.assign({ 'Cache-Control': 'no-store' }, SEC, headers);
    res.writeHead(code, h);
    res.end(body);
  }
  const json = (res, code, obj, headers) => send(res, code, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers));

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > 65536) { reject(new Error('Te groot')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Ongeldige JSON')); }
      });
      req.on('error', reject);
    });
  }

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // geen formules laten uitvoeren in Excel
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    const rows = scanner.serialize().sort((a, b) => net.ipToInt(a.ip || '0.0.0.0') - net.ipToInt(b.ip || '0.0.0.0'));
    const fmt = (t) => (t ? new Date(t).toLocaleString('nl-NL', { timeZone: env.TZ || 'Europe/Amsterdam' }) : '');
    const head = ['Naam', 'Eigen naam', 'Naam in netwerk', 'IP-adres', 'MAC-adres', 'Fabrikant', 'Status', 'Laatst gezien', 'Eerst gezien', 'Notitie'];
    const lines = [head.map(csvCell).join(';')];
    for (const d of rows) {
      lines.push([d.name, d.customName, d.netName, d.ip, d.mac, d.privateMac && !d.vendor ? 'Privé-adres' : d.vendor, d.online ? 'Online' : 'Offline', fmt(d.lastSeen), fmt(d.firstSeen), d.note].map(csvCell).join(';'));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function statePayload() {
    const s = scanner.state;
    const sub = s.subnet || scanner.safeResolve();
    return {
      version: VERSION,
      demo: DEMO,
      scanning: s.scanning,
      phase: s.phase,
      startedAt: s.startedAt,
      last: s.last,
      nextAt: s.nextAt,
      subnet: { cidr: sub.cidr, source: sub.source, iface: sub.iface || null, ip: sub.ip || null, gateway: sub.gateway || null, warning: sub.warning || null },
      settings: scanner.settings(),
      logos: scanner.settings().logos,
      intervals: scanner.INTERVALS,
      icons: scanner.VALID_ICONS,
      oui: oui.status(),
      devices: scanner.serialize(),
    };
  }

  async function api(req, res, url) {
    const p = url.pathname;
    const method = req.method;
    const mutating = method !== 'GET' && method !== 'HEAD';

    if (mutating) {
      if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Niet toegestaan' });
      if (!/^application\/json/i.test(req.headers['content-type'] || '') && p !== '/api/logout' && method !== 'DELETE') {
        return json(res, 415, { error: 'JSON verwacht' });
      }
    }

    if (p === '/api/version' && method === 'GET') return json(res, 200, { version: VERSION });

    if (p === '/api/login' && method === 'POST') {
      const wait = auth.blockedFor(req);
      if (wait) return json(res, 429, { error: 'Te veel pogingen, probeer het over ' + wait + ' seconden opnieuw' }, { 'Retry-After': String(wait) });
      const b = await readBody(req);
      if (auth.checkCredentials(String(b.user || ''), String(b.password || ''))) {
        auth.recordOk(req);
        return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader(req, auth.makeToken()) });
      }
      auth.recordFail(req);
      return json(res, 401, { error: 'Gebruikersnaam of wachtwoord klopt niet' });
    }

    if (p === '/api/logout' && method === 'POST') {
      return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader(req, '') });
    }

    if (!auth.isLoggedIn(req)) return json(res, 401, { error: 'Niet ingelogd' });

    if (p === '/api/me' && method === 'GET') return json(res, 200, { user });
    if (p === '/api/state' && method === 'GET') return json(res, 200, statePayload());

    if (p === '/api/scan' && method === 'POST') {
      const started = !scanner.state.scanning;
      if (started) scanner.run();
      return json(res, 202, { started });
    }

    if (p === '/api/known-all' && method === 'POST') { scanner.markAllKnown(); return json(res, 200, { ok: true }); }

    if (p === '/api/settings' && method === 'PATCH') {
      const b = await readBody(req);
      try { scanner.setSettings(b); } catch (e) { return json(res, 400, { error: e.message }); }
      return json(res, 200, { ok: true });
    }

    if (p === '/api/oui/update' && method === 'POST') {
      oui.update();
      return json(res, 202, { started: true });
    }

    if (p === '/api/export.csv' && method === 'GET') {
      return send(res, 200, exportCsv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="peek-apparaten.csv"' });
    }

    const lg = /^\/api\/vendor-logo\/([a-z0-9]{1,30})\.svg$/.exec(p);
    if (lg && method === 'GET') {
      const svg = await logos.get(lg[1]);
      if (!svg) return json(res, 404, { error: 'Geen logo' });
      return send(res, 200, svg, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=604800',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      });
    }

    const m = /^\/api\/devices\/([^/]+)$/.exec(p);
    if (m) {
      const mac = net.normMac(decodeURIComponent(m[1]));
      if (!mac) return json(res, 400, { error: 'Ongeldig MAC-adres' });
      if (method === 'PATCH') {
        const b = await readBody(req);
        try {
          const d = scanner.patchDevice(mac, b);
          return d ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Apparaat niet gevonden' });
        } catch (e) { return json(res, 400, { error: e.message }); }
      }
      if (method === 'DELETE') {
        const r = scanner.forget(mac);
        if (r === 'none') return json(res, 404, { error: 'Apparaat niet gevonden' });
        if (r === 'online') return json(res, 409, { error: 'Dit apparaat is online en kan niet vergeten worden' });
        return json(res, 200, { ok: true });
      }
    }

    return json(res, 404, { error: 'Onbekend' });
  }

  function serveStatic(req, res, url) {
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    let file;
    try { file = path.normalize(path.join(PUBLIC, decodeURIComponent(rel))); } catch { return send(res, 400, 'Bad request'); }
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'Niet gevonden', { 'Content-Type': 'text/plain; charset=utf-8' });
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const cache = /\.(png|svg|ico|webmanifest)$/.test(file) ? 'public, max-age=86400' : 'no-cache';
      send(res, 200, buf, { 'Content-Type': type, 'Cache-Control': cache });
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) json(res, 500, { error: 'Er ging iets mis' });
      console.error('[peek] fout:', e && e.message);
    }
  });

  server.listen(PORT, () => {
    console.log('[peek] versie ' + VERSION + ' luistert op poort ' + PORT + (DEMO ? ' (demo-modus)' : ''));
    scanner.start();
  });

  const stop = () => { store.flush(); server.close(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (require.main === module) main();
module.exports = { VERSION };
