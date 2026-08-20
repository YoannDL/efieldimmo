const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createApp } = require('../server/app');

function startTestApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efield-test-'));
  const dbPath = path.join(dir, 'test.sqlite');
  const { app, db } = createApp({ dbPath, sessionSecret: 'test-secret' });
  const server = app.listen(0);
  const { port } = server.address();
  return {
    baseUrl: `http://localhost:${port}`,
    db,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

module.exports = { startTestApp };
