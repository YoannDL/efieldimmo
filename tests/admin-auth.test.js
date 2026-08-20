const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

async function seedAdmin(db, username, password) {
  upsertAdminUser(db, username, bcrypt.hashSync(password, 10));
}

test('rejects login with wrong credentials', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    await seedAdmin(db, 'admin', 'correct-horse');
    const res = await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' })
    });
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});

test('logs in, reads session, then logs out', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    await seedAdmin(db, 'admin', 'correct-horse');

    const loginRes = await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'correct-horse' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie, 'expected a session cookie');

    const sessionRes = await fetch(`${baseUrl}/admin/api/session`, {
      headers: { cookie }
    });
    assert.equal(sessionRes.status, 200);
    const sessionBody = await sessionRes.json();
    assert.equal(sessionBody.username, 'admin');

    const logoutRes = await fetch(`${baseUrl}/admin/api/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${baseUrl}/admin/api/session`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  } finally {
    await close();
  }
});

test('session endpoint rejects an unauthenticated request', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/admin/api/session`);
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});
