const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const { requireAdmin } = require('../middleware/auth');
const { LANGS, DEFAULT_SETTINGS, loadDefaultDict, flattenKeys, getByPath, mergedDictionary } = require('../content');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'properties');

// Uploads land in memory first so sharp can resize/compress before anything
// touches the disk — real-estate photos are routinely 5-10MB straight off a phone.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const AVAILABILITY_VALUES = ['available', 'reserved', 'sold'];
const INQUIRY_STATUSES = ['new', 'contacted', 'closed'];

const PROPERTY_FIELDS = ['status', 'type', 'title_fr', 'title_en', 'description_fr', 'description_en',
  'location', 'price', 'currency', 'bedrooms', 'garages', 'parking', 'land_area_m2', 'floor_area_m2',
  'featured', 'availability', 'featured_order', 'map_url'];

function pickPropertyFields(body) {
  const out = {};
  for (const field of PROPERTY_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  out.currency = out.currency || 'MUR';
  out.bedrooms = Number(out.bedrooms || 0);
  out.garages = Number(out.garages || 0);
  out.parking = Number(out.parking || 0);
  out.land_area_m2 = out.land_area_m2 != null && out.land_area_m2 !== '' ? Number(out.land_area_m2) : null;
  out.floor_area_m2 = out.floor_area_m2 != null && out.floor_area_m2 !== '' ? Number(out.floor_area_m2) : null;
  out.featured = out.featured ? 1 : 0;
  out.price = Number(out.price);
  out.availability = AVAILABILITY_VALUES.includes(out.availability) ? out.availability : 'available';
  out.featured_order = Number(out.featured_order || 0);
  out.map_url = out.map_url || null;
  return out;
}

function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function saveCriteriaValues(db, propertyId, criteria) {
  if (criteria === undefined) return;
  db.prepare('DELETE FROM property_criteria WHERE property_id = ?').run(propertyId);
  if (!criteria || typeof criteria !== 'object') return;
  const insert = db.prepare('INSERT OR REPLACE INTO property_criteria (property_id, criterion_id, value) VALUES (?, ?, ?)');
  const exists = db.prepare('SELECT id FROM search_criteria WHERE id = ?');
  for (const [criterionId, rawValue] of Object.entries(criteria)) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!exists.get(criterionId)) continue;
    insert.run(propertyId, Number(criterionId), value);
  }
}

function createAdminRouter(db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.adminUsername = user.username;
    res.json({ username: user.username });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/session', requireAdmin, (req, res) => {
    res.json({ username: req.session.adminUsername });
  });

  router.use(requireAdmin);

  router.post('/properties', (req, res) => {
    const fields = pickPropertyFields(req.body || {});
    const info = db.prepare(`
      INSERT INTO properties (status, type, title_fr, title_en, description_fr, description_en,
        location, price, currency, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured,
        availability, featured_order, map_url)
      VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
        @price, @currency, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured,
        @availability, @featured_order, @map_url)
    `).run(fields);
    saveCriteriaValues(db, info.lastInsertRowid, (req.body || {}).criteria);
    res.status(201).json({ id: info.lastInsertRowid });
  });

  router.put('/properties/:id', (req, res) => {
    const fields = pickPropertyFields(req.body || {});
    const existing = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE properties SET status=@status, type=@type, title_fr=@title_fr, title_en=@title_en,
        description_fr=@description_fr, description_en=@description_en, location=@location,
        price=@price, currency=@currency, bedrooms=@bedrooms, garages=@garages, parking=@parking,
        land_area_m2=@land_area_m2, floor_area_m2=@floor_area_m2, featured=@featured,
        availability=@availability, featured_order=@featured_order, map_url=@map_url
      WHERE id=@id
    `).run({ ...fields, id: req.params.id });
    saveCriteriaValues(db, Number(req.params.id), (req.body || {}).criteria);
    res.json({ id: Number(req.params.id) });
  });

  router.delete('/properties/:id', (req, res) => {
    const images = db.prepare('SELECT url FROM property_images WHERE property_id = ?').all(req.params.id);
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
    for (const image of images) {
      fs.rmSync(path.join(UPLOAD_DIR, path.basename(image.url)), { force: true });
    }
    res.json({ ok: true });
  });

  router.post('/properties/:id/images', upload.array('images', 10), async (req, res) => {
    const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Not found' });

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const processed = [];
    for (const file of req.files || []) {
      const filename = `${crypto.randomUUID()}.jpg`;
      try {
        await sharp(file.buffer)
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(path.join(UPLOAD_DIR, filename));
      } catch (err) {
        for (const p of processed) fs.rmSync(path.join(UPLOAD_DIR, p.filename), { force: true });
        return res.status(400).json({ error: `Invalid image file: ${file.originalname}` });
      }
      processed.push({ filename });
    }

    const insert = db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)');
    const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM property_images WHERE property_id = ?').get(req.params.id);
    let nextOrder = maxOrderRow.m + 1;
    const created = [];
    for (const { filename } of processed) {
      const url = `/img/properties/${filename}`;
      const info = insert.run(req.params.id, url, nextOrder++);
      created.push({ id: info.lastInsertRowid, url });
    }
    res.status(201).json(created);
  });

  router.delete('/properties/:id/images/:imageId', (req, res) => {
    const image = db.prepare('SELECT * FROM property_images WHERE id = ? AND property_id = ?').get(req.params.imageId, req.params.id);
    if (!image) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM property_images WHERE id = ?').run(req.params.imageId);
    const filePath = path.join(UPLOAD_DIR, path.basename(image.url));
    fs.rmSync(filePath, { force: true });
    res.json({ ok: true });
  });

  router.get('/inquiries', (req, res) => {
    res.json(db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all());
  });

  router.put('/inquiries/:id', (req, res) => {
    const { status } = req.body || {};
    if (!INQUIRY_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${INQUIRY_STATUSES.join(', ')}` });
    }
    const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ ok: true });
  });

  router.get('/content', (req, res) => {
    const lang = LANGS.includes(req.query.lang) ? req.query.lang : 'fr';
    const merged = mergedDictionary(db, lang);
    const overridden = new Set(db.prepare('SELECT key FROM content_overrides WHERE lang = ?').all(lang).map((r) => r.key));
    const entries = flattenKeys(loadDefaultDict(lang)).map((key) => ({
      key,
      value: getByPath(merged, key),
      overridden: overridden.has(key)
    }));
    res.json(entries);
  });

  router.put('/content', (req, res) => {
    const { lang, key, value } = req.body || {};
    if (!LANGS.includes(lang) || !key || typeof value !== 'string') {
      return res.status(400).json({ error: 'lang, key and value are required' });
    }
    if (getByPath(loadDefaultDict(lang), key) === undefined) {
      return res.status(400).json({ error: 'Unknown content key' });
    }
    if (value === '') {
      db.prepare('DELETE FROM content_overrides WHERE lang = ? AND key = ?').run(lang, key);
    } else {
      db.prepare('INSERT OR REPLACE INTO content_overrides (lang, key, value) VALUES (?, ?, ?)').run(lang, key, value);
    }
    res.json({ ok: true });
  });

  router.put('/settings', (req, res) => {
    const updates = req.body || {};
    const allowed = Object.keys(DEFAULT_SETTINGS);
    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) return res.status(400).json({ error: `Unknown setting: ${key}` });
    }
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(updates)) upsert.run(key, String(value));
    res.json({ ok: true });
  });

  router.get('/stats', (req, res) => {
    const rows = db.prepare(`
      SELECT path, SUM(views) AS views FROM page_views
      WHERE day >= date('now', '-30 days')
      GROUP BY path ORDER BY views DESC
    `).all();
    res.json(rows);
  });

  router.get('/types', (req, res) => {
    res.json(db.prepare('SELECT * FROM property_types ORDER BY label_fr').all());
  });

  router.post('/types', (req, res) => {
    const { label_fr, label_en } = req.body || {};
    if (!label_fr || !label_en) {
      return res.status(400).json({ error: 'label_fr and label_en are required' });
    }
    const value = slugify(label_fr);
    const existing = db.prepare('SELECT id FROM property_types WHERE value = ?').get(value);
    if (existing) return res.status(409).json({ error: 'This type already exists' });
    const info = db.prepare('INSERT INTO property_types (value, label_fr, label_en) VALUES (?, ?, ?)').run(value, label_fr, label_en);
    res.status(201).json({ id: info.lastInsertRowid, value, label_fr, label_en });
  });

  router.delete('/types/:id', (req, res) => {
    db.prepare('DELETE FROM property_types WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  router.get('/criteria', (req, res) => {
    res.json(db.prepare('SELECT * FROM search_criteria ORDER BY label_fr').all());
  });

  router.post('/criteria', (req, res) => {
    const { label_fr, label_en, kind } = req.body || {};
    if (!label_fr || !label_en || !['number', 'boolean'].includes(kind)) {
      return res.status(400).json({ error: 'label_fr, label_en and kind (number|boolean) are required' });
    }
    const slug = slugify(label_fr);
    const existing = db.prepare('SELECT id FROM search_criteria WHERE slug = ?').get(slug);
    if (existing) return res.status(409).json({ error: 'This criterion already exists' });
    const info = db.prepare('INSERT INTO search_criteria (slug, label_fr, label_en, kind) VALUES (?, ?, ?, ?)').run(slug, label_fr, label_en, kind);
    res.status(201).json({ id: info.lastInsertRowid, slug, label_fr, label_en, kind });
  });

  router.delete('/criteria/:id', (req, res) => {
    db.prepare('DELETE FROM search_criteria WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAdminRouter };
