'use strict';
// Demo-modus (PEEK_DEMO=1): verzonnen apparaten om de interface te tonen, zonder netwerk.
// Wordt alleen gebruikt voor screenshots en tests, nooit in gewone installaties.
const SELF = '3c:ab:0b:00:00:02';

const OUI = {
  '3CAB0A': 'TP-LINK TECHNOLOGIES CO.,LTD.', '3CAB0B': 'IceWhale Technology Limited', '3CAB0C': 'Espressif Inc.',
  '3CAB0D': 'LG Electronics', '3CAB0E': 'Sonos, Inc.', '3CAB0F': 'HP Inc.', '3CAB10': 'Signify B.V.',
  '3CAB11': 'Dell Inc.', '3CAB12': 'Apple, Inc.', '3CAB13': 'Samsung Electronics Co.,Ltd', '3CAB14': 'Reolink Innovation Limited',
};

const H = 3600 * 1000;
// [mac, ip, eigen naam, netnaam, bron, notitie, icoon, status]
const LIST = [
  ['3c:ab:0a:00:00:01', '192.168.2.1', 'Router', '', '', 'Glasvezelmodem staat in de meterkast', '', 'on'],
  [SELF, '192.168.2.10', 'Server', 'zimaos', 'Deze server', '', '', 'on'],
  ['da:a1:19:4c:10:7e', '192.168.2.21', 'iPhone Job', 'Jobs-iPhone', 'mDNS', '', '', 'on'],
  ['5e:7b:90:12:ab:34', '192.168.2.22', 'iPad kinderkamer', 'iPad-van-Kind', 'mDNS', '', 'tablet', 'on'],
  ['3c:ab:0d:55:21:09', '192.168.2.31', 'TV woonkamer', 'LGwebOSTV', 'DNS', '', '', 'on'],
  ['3c:ab:0e:a1:b2:c3', '192.168.2.32', 'Sonos keuken', 'Sonos-Keuken', 'mDNS', '', '', 'on'],
  ['3c:ab:0f:3a:2b:1c', '192.168.2.40', 'Printer', 'NPI3A2B1C', 'NetBIOS', 'Zwart-wit laser, tonerlade zit rechts', '', 'on'],
  ['3c:ab:10:77:88:99', '192.168.2.41', 'Hue bridge', 'Philips-hue', 'DNS', '', '', 'on'],
  ['3c:ab:11:de:ad:01', '192.168.2.50', 'Werk-pc', 'DESKTOP-4F8K2LM', 'NetBIOS', '', '', 'on'],
  ['3c:ab:12:09:87:65', '192.168.2.51', 'MacBook Pro', 'MacBook-Pro', 'mDNS', '', '', 'on'],
  ['3c:ab:14:11:22:33', '192.168.2.60', 'Camera hal', 'reolink-hal', 'DNS', '', '', 'on'],
  ['3c:ab:0c:aa:bb:cc', '192.168.2.77', '', '', '', '', '', 'new'],
  ['f6:12:34:56:78:9a', '192.168.2.88', '', '', '', '', '', 'new'],
  ['3c:ab:13:66:55:44', '192.168.2.34', 'TV slaapkamer', 'Samsung-TV', 'DNS', '', '', 'off:50'],
  ['9a:bc:de:f0:12:34', '192.168.2.23', 'Telefoon partner', 'Galaxy-S23', 'DNS', '', '', 'off:3'],
];

function seed(store) {
  if (Object.keys(store.data.devices).length) return;
  const now = Date.now();
  for (const [mac, ip, name, netName, src, note, icon, st] of LIST) {
    const off = st.startsWith('off');
    const hrs = off ? Number(st.split(':')[1]) : 0;
    store.data.devices[mac] = {
      mac, ip, name, note, icon, netName, nameSource: src, nameChecked: now,
      firstSeen: now - 40 * 24 * H, lastSeen: now - hrs * H, misses: off ? 5 : 0, online: !off, known: st !== 'new', demoOffline: off,
    };
  }
  store.data.meta.baselineDone = true;
  store.flush();
}

async function scan(store, oui) {
  oui.setDemo(OUI);
  seed(store);
  await new Promise((r) => setTimeout(r, 1500));
  return Object.values(store.data.devices).filter((d) => !d.demoOffline).map((d) => ({ ip: d.ip, mac: d.mac }));
}

module.exports = { scan, seed, selfMac: SELF, OUI };
