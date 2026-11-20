'use strict';
// Apparaatnamen uit het netwerk zelf: reverse DNS (router/DHCP), mDNS en NetBIOS.
// Alles is alleen-lezen: er worden alleen vragen gesteld, er wordt niets ingesteld.
const dgram = require('dgram');
const dns = require('dns');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })])
    .finally(() => clearTimeout(t));
}

// Maak van een ruwe naam iets leesbaars, of null als het niets zinnigs is
function cleanName(raw) {
  let n = String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\.$/, '');
  if (!n) return null;
  n = n.replace(/\.(local|lan|home|localdomain|home\.arpa|fritz\.box|internal|router)$/i, '');
  if (n.includes('.')) n = n.split('.')[0];
  n = n.replace(/\\032/g, ' ').trim();
  if (!n || n.length > 64) n = n.slice(0, 64);
  if (/^(localhost|unknown|unnamed|nameless|\*)$/i.test(n)) return null;
  if (/^\d{1,3}[-.]\d{1,3}[-.]\d{1,3}[-.]\d{1,3}/.test(n)) return null; // IP als naam
  if (/^in-addr/i.test(n)) return null;
  return n || null;
}

// ---- Reverse DNS ----------------------------------------------------------
async function reverseDns(ip, server) {
  try {
    let list;
    if (server) {
      const r = new dns.promises.Resolver({ timeout: 1200, tries: 1 });
      r.setServers([server]);
      list = await withTimeout(r.reverse(ip), 1500);
    } else {
      list = await withTimeout(dns.promises.reverse(ip), 1500);
    }
    for (const h of list || []) {
      const c = cleanName(h);
      if (c) return c;
    }
  } catch { /* geen antwoord */ }
  return null;
}

// ---- mDNS (direct bij het apparaat vragen, poort 5353) --------------------
function dnsName(name) {
  const parts = name.split('.');
  const bufs = parts.map((p) => { const b = Buffer.from(p); return Buffer.concat([Buffer.from([b.length]), b]); });
  return Buffer.concat([...bufs, Buffer.from([0])]);
}

function readName(buf, off) {
  const labels = [];
  let pos = off;
  let next = -1;
  for (let guard = 0; guard < 40; guard++) {
    if (pos >= buf.length) return null;
    const len = buf[pos];
    if (len === 0) { pos++; break; }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= buf.length) return null;
      if (next < 0) next = pos + 2;
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
      continue;
    }
    labels.push(buf.slice(pos + 1, pos + 1 + len).toString('utf8'));
    pos += len + 1;
  }
  return { name: labels.join('.'), next: next >= 0 ? next : pos };
}

function mdnsQuery(ip) {
  const rev = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  const head = Buffer.alloc(12);
  head.writeUInt16BE(1, 4); // één vraag
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(12, 0); // PTR
  tail.writeUInt16BE(1, 2); // IN
  return Buffer.concat([head, dnsName(rev), tail]);
}

function parseMdnsAnswer(buf) {
  try {
    if (buf.length < 12) return null;
    const qd = buf.readUInt16BE(4);
    const total = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
    let pos = 12;
    for (let i = 0; i < qd; i++) {
      const r = readName(buf, pos);
      if (!r) return null;
      pos = r.next + 4;
    }
    for (let i = 0; i < total; i++) {
      const r = readName(buf, pos);
      if (!r) return null;
      pos = r.next;
      if (pos + 10 > buf.length) return null;
      const type = buf.readUInt16BE(pos);
      const rdlen = buf.readUInt16BE(pos + 8);
      const rd = pos + 10;
      if (type === 12) {
        const t = readName(buf, rd);
        if (t) { const c = cleanName(t.name); if (c) return c; }
      }
      pos = rd + rdlen;
    }
  } catch { /* kapot pakket */ }
  return null;
}

function udpAsk(ip, port, packet, parse, ms) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(t); try { sock.close(); } catch { /* al dicht */ } resolve(v); };
    const t = setTimeout(() => finish(null), ms);
    sock.on('error', () => finish(null));
    sock.on('message', (msg, rinfo) => { if (rinfo.address === ip) { const v = parse(msg); if (v) finish(v); } });
    sock.send(packet, port, ip, (err) => { if (err) finish(null); });
  });
}

const mdns = (ip) => udpAsk(ip, 5353, mdnsQuery(ip), parseMdnsAnswer, 1200);

// ---- NetBIOS (Windows en sommige NAS/printers, poort 137) ------------------
function nbstatQuery() {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(0x1234, 0);
  head.writeUInt16BE(1, 4);
  const name = Buffer.concat([Buffer.from([0x20]), Buffer.from('CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), Buffer.from([0])]);
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(0x21, 0);
  tail.writeUInt16BE(1, 2);
  return Buffer.concat([head, name, tail]);
}

function parseNbstat(buf) {
  try {
    if (buf.length < 57) return null;
    const r = readName(buf, 12);
    if (!r) return null;
    let pos = r.next + 10; // type, class, ttl, rdlength
    const count = buf[pos];
    pos++;
    for (let i = 0; i < count; i++) {
      const o = pos + i * 18;
      if (o + 18 > buf.length) break;
      const suffix = buf[o + 15];
      const flags = buf.readUInt16BE(o + 16);
      if (suffix === 0 && (flags & 0x8000) === 0) {
        const c = cleanName(buf.slice(o, o + 15).toString('ascii').trim());
        if (c) return c;
      }
    }
  } catch { /* kapot pakket */ }
  return null;
}

const netbios = (ip) => udpAsk(ip, 137, nbstatQuery(), parseNbstat, 1200);

// Probeer achter elkaar tot er een naam is
async function resolveName(ip, gateway) {
  let n;
  if (gateway && gateway !== ip && (n = await reverseDns(ip, gateway))) return { name: n, source: 'DNS' };
  if ((n = await reverseDns(ip))) return { name: n, source: 'DNS' };
  if ((n = await mdns(ip))) return { name: n, source: 'mDNS' };
  if ((n = await netbios(ip))) return { name: n, source: 'NetBIOS' };
  return null;
}

// Parallel met een maximum aantal tegelijk
async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; try { await fn(item); } catch { /* volgende */ } }
  });
  await Promise.all(workers);
}

// ---- Fabrikant en soort apparaat uit de naam raden ---------------------------
const VENDOR_BY_NAME = [
  [/iphone|ipad|ipod|macbook|imac|mac-?mini|mac-?studio|apple-?tv|homepod|airport|airpods|^mbp\b/i, 'Apple'],
  [/galaxy|samsung|^sm-[a-z]\d/i, 'Samsung'],
  [/pixel|chromecast|google-?home|google-?nest|nest-/i, 'Google'],
  [/^echo|alexa|kindle|fire-?tv|fire-?stick|amazon/i, 'Amazon'],
  [/playstation|^ps[345]\b/i, 'Sony'],
  [/xbox/i, 'Microsoft'],
  [/^desktop-|^laptop-|^win(dows)?-|^surface/i, 'Microsoft (Windows)'],
  [/esp[-_]?\d|esp32|esp8266|espressif/i, 'Espressif'],
  [/shelly/i, 'Shelly'], [/tasmota/i, 'Tasmota'], [/sonoff/i, 'Sonoff'],
  [/hue-?bridge|philips-?hue/i, 'Philips Hue'],
  [/sonos/i, 'Sonos'], [/roku/i, 'Roku'],
  [/^lg|webos/i, 'LG'],
  [/synology|diskstation/i, 'Synology'],
  [/tp-?link|^deco|^archer/i, 'TP-Link'],
  [/huawei/i, 'Huawei'], [/xiaomi|redmi|miui/i, 'Xiaomi'], [/oneplus/i, 'OnePlus'],
  [/android/i, 'Android'],
  [/raspberry|^rpi/i, 'Raspberry Pi'],
  [/zima/i, 'ZimaOS'],
  [/^npi[0-9a-f]{6}|^hp[-_]/i, 'HP'], [/^brn|brother/i, 'Brother'], [/epson/i, 'Epson'], [/canon/i, 'Canon'],
];

function vendorFromName(name) {
  const n = String(name || '');
  if (!n) return null;
  for (const [re, v] of VENDOR_BY_NAME) if (re.test(n)) return v;
  return null;
}

const ICON_BY_TEXT = [
  ['tablet', /ipad|tablet|^tab[-_ ]/i],
  ['phone', /iphone|android|galaxy|pixel|phone|redmi|oneplus|xiaomi|huawei|^sm-[a-z]\d/i],
  ['laptop', /macbook|laptop|notebook|surface|^mbp\b/i],
  ['desktop', /desktop|imac|^pc\b|-pc\b|mac-?mini|mac-?studio|windows/i],
  ['tv', /\btv\b|-tv|tv-|webos|roku|chromecast|apple-?tv|bravia|fire-?tv|fire-?stick|^lg/i],
  ['speaker', /sonos|^echo|alexa|homepod|google-?home|nest-?(audio|mini)|speaker/i],
  ['printer', /printer|^brn|brother|epson|canon|^npi/i],
  ['camera', /\bcam|camera|\bring\b|eufy|reolink|hikvision|doorbell/i],
  ['router', /router|^deco|^archer|gateway|modem|^ap-|accesspoint|unifi|tp-?link/i],
  ['server', /\bnas\b|server|zima|synology|raspberry|^rpi|docker|pi-?hole|adguard|diskstation/i],
  ['game', /playstation|^ps[345]\b|xbox|switch|nintendo|steam/i],
  ['iot', /^esp|[-_]esp|esp32|esp8266|shelly|tasmota|sonoff|\bhue\b|plug|bulb|sensor|tuya|smart/i],
];

function iconFromText(...parts) {
  const text = parts.filter(Boolean).join(' ');
  if (!text) return null;
  for (const [icon, re] of ICON_BY_TEXT) if (re.test(text)) return icon;
  return null;
}

module.exports = {
  cleanName, reverseDns, mdns, netbios, resolveName, pool, sleep,
  parseMdnsAnswer, parseNbstat, mdnsQuery, nbstatQuery, vendorFromName, iconFromText, readName, dnsName,
};
