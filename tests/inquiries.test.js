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
  } finally { await close(); }
});
