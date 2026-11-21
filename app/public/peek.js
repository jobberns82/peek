'use strict';
(function () {
  // ---- hulpjes ----
  const $ = (id) => document.getElementById(id);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Statische iconen (geen invoer van buiten, dus veilig om als markup in te zetten)
  const ICONS = {
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M11 18h2"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
    desktop: '<rect x="3" y="4" width="18" height="12" rx="1.8"/><path d="M9 20h6M12 16v4"/>',
    tv: '<rect x="3" y="7" width="18" height="12" rx="1.8"/><path d="M9 22h6M9.5 3.5 12 7l2.5-3.5"/>',
    speaker: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="14.5" r="3.2"/><circle cx="12" cy="7.5" r="1"/>',
    printer: '<path d="M7 9V3.5h10V9"/><rect x="4" y="9" width="16" height="8" rx="1.8"/><path d="M7 14h10v6.5H7z"/>',
    camera: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2l1.5-2h7L17 7h2a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/><circle cx="12" cy="13" r="3.5"/>',
    router: '<rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 17h.01M11 17h.01"/><path d="M8.5 10.3a5 5 0 0 1 7 0M6 7.8a8.5 8.5 0 0 1 12 0"/>',
    server: '<rect x="3.5" y="3.5" width="17" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="17" height="7" rx="1.8"/><path d="M7 7h.01M7 17h.01"/>',
    game: '<path d="M7 8h10a4 4 0 0 1 4 4.2l-.6 3.6a2.3 2.3 0 0 1-4 1.2L14.5 15h-5l-1.9 2a2.3 2.3 0 0 1-4-1.2L3 12.2A4 4 0 0 1 7 8z"/><path d="M8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 13h.01"/>',
    iot: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
    thermostat: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v6"/><circle cx="12" cy="15.3" r="1.6"/>',
    airco: '<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M7 15.5c0 1.5 1 1.5 1 3M12 15.5c0 1.5 1 1.5 1 3M17 15.5c0 1.5 1 1.5 1 3"/>',
    heater: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8.5 8v6M12 8v6M15.5 8v6M7 19.5v-2.5M17 19.5v-2.5"/>',
    fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 14.5 4 16 5.5s-.5 4.5-4 4.9zM13.6 12c4.4 0 6.4 2.5 4.9 4s-4.500-.5-4.900-4zM12 13.6c0 4.400-2.500 6.400-4 4.900s.5-4.500 4-4.900zM10.400 12C6 12 4 9.500 5.500 8s4.500.5 4.900 4z"/>',
    purifier: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9 8h6M9 11h6M9 14h6"/>',
    sensor: '<path d="M14 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    plug: '<path d="M9 3v4M15 3v4"/><path d="M6.5 7h11v4.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 17v4"/>',
    lamp: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
    doorbell: '<rect x="7" y="2.5" width="10" height="19" rx="3"/><circle cx="12" cy="9" r="1.8"/><circle cx="12" cy="16" r="1.4"/>',
    vacuum: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.8"/><path d="M5.5 5.5l1.8 1.8"/>',
    blinds: '<path d="M4 4h16M4 8h16M4 12h16M4 16h10"/><path d="M17 15v5"/>',
    hub: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V4.5M12 14.5v5M9.5 12h-5M14.5 12h5"/><circle cx="12" cy="3.5" r="1"/><circle cx="12" cy="20.5" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="20.5" cy="12" r="1"/>',
    smoke: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M9.5 9h5M9.5 15h5"/>',
    solar: '<path d="M6 10h12l2.5 9h-17z"/><path d="M5 14.5h14M10 10l-.8 9M14 10l.8 9"/><path d="M12 3v2M5.500 5l1.300 1.300M18.500 5l-1.300 1.300"/>',
    ev: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M12.800 7l-2.800 5h3.500l-2.800 5"/>',
    unknown: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.7a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.6M12 16.5h.01"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  };
  const ICON_LABEL = {
    phone: 'Telefoon', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Computer', tv: 'Tv', speaker: 'Speaker',
    printer: 'Printer', camera: 'Camera', router: 'Router', server: 'Server', game: 'Spelcomputer', unknown: 'Onbekend', iot: 'Slim apparaat', thermostat: 'Thermostaat', airco: 'Airco', heater: 'Verwarming', fan: 'Ventilatie', purifier: 'Luchtreiniger', sensor: 'Sensor', plug: 'Slimme stekker', lamp: 'Lamp', lock: 'Slot', doorbell: 'Deurbel', vacuum: 'Stofzuiger', blinds: 'Rolluik', hub: 'Hub', smoke: 'Rookmelder', solar: 'Zonnepanelen', ev: 'Laadpaal',
  };
  function svg(name, cls) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    if (cls) el.setAttribute('class', cls);
    el.innerHTML = ICONS[name] || ICONS.unknown; // vaste, eigen markup
    return el;
  }

  // ---- webpagina openen ----
  // Peek scant geen poorten: de knop staat bij soorten apparaten die meestal een webpagina hebben,
  // en altijd in het detailvenster van een apparaat dat online is.
  const WEB_ICONS = new Set(['router', 'printer', 'camera', 'server', 'hub', 'thermostat', 'airco', 'heater', 'purifier', 'fan', 'solar', 'ev', 'doorbell', 'vacuum', 'iot']);
  const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  function webUrl(d) { return IPV4.test(d.ip || '') ? 'http://' + d.ip : null; }
  function openLink(d, compact) {
    const url = d.online ? webUrl(d) : null;
    if (!url) return null;
    if (compact && !(WEB_ICONS.has(d.icon) || d.isGateway)) return null;
    const a = h('a', { class: compact ? 'weblink' : 'btn small', href: url, target: '_blank', rel: 'noopener noreferrer', title: 'Open ' + url, 'aria-label': 'Open webpagina van ' + (d.name || d.ip) }, svg('ext'), compact ? null : 'Open webpagina');
    return a;
  }

  // ---- toestand ----
  const SORTS = ['name', 'ip', 'mac', 'vendor', 'seen'];
  const SORT_DEFAULT_DIR = { seen: -1 }; // laatst gezien: nieuwste eerst, de rest oplopend
  let data = null;
  let filter = 'all';
  let sortBy = 'ip';
  let sortDir = 1; // 1 = oplopend, -1 = aflopend
  let query = '';
  const open = new Set();
  let pendingRender = false;
  const saved = new Set(); // regels die net zijn opgeslagen: tonen kort een vinkje
  let pollTimer = null;

  try {
    const s = localStorage.getItem('peek-sort');
    if (SORTS.includes(s)) sortBy = s;
    if (localStorage.getItem('peek-sortdir') === '-1') sortDir = -1;
  } catch { /* geen opslag */ }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function api(path, opts) {
    const o = Object.assign({ headers: {} }, opts);
    if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(path, o);
    if (res.status === 401 && path !== '/api/login') {
      if (!document.body.classList.contains('inlog')) showLogin();
      throw new Error('Niet ingelogd');
    }
    let body = null;
    try { body = await res.json(); } catch { /* geen JSON */ }
    if (!res.ok) throw new Error((body && body.error) || 'Er ging iets mis (' + res.status + ')');
    return body;
  }

  // ---- tijd ----
  function ago(ts) {
    if (!ts) return 'nooit';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return 'zojuist';
    if (s < 3600) return Math.round(s / 60) + ' min geleden';
    if (s < 86400) return Math.round(s / 3600) + ' uur geleden';
    const d = new Date(ts);
    const t = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (s < 172800) return 'gisteren ' + t;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' + t;
  }
  const full = (ts) => (ts ? new Date(ts).toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
  function inMin(ts) {
    const m = Math.max(0, Math.round((ts - Date.now()) / 60000));
    return m <= 0 ? 'zo meteen' : 'over ' + m + ' min';
  }

  // ---- fabrikantlogo of monogram ----
  const logoState = new Map(); // merk -> 'busy' | 'ok' | 'none'
  let logoTimer = null;

  function probeLogo(slug) {
    logoState.set(slug, 'busy');
    const im = new Image();
    im.onload = () => { logoState.set(slug, 'ok'); clearTimeout(logoTimer); logoTimer = setTimeout(render, 150); };
    im.onerror = () => { logoState.set(slug, 'none'); };
    im.src = '/api/vendor-logo/' + slug + '.svg';
  }

  function monogram(name, small) {
    const text = String(name);
    const letter = (text.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
    let n = 0;
    for (const ch of text.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) % 5;
    return h('span', { class: 'mg mg' + n + (small ? ' sm' : ''), 'aria-hidden': 'true' }, letter);
  }

  function vendorMark(d, small) {
    if (!d.vendor) return null;
    const slug = d.vendorSlug;
    if (slug && data.logos !== false) {
      const st = logoState.get(slug);
      if (st === 'ok') {
        const url = 'url("/api/vendor-logo/' + slug + '.svg")';
        const el = h('span', { class: 'vlogo' + (small ? ' sm' : ''), role: 'img', 'aria-label': d.vendor });
        el.style.setProperty('-webkit-mask-image', url); // via CSSOM, dus toegestaan door de CSP
        el.style.setProperty('mask-image', url);
        return el;
      }
      if (!st) probeLogo(slug);
    }
    return monogram(d.vendor, small);
  }

  // ---- sorteren en filteren ----
  function ipNum(ip) { return (ip || '0.0.0.0').split('.').reduce((a, o) => a * 256 + Number(o), 0); }

  const SORT_VALUE = {
    ip: (d) => ipNum(d.ip),
    mac: (d) => d.mac,
    name: (d) => d.name || '',
    vendor: (d) => d.vendor || '',
    seen: (d) => (d.online ? Number.MAX_SAFE_INTEGER : d.lastSeen || 0),
  };

  function visible() {
    const q = query.trim().toLowerCase();
    const qm = q.replace(/[:\-]/g, '');
    const list = data.devices.filter((d) => {
      if (filter === 'online' && !d.online) return false;
      if (filter === 'offline' && d.online) return false;
      if (filter === 'new' && !d.isNew) return false;
      if (!q) return true;
      const hay = [d.name, d.netName, d.ip, d.mac, d.vendor, d.note].join(' ').toLowerCase();
      return hay.includes(q) || (qm && d.mac.replace(/:/g, '').includes(qm));
    });
    const val = SORT_VALUE[sortBy];
    list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      // Zonder naam of fabrikant staat altijd onderaan, welke kant je ook op sorteert
      if ((sortBy === 'name' || sortBy === 'vendor') && va !== vb && (!va || !vb)) return va ? -1 : 1;
      let c;
      if (typeof va === 'string') c = va.localeCompare(vb, 'nl', { sensitivity: 'base', numeric: true });
      else c = va < vb ? -1 : va > vb ? 1 : 0;
      return c * sortDir || ipNum(a.ip) - ipNum(b.ip);
    });
    return list;
  }

  function syncSortUi() {
    $('sort').value = sortBy;
    $('sortDir').classList.toggle('asc', sortDir === 1);
    for (const b of document.querySelectorAll('#kolommen button')) {
      const on = b.dataset.s === sortBy;
      b.classList.toggle('on', on);
      b.classList.toggle('desc', on && sortDir === -1);
      b.setAttribute('aria-sort', on ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
    }
  }

  function setSort(key, dir) {
    sortBy = key;
    sortDir = dir;
    try { localStorage.setItem('peek-sort', key); localStorage.setItem('peek-sortdir', String(dir)); } catch { /* geen opslag */ }
    syncSortUi();
    render();
  }

  // ---- weergave ----
  function renderStats() {
    const all = data.devices;
    const on = all.filter((d) => d.online).length;
    const nw = all.filter((d) => d.isNew).length;
    const tile = (key, n, label, cls) => h('div', { class: 'stat ' + (cls || ''), role: 'button', tabindex: '0', onclick: () => setFilter(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(key); } } },
      h('div', { class: 'n' }, n), h('div', { class: 'l' }, label));
    $('stats').replaceChildren(
      tile('all', all.length, 'Apparaten'),
      tile('online', on, 'Online', 'on-line'),
      tile('offline', all.length - on, 'Offline'),
      tile('new', nw, 'Nieuw', nw ? 'warn' : ''),
    );
  }

  function renderTop() {
    const sub = data.subnet;
    const bits = ['Peek ' + data.version, sub.cidr];
    if (data.last && !data.last.error) bits.push('laatste scan ' + ago(data.last.at));
    if (data.nextAt && !data.scanning) bits.push('volgende ' + inMin(data.nextAt));
    $('voet').textContent = bits.join(' · ');
    $('scanBtn').disabled = data.scanning;
    $('scanBtn').textContent = data.scanning ? 'Bezig…' : 'Nu scannen';
    const bar = $('scanBar');
    bar.hidden = !data.scanning;
    if (data.scanning) $('scanText').textContent = (data.phase || 'Scannen') + '… ' + Math.round((Date.now() - data.startedAt) / 1000) + ' s';

    const msgs = [];
    if (sub.warning) msgs.push(sub.warning);
    if (data.last && data.last.error) msgs.push('De laatste scan mislukte: ' + data.last.error);
    const b = $('banner');
    b.hidden = !msgs.length;
    b.textContent = msgs.join(' ');
  }

  function copy(text) {
    const done = () => toast('Gekopieerd: ' + text);
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, done); return; }
    const t = h('textarea', { 'aria-hidden': 'true' });
    t.value = text;
    document.body.append(t);
    t.select();
    try { document.execCommand('copy'); } catch { /* niet gelukt */ }
    t.remove();
    done();
  }

  async function patch(mac, body, quiet) {
    try {
      await api('/api/devices/' + encodeURIComponent(mac), { method: 'PATCH', body });
      const d = data.devices.find((x) => x.mac === mac);
      if (d) {
        if (body.name !== undefined) { d.customName = body.name; d.name = body.name || d.netName; }
        if (body.note !== undefined) d.note = body.note;
        if (body.known !== undefined) d.isNew = !body.known;
      }
      if (!quiet) toast('Opgeslagen');
      await refresh();
    } catch (e) { toast(e.message); }
  }

  // Naam en notitie opslaan, de regel dichtklappen en kort een vinkje tonen
  async function saveRow(d, name, note) {
    const body = {};
    if (name !== d.customName) body.name = name;
    if (note !== d.note) body.note = note;
    try {
      if (Object.keys(body).length) await api('/api/devices/' + encodeURIComponent(d.mac), { method: 'PATCH', body });
    } catch (e) { toast(e.message); return false; }
    if (body.name !== undefined) { d.customName = body.name; d.name = body.name || d.netName; }
    if (body.note !== undefined) d.note = body.note;
    open.delete(d.mac);
    saved.add(d.mac);
    render();
    setTimeout(() => { saved.delete(d.mac); render(); }, 1800);
    refresh();
    return true;
  }

  function detailPanel(d) {
    const nameIn = h('input', { value: d.customName, placeholder: d.netName || 'Geef dit apparaat een naam', maxlength: '60', 'aria-label': 'Naam', autocomplete: 'off', spellcheck: 'false', 'data-focus': d.mac });
    let saving = false;
    const saveAll = async () => {
      saving = true;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!(await saveRow(d, nameIn.value.trim(), note.value))) saving = false;
    };
    // Wie wegklikt zonder op Opslaan te drukken, verliest niets
    const saveName = () => { if (saving) return; const v = nameIn.value.trim(); if (v !== d.customName) patch(d.mac, { name: v }, true); };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveAll(); } if (e.key === 'Escape') { nameIn.value = d.customName; nameIn.blur(); } });
    nameIn.addEventListener('blur', saveName);

    const note = h('textarea', { placeholder: 'Bijvoorbeeld: waar staat het, van wie is het', maxlength: '500', 'aria-label': 'Notitie' });
    note.value = d.note;
    note.addEventListener('blur', () => { if (saving) return; if (note.value !== d.note) patch(d.mac, { note: note.value }, true); });

    const picker = h('div', { class: 'picker', role: 'group', 'aria-label': 'Icoon' });
    for (const ic of data.icons) {
      picker.append(h('button', { type: 'button', class: d.iconCustom && d.icon === ic ? 'on' : '', title: ICON_LABEL[ic], 'aria-label': ICON_LABEL[ic], onclick: () => patch(d.mac, { icon: ic }) }, svg(ic)));
    }
    picker.append(h('button', { type: 'button', class: !d.iconCustom ? 'on' : '', title: 'Automatisch kiezen', 'aria-label': 'Automatisch', onclick: () => patch(d.mac, { icon: '' }) }, 'Auto'));

    const vendorText = d.vendor ? d.vendor + (d.vendorSource === 'naam' ? ' (geraden op naam)' : '') : (d.privateMac ? 'Onbekend, privé-adres' : 'Onbekend');
    const facts = h('div', { class: 'facts' },
      h('span', {}, 'IP-adres'), h('b', { class: 'mono' }, d.ip || '-'),
      h('span', {}, 'MAC-adres'), h('b', { class: 'mono' }, d.mac),
      h('span', {}, 'Fabrikant'), h('b', {}, vendorMark(d), vendorText),
      d.privateMac ? [h('span', {}, 'Privé-adres'), h('b', {}, 'Dit apparaat gebruikt een willekeurig MAC-adres (privacyfunctie).')] : null,
      h('span', {}, 'Naam in netwerk'), h('b', {}, d.netName ? d.netName + (d.nameSource ? ' (' + d.nameSource + ')' : '') : 'Geen naam gevonden'),
      h('span', {}, 'Eerst gezien'), h('b', {}, full(d.firstSeen)),
      h('span', {}, 'Laatst gezien'), h('b', {}, d.online ? 'Nu online' : full(d.lastSeen)),
    );

    const actions = h('div', { class: 'detail-actions' },
      h('button', { class: 'small primary', type: 'button', onclick: saveAll }, svg('check'), 'Opslaan'),
      h('button', { class: 'small', type: 'button', onclick: () => copy(d.mac) }, 'Kopieer MAC'),
      openLink(d, false),
      d.ip ? h('button', { class: 'small', type: 'button', onclick: () => copy(d.ip) }, 'Kopieer IP') : null,
      d.isNew ? h('button', { class: 'small primary', type: 'button', onclick: () => patch(d.mac, { known: true }) }, 'Markeer als bekend') : null,
      (!d.online && !d.isSelf) ? h('button', { class: 'small gevaar', type: 'button', onclick: () => forget(d) }, 'Vergeet apparaat') : null,
    );

    return h('div', { class: 'detail' },
      h('label', {}, 'Naam', nameIn),
      h('label', {}, 'Notitie', note),
      h('div', { class: 'full' }, h('div', { class: 'hint' }, 'Icoon'), picker),
      h('div', { class: 'full' }, facts),
      h('div', { class: 'full' }, actions),
    );
  }

  async function forget(d) {
    if (!confirm('Dit apparaat vergeten? Naam en notitie worden verwijderd. Als het later weer op het netwerk komt, verschijnt het opnieuw als nieuw.')) return;
    try { await api('/api/devices/' + encodeURIComponent(d.mac), { method: 'DELETE' }); open.delete(d.mac); toast('Apparaat vergeten'); await refresh(); } catch (e) { toast(e.message); }
  }

  function deviceEl(d) {
    const isOpen = open.has(d.mac);
    const title = d.name || 'Naamloos apparaat';
    let sub = '';
    if (d.customName && d.netName && d.customName.toLowerCase() !== d.netName.toLowerCase()) sub = d.netName;
    else if (d.note) sub = d.note.split('\n')[0];
    const vendorName = d.vendor ? d.vendor : (d.privateMac ? 'Privé-adres' : 'Onbekend');
    const seen = d.online ? 'Online' : ago(d.lastSeen);

    const toggle = () => {
      const closing = open.has(d.mac);
      if (closing) { open.delete(d.mac); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } else open.add(d.mac);
      render(true); // inklappen mag nooit wachten op een invoerveld
      if (open.has(d.mac)) { const i = document.querySelector('[data-focus="' + d.mac + '"]'); if (i && matchMedia('(hover: hover)').matches) i.focus(); }
    };

    const row = h('div', { class: 'row', role: 'button', tabindex: '0', 'aria-expanded': String(isOpen), onclick: (e) => { if (e.target.closest('.copy, .weblink')) return; toggle(); }, onkeydown: (e) => { if (e.key === 'Enter' && e.target === row) toggle(); } },
      h('div', { class: 'ico' }, svg(d.icon), h('span', { class: 'dot' })),
      h('div', { class: 'name' },
        h('div', { class: 't' + (d.name ? '' : ' noname') },
          h('span', { class: 'txt' }, title),
          svg('pen', 'pen'),
          d.isSelf ? h('span', { class: 'tag self' }, 'Deze server') : null,
          d.isGateway ? h('span', { class: 'tag gw' }, 'Gateway') : null,
          d.isNew ? h('span', { class: 'tag new' }, 'Nieuw') : null),
        h('div', { class: 's' }, sub)),
      h('div', { class: 'ip mono' }, d.ip || '-', openLink(d, true)),
      h('div', { class: 'mac mono copy', title: 'Klik om te kopiëren', onclick: () => copy(d.mac) }, d.mac),
      h('div', { class: 'vendor' }, vendorMark(d), h('span', { class: 'vt' }, vendorName, d.vendor && d.vendorSource === 'naam' ? h('span', { class: 'g' }, ' (op naam)') : null)),
      h('div', { class: 'seen' }, seen),
      saved.has(d.mac) ? svg('check', 'chev saved') : svg('chev', 'chev'),
      h('div', { class: 'meta' }, h('span', { class: 'mono' }, d.ip || '-', openLink(d, true)), h('span', { class: 'm' }, vendorMark(d, true), vendorName), h('span', {}, seen)),
    );

    return h('article', { class: 'dev' + (d.online ? ' online' : '') + (isOpen ? ' open' : ''), 'data-mac': d.mac }, row, isOpen ? detailPanel(d) : null);
  }

  function renderList() {
    const list = $('list');
    const items = visible();
    const nodes = [];
    const nw = data.devices.filter((d) => d.isNew).length;
    if (nw && filter !== 'new') {
      nodes.push(h('div', { class: 'banner newnote' },
        h('span', {}, nw === 1 ? '1 nieuw apparaat gezien op je netwerk.' : nw + ' nieuwe apparaten gezien op je netwerk.'),
        h('span', {},
          h('button', { class: 'small', type: 'button', onclick: () => setFilter('new') }, 'Bekijk'), ' ',
          h('button', { class: 'small', type: 'button', onclick: markAll }, 'Alles bekend'))));
    }
    for (const d of items) nodes.push(deviceEl(d));
    list.replaceChildren(...nodes);
    const empty = $('empty');
    empty.hidden = items.length > 0;
    if (!items.length) {
      empty.textContent = !data.devices.length ? (data.scanning ? 'Eerste scan bezig, een moment geduld…' : 'Nog geen apparaten gevonden. Start een scan.') : 'Niets gevonden met dit filter.';
    }
  }

  async function markAll() {
    try { await api('/api/known-all', { method: 'POST', body: {} }); toast('Alles als bekend gemarkeerd'); await refresh(); } catch (e) { toast(e.message); }
  }

  function setFilter(f) {
    filter = f;
    for (const b of document.querySelectorAll('#filters button')) b.classList.toggle('on', b.dataset.f === f);
    render();
  }

  function editing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && $('list').contains(a);
  }

  function render(force) {
    if (!data) return;
    renderTop();
    if (!force && editing()) { pendingRender = true; return; }
    pendingRender = false;
    renderStats();
    renderList();
  }

  // ---- ophalen ----
  async function refresh() {
    clearTimeout(pollTimer);
    try {
      data = await api('/api/state');
      render();
    } catch { /* login of tijdelijke fout */ }
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if ($('appView').hidden) return;
    const wait = data && data.scanning ? 1200 : 6000;
    pollTimer = setTimeout(() => { if (!document.hidden) refresh(); else schedulePoll(); }, wait);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('appView').hidden) refresh(); });
  document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!editing()) render(); }, 50); });

  // ---- knoppen ----
  $('search').addEventListener('input', (e) => { query = e.target.value; render(); });
  $('sort').addEventListener('change', (e) => setSort(e.target.value, SORT_DEFAULT_DIR[e.target.value] || 1));
  $('sortDir').addEventListener('click', () => setSort(sortBy, -sortDir));
  for (const b of document.querySelectorAll('#kolommen button')) {
    b.addEventListener('click', () => (b.dataset.s === sortBy ? setSort(sortBy, -sortDir) : setSort(b.dataset.s, SORT_DEFAULT_DIR[b.dataset.s] || 1)));
  }
  for (const b of document.querySelectorAll('#filters button')) b.addEventListener('click', () => setFilter(b.dataset.f));
  $('exportBtn').addEventListener('click', () => { location.href = '/api/export.csv'; });
  $('scanBtn').addEventListener('click', async () => {
    try { $('scanBtn').disabled = true; await api('/api/scan', { method: 'POST', body: {} }); await refresh(); } catch (e) { toast(e.message); }
  });
  $('logoutBtn').addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: {} }); } catch { /* al uit */ } showLogin(); });

  // ---- instellingen ----
  const dlg = $('settingsDlg');
  $('settingsBtn').addEventListener('click', () => {
    if (!data) return;
    const sel = $('setInterval');
    sel.replaceChildren(...data.intervals.map((m) => h('option', { value: String(m) }, m === 0 ? 'Uit (alleen met de knop)' : 'Elke ' + m + (m === 1 ? ' minuut' : ' minuten'))));
    sel.value = String(data.settings.interval);
    $('setSubnet').value = data.settings.subnet;
    $('subnetHint').textContent = 'Nu in gebruik: ' + data.subnet.cidr + ' (' + data.subnet.source + ')';
    $('setLogos').checked = data.settings.logos !== false;
    ouiInfo();
    $('settingsError').hidden = true;
    dlg.showModal();
  });
  function ouiInfo() {
    const o = data.oui;
    let t = o.entries ? o.entries.toLocaleString('nl-NL') + ' vermeldingen, bijgewerkt ' + full(o.updated) : 'Nog niet geladen.';
    if (o.busy) t = 'Bezig met bijwerken…';
    if (o.error) t += ' Laatste poging mislukt: ' + o.error;
    $('ouiInfo').textContent = t;
  }
  $('ouiBtn').addEventListener('click', async () => {
    try { await api('/api/oui/update', { method: 'POST', body: {} }); toast('Bijwerken gestart, dit duurt even'); setTimeout(async () => { await refresh(); ouiInfo(); }, 6000); } catch (e) { toast(e.message); }
  });
  async function saveSettings() {
    try {
      await api('/api/settings', { method: 'PATCH', body: { interval: Number($('setInterval').value), subnet: $('setSubnet').value.trim(), logos: $('setLogos').checked } });
      dlg.close();
      toast('Instellingen opgeslagen');
      logoState.clear();
      await refresh();
    } catch (e) { $('settingsError').textContent = e.message; $('settingsError').hidden = false; }
  }
  $('setSave').addEventListener('click', saveSettings);
  $('setSubnet').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSettings(); } });

  // ---- inloggen ----
  function showLogin() {
    clearTimeout(pollTimer);
    data = null;
    document.body.classList.add('inlog');
    $('acties').hidden = true;
    $('appView').hidden = true;
    $('loginView').hidden = false;
    $('loginPass').value = '';
    $('loginError').textContent = '';
    fetch('/api/version').then((r) => r.json()).then((v) => { $('voet').textContent = 'Peek ' + v.version; }).catch(() => {});
    setTimeout(() => $('loginUser').focus(), 50);
  }
  async function showApp() {
    document.body.classList.remove('inlog');
    $('acties').hidden = false;
    $('loginView').hidden = true;
    $('appView').hidden = false;
    logoState.clear();
    await refresh();
  }
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: { user: $('loginUser').value.trim(), password: $('loginPass').value } });
      await showApp();
    } catch (ex) { $('loginError').textContent = ex.message; }
  });

  // ---- start ----
  $('sort').value = sortBy;
  syncSortUi();
  api('/api/me').then(showApp, showLogin);
})();
