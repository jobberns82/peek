'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('dgram');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const net = require('../lib/netutil');
const names = require('../lib/names');
const { createOui } = require('../lib/oui');
const { createAuth } = require('../lib/auth');
const logosLib = require('../lib/logos');
const http = require('http');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'peek-test-'));

// ---------- netutil ----------
test('parseCidr rekent het netwerk uit en weigert onzin', () => {
  const n = net.parseCidr('192.168.2.77/24');
  assert.equal(n.cidr, '192.168.2.0/24');
  assert.equal(net.hostsOf(n).length, 254);
  assert.equal(net.hostsOf(n)[0], '192.168.2.1');
  assert.equal(net.hostsOf(n)[253], '192.168.2.254');
  assert.throws(() => net.parseCidr('10.0.0.0/8'), /te groot/);
  assert.throws(() => net.parseCidr('hallo'), /Ongeldig/);
  assert.throws(() => net.parseCidr('300.1.1.1/24'), /Ongeldig/);
  assert.equal(net.parseCidr('192.168.0.0/22').size, 1024);
});

test('inNet, normMac en privé-MAC', () => {
  const n = net.parseCidr('192.168.2.0/24');
  assert.ok(net.inNet('192.168.2.5', n));
  assert.ok(!net.inNet('192.168.3.5', n));
  assert.equal(net.normMac('3C-AB-0A-00-00-01'), '3c:ab:0a:00:00:01');
  assert.equal(net.normMac('xyz'), null);
  assert.ok(net.isPrivateMac('da:a1:19:4c:10:7e'));
  assert.ok(net.isPrivateMac('f6:12:34:56:78:9a'));
  assert.ok(!net.isPrivateMac('3c:ab:0a:00:00:01'));
});

test('ARP-tabel: alleen volledige regels tellen', () => {
  const text = [
    'IP address       HW type     Flags       HW address            Mask     Device',
    '192.168.2.1      0x1         0x2         3c:ab:0a:00:00:01     *        eth0',
    '192.168.2.9      0x1         0x0         00:00:00:00:00:00     *        eth0',
    '192.168.2.21     0x1         0x2         DA:A1:19:4C:10:7E     *        eth0',
    '192.168.2.30     0x1         0x6         3c:ab:0d:55:21:09     *        eth0',
  ].join('\n');
  const r = net.parseArp(text);
  assert.deepEqual(r.map((x) => x.ip), ['192.168.2.1', '192.168.2.21', '192.168.2.30']);
  assert.equal(r[1].mac, 'da:a1:19:4c:10:7e');
});

test('standaardroute uit /proc/net/route', () => {
  const text = 'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\tMTU\tWindow\tIRTT\neth0\t00000000\t0102A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0\neth0\t0002A8C0\t00000000\t0001\t0\t0\t100\t00FFFFFF\t0\t0\t0';
  assert.deepEqual(net.parseRoute(text), { iface: 'eth0', ip: '192.168.2.1' });
});

// ---------- fabrikantenlijst ----------
test('OUI-lijst: csv, lengtes, opschonen en privé-adressen', () => {
  const oui = createOui(tmp());
  const csv = [
    'Registry,Assignment,Organization Name,Organization Address',
    'MA-L,3CAB0A,"TP-LINK TECHNOLOGIES CO.,LTD.","Shenzhen, China"',
    'MA-L,3CAB0B,Apple\\, Inc.,Cupertino',
    'MA-M,3CAB0C1,"Voorbeeld ""Zeven"" B.V.",Utrecht',
    'MA-S,3CAB0D123,Negen Systems Inc.,Delft',
    'MA-L,3CAB0E,Private,',
  ].join('\r\n');
  const map = new Map();
  assert.equal(oui.addCsv(map, csv), 4);
  assert.equal(map.get('3CAB0A'), 'TP-LINK TECHNOLOGIES CO.,LTD.');
  assert.equal(map.get('3CAB0C1'), 'Voorbeeld "Zeven" B.V.');
  assert.equal(oui.tidy('TP-LINK TECHNOLOGIES CO.,LTD.'), 'TP-LINK TECHNOLOGIES');
  assert.equal(oui.tidy('Apple, Inc.'), 'Apple');
  assert.equal(oui.tidy('Samsung Electronics Co.,Ltd'), 'Samsung Electronics');
  // lookup via setDemo (gebruikt dezelfde opzoekfunctie)
  oui.setDemo({ '3CAB0A': 'Kort', '3CAB0C1': 'Zeven', '3CAB0C': 'Zes' });
  assert.equal(oui.lookup('3c:ab:0a:11:22:33'), 'Kort');
  assert.equal(oui.lookup('3c:ab:0c:1f:00:00'), 'Zeven', 'langste overeenkomst wint');
  assert.equal(oui.lookup('3c:ab:0c:2f:00:00'), 'Zes');
  assert.equal(oui.lookup('da:a1:19:00:00:01'), null, 'privé-adres heeft geen fabrikant');
});

test('OUI-reserveformaat (Wireshark manuf) wordt gelezen', () => {
  const oui = createOui(tmp());
  const text = ['# commentaar', '00:00:0C\tCisco\tCisco Systems, Inc', '3C:AB:0C:10:00:00/28\tZeven\tZeven Systems B.V.', '3C:AB:0D:12:30:00/36\tNegen', 'kapotte regel', ''].join('\n');
  const map = new Map();
  assert.equal(oui.addManuf(map, text), 3);
  assert.equal(map.get('00000C'), 'Cisco Systems, Inc');
  assert.equal(map.get('3CAB0C1'), 'Zeven Systems B.V.');
  assert.equal(map.get('3CAB0D123'), 'Negen');
});

// ---------- namen ----------
test('cleanName', () => {
  assert.equal(names.cleanName('Jobs-iPhone.local'), 'Jobs-iPhone');
  assert.equal(names.cleanName('nas.home.arpa.'), 'nas');
  assert.equal(names.cleanName('192-168-2-5.lan'), null);
  assert.equal(names.cleanName('localhost'), null);
  assert.equal(names.cleanName('naam\u0007met\u0000tekens'), 'naammettekens');
  assert.equal(names.cleanName(''), null);
});

function mdnsAnswer(ip, hostname) {
  const q = names.mdnsQuery(ip).slice(12); // vraag zonder header
  const head = Buffer.alloc(12);
  head.writeUInt16BE(0x8400, 2); head.writeUInt16BE(1, 4); head.writeUInt16BE(1, 6);
  const rdata = names.dnsName(hostname);
  const rr = Buffer.alloc(12);
  rr.writeUInt16BE(0xc00c, 0); // verwijzing naar de naam in de vraag
  rr.writeUInt16BE(12, 2); rr.writeUInt16BE(1, 4); rr.writeUInt32BE(120, 6); rr.writeUInt16BE(rdata.length, 10);
  return Buffer.concat([head, q, rr, rdata]);
}

test('mDNS-antwoord met naamverwijzing wordt gelezen', () => {
  assert.equal(names.parseMdnsAnswer(mdnsAnswer('192.168.2.21', 'Jobs-iPhone.local')), 'Jobs-iPhone');
  assert.equal(names.parseMdnsAnswer(Buffer.from([1, 2, 3])), null);
  assert.equal(names.parseMdnsAnswer(Buffer.alloc(40, 255)), null);
});

test('NetBIOS-antwoord: groepsnamen worden overgeslagen', () => {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(0x8400, 2); head.writeUInt16BE(1, 6);
  const nm = Buffer.concat([Buffer.from([0x20]), Buffer.from('CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), Buffer.from([0])]);
  const entry = (name, suffix, flags) => { const b = Buffer.alloc(18); b.write(name.padEnd(15, ' '), 0, 'ascii'); b[15] = suffix; b.writeUInt16BE(flags, 16); return b; };
  const data = Buffer.concat([Buffer.from([2]), entry('WORKGROUP', 0, 0x8400), entry('DESKTOP-4F8K2LM', 0, 0x0400), Buffer.alloc(6)]);
  const rr = Buffer.alloc(10);
  rr.writeUInt16BE(0x21, 0); rr.writeUInt16BE(1, 2); rr.writeUInt16BE(data.length, 8);
  assert.equal(names.parseNbstat(Buffer.concat([head, nm, rr, data])), 'DESKTOP-4F8K2LM');
});

test('naam vragen over UDP werkt tegen een lokale tegenstem', async () => {
  const server = dgram.createSocket('udp4');
  await new Promise((r) => server.bind(0, '127.0.0.1', r));
  server.on('message', (msg, rinfo) => server.send(mdnsAnswer('127.0.0.1', 'Testbak.local'), rinfo.port, rinfo.address));
  const port = server.address().port;
  const sock = dgram.createSocket('udp4');
  const got = await new Promise((resolve) => {
    sock.on('message', (m) => resolve(names.parseMdnsAnswer(m)));
    sock.send(names.mdnsQuery('127.0.0.1'), port, '127.0.0.1');
    setTimeout(() => resolve(null), 1500);
  });
  sock.close(); server.close();
  assert.equal(got, 'Testbak');
});

test('fabrikant en icoon raden op naam', () => {
  assert.equal(names.vendorFromName('Jobs-iPhone'), 'Apple');
  assert.equal(names.vendorFromName('DESKTOP-4F8K2LM'), 'Microsoft (Windows)');
  assert.equal(names.vendorFromName('Galaxy-S23'), 'Samsung');
  assert.equal(names.vendorFromName('onbekend-ding'), null);
  assert.equal(names.iconFromText('iPad-van-Kind'), 'tablet');
  assert.equal(names.iconFromText('Jobs-iPhone'), 'phone');
  assert.equal(names.iconFromText('MacBook-Pro'), 'laptop');
  assert.equal(names.iconFromText('Spring-laptop'), 'laptop');
  assert.equal(names.iconFromText('xyz'), null);
});

// ---------- login ----------
test('sessiecookie: ondertekend, niet te vervalsen', () => {
  const a = createAuth({ dataDir: tmp(), user: 'job', password: 'geheim-wachtwoord' });
  assert.ok(a.checkCredentials('job', 'geheim-wachtwoord'));
  assert.ok(!a.checkCredentials('job', 'fout'));
  assert.ok(!a.checkCredentials('ander', 'geheim-wachtwoord'));
  const t = a.makeToken();
  assert.ok(a.verifyToken(t));
  assert.ok(!a.verifyToken(t.slice(0, -2) + 'xx'));
  assert.ok(!a.verifyToken('abc.def'));
  const evil = Buffer.from(JSON.stringify({ u: 'job', exp: Date.now() + 1e12 })).toString('base64url') + '.' + t.split('.')[1];
  assert.ok(!a.verifyToken(evil));
  // een andere sleutel (andere installatie) accepteert deze sessie niet
  const b = createAuth({ dataDir: tmp(), user: 'job', password: 'geheim-wachtwoord' });
  assert.ok(!b.verifyToken(t));
});

test('rem op foute pogingen', () => {
  const a = createAuth({ dataDir: tmp(), user: 'job', password: 'geheim-wachtwoord' });
  const req = { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {} };
  for (let i = 0; i < 5; i++) { assert.equal(a.blockedFor(req), 0); a.recordFail(req); }
  assert.ok(a.blockedFor(req) > 0);
  assert.equal(a.blockedFor({ headers: { 'x-forwarded-for': '5.6.7.8' }, socket: {} }), 0, 'andere bezoeker niet geblokkeerd');
});

// ---------- fabrikantlogo's ----------
test('logo: merk bij fabrikant en alleen veilige SVG', () => {
  assert.equal(logosLib.slugFor('Apple'), 'apple');
  assert.equal(logosLib.slugFor('TP-LINK TECHNOLOGIES'), 'tplink');
  assert.equal(logosLib.slugFor('Signify'), 'philipshue');
  assert.equal(logosLib.slugFor('Microsoft (Windows)'), 'microsoft');
  assert.equal(logosLib.slugFor('Onbekende Fabriek BV'), null);
  assert.equal(logosLib.slugFor(null), null);
  const ok = '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"/></svg>';
  assert.equal(logosLib.clean(ok), ok);
  assert.equal(logosLib.clean('<?xml version="1.0"?>\n' + ok).startsWith('<?xml'), true);
  for (const bad of [
    '<svg onload="alert(1)"><path d="M0 0"/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div/></foreignObject></svg>',
    '<svg><image href="http://x/y.png"/></svg>',
    '<svg><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>',
    '<html><body>geen svg</body></html>',
    '',
  ]) assert.equal(logosLib.clean(bad), null, bad);
});

test('logo: ophalen, bewaren en onthouden wat niet bestaat', async () => {
  const dir = tmp();
  const calls = [];
  const svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h20v20H2z"/></svg>';
  let mode = 'ok';
  const fakeFetch = async (url) => {
    calls.push(url);
    if (mode === 'down') throw new Error('geen internet');
    if (url.endsWith('/sonos.svg')) return { status: 404, ok: false, text: async () => '' };
    if (url.endsWith('/dell.svg')) return { status: 200, ok: true, text: async () => '<svg onload="x()"></svg>' };
    return { status: 200, ok: true, text: async () => svg };
  };
  let enabled = true;
  const logos = logosLib.createLogos({ dataDir: dir, enabled: () => enabled, fetchFn: fakeFetch, urlTemplate: 'https://example.test/{slug}.svg' });

  assert.equal(await logos.get('niet-in-de-lijst'), null);
  assert.equal(calls.length, 0, 'onbekend merk wordt nooit opgevraagd');
  assert.equal(await logos.get('apple'), svg);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'https://example.test/apple.svg', 'alleen de merknaam gaat naar buiten');
  assert.equal(await logos.get('apple'), svg);
  assert.equal(calls.length, 1, 'tweede keer uit de eigen opslag');
  assert.equal(await logos.get('sonos'), null);
  assert.equal(await logos.get('sonos'), null);
  assert.equal(calls.filter((u) => u.includes('sonos')).length, 1, '404 wordt onthouden');
  assert.equal(await logos.get('dell'), null, 'onveilige SVG wordt geweigerd');
  assert.ok(!fs.existsSync(path.join(dir, 'logos', 'dell.svg')));
  mode = 'down';
  assert.equal(await logos.get('lg'), null);
  mode = 'ok';
  assert.equal(await logos.get('lg'), null, 'na een storing even niet opnieuw proberen');
  assert.equal(calls.filter((u) => u.includes('/lg.svg')).length, 1);
  enabled = false;
  assert.equal(await logos.get('apple'), svg, 'uitgeschakeld: opgeslagen logo blijft werken');
  assert.equal(await logos.get('google'), null, 'uitgeschakeld: niets nieuws ophalen');
  assert.equal(calls.filter((u) => u.includes('google')).length, 0);
});

// ---------- hele server (demo-modus) ----------
async function startServer(extraEnv) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const dir = tmp();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, PEEK_DEMO: '1', PEEK_USER: 'job', PEEK_PASSWORD: 'test-wachtwoord', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start duurde te lang')), 8000);
    child.stdout.on('data', (d) => { if (String(d).includes('luistert')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error('server stopte met ' + c)));
  });
  return { base: 'http://127.0.0.1:' + port, child, dir };
}

test('server: login, beveiliging en API', async (t) => {
  const { base, child } = await startServer();
  t.after(() => child.kill());
  const J = { 'Content-Type': 'application/json' };

  assert.equal((await fetch(base + '/healthz')).status, 200);
  assert.equal((await fetch(base + '/api/state')).status, 401, 'zonder login geen gegevens');
  assert.equal((await fetch(base + '/')).status, 200, 'inlogpagina is wel bereikbaar');

  const bad = await fetch(base + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ user: 'job', password: 'nee' }) });
  assert.equal(bad.status, 401);
  const ok = await fetch(base + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ user: 'job', password: 'test-wachtwoord' }) });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const C = { Cookie: cookie.split(';')[0] };

  await new Promise((r) => setTimeout(r, 2500)); // demo-scan klaar
  const st = await (await fetch(base + '/api/state', { headers: C })).json();
  assert.equal(st.devices.length, 15);
  assert.equal(st.subnet.cidr, '192.168.2.0/24');
  const mac = '3c:ab:0c:aa:bb:cc';
  assert.ok(st.devices.find((d) => d.mac === mac).isNew);

  // hernoemen blijft bewaard
  let r = await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ name: '  Stekker  ', note: 'garage', icon: 'iot', known: true }) });
  assert.equal(r.status, 200);
  const st2 = await (await fetch(base + '/api/state', { headers: C })).json();
  const d = st2.devices.find((x) => x.mac === mac);
  assert.equal(d.name, 'Stekker');
  assert.equal(d.note, 'garage');
  assert.ok(!d.isNew);
  assert.ok(d.iconCustom);

  // ongeldige invoer
  r = await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ icon: 'bestaat-niet' }) });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/devices/zzz', { method: 'PATCH', headers: { ...J, ...C }, body: '{}' });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', headers: { ...C }, body: '{}' });
  assert.equal(r.status, 415, 'alleen JSON');
  r = await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', headers: { ...J, ...C, 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
  assert.equal(r.status, 403, 'geen verzoeken vanaf andere websites');

  // online apparaat kan niet vergeten worden, offline wel
  r = await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'DELETE', headers: C });
  assert.equal(r.status, 409);
  r = await fetch(base + '/api/devices/' + encodeURIComponent('9a:bc:de:f0:12:34'), { method: 'DELETE', headers: C });
  assert.equal(r.status, 200);

  // instellingen
  r = await fetch(base + '/api/settings', { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ subnet: '10.0.0.0/8' }) });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/settings', { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ interval: 7 }) });
  assert.equal(r.status, 400);

  // CSV: formules worden onschadelijk gemaakt
  await fetch(base + '/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ name: '=HYPERLINK("x")' }) });
  r = await fetch(base + '/api/export.csv', { headers: C });
  assert.match(r.headers.get('content-type'), /text\/csv/);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM zodat Excel de tekens goed leest');
  const csv = bytes.toString('utf8');
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"Naam";"Eigen naam"'));

  // padtruc werkt niet
  assert.notEqual((await fetch(base + '/..%2f..%2fetc%2fpasswd')).status, 200);
  const raw = await fetch(base + '/%2e%2e/server.js');
  assert.notEqual(raw.status, 200);

  // uitloggen maakt de cookie ongeldig voor de browser
  r = await fetch(base + '/api/logout', { method: 'POST', headers: C });
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
});

test('server: fabrikantlogo via eigen route, achter de login', async (t) => {
  const svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/></svg>';
  const asked = [];
  const logoHost = http.createServer((req, res) => {
    asked.push(req.url);
    if (req.url === '/apple.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end(svg); } else { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => logoHost.listen(0, '127.0.0.1', r));
  const { base, child } = await startServer({ PEEK_LOGO_URL: 'http://127.0.0.1:' + logoHost.address().port + '/{slug}.svg' });
  t.after(() => { child.kill(); logoHost.close(); });
  const J = { 'Content-Type': 'application/json' };

  assert.equal((await fetch(base + '/api/vendor-logo/apple.svg')).status, 401, 'zonder login geen logo');
  const v = await (await fetch(base + '/api/version')).json();
  assert.equal(v.version, '1.1.0', 'versie is zonder login te zien (inlogscherm)');

  const ok = await fetch(base + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ user: 'job', password: 'test-wachtwoord' }) });
  const C = { Cookie: ok.headers.get('set-cookie').split(';')[0] };
  await new Promise((r) => setTimeout(r, 2500));
  const st = await (await fetch(base + '/api/state', { headers: C })).json();
  assert.ok(st.devices.find((d) => d.vendor === 'Apple').vendorSlug === 'apple');
  assert.equal(st.devices.find((d) => !d.vendor).vendorSlug, null);
  assert.equal(st.logos, true);

  let r = await fetch(base + '/api/vendor-logo/apple.svg', { headers: C });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/svg+xml');
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(await r.text(), svg);
  r = await fetch(base + '/api/vendor-logo/sonos.svg', { headers: C });
  assert.equal(r.status, 404, 'monogram als terugval');
  r = await fetch(base + '/api/vendor-logo/..%2fetc.svg', { headers: C });
  assert.equal(r.status, 404);
  r = await fetch(base + '/api/vendor-logo/onbekendmerk.svg', { headers: C });
  assert.equal(r.status, 404);
  assert.ok(!asked.includes('/onbekendmerk.svg'), 'alleen vaste merken worden opgevraagd');

  // uitzetten in de instellingen: niets nieuws meer ophalen
  r = await fetch(base + '/api/settings', { method: 'PATCH', headers: { ...J, ...C }, body: JSON.stringify({ logos: false }) });
  assert.equal(r.status, 200);
  const before = asked.length;
  await fetch(base + '/api/vendor-logo/samsung.svg', { headers: C });
  assert.equal(asked.length, before);
  const st2 = await (await fetch(base + '/api/state', { headers: C })).json();
  assert.equal(st2.logos, false);
});

test('server start niet zonder wachtwoord', async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: '29999', DATA_DIR: tmp(), PEEK_USER: '', PEEK_PASSWORD: '' }, stdio: 'ignore',
  });
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 1);
});
