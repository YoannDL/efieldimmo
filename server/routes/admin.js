const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'properties');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

const PROPERTY_FIELDS = ['status', 'type', 'title_fr', 'title_en', 'description_fr', 'description_en',
  'location', 'price', 'currency', 'bedrooms', 'garages', 'parking', 'land_area_m2', 'floor_area_m2', 'featured'];

function pickPropertyFields(body) {
  const out = {};
  for (const field of PROPERTY_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  out.currency = out.currency || 'MUR';
  out.bedrooms = Number(out.bedrooms || 0);
  out.garages = Number(out.garages || 0);
  out.parking = Number(out.parking || 0);
  out.land_area_m2 = out.land_area_m2 != null ? Number(out.land_area_m2) : null;
  out.floor_area_m2 = out.floor_area_m2 != null ? Number(out.floor_area_m2) : null;
  out.featured = out.featured ? 1 : 0;
  out.price = Number(out.price);
  return out;
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
        location, price, currency, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured)
      VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
        @price, @currency, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured)
    `).run(fields);
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
        land_area_m2=@land_area_m2, floor_area_m2=@floor_area_m2, featured=@featured
      WHERE id=@id
    `).run({ ...fields, id: req.params.id });
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

  router.post('/properties/:id/images', upload.array('images', 10), (req, res) => {
    const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Not found' });
    const insert = db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)');
    const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM property_images WHERE property_id = ?').get(req.params.id);
    let nextOrder = maxOrderRow.m + 1;
    const created = [];
    for (const file of req.files || []) {
      const url = `/img/properties/${file.filename}`;
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

  return router;
}

module.exports = { createAdminRouter };
