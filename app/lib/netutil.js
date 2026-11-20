'use strict';
// Netwerkhulpjes: subnet berekenen, interfaces en gateway ontdekken, ARP-tabel lezen.
const os = require('os');
const fs = require('fs');

const FALLBACK_CIDR = '192.168.2.0/24';
const MIN_PREFIX = 22; // maximaal 1022 adressen per scan

function ipToInt(ip) {
  const p = String(ip).split('.').map(Number);
  return ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3];
}

function intToIp(n) {
  return [Math.floor(n / 16777216) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function validIp(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip));
  return !!m && m.slice(1).every((x) => Number(x) <= 255);
}

// '192.168.2.0/24' of '192.168.2.1/24' -> { cidr, base, prefix, size }
function parseCidr(text) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(String(text || '').trim());
  if (!m || !validIp(m[1])) throw new Error('Ongeldig subnet, gebruik bijvoorbeeld 192.168.2.0/24');
  const prefix = Number(m[2]);
  if (prefix < MIN_PREFIX) throw new Error('Subnet te groot, gebruik minimaal /' + MIN_PREFIX);
  if (prefix > 30) throw new Error('Subnet te klein, gebruik maximaal /30');
  const size = Math.pow(2, 32 - prefix);
  const base = Math.floor(ipToInt(m[1]) / size) * size;
  return { cidr: intToIp(base) + '/' + prefix, base, prefix, size };
}

// Alle bruikbare adressen (zonder netwerk- en broadcastadres)
function hostsOf(net) {
  const out = [];
  for (let i = 1; i < net.size - 1; i++) out.push(intToIp(net.base + i));
  return out;
}

function inNet(ip, net) {
  if (!validIp(ip)) return false;
  const n = ipToInt(ip);
  return n >= net.base && n < net.base + net.size;
}

function isPrivateIp(ip) {
  const [a, b] = String(ip).split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function normMac(mac) {
  const m = String(mac || '').trim().toLowerCase().replace(/-/g, ':');
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(m) ? m : null;
}

// Willekeurig (privé) MAC-adres: tweede bit van het eerste byte staat aan
function isPrivateMac(mac) {
  return (parseInt(String(mac).slice(0, 2), 16) & 2) !== 0;
}

function parseRoute(text) {
  // /proc/net/route: Iface Destination Gateway Flags ...
  const lines = String(text).split('\n').slice(1);
  for (const line of lines) {
    const c = line.trim().split(/\s+/);
    if (c.length < 4 || c[1] !== '00000000') continue;
    if ((parseInt(c[3], 16) & 2) === 0) continue; // geen gateway-vlag
    const g = parseInt(c[2], 16);
    const ip = [g & 255, (g >>> 8) & 255, (g >>> 16) & 255, (g >>> 24) & 255].join('.');
    if (ip !== '0.0.0.0') return { iface: c[0], ip };
  }
  return null;
}

function getGateway() {
  try { return parseRoute(fs.readFileSync('/proc/net/route', 'utf8')); } catch { return null; }
}

function parseArp(text) {
  const out = [];
  for (const line of String(text).split('\n').slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 6) continue;
    const flags = parseInt(c[2], 16);
    const mac = normMac(c[3]);
    if (!mac || mac === '00:00:00:00:00:00' || (flags & 2) === 0) continue;
    if (!validIp(c[0])) continue;
    out.push({ ip: c[0], mac, dev: c[5] });
  }
  return out;
}

function readArp() {
  try { return parseArp(fs.readFileSync('/proc/net/arp', 'utf8')); } catch { return []; }
}

const SKIP_IFACE = /^(lo|docker|br-|veth|virbr|tailscale|zt|wg|tun|tap|cni|flannel|cali)/;

// Lijst van eigen IPv4-interfaces (zonder docker en dergelijke)
function ownInterfaces() {
  const list = [];
  const all = os.networkInterfaces();
  for (const name of Object.keys(all)) {
    if (SKIP_IFACE.test(name)) continue;
    for (const a of all[name] || []) {
      if (a.internal || (a.family !== 'IPv4' && a.family !== 4)) continue;
      if (!isPrivateIp(a.address)) continue;
      list.push({ name, ip: a.address, mac: normMac(a.mac), netmask: a.netmask });
    }
  }
  return list;
}

function prefixFromMask(mask) {
  return String(mask).split('.').reduce((n, o) => n + (Number(o).toString(2).match(/1/g) || []).length, 0);
}

// Automatisch het LAN zoeken: voorkeur voor de interface met de standaardroute
function detectSubnet() {
  const own = ownInterfaces();
  const gw = getGateway();
  let pick = null;
  if (gw) pick = own.find((i) => i.name === gw.iface);
  if (!pick) pick = own[0];
  if (!pick) return null;
  let prefix = prefixFromMask(pick.netmask);
  if (prefix < MIN_PREFIX || prefix > 30) prefix = 24;
  const net = parseCidr(pick.ip + '/' + prefix);
  return { cidr: net.cidr, iface: pick.name, ip: pick.ip, mac: pick.mac, gateway: gw ? gw.ip : null };
}

module.exports = {
  FALLBACK_CIDR, ipToInt, intToIp, validIp, parseCidr, hostsOf, inNet, isPrivateIp,
  normMac, isPrivateMac, parseRoute, getGateway, parseArp, readArp, ownInterfaces,
  prefixFromMask, detectSubnet,
};
