require('dotenv').config();
const path = require('node:path');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'efield-immo.sqlite');

const { app } = createApp({ dbPath: DB_PATH, sessionSecret: process.env.SESSION_SECRET });

app.listen(PORT, () => {
  console.log(`EFIELD IMMO server listening on http://localhost:${PORT}`);
});
