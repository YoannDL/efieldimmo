const express = require('express');

function createInquiriesRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { name, email, message, phone, propertyRef, hasPropertyToSell, projectType, budgetRange } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required' });
    }
    const info = db.prepare(`
      INSERT INTO inquiries (name, email, phone, property_ref, has_property_to_sell, project_type, budget_range, message)
      VALUES (@name, @email, @phone, @property_ref, @has_property_to_sell, @project_type, @budget_range, @message)
    `).run({
      name, email, message,
      phone: phone || null,
      property_ref: propertyRef || null,
      has_property_to_sell: hasPropertyToSell || null,
      project_type: projectType || null,
      budget_range: budgetRange || null
    });
    res.status(201).json({ id: info.lastInsertRowid });
  });

  return router;
}

module.exports = { createInquiriesRouter };
