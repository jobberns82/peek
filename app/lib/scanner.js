'use strict';
// De scanner: LAN doorzoeken (alleen kijken), apparaten bijhouden en voor de interface klaarzetten.
//
// Werkwijze zonder extra rechten of programma's:
//  1. Naar elk adres in het subnet gaat één klein UDP-pakketje (poort 9, discard).
//     Daardoor vraagt het besturingssysteem zelf via ARP "wie is dit?".
//  2. Daarna lezen we de ARP-tabel (/proc/net/arp) uit. Dat levert IP en MAC op.
//  3. Per apparaat vragen we de naam via DNS, mDNS en NetBIOS.
// Dit werkt alleen als de container op het netwerk van de server zelf draait (network_mode: host).
const dgram = require('dgram');
const os = require('os');
const net = require('./netutil');
const names = require('./names');
const { slugFor } = require('./logos');

const MISS_LIMIT = 2; // zo vaak gemist voordat een apparaat offline heet
const NAME_TTL_KNOWN = 6 * 3600 * 1000;
const NAME_TTL_UNKNOWN = 3600 * 1000;
const VALID_ICONS = ['phone', 'tablet', 'laptop', 'desktop', 'tv', 'speaker', 'printer', 'camera', 'router', 'server', 'game', 'iot', 'unknown'];
const INTERVALS = [0, 1, 5, 15, 30, 60];

function createScanner({ store, oui, env, demo }) {
  const state = {
    scanning: false,
    phase: '',
    startedAt: 0,
    last: null, // { at, durationMs, found, error }
    nextAt: 0,
    subnet: null, // { cidr, source, iface, ip, gateway, warning }
  };
  let timer = null;

  // ---- Instellingen ----
  function settings() {
    const s = store.data.settings;
    let interval = Number.isFinite(s.interval) ? s.interval : Number(env.PEEK_INTERVAL);
    if (!INTERVALS.includes(interval)) interval = 5;
    const logos = s.logos !== undefined ? !!s.logos : env.PEEK_LOGOS !== '0';
    return { interval, subnet: s.subnet || '', logos };
  }

  function resolveSubnet() {
    if (demo) return { cidr: '192.168.2.0/24', source: 'automatisch', iface: 'eth0', ip: '192.168.2.10', mac: demo.selfMac, gateway: '192.168.2.1' };
    const s = settings();
    const manual = s.subnet || env.PEEK_SUBNET || '';
    const auto = net.detectSubnet();
    if (manual) {
      const n = net.parseCidr(manual);
      return { cidr: n.cidr, source: s.subnet ? 'handmatig' : 'compose', iface: auto && auto.iface, ip: auto && auto.ip, mac: auto && auto.mac, gateway: auto && auto.gateway };
    }
    if (auto) return { cidr: auto.cidr, source: 'automatisch', iface: auto.iface, ip: auto.ip, mac: auto.mac, gateway: auto.gateway };
    return {
      cidr: net.FALLBACK_CIDR, source: 'standaard', iface: null, ip: null, mac: null, gateway: null,
      warning: 'Geen netwerk gevonden, standaardwaarde gebruikt. Draait de container met network_mode: host?',
    };
  }

  function setSettings(patch) {
    const s = store.data.settings;
    if (patch.interval !== undefined) {
      const v = Number(patch.interval);
      if (!INTERVALS.includes(v)) throw new Error('Ongeldige scanfrequentie');
      s.interval = v;
    }
    if (patch.subnet !== undefined) {
      const v = String(patch.subnet || '').trim();
      if (v) net.parseCidr(v); // gooit een fout bij onzin
      s.subnet = v ? net.parseCidr(v).cidr : '';
    }
    if (patch.logos !== undefined) s.logos = !!patch.logos;
    store.save();
    state.subnet = safeResolve();
    planNext();
  }

  function safeResolve() {
    try { return resolveSubnet(); } catch (e) { return { cidr: net.FALLBACK_CIDR, source: 'standaard', warning: e.message }; }
  }

  // ---- Scannen ----
  async function sweep(ips) {
    const sock = dgram.createSocket('udp4');
    sock.on('error', () => {});
    const buf = Buffer.from([0]);
    for (let i = 0; i < ips.length; i++) {
      try { sock.send(buf, 9, ips[i], () => {}); } catch { /* volgende */ }
      if (i % 64 === 63) await names.sleep(25);
    }
    await names.sleep(150);
    try { sock.close(); } catch { /* al dicht */ }
  }

  async function arpScan(n) {
    const ips = net.hostsOf(n);
    state.phase = 'Apparaten zoeken';
    await sweep(ips);
    await names.sleep(3000);
    await sweep(ips); // tweede ronde voor apparaten die nog sliepen
    // Het besturingssysteem heeft ±8 seconden nodig om verdwenen apparaten als mislukt te markeren
    await names.sleep(7000);
    return net.readArp().filter((e) => net.inNet(e.ip, n));
  }

  function selfEntry(n, info) {
    for (const i of net.ownInterfaces()) {
      if (net.inNet(i.ip, n) && i.mac && i.mac !== '00:00:00:00:00:00') return { ip: i.ip, mac: i.mac };
    }
    if (info && info.ip && info.mac && net.inNet(info.ip, n)) return { ip: info.ip, mac: info.mac };
    return null;
  }

  function newDevice(mac, now, known) {
    return { mac, ip: '', name: '', note: '', icon: '', netName: '', nameSource: '', nameChecked: 0, firstSeen: now, lastSeen: now, misses: 0, online: true, known };
  }

  async function run() {
    if (state.scanning) return false;
    state.scanning = true;
    state.startedAt = Date.now();
    state.phase = 'Starten';
    clearTimeout(timer);
    const t0 = Date.now();
    try {
      state.subnet = resolveSubnet();
      const n = net.parseCidr(state.subnet.cidr);
      let found;
      if (demo) found = await demo.scan(store, oui);
      else {
        found = await arpScan(n);
        const me = selfEntry(n, state.subnet);
        if (me && !found.some((f) => f.mac === me.mac)) found.push({ ip: me.ip, mac: me.mac, self: true });
      }
      if (!found.length) throw new Error('Geen apparaten gezien. Controleer of de container met network_mode: host draait.');
      merge(found);
      state.phase = 'Namen opzoeken';
      await lookupNames(found);
      state.last = { at: Date.now(), durationMs: Date.now() - t0, found: found.length, error: null };
    } catch (e) {
      state.last = { at: Date.now(), durationMs: Date.now() - t0, found: 0, error: String((e && e.message) || e).slice(0, 300) };
    } finally {
      state.scanning = false;
      state.phase = '';
      store.save();
      planNext();
    }
    return true;
  }

  function merge(found) {
    const now = Date.now();
    const devs = store.data.devices;
    const seen = new Set();
    const firstEver = !store.data.meta.baselineDone;
    for (const f of found) {
      seen.add(f.mac);
      let d = devs[f.mac];
      if (!d) { d = devs[f.mac] = newDevice(f.mac, now, firstEver); }
      d.ip = f.ip;
      d.lastSeen = now;
      d.misses = 0;
      d.online = true;
    }
    for (const mac of Object.keys(devs)) {
      if (seen.has(mac)) continue;
      const d = devs[mac];
      d.misses = (d.misses || 0) + 1;
      if (d.misses >= MISS_LIMIT) d.online = false;
    }
    // Bij de allereerste scan is alles "bekend", anders is alles meteen nieuw
    if (firstEver) store.data.meta.baselineDone = true;
  }

  async function lookupNames(found) {
    const now = Date.now();
    const devs = store.data.devices;
    const gw = state.subnet && state.subnet.gateway;
    const selfMac = (selfEntry(net.parseCidr(state.subnet.cidr), state.subnet) || {}).mac;
    const todo = found.map((f) => devs[f.mac]).filter((d) => {
      const ttl = d.netName ? NAME_TTL_KNOWN : NAME_TTL_UNKNOWN;
      return now - (d.nameChecked || 0) > ttl;
    });
    await names.pool(todo, 24, async (d) => {
      if (d.mac === selfMac) {
        d.netName = names.cleanName(os.hostname()) || d.netName;
        d.nameSource = 'Deze server';
      } else if (demo) {
        // geen netwerk in demo
      } else {
        const r = await names.resolveName(d.ip, gw);
        if (r) { d.netName = r.name; d.nameSource = r.source; }
      }
      d.nameChecked = Date.now();
    });
  }

  // ---- Planning ----
  function planNext() {
    clearTimeout(timer);
    const s = settings();
    if (!s.interval) { state.nextAt = 0; return; }
    const base = state.last ? state.last.at : Date.now();
    state.nextAt = base + s.interval * 60000;
    timer = setTimeout(() => { run(); }, Math.max(1000, state.nextAt - Date.now()));
    timer.unref();
  }

  function start() {
    state.subnet = safeResolve();
    setTimeout(() => { run(); }, 2500).unref();
  }

  // ---- Voor de interface ----
  function serialize() {
    const devs = store.data.devices;
    const sub = state.subnet || safeResolve();
    const selfMac = demo ? demo.selfMac : (sub.mac || (selfEntry(net.parseCidr(sub.cidr), sub) || {}).mac);
    return Object.values(devs).map((d) => {
      const priv = net.isPrivateMac(d.mac);
      const display = d.name || d.netName || '';
      let vendor = oui.lookup(d.mac);
      let vendorSource = vendor ? 'mac' : null;
      if (!vendor) {
        const g = names.vendorFromName(display) || names.vendorFromName(d.netName);
        if (g) { vendor = g; vendorSource = 'naam'; }
      }
      const isGateway = !!(sub.gateway && d.ip === sub.gateway);
      const isSelf = d.mac === selfMac;
      const auto = isGateway ? 'router' : isSelf ? 'server' : names.iconFromText(display, d.netName, vendor);
      return {
        mac: d.mac,
        ip: d.ip,
        name: display,
        customName: d.name || '',
        netName: d.netName || '',
        nameSource: d.name ? 'Eigen naam' : (d.nameSource || ''),
        note: d.note || '',
        icon: d.icon && VALID_ICONS.includes(d.icon) ? d.icon : (auto || 'unknown'),
        iconCustom: !!(d.icon && VALID_ICONS.includes(d.icon)),
        vendor,
        vendorSource,
        vendorSlug: slugFor(vendor),
        privateMac: priv,
        online: !!d.online,
        lastSeen: d.lastSeen,
        firstSeen: d.firstSeen,
        isNew: !d.known,
        isGateway,
        isSelf,
      };
    });
  }

  function patchDevice(mac, body) {
    const d = store.data.devices[mac];
    if (!d) return null;
    if (body.name !== undefined) d.name = String(body.name).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60);
    if (body.note !== undefined) d.note = String(body.note).replace(/\u0000/g, '').slice(0, 500);
    if (body.icon !== undefined) {
      if (body.icon && !VALID_ICONS.includes(body.icon)) throw new Error('Onbekend icoon');
      d.icon = body.icon || '';
    }
    if (body.known !== undefined) d.known = !!body.known;
    store.save();
    return d;
  }

  function forget(mac) {
    const d = store.data.devices[mac];
    if (!d) return 'none';
    if (d.online) return 'online';
    delete store.data.devices[mac];
    store.save();
    return 'ok';
  }

  function markAllKnown() {
    for (const d of Object.values(store.data.devices)) d.known = true;
    store.save();
  }

  return { state, settings, setSettings, run, start, serialize, patchDevice, forget, markAllKnown, VALID_ICONS, INTERVALS, safeResolve };
}

module.exports = { createScanner, VALID_ICONS, INTERVALS };
