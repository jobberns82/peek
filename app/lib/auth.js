'use strict';
// Eén gebruiker, gegevens uit de compose (PEEK_USER en PEEK_PASSWORD).
// Sessie = ondertekende cookie (HMAC), de sleutel staat in /data/secret en blijft bewaard.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'peek_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;

function createAuth({ dataDir, user, password }) {
  const secretFile = path.join(dataDir, 'secret');
  let secret;
  try { secret = fs.readFileSync(secretFile); } catch { /* nieuw */ }
  if (!secret || secret.length < 32) {
    secret = crypto.randomBytes(48);
    try { fs.writeFileSync(secretFile, secret, { mode: 0o600 }); } catch { /* alleen in geheugen */ }
  }

  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
  const userHash = sha(user);
  const passHash = sha(password);

  function checkCredentials(u, p) {
    // Beide altijd vergelijken zodat de tijd niets verraadt
    const a = crypto.timingSafeEqual(sha(u), userHash);
    const b = crypto.timingSafeEqual(sha(p), passHash);
    return a && b;
  }

  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  function makeToken() {
    const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_MS })).toString('base64url');
    return payload + '.' + sign(payload);
  }

  function verifyToken(token) {
    if (!token || typeof token !== 'string') return false;
    const i = token.indexOf('.');
    if (i < 1) return false;
    const payload = token.slice(0, i);
    const given = Buffer.from(token.slice(i + 1));
    const want = Buffer.from(sign(payload));
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return false;
    try {
      const j = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return j.u === user && j.exp > Date.now();
    } catch { return false; }
  }

  function readCookie(req) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const k = part.trim();
      if (k.startsWith(COOKIE + '=')) return decodeURIComponent(k.slice(COOKIE.length + 1));
    }
    return null;
  }

  function isLoggedIn(req) { return verifyToken(readCookie(req)); }

  function cookieHeader(req, token) {
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
    const base = COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Lax';
    return base + (token ? '; Max-Age=' + Math.floor(SESSION_MS / 1000) : '; Max-Age=0') + (secure ? '; Secure' : '');
  }

  // ---- Rem op foute pogingen ----
  const fails = new Map(); // sleutel -> { n, until }
  let globalFails = [];

  function clientKey(req) {
    const h = req.headers;
    return String(h['cf-connecting-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?');
  }

  function blockedFor(req) {
    const now = Date.now();
    globalFails = globalFails.filter((t) => now - t < 15 * 60000);
    if (globalFails.length >= 40) return 60;
    const f = fails.get(clientKey(req));
    if (f && f.until > now) return Math.ceil((f.until - now) / 1000);
    return 0;
  }

  function recordFail(req) {
    const k = clientKey(req);
    const f = fails.get(k) || { n: 0, until: 0 };
    f.n++;
    if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60000, 30000 * Math.pow(2, f.n - 5));
    fails.set(k, f);
    globalFails.push(Date.now());
    if (fails.size > 500) fails.clear();
  }

  function recordOk(req) { fails.delete(clientKey(req)); }

  return { checkCredentials, makeToken, verifyToken, isLoggedIn, cookieHeader, blockedFor, recordFail, recordOk, COOKIE };
}

module.exports = { createAuth };
