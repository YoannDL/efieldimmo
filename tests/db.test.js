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

test('upsertAdminUser inserts then updates the same username', () => {
  const db = createDb(tmpDbPath());
  upsertAdminUser(db, 'admin', 'hash1');
  upsertAdminUser(db, 'admin', 'hash2');
  const rows = db.prepare('SELECT username, password_hash FROM admin_users').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].password_hash, 'hash2');
});
