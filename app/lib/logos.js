'use strict';
// Kleine fabrikantlogo's naast de fabrikantnaam.
//
// Peek haalt een logo één keer op (open Simple Icons-verzameling via jsDelivr), controleert het
// en bewaart het in /data/logos. Daarna komt het uit de eigen opslag. De browser praat dus alleen
// met Peek. Naar buiten gaat uitsluitend een vaste merknaam zoals "apple", nooit een MAC-adres of
// apparaatnaam. Zonder logo (of zonder internet) toont de interface een monogram.
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg';
const NONE_TTL_MS = 30 * 24 * 3600 * 1000;
const RETRY_MS = 10 * 60 * 1000;

// Vaste lijst: alleen deze merken worden ooit opgevraagd (naam uit IEEE-lijst of apparaatnaam -> slug)
const SLUGS = [
  [/apple/i, 'apple'], [/samsung/i, 'samsung'], [/google|nest\b/i, 'google'], [/amazon|kindle|\becho\b/i, 'amazon'],
  [/sony/i, 'sony'], [/microsoft/i, 'microsoft'], [/^lg\b|lg electronics/i, 'lg'], [/tp-?link/i, 'tplink'],
  [/signify|philips/i, 'philipshue'], [/sonos/i, 'sonos'], [/^hp\b|hewlett|\bhp inc/i, 'hp'], [/dell/i, 'dell'],
  [/synology/i, 'synology'], [/raspberry/i, 'raspberrypi'], [/espressif/i, 'espressif'], [/xiaomi/i, 'xiaomi'],
  [/huawei/i, 'huawei'], [/brother/i, 'brother'], [/canon/i, 'canon'], [/epson/i, 'epson'], [/intel/i, 'intel'],
  [/asus/i, 'asus'], [/netgear/i, 'netgear'], [/ubiquiti/i, 'ubiquiti'], [/nintendo/i, 'nintendo'],
  [/lenovo/i, 'lenovo'], [/acer/i, 'acer'], [/cisco/i, 'cisco'], [/qualcomm/i, 'qualcomm'], [/mikrotik/i, 'mikrotik'],
  [/roku/i, 'roku'], [/oneplus/i, 'oneplus'], [/\bamd\b|advanced micro/i, 'amd'], [/nvidia/i, 'nvidia'],
  [/tuya/i, 'tuya'], [/ikea/i, 'ikea'], [/android/i, 'android'], [/sagemcom/i, 'sagemcom'], [/zyxel/i, 'zyxel'],
];
const KNOWN = new Set(SLUGS.map((s) => s[1]));

function slugFor(vendor) {
  if (!vendor) return null;
  for (const [re, slug] of SLUGS) if (re.test(vendor)) return slug;
  return null;
}

// Alleen een kale SVG zonder scripts, afbeeldingen of verwijzingen accepteren
function clean(text) {
  const svg = String(text || '').trim();
  if (!svg || svg.length > 30000) return null;
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)) return null;
  if (/<script|<foreignObject|<iframe|<image|<style|<use|<a[\s>]|\son[a-z]+\s*=|javascript:|data:|href\s*=/i.test(svg)) return null;
  return svg;
}

function createLogos({ dataDir, enabled, fetchFn, urlTemplate }) {
  const dir = path.join(dataDir, 'logos');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* geen opslag, dan zonder cache */ }
  const doFetch = fetchFn || fetch;
  const template = urlTemplate || DEFAULT_URL;
  const retryAt = new Map();
  const inflight = new Map();

  function write(file, content) {
    try {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, content);
      fs.renameSync(tmp, file);
    } catch { /* niet erg */ }
  }

  async function download(slug) {
    try {
      const res = await doFetch(template.replace('{slug}', slug), {
        headers: { 'User-Agent': 'Peek/1.1 (netwerkscanner)' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) { write(path.join(dir, slug + '.none'), String(Date.now())); return null; }
      if (!res.ok) throw new Error('status ' + res.status);
      const svg = clean(await res.text());
      if (!svg) { write(path.join(dir, slug + '.none'), String(Date.now())); return null; }
      write(path.join(dir, slug + '.svg'), svg);
      return svg;
    } catch {
      retryAt.set(slug, Date.now() + RETRY_MS); // tijdelijk niet bereikbaar: later opnieuw
      return null;
    } finally {
      inflight.delete(slug);
    }
  }

  // Geeft de SVG-tekst of null
  async function get(slug) {
    if (!KNOWN.has(slug)) return null;
    try { return fs.readFileSync(path.join(dir, slug + '.svg'), 'utf8'); } catch { /* nog niet bewaard */ }
    try {
      if (Date.now() - fs.statSync(path.join(dir, slug + '.none')).mtimeMs < NONE_TTL_MS) return null;
    } catch { /* geen eerdere afwijzing */ }
    if (!enabled()) return null;
    if ((retryAt.get(slug) || 0) > Date.now()) return null;
    if (!inflight.has(slug)) inflight.set(slug, download(slug));
    return inflight.get(slug);
  }

  return { get, slugFor, clean, known: KNOWN };
}

module.exports = { createLogos, slugFor, clean, KNOWN, SLUGS };
