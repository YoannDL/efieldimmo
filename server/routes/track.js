const express = require('express');

function createTrackRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { path: viewPath } = req.body || {};
    if (typeof viewPath !== 'string' || !viewPath || viewPath.length > 200) {
      return res.status(400).json({ error: 'path is required' });
    }
    db.prepare(`
      INSERT INTO page_views (path, day, views) VALUES (?, date('now'), 1)
      ON CONFLICT(path, day) DO UPDATE SET views = views + 1
    `).run(viewPath);
    res.status(204).end();
  });

  return router;
}

module.exports = { createTrackRouter };
