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

const basePayload = {
  status: 'sale', type: 'residential-villa', title_fr: 'Villa', title_en: 'Villa',
  description_fr: 'FR', description_en: 'EN', location: 'Tamarin',
  price: 8000000, bedrooms: 4, garages: 2, parking: 2, featured: 0
};

async function createCriterion(baseUrl, cookie, body) {
  const res = await fetch(`${baseUrl}/admin/api/criteria`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test('admin can create, list and delete search criteria; kind is validated', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const anon = await fetch(`${baseUrl}/admin/api/criteria`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label_fr: 'Piscine', label_en: 'Pool', kind: 'boolean' })
    });
    assert.equal(anon.status, 401);

    const cookie = await loginCookie(baseUrl, db);
    const bad = await createCriterion(baseUrl, cookie, { label_fr: 'X', label_en: 'X', kind: 'text' });
    assert.equal(bad.status, 400);

    const pool = await createCriterion(baseUrl, cookie, { label_fr: 'Piscine', label_en: 'Pool', kind: 'boolean' });
    assert.equal(pool.status, 201);
    const baths = await createCriterion(baseUrl, cookie, { label_fr: 'Salles de bain', label_en: 'Bathrooms', kind: 'number' });
    assert.equal(baths.status, 201);

    const filters = await (await fetch(`${baseUrl}/api/filters`)).json();
    assert.equal(filters.criteria.length, 2);
    const poolRow = filters.criteria.find((c) => c.id === pool.body.id);
    assert.equal(poolRow.kind, 'boolean');
    assert.equal(poolRow.label_en, 'Pool');

    const del = await fetch(`${baseUrl}/admin/api/criteria/${pool.body.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(del.status, 200);
    const after = await (await fetch(`${baseUrl}/api/filters`)).json();
    assert.equal(after.criteria.length, 1);
  } finally { await close(); }
});

test('property saves criteria values and public search filters on them', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const pool = (await createCriterion(baseUrl, cookie, { label_fr: 'Piscine', label_en: 'Pool', kind: 'boolean' })).body;
    const baths = (await createCriterion(baseUrl, cookie, { label_fr: 'Salles de bain', label_en: 'Bathrooms', kind: 'number' })).body;

    const withPool = await (await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, title_fr: 'Avec piscine', criteria: { [pool.id]: 1, [baths.id]: 3 } })
    })).json();
    await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, title_fr: 'Sans piscine', criteria: { [baths.id]: 1 } })
    });

    const all = await (await fetch(`${baseUrl}/api/properties`)).json();
    assert.equal(all.length, 2);

    const poolOnly = await (await fetch(`${baseUrl}/api/properties?crit_${pool.id}=1`)).json();
    assert.equal(poolOnly.length, 1);
    assert.equal(poolOnly[0].id, withPool.id);

    const twoBaths = await (await fetch(`${baseUrl}/api/properties?crit_${baths.id}=2`)).json();
    assert.equal(twoBaths.length, 1);
    assert.equal(twoBaths[0].id, withPool.id);

    const detail = await (await fetch(`${baseUrl}/api/properties/${withPool.id}`)).json();
    assert.equal(detail.criteria.length, 2);
    const poolValue = detail.criteria.find((c) => c.id === pool.id);
    assert.equal(poolValue.value, 1);
    assert.equal(poolValue.kind, 'boolean');
  } finally { await close(); }
});

test('updating a property replaces its criteria values', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const pool = (await createCriterion(baseUrl, cookie, { label_fr: 'Piscine', label_en: 'Pool', kind: 'boolean' })).body;

    const created = await (await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, criteria: { [pool.id]: 1 } })
    })).json();

    await fetch(`${baseUrl}/admin/api/properties/${created.id}`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, criteria: {} })
    });
    const detail = await (await fetch(`${baseUrl}/api/properties/${created.id}`)).json();
    assert.equal(detail.criteria.length, 0);
  } finally { await close(); }
});
