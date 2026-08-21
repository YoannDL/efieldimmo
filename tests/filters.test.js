const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

async function loginCookie(baseUrl, db) {
  upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
  const res = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret123' })
  });
  return res.headers.get('set-cookie');
}

function insertType(db, value, labelFr, labelEn) {
  db.prepare('INSERT INTO property_types (value, label_fr, label_en) VALUES (?, ?, ?)').run(value, labelFr, labelEn);
}

function insertProperty(db, overrides = {}) {
  const p = {
    status: 'sale', type: 'residential-villa', title_fr: 'Villa Test', title_en: 'Test Villa',
    description_fr: 'FR', description_en: 'EN', location: 'Grand Baie',
    price: 5000000, bedrooms: 3, garages: 1, parking: 1, land_area_m2: 600, floor_area_m2: 250,
    featured: 0, ...overrides
  };
  db.prepare(`
    INSERT INTO properties (status, type, title_fr, title_en, description_fr, description_en,
      location, price, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured)
    VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
      @price, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured)
  `).run(p);
}

test('GET /api/filters returns admin-defined types and distinct locations', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    insertType(db, 'residential-villa', 'Villa', 'Villa');
    insertType(db, 'residential-studio', 'Studio', 'Studio');
    insertProperty(db, { location: 'Grand Baie' });
    insertProperty(db, { location: 'Tamarin' });
    insertProperty(db, { location: 'Grand Baie' });

    const res = await fetch(`${baseUrl}/api/filters`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.types.length, 2);
    const villa = body.types.find((t) => t.value === 'residential-villa');
    assert.deepEqual(villa, { value: 'residential-villa', label_fr: 'Villa', label_en: 'Villa' });
    assert.deepEqual(body.locations.sort(), ['Grand Baie', 'Tamarin']);
  } finally { await close(); }
});

test('admin can add and delete a property type, rejected when unauthenticated', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const anon = await fetch(`${baseUrl}/admin/api/types`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Penthouse', label_en: 'Penthouse' })
    });
    assert.equal(anon.status, 401);

    const cookie = await loginCookie(baseUrl, db);
    const createRes = await fetch(`${baseUrl}/admin/api/types`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Penthouse de luxe', label_en: 'Luxury Penthouse' })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);
    assert.equal(created.value, 'penthouse-de-luxe');

    let filters = await (await fetch(`${baseUrl}/api/filters`)).json();
    assert.equal(filters.types.length, 1);

    const delRes = await fetch(`${baseUrl}/admin/api/types/${created.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(delRes.status, 200);
    filters = await (await fetch(`${baseUrl}/api/filters`)).json();
    assert.equal(filters.types.length, 0);
  } finally { await close(); }
});

test('adding a type rejects missing labels and duplicate values', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const missing = await fetch(`${baseUrl}/admin/api/types`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Villa' })
    });
    assert.equal(missing.status, 400);

    const first = await fetch(`${baseUrl}/admin/api/types`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Villa', label_en: 'Villa' })
    });
    assert.equal(first.status, 201);
    const dup = await fetch(`${baseUrl}/admin/api/types`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Villa', label_en: 'Villa' })
    });
    assert.equal(dup.status, 409);
  } finally { await close(); }
});
