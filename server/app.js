const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { createDb } = require('./db');
const { createAdminRouter } = require('./routes/admin');

function createApp({ dbPath, sessionSecret }) {
  const db = createDb(dbPath);
  const app = express();

  app.use(express.json());
  app.use(session({
    secret: sessionSecret || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/admin/api', createAdminRouter(db));

  return { app, db };
}

module.exports = { createApp };
