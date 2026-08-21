const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createDb } = require('../server/db');
const { seedDatabase } = require('../server/seed');

function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efield-seed-test-'));
  return path.join(dir, 'test.sqlite');
}

test('seedDatabase inserts the admin user and 3 sample properties with images', () => {
  const db = createDb(tmpDbPath());
  const result = seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  assert.equal(result.propertiesInserted, 3);

  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
  assert.ok(admin);

  const properties = db.prepare('SELECT * FROM properties').all();
  assert.equal(properties.length, 3);
  assert.ok(properties.every(p => p.featured === 1));

  const images = db.prepare('SELECT * FROM property_images').all();
  assert.equal(images.length, 6);

  const types = db.prepare('SELECT * FROM property_types').all();
  assert.equal(types.length, 8);
  assert.ok(types.some(t => t.value === 'residential-studio'));
});

test('seedDatabase is idempotent for properties on repeat runs', () => {
  const db = createDb(tmpDbPath());
  seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  const second = seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  assert.equal(second.propertiesInserted, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM properties').get().c, 3);
});
