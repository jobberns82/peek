'use strict';
// Eenvoudige JSON-opslag in /data. Alleen namen, notities en wat Peek zelf ziet.
const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'peek.json');
  let data = { meta: { baselineDone: false }, settings: {}, devices: {} };
  let timer = null;

  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = {
      meta: Object.assign({ baselineDone: false }, j.meta),
      settings: j.settings || {},
      devices: j.devices || {},
    };
  } catch { /* nieuw bestand */ }

  function flush() {
    clearTimeout(timer);
    timer = null;
    const tmp = file + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('[peek] opslaan mislukt:', e.message);
    }
  }

  function save() {
    if (timer) return;
    timer = setTimeout(flush, 400);
  }

  return {
    get data() { return data; },
    save,
    flush,
    dir: dataDir,
  };
}

module.exports = { createStore };
