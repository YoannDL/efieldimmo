const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

const samplePayload = {
  status: 'sale', type: 'residential-villa', title_fr: 'Villa Neuve', title_en: 'New Villa',
  description_fr: 'Belle villa', description_en: 'Beautiful villa', location: 'Tamarin',
  price: 8000000, bedrooms: 4, garages: 2, parking: 2, land_area_m2: 900, floor_area_m2: 300, featured: 1
};

test('rejects create without authentication', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    });
    assert.equal(res.status, 401);
  } finally { await close(); }
});

test('creates, edits and deletes a property', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);

    const createRes = await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);

    const publicListRes = await fetch(`${baseUrl}/api/properties`);
    const publicList = await publicListRes.json();
    assert.equal(publicList.length, 1);

    const editRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...samplePayload, price: 8500000 })
    });
    assert.equal(editRes.status, 200);
    const publicDetail = await (await fetch(`${baseUrl}/api/properties/${created.id}`)).json();
    assert.equal(publicDetail.price, 8500000);

    const deleteRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(deleteRes.status, 200);
    const afterDelete = await fetch(`${baseUrl}/api/properties/${created.id}`);
    assert.equal(afterDelete.status, 404);
  } finally { await close(); }
});

test('uploads images for a property and can delete one', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const created = await (await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    })).json();

    const form = new FormData();
    form.append('images', new Blob([Buffer.from('fake-image-bytes')], { type: 'image/jpeg' }), 'photo1.jpg');

    const uploadRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}/images`, {
      method: 'POST', headers: { cookie }, body: form
    });
    assert.equal(uploadRes.status, 201);
    const images = await uploadRes.json();
    assert.equal(images.length, 1);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', images[0].url)));

    const deleteImgRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}/images/${images[0].id}`, {
      method: 'DELETE', headers: { cookie }
    });
    assert.equal(deleteImgRes.status, 200);
    const detail = await (await fetch(`${baseUrl}/api/properties/${created.id}`)).json();
    assert.equal(detail.images.length, 0);
  } finally { await close(); }
});

test('deleting a property also removes its uploaded image files from disk', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const created = await (await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    })).json();

    const form = new FormData();
    form.append('images', new Blob([Buffer.from('fake-image-bytes')], { type: 'image/jpeg' }), 'photo1.jpg');
    const images = await (await fetch(`${baseUrl}/admin/api/properties/${created.id}/images`, {
      method: 'POST', headers: { cookie }, body: form
    })).json();
    const filePath = path.join(__dirname, '..', 'public', images[0].url);
    assert.ok(fs.existsSync(filePath));

    await fetch(`${baseUrl}/admin/api/properties/${created.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(fs.existsSync(filePath), false);
  } finally { await close(); }
});
