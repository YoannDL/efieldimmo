const express = require('express');
const { LANGS, mergedDictionary, getSettings } = require('../content');

function createContentRouter(db) {
  const router = express.Router();

  router.get('/i18n/:lang', (req, res) => {
    if (!LANGS.includes(req.params.lang)) return res.status(404).json({ error: 'Unknown language' });
    res.json(mergedDictionary(db, req.params.lang));
  });

  router.get('/settings', (req, res) => {
    res.json(getSettings(db));
  });

  return router;
}

module.exports = { createContentRouter };
