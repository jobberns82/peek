'use strict';
// Fabrikant opzoeken aan de hand van het MAC-adres (IEEE OUI-lijst).
// De lijst wordt bij de eerste start opgehaald en daarna elke maand ververst.
// Het opzoeken zelf gebeurt lokaal: er gaan geen MAC-adressen het internet op.
const fs = require('fs');
const path = require('path');
const { isPrivateMac } = require('./netutil');

const SOURCES = [
  'https://standards-oui.ieee.org/oui/oui.csv',
  'https://standards-oui.ieee.org/oui28/mam.csv',
  'https://standards-oui.ieee.org/oui36/oui36.csv',
];
// Reserve als IEEE automatische downloads weigert (zelfde gegevens, ander formaat)
const FALLBACK = 'https://www.wireshark.org/download/automated/data/manuf';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const RETRY_MS = 6 * 3600 * 1000;

function createOui(dataDir) {
  const file = path.join(dataDir, 'oui.json');
  let map = new Map();
  let updated = 0;
  let error = null;
  let busy = false;
  let timer = null;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Registry,Assignment,Organization Name,Organization Address
  function addCsv(target, text) {
    let n = 0;
    for (const r of parseCsv(text).slice(1)) {
      const key = (r[1] || '').trim().toUpperCase();
      const name = (r[2] || '').trim();
      if (!/^[0-9A-F]{6}$|^[0-9A-F]{7}$|^[0-9A-F]{9}$/.test(key)) continue;
      if (!name || /^private$/i.test(name)) continue;
      target.set(key, name);
      n++;
    }
    return n;
  }

  // Wireshark manuf: "AA:BB:CC<TAB>Kort<TAB>Lange naam" of "AA:BB:CC:D0:00:00/28<TAB>..."
  function addManuf(target, text) {
    let n = 0;
    for (const line of text.split('\n')) {
      if (!line || line[0] === '#') continue;
      const c = line.replace(/\r$/, '').split('\t');
      if (c.length < 2) continue;
      const m = /^([0-9A-Fa-f:]+)(?:\/(\d+))?$/.exec(c[0].trim());
      if (!m) continue;
      const hex = m[1].replace(/:/g, '').toUpperCase();
      const bits = m[2] ? Number(m[2]) : 24;
      const len = bits === 24 ? 6 : bits === 28 ? 7 : bits === 36 ? 9 : 0;
      const name = (c[2] || c[1] || '').trim();
      if (!len || hex.length < len || !name || /^private$/i.test(name)) continue;
      target.set(hex.slice(0, len), name);
      n++;
    }
    return n;
  }

  function tidy(name) {
    let n = String(name || '').trim();
    for (let i = 0; i < 3; i++) {
      n = n.replace(/[,\s]+(inc\.?|llc|ltd\.?|co\.?,?\s*ltd\.?|corporation|corp\.?|gmbh|b\.v\.?|s\.a\.?|ag|limited|company|s\.r\.l\.?)\s*$/i, '').trim();
    }
    return n.replace(/[,.\s]+$/, '') || String(name || '').trim();
  }

  function lookup(mac) {
    if (!mac || isPrivateMac(mac)) return null;
    const hex = mac.replace(/:/g, '').toUpperCase();
    const hit = map.get(hex.slice(0, 9)) || map.get(hex.slice(0, 7)) || map.get(hex.slice(0, 6));
    return hit ? tidy(hit) : null;
  }

  function load() {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      map = new Map(Object.entries(j.entries || {}));
      updated = j.updated || 0;
    } catch { /* nog geen lijst */ }
  }

  async function fetchText(url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Peek/1.0)', Accept: 'text/csv,*/*' },
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(url + ' gaf status ' + res.status);
    return res.text();
  }

  async function update() {
    if (busy) return;
    busy = true;
    try {
      let next = new Map();
      let got = 0;
      try {
        for (const url of SOURCES) got += addCsv(next, await fetchText(url));
        if (got < 1000) throw new Error('Lijst leek onvolledig (' + got + ' regels)');
      } catch (e1) {
        next = new Map();
        try {
          got = addManuf(next, await fetchText(FALLBACK));
          if (got < 1000) throw new Error('Reservelijst leek onvolledig');
        } catch (e2) {
          throw new Error('IEEE: ' + e1.message + ' / reserve: ' + e2.message);
        }
      }
      map = next;
      updated = Date.now();
      error = null;
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ updated, entries: Object.fromEntries(next) }));
      fs.renameSync(tmp, file);
    } catch (e) {
      error = String((e && e.message) || e).slice(0, 200);
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    const due = !updated || Date.now() - updated > MAX_AGE_MS;
    const wait = due ? (error ? RETRY_MS : 2000) : Math.max(60000, MAX_AGE_MS - (Date.now() - updated));
    timer = setTimeout(async () => { if (!updated || Date.now() - updated > MAX_AGE_MS) await update(); schedule(); }, Math.min(wait, 2147483000));
    timer.unref();
  }

  function status() {
    return { entries: map.size, updated: updated || null, error, busy };
  }

  function setDemo(obj) { map = new Map(Object.entries(obj)); updated = Date.now(); }

  return { lookup, load, update, schedule, status, parseCsv, addCsv, addManuf, tidy, setDemo };
}

module.exports = { createOui };
