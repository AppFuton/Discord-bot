import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.resolve('./data/config.json');

let cache = null;

async function _load() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    cache = JSON.parse(raw || '{}');
  } catch (e) {
    cache = {};
  }
  return cache;
}

async function _save() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(cache || {}, null, 2));
}

export default {
  get(guildId) {
    if (!cache) return null;
    return cache[guildId] || null;
  },
  set(guildId, obj) {
    if (!cache) cache = {};
    cache[guildId] = obj;
    // write asynchronously
    _save().catch(err => console.error('Failed to save config', err));
  },
  async loadAll() {
    await _load();
    return cache;
  }
};
