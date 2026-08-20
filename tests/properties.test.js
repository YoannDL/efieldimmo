const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

function insertProperty(db, overrides = {}) {
  const p = {
    status: 'sale', type: 'residential-villa', title_fr: 'Villa Test', title_en: 'Test Villa',
    description_fr: 'Description FR', description_en: 'Description EN', location: 'Grand Baie',
    price: 5000000, bedrooms: 3, garages: 1, parking: 1, land_area_m2: 600, floor_area_m2: 250,
    featured: 0, ...overrides
  };
  const info = db.prepare(`
    INSERT INTO properties (status, type, title_fr, title_en, description_fr, description_en,
      location, price, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured)
    VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
      @price, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured)
  `).run(p);
  return info.lastInsertRowid;
}

test('lists all properties with no filters', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    insertProperty(db);
    insertProperty(db, { location: 'Tamarin', status: 'invest' });
    const res = await fetch(`${baseUrl}/api/properties`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 2);
  } finally {
    await close();
  }
});

test('filters by status, location and min bedrooms', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const idMatch = insertProperty(db, { status: 'sale', location: 'Grand Baie', bedrooms: 4 });
    insertProperty(db, { status: 'rent', location: 'Grand Baie', bedrooms: 4 });
    insertProperty(db, { status: 'sale', location: 'Tamarin', bedrooms: 4 });
    insertProperty(db, { status: 'sale', location: 'Grand Baie', bedrooms: 1 });

    const res = await fetch(`${baseUrl}/api/properties?status=sale&location=Grand Baie&bedrooms=3`);
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].id, idMatch);
  } finally {
    await close();
  }
});

test('list rows include a primaryImage field', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const id = insertProperty(db);
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 0)').run(id, '/img/properties/first.jpg');
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 1)').run(id, '/img/properties/second.jpg');
    insertProperty(db, { location: 'Tamarin' });

    const res = await fetch(`${baseUrl}/api/properties`);
    const body = await res.json();
    const withImage = body.find((p) => p.id === id);
    const withoutImage = body.find((p) => p.id !== id);
    assert.equal(withImage.primaryImage, '/img/properties/first.jpg');
    assert.equal(withoutImage.primaryImage, null);
  } finally {
    await close();
  }
});

test('gets a single property with its images', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const id = insertProperty(db);
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 0)').run(id, '/img/properties/a.jpg');
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 1)').run(id, '/img/properties/b.jpg');

    const res = await fetch(`${baseUrl}/api/properties/${id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, id);
    assert.equal(body.images.length, 2);
    assert.equal(body.images[0].url, '/img/properties/a.jpg');
  } finally {
    await close();
  }
});

test('returns 404 for a missing property', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/api/properties/999`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});
