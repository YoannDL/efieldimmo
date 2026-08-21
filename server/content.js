const path = require('node:path');
const fs = require('node:fs');

const I18N_DIR = path.join(__dirname, '..', 'public', 'i18n');
const LANGS = ['fr', 'en'];

const DEFAULT_SETTINGS = {
  whatsapp_number: '23057000000',
  phone_display: '+230 XXX XXXX',
  email: 'efieldimmo@gmail.com',
  facebook_url: 'https://www.facebook.com/',
  instagram_url: 'https://www.instagram.com/',
  tiktok_url: 'https://www.tiktok.com/'
};

function loadDefaultDict(lang) {
  return JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8'));
}

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flattenKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
}

function getByPath(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function setByPath(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let node = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) return;
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
}

function mergedDictionary(db, lang) {
  const dict = loadDefaultDict(lang);
  const overrides = db.prepare('SELECT key, value FROM content_overrides WHERE lang = ?').all(lang);
  for (const { key, value } of overrides) {
    if (getByPath(dict, key) !== undefined) setByPath(dict, key, value);
  }
  return dict;
}

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

module.exports = { LANGS, DEFAULT_SETTINGS, loadDefaultDict, flattenKeys, getByPath, mergedDictionary, getSettings };
