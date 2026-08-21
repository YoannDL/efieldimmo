const express = require('express');

function createFiltersRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const types = db.prepare('SELECT value, label_fr, label_en FROM property_types ORDER BY label_fr').all();
    const locations = db.prepare('SELECT DISTINCT location FROM properties ORDER BY location').all().map((r) => r.location);
    res.json({ types, locations });
  });

  return router;
}

module.exports = { createFiltersRouter };
