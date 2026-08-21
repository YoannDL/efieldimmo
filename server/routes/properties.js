const express = require('express');

function createPropertiesRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status, type, location, minPrice, maxPrice, bedrooms, garages, parking, minLandArea, minFloorArea } = req.query;
    const clauses = [];
    const params = {};

    if (status) { clauses.push('status = @status'); params.status = status; }
    if (type) { clauses.push('type = @type'); params.type = type; }
    if (location) { clauses.push('location LIKE @location'); params.location = `%${location}%`; }
    if (minPrice) { clauses.push('price >= @minPrice'); params.minPrice = Number(minPrice); }
    if (maxPrice) { clauses.push('price <= @maxPrice'); params.maxPrice = Number(maxPrice); }
    if (bedrooms) { clauses.push('bedrooms >= @bedrooms'); params.bedrooms = Number(bedrooms); }
    if (garages) { clauses.push('garages >= @garages'); params.garages = Number(garages); }
    if (parking) { clauses.push('parking >= @parking'); params.parking = Number(parking); }
    if (minLandArea) { clauses.push('land_area_m2 >= @minLandArea'); params.minLandArea = Number(minLandArea); }
    if (minFloorArea) { clauses.push('floor_area_m2 >= @minFloorArea'); params.minFloorArea = Number(minFloorArea); }

    // Admin-defined criteria filters arrive as crit_<id>=<value>; a match means
    // the property has that criterion with a value >= the requested one
    // (>=1 for yes/no, >=n for numeric thresholds).
    let critIndex = 0;
    for (const [key, rawValue] of Object.entries(req.query)) {
      const match = key.match(/^crit_(\d+)$/);
      if (!match || rawValue === '' || Number.isNaN(Number(rawValue))) continue;
      const idParam = `critId${critIndex}`;
      const valueParam = `critVal${critIndex}`;
      clauses.push(`EXISTS (SELECT 1 FROM property_criteria pc WHERE pc.property_id = properties.id AND pc.criterion_id = @${idParam} AND pc.value >= @${valueParam})`);
      params[idParam] = Number(match[1]);
      params[valueParam] = Number(rawValue);
      critIndex++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM properties ${where} ORDER BY created_at DESC`).all(params);
    const primaryImageStmt = db.prepare('SELECT url FROM property_images WHERE property_id = ? ORDER BY sort_order LIMIT 1');
    const withImages = rows.map((row) => {
      const primary = primaryImageStmt.get(row.id);
      return { ...row, primaryImage: primary ? primary.url : null };
    });
    res.json(withImages);
  });

  router.get('/:id', (req, res) => {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Not found' });
    const images = db.prepare('SELECT id, url, sort_order AS sortOrder FROM property_images WHERE property_id = ? ORDER BY sort_order').all(req.params.id);
    const criteria = db.prepare(`
      SELECT sc.id, sc.slug, sc.label_fr, sc.label_en, sc.kind, pc.value
      FROM property_criteria pc JOIN search_criteria sc ON sc.id = pc.criterion_id
      WHERE pc.property_id = ? ORDER BY sc.label_fr
    `).all(req.params.id);
    res.json({ ...property, images, criteria });
  });

  return router;
}

module.exports = { createPropertiesRouter };
