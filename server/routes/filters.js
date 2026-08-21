const express = require('express');

function createFiltersRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const types = db.prepare('SELECT value, label_fr, label_en FROM property_types ORDER BY label_fr').all();
    const locations = db.prepare('SELECT DISTINCT location FROM properties ORDER BY location').all().map((r) => r.location);
    const criteria = db.prepare('SELECT id, slug, label_fr, label_en, kind FROM search_criteria ORDER BY label_fr').all();
    res.json({ types, locations, criteria });
  });

  return router;
}

module.exports = { createFiltersRouter };
