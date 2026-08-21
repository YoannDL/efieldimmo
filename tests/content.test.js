const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

async function loginCookie(baseUrl, db) {
  upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
  const res = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret123' })
  });
  return res.headers.get('set-cookie');
}

test('GET /api/i18n/:lang serves the dictionary and applies admin overrides', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    let dict = await (await fetch(`${baseUrl}/api/i18n/fr`)).json();
    assert.equal(dict.nav.home, 'Accueil');

    const cookie = await loginCookie(baseUrl, db);
    const put = await fetch(`${baseUrl}/admin/api/content`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'fr', key: 'nav.home', value: 'Bienvenue' })
    });
    assert.equal(put.status, 200);

    dict = await (await fetch(`${baseUrl}/api/i18n/fr`)).json();
    assert.equal(dict.nav.home, 'Bienvenue');
    const en = await (await fetch(`${baseUrl}/api/i18n/en`)).json();
    assert.equal(en.nav.home, 'Home');

    // empty value reverts to the default
    await fetch(`${baseUrl}/admin/api/content`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'fr', key: 'nav.home', value: '' })
    });
    dict = await (await fetch(`${baseUrl}/api/i18n/fr`)).json();
    assert.equal(dict.nav.home, 'Accueil');
  } finally { await close(); }
});

test('content editing rejects unauthenticated and unknown languages/keys', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const anon = await fetch(`${baseUrl}/admin/api/content`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'fr', key: 'nav.home', value: 'X' })
    });
    assert.equal(anon.status, 401);

    const badLang = await fetch(`${baseUrl}/api/i18n/de`);
    assert.equal(badLang.status, 404);

    const cookie = await loginCookie(baseUrl, db);
    const badKey = await fetch(`${baseUrl}/admin/api/content`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'fr', key: 'does.not.exist', value: 'X' })
    });
    assert.equal(badKey.status, 400);
  } finally { await close(); }
});

test('site settings have defaults and are editable by admin', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    let settings = await (await fetch(`${baseUrl}/api/settings`)).json();
    assert.equal(settings.whatsapp_number, '23057000000');
    assert.ok(settings.email);

    const cookie = await loginCookie(baseUrl, db);
    const put = await fetch(`${baseUrl}/admin/api/settings`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ whatsapp_number: '23059998888', facebook_url: 'https://facebook.com/efieldimmo' })
    });
    assert.equal(put.status, 200);

    settings = await (await fetch(`${baseUrl}/api/settings`)).json();
    assert.equal(settings.whatsapp_number, '23059998888');
    assert.equal(settings.facebook_url, 'https://facebook.com/efieldimmo');

    const badKey = await fetch(`${baseUrl}/admin/api/settings`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ hacker_key: 'x' })
    });
    assert.equal(badKey.status, 400);
  } finally { await close(); }
});
