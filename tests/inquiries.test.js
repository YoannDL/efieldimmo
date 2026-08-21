const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

test('rejects a submission missing required fields', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean' })
    });
    assert.equal(res.status, 400);
  } finally { await close(); }
});

test('accepts a valid submission and it shows up in admin inquiries', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
    const cookie = (await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret123' })
    })).headers.get('set-cookie');

    const postRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean Dupont', email: 'jean@example.com', message: 'Interessé par ce bien.', propertyRef: 42 })
    });
    assert.equal(postRes.status, 201);

    const listRes = await fetch(`${baseUrl}/admin/api/inquiries`, { headers: { cookie } });
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].email, 'jean@example.com');
    assert.equal(list[0].property_ref, 42);
    assert.equal(list[0].status, 'new');

    const updateRes = await fetch(`${baseUrl}/admin/api/inquiries/${list[0].id}`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'contacted' })
    });
    assert.equal(updateRes.status, 200);
    const after = await (await fetch(`${baseUrl}/admin/api/inquiries`, { headers: { cookie } })).json();
    assert.equal(after[0].status, 'contacted');

    const badStatus = await fetch(`${baseUrl}/admin/api/inquiries/${list[0].id}`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'whatever' })
    });
    assert.equal(badStatus.status, 400);
  } finally { await close(); }
});

test('page view tracking counts views and admin stats returns them', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/track`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '/properties.html' })
      });
      assert.equal(res.status, 204);
    }
    await fetch(`${baseUrl}/api/track`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'property:7' })
    });

    const anonStats = await fetch(`${baseUrl}/admin/api/stats`);
    assert.equal(anonStats.status, 401);

    upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
    const cookie = (await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret123' })
    })).headers.get('set-cookie');

    const stats = await (await fetch(`${baseUrl}/admin/api/stats`, { headers: { cookie } })).json();
    const pageRow = stats.find((r) => r.path === '/properties.html');
    assert.equal(pageRow.views, 3);
    assert.ok(stats.some((r) => r.path === 'property:7'));
  } finally { await close(); }
});
