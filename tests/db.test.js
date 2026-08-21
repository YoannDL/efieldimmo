const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createDb, upsertAdminUser } = require('../server/db');

function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efield-db-test-'));
  return path.join(dir, 'test.sqlite');
}

test('createDb creates all required tables', () => {
  const db = createDb(tmpDbPath());
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
  for (const name of ['admin_users', 'properties', 'property_images', 'inquiries']) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
});

test('schema has the extended columns and page_views table', () => {
  const db = createDb(tmpDbPath());
  const propertyCols = db.prepare('PRAGMA table_info(properties)').all().map(c => c.name);
  for (const col of ['availability', 'featured_order', 'map_url']) {
    assert.ok(propertyCols.includes(col), `properties missing ${col}`);
  }
  const inquiryCols = db.prepare('PRAGMA table_info(inquiries)').all().map(c => c.name);
  assert.ok(inquiryCols.includes('status'), 'inquiries missing status');
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
  assert.ok(tables.includes('page_views'), 'missing page_views table');
});

test('migration adds new columns to a database created with the old schema', () => {
  const dbPath = tmpDbPath();
  const Database = require('better-sqlite3');
  const old = new Database(dbPath);
  old.exec(`CREATE TABLE properties (id INTEGER PRIMARY KEY, status TEXT, type TEXT,
    title_fr TEXT, title_en TEXT, description_fr TEXT, description_en TEXT, location TEXT,
    price REAL, currency TEXT, bedrooms INTEGER, garages INTEGER, parking INTEGER,
    land_area_m2 REAL, floor_area_m2 REAL, featured INTEGER, created_at TEXT);
    CREATE TABLE inquiries (id INTEGER PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT);`);
  old.close();

  const db = createDb(dbPath);
  const propertyCols = db.prepare('PRAGMA table_info(properties)').all().map(c => c.name);
  assert.ok(propertyCols.includes('availability'));
  const inquiryCols = db.prepare('PRAGMA table_info(inquiries)').all().map(c => c.name);
  assert.ok(inquiryCols.includes('status'));
});

test('upsertAdminUser inserts then updates the same username', () => {
  const db = createDb(tmpDbPath());
  upsertAdminUser(db, 'admin', 'hash1');
  upsertAdminUser(db, 'admin', 'hash2');
  const rows = db.prepare('SELECT username, password_hash FROM admin_users').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].password_hash, 'hash2');
});
