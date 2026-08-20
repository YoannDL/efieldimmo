# EFIELD IMMO Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the EFIELD IMMO real-estate website: a bilingual (FR/EN) public marketing + property-search site, backed by a single Node/Express + SQLite app with a minimal login-protected admin panel for managing listings and viewing form submissions.

**Architecture:** One Express process serves both static public pages (plain HTML/CSS/vanilla JS, no build step) and a JSON API backed by a single SQLite file (via `better-sqlite3`). The admin panel is server-guarded plain HTML/JS under `/admin`, using the same API with a session-cookie auth check. No external services (no CMS, no form provider, no CDN).

**Tech Stack:** Node.js, Express, better-sqlite3, bcryptjs, express-session, multer, dotenv. Testing via Node's built-in `node:test` runner + global `fetch`/`FormData` (Node 18+) — no extra test framework dependency.

**Spec:** [docs/superpowers/specs/2026-08-20-efield-immo-website-design.md](../specs/2026-08-20-efield-immo-website-design.md)

## Global Constraints

- Colors: primary gold `#B6A062` (CTAs/links/icons), cream `#F7EDD4`, blue `#204C8E`, off-white `#FFFDFA` (background), subtitle brown `#5C4E3D`, body text `#454240`.
- Fonts: **Libre Baskerville** for headings (H1 very large/bold/spaced, H2 elegant semi-bold, H3 medium), **DM Sans** for body text and CTAs (CTA = discreet bold). Self-hosted, no Google Fonts CDN.
- Bilingual FR/EN via a client-side toggle; French is the source language, English is a faithful translation. No page reload needed to switch.
- No third-party form/CMS services: contact + inquiry forms and property listings are stored in the app's own SQLite database.
- One admin account only (no roles, no self-registration, no password reset flow).
- WhatsApp click-to-chat floating button replaces the "chatbot" from the brief; no AI chat.
- Every logic-bearing unit (routes, middleware, db, seed script) gets a `node:test` test written before its implementation. Pure markup/CSS tasks use a lightweight grep-style assertion (the file contains the required selectors/strings) instead of full red/green behavioral tests, plus a manual visual check called out in Task 19's smoke test — content-only changes don't carry the same regression risk as logic.
- Node project uses CommonJS (`require`), not ESM — keeps tooling simple, no transpilation.

---

## File Structure

```
package.json, .env.example, .gitignore
data/.gitkeep                          – sqlite file lives here at runtime (gitignored)
server/
  app.js                               – Express app factory (no listen)
  index.js                             – loads env, calls app.listen
  db.js                                – sqlite connection + schema + admin user upsert
  seed.js                              – seeds admin user + 3 sample properties + images
  middleware/auth.js                   – requireAdmin session guard
  routes/properties.js                 – public GET /api/properties, GET /api/properties/:id
  routes/inquiries.js                  – public POST /api/inquiries
  routes/admin.js                      – login/logout/session + admin CRUD + inquiries list
tests/
  helpers.js                           – startTestApp() test harness
  scaffolding.test.js
  db.test.js
  admin-auth.test.js
  properties.test.js
  admin-properties.test.js
  inquiries.test.js
  seed.test.js
  partials.test.js, home-page.test.js, about-page.test.js, services-page.test.js,
  properties-page.test.js, property-detail-page.test.js, contact-page.test.js,
  admin-login-page.test.js, admin-dashboard-page.test.js
public/
  index.html, about.html, services.html, properties.html, property.html, contact.html
  css/fonts.css, css/styles.css, css/admin.css
  fonts/dm-sans/*.ttf, fonts/libre-baskerville/*.otf
  i18n/fr.json, i18n/en.json
  js/i18n.js, js/partials.js, js/home.js, js/properties.js, js/property-detail.js, js/contact.js, js/admin.js
  partials/header.html, partials/footer.html
  img/brand/*, img/services/*, img/properties/* (copied from project source assets)
  favicon.png
  admin/login.html, admin/dashboard.html
```

---

### Task 1: Project scaffolding & static server

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`
- Create: `server/db.js`, `server/app.js`, `server/index.js`
- Create: `public/index.html`
- Create: `tests/helpers.js`, `tests/scaffolding.test.js`
- Create: `data/.gitkeep`

**Interfaces:**
- Produces: `createDb(dbPath) -> Database` (server/db.js, opens connection only — schema added in Task 2)
- Produces: `createApp({ dbPath, sessionSecret }) -> { app, db }` (server/app.js)
- Produces: `startTestApp() -> { baseUrl, db, close }` (tests/helpers.js), used by every later test file

- [ ] **Step 1: Initialize the Node project and install dependencies**

```bash
npm init -y
npm install express better-sqlite3 bcryptjs express-session multer dotenv
```

- [ ] **Step 2: Write `.gitignore` and `.env.example`**

`.gitignore`:
```
node_modules/
data/*.sqlite
data/*.sqlite-*
.env
```

`.env.example`:
```
PORT=3000
DB_PATH=./data/efield-immo.sqlite
SESSION_SECRET=change-me-to-a-long-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-too
```

- [ ] **Step 3: Write `data/.gitkeep`**

Empty file, just so the `data/` directory exists in the repo.

- [ ] **Step 4: Write the failing scaffolding test**

`tests/helpers.js`:
```js
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
```

`tests/scaffolding.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('GET / serves the static public site', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /EFIELD IMMO/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `node --test tests/scaffolding.test.js`
Expected: FAIL — `Cannot find module '../server/app'` (app.js doesn't exist yet)

- [ ] **Step 6: Implement `server/db.js`**

```js
const Database = require('better-sqlite3');

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

module.exports = { createDb };
```

- [ ] **Step 7: Implement `server/app.js`**

```js
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { createDb } = require('./db');

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

  return { app, db };
}

module.exports = { createApp };
```

- [ ] **Step 8: Implement `server/index.js`**

```js
require('dotenv').config();
const path = require('node:path');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'efield-immo.sqlite');

const { app } = createApp({ dbPath: DB_PATH, sessionSecret: process.env.SESSION_SECRET });

app.listen(PORT, () => {
  console.log(`EFIELD IMMO server listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 9: Write placeholder `public/index.html`**

```html
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>EFIELD IMMO</title></head>
<body><p>EFIELD IMMO — site en construction</p></body>
</html>
```

- [ ] **Step 10: Run test to verify it passes**

Run: `node --test tests/scaffolding.test.js`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git init
git add package.json package-lock.json .gitignore .env.example server public tests data/.gitkeep
git commit -m "chore: scaffold Express + SQLite app with static file serving"
```

---

### Task 2: Database schema

**Files:**
- Modify: `server/db.js`
- Create: `tests/db.test.js`

**Interfaces:**
- Consumes: `createDb(dbPath)` from Task 1
- Produces: `createDb(dbPath) -> Database` (now also creates schema on open)
- Produces: `upsertAdminUser(db, username, passwordHash) -> void`

- [ ] **Step 1: Write the failing test**

`tests/db.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createDb, upsertAdminUser } = require('../server/db');

function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efield-db-test-'));
  return path.join(dir, 'test.sqlite');
}

test('createDb creates all required tables', () => {
  const db = createDb(tmpDbPath());
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
  for (const name of ['admin_users', 'properties', 'property_images', 'inquiries']) {
    assert.ok(tables.includes(name), `missing table ${name}`);
  }
});

test('upsertAdminUser inserts then updates the same username', () => {
  const db = createDb(tmpDbPath());
  upsertAdminUser(db, 'admin', 'hash1');
  upsertAdminUser(db, 'admin', 'hash2');
  const rows = db.prepare('SELECT username, password_hash FROM admin_users').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].password_hash, 'hash2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/db.test.js`
Expected: FAIL — table names array is empty / `upsertAdminUser` is not a function

- [ ] **Step 3: Implement the schema in `server/db.js`**

```js
const Database = require('better-sqlite3');

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      type TEXT NOT NULL,
      title_fr TEXT NOT NULL,
      title_en TEXT NOT NULL,
      description_fr TEXT NOT NULL,
      description_en TEXT NOT NULL,
      location TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MUR',
      bedrooms INTEGER NOT NULL DEFAULT 0,
      garages INTEGER NOT NULL DEFAULT 0,
      parking INTEGER NOT NULL DEFAULT 0,
      land_area_m2 REAL,
      floor_area_m2 REAL,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS property_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      property_ref INTEGER,
      has_property_to_sell TEXT,
      project_type TEXT,
      budget_range TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function upsertAdminUser(db, username, passwordHash) {
  db.prepare(`
    INSERT INTO admin_users (username, password_hash) VALUES (?, ?)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
  `).run(username, passwordHash);
}

module.exports = { createDb, upsertAdminUser };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/db.test.js
git commit -m "feat: add SQLite schema for properties, images, inquiries, admin users"
```

---

### Task 3: Admin session auth

**Files:**
- Create: `server/middleware/auth.js`
- Create: `server/routes/admin.js`
- Modify: `server/app.js` (mount `/admin/api` router)
- Create: `tests/admin-auth.test.js`

**Interfaces:**
- Consumes: `upsertAdminUser(db, username, passwordHash)` from Task 2
- Produces: `requireAdmin(req, res, next)` (server/middleware/auth.js) — used by every guarded route in Tasks 5 and 6
- Produces: `createAdminRouter(db) -> express.Router` mounted at `/admin/api`, with `POST /login`, `POST /logout`, `GET /session`

- [ ] **Step 1: Write the failing test**

`tests/admin-auth.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

async function seedAdmin(db, username, password) {
  upsertAdminUser(db, username, bcrypt.hashSync(password, 10));
}

test('rejects login with wrong credentials', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    await seedAdmin(db, 'admin', 'correct-horse');
    const res = await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' })
    });
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});

test('logs in, reads session, then logs out', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    await seedAdmin(db, 'admin', 'correct-horse');

    const loginRes = await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'correct-horse' })
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie, 'expected a session cookie');

    const sessionRes = await fetch(`${baseUrl}/admin/api/session`, {
      headers: { cookie }
    });
    assert.equal(sessionRes.status, 200);
    const sessionBody = await sessionRes.json();
    assert.equal(sessionBody.username, 'admin');

    const logoutRes = await fetch(`${baseUrl}/admin/api/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${baseUrl}/admin/api/session`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);
  } finally {
    await close();
  }
});

test('session endpoint rejects an unauthenticated request', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/admin/api/session`);
    assert.equal(res.status, 401);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-auth.test.js`
Expected: FAIL — `/admin/api/login` returns 404 (route doesn't exist)

- [ ] **Step 3: Implement `server/middleware/auth.js`**

```js
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUsername) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = { requireAdmin };
```

- [ ] **Step 4: Implement `server/routes/admin.js`**

```js
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');

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

  return router;
}

module.exports = { createAdminRouter };
```

- [ ] **Step 5: Mount the router in `server/app.js`**

Add near the top:
```js
const { createAdminRouter } = require('./routes/admin');
```

Add after `app.use(express.static(...))`:
```js
app.use('/admin/api', createAdminRouter(db));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/admin-auth.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/middleware/auth.js server/routes/admin.js server/app.js tests/admin-auth.test.js
git commit -m "feat: add admin login/logout/session endpoints"
```

---

### Task 4: Public properties API (list + filter, detail)

**Files:**
- Create: `server/routes/properties.js`
- Modify: `server/app.js` (mount `/api/properties`)
- Create: `tests/properties.test.js`

**Interfaces:**
- Consumes: `properties` / `property_images` tables from Task 2
- Produces: `createPropertiesRouter(db) -> express.Router` mounted at `/api/properties`, `GET /` (query filters: `status`, `type`, `location`, `minPrice`, `maxPrice`, `bedrooms`, `garages`, `parking`, `minLandArea`, `minFloorArea`; each row includes a `primaryImage: string|null` field), `GET /:id` (includes `images: [{id, url, sortOrder}]`)

- [ ] **Step 1: Write the failing test**

`tests/properties.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

function insertProperty(db, overrides = {}) {
  const p = {
    status: 'sale', type: 'residential-villa', title_fr: 'Villa Test', title_en: 'Test Villa',
    description_fr: 'Description FR', description_en: 'Description EN', location: 'Grand Baie',
    price: 5000000, bedrooms: 3, garages: 1, parking: 1, land_area_m2: 600, floor_area_m2: 250,
    featured: 0, ...overrides
  };
  const info = db.prepare(`
    INSERT INTO properties (status, type, title_fr, title_en, description_fr, description_en,
      location, price, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured)
    VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
      @price, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured)
  `).run(p);
  return info.lastInsertRowid;
}

test('lists all properties with no filters', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    insertProperty(db);
    insertProperty(db, { location: 'Tamarin', status: 'invest' });
    const res = await fetch(`${baseUrl}/api/properties`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 2);
  } finally {
    await close();
  }
});

test('filters by status, location and min bedrooms', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const idMatch = insertProperty(db, { status: 'sale', location: 'Grand Baie', bedrooms: 4 });
    insertProperty(db, { status: 'rent', location: 'Grand Baie', bedrooms: 4 });
    insertProperty(db, { status: 'sale', location: 'Tamarin', bedrooms: 4 });
    insertProperty(db, { status: 'sale', location: 'Grand Baie', bedrooms: 1 });

    const res = await fetch(`${baseUrl}/api/properties?status=sale&location=Grand Baie&bedrooms=3`);
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].id, idMatch);
  } finally {
    await close();
  }
});

test('list rows include a primaryImage field', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const id = insertProperty(db);
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 0)').run(id, '/img/properties/first.jpg');
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 1)').run(id, '/img/properties/second.jpg');
    insertProperty(db, { location: 'Tamarin' });

    const res = await fetch(`${baseUrl}/api/properties`);
    const body = await res.json();
    const withImage = body.find((p) => p.id === id);
    const withoutImage = body.find((p) => p.id !== id);
    assert.equal(withImage.primaryImage, '/img/properties/first.jpg');
    assert.equal(withoutImage.primaryImage, null);
  } finally {
    await close();
  }
});

test('gets a single property with its images', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const id = insertProperty(db);
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 0)').run(id, '/img/properties/a.jpg');
    db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, 1)').run(id, '/img/properties/b.jpg');

    const res = await fetch(`${baseUrl}/api/properties/${id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, id);
    assert.equal(body.images.length, 2);
    assert.equal(body.images[0].url, '/img/properties/a.jpg');
  } finally {
    await close();
  }
});

test('returns 404 for a missing property', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/api/properties/999`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/properties.test.js`
Expected: FAIL — 404 on `/api/properties` (route not mounted yet)

- [ ] **Step 3: Implement `server/routes/properties.js`**

```js
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
    res.json({ ...property, images });
  });

  return router;
}

module.exports = { createPropertiesRouter };
```

- [ ] **Step 4: Mount the router in `server/app.js`**

Add near the top:
```js
const { createPropertiesRouter } = require('./routes/properties');
```

Add after the admin router mount:
```js
app.use('/api/properties', createPropertiesRouter(db));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/properties.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/routes/properties.js server/app.js tests/properties.test.js
git commit -m "feat: add public properties list/filter/detail API"
```

---

### Task 5: Admin properties CRUD + image upload

**Files:**
- Modify: `server/routes/admin.js`
- Create: `tests/admin-properties.test.js`

**Interfaces:**
- Consumes: `requireAdmin` (Task 3), `properties`/`property_images` schema (Task 2)
- Produces (all under `/admin/api`, guarded by `requireAdmin`): `POST /properties`, `PUT /properties/:id`, `DELETE /properties/:id`, `POST /properties/:id/images` (multipart field `images`, up to 10 files), `DELETE /properties/:id/images/:imageId`

- [ ] **Step 1: Write the failing test**

`tests/admin-properties.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

async function loginCookie(baseUrl, db) {
  upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
  const res = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret123' })
  });
  return res.headers.get('set-cookie');
}

const samplePayload = {
  status: 'sale', type: 'residential-villa', title_fr: 'Villa Neuve', title_en: 'New Villa',
  description_fr: 'Belle villa', description_en: 'Beautiful villa', location: 'Tamarin',
  price: 8000000, bedrooms: 4, garages: 2, parking: 2, land_area_m2: 900, floor_area_m2: 300, featured: 1
};

test('rejects create without authentication', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    });
    assert.equal(res.status, 401);
  } finally { await close(); }
});

test('creates, edits and deletes a property', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);

    const createRes = await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);

    const publicListRes = await fetch(`${baseUrl}/api/properties`);
    const publicList = await publicListRes.json();
    assert.equal(publicList.length, 1);

    const editRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}`, {
      method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...samplePayload, price: 8500000 })
    });
    assert.equal(editRes.status, 200);
    const publicDetail = await (await fetch(`${baseUrl}/api/properties/${created.id}`)).json();
    assert.equal(publicDetail.price, 8500000);

    const deleteRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(deleteRes.status, 200);
    const afterDelete = await fetch(`${baseUrl}/api/properties/${created.id}`);
    assert.equal(afterDelete.status, 404);
  } finally { await close(); }
});

test('uploads images for a property and can delete one', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    const cookie = await loginCookie(baseUrl, db);
    const created = await (await fetch(`${baseUrl}/admin/api/properties`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(samplePayload)
    })).json();

    const form = new FormData();
    form.append('images', new Blob([Buffer.from('fake-image-bytes')], { type: 'image/jpeg' }), 'photo1.jpg');

    const uploadRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}/images`, {
      method: 'POST', headers: { cookie }, body: form
    });
    assert.equal(uploadRes.status, 201);
    const images = await uploadRes.json();
    assert.equal(images.length, 1);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', images[0].url)));

    const deleteImgRes = await fetch(`${baseUrl}/admin/api/properties/${created.id}/images/${images[0].id}`, {
      method: 'DELETE', headers: { cookie }
    });
    assert.equal(deleteImgRes.status, 200);
    const detail = await (await fetch(`${baseUrl}/api/properties/${created.id}`)).json();
    assert.equal(detail.images.length, 0);
  } finally { await close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-properties.test.js`
Expected: FAIL — 404 on `POST /admin/api/properties` (route doesn't exist)

- [ ] **Step 3: Implement the routes in `server/routes/admin.js`**

Replace the file's contents with:
```js
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
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
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
    fs.rm(filePath, { force: true }, () => {});
    res.json({ ok: true });
  });

  router.get('/inquiries', (req, res) => {
    res.json(db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all());
  });

  return router;
}

module.exports = { createAdminRouter };
```

Note: the `GET /inquiries` route is included here (guarded by the same `router.use(requireAdmin)`) but is only exercised by Task 6's tests, once the `inquiries` table has rows to read.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-properties.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin.js tests/admin-properties.test.js
git commit -m "feat: add admin property CRUD and image upload endpoints"
```

---

### Task 6: Inquiries API (contact + property inquiry forms)

**Files:**
- Create: `server/routes/inquiries.js`
- Modify: `server/app.js` (mount `/api/inquiries`)
- Create: `tests/inquiries.test.js`

**Interfaces:**
- Consumes: `inquiries` table (Task 2), `GET /admin/api/inquiries` (Task 5, already implemented)
- Produces: `createInquiriesRouter(db) -> express.Router` mounted at `/api/inquiries`, `POST /` (public)

- [ ] **Step 1: Write the failing test**

`tests/inquiries.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('./helpers');
const { upsertAdminUser } = require('../server/db');

test('rejects a submission missing required fields', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const res = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean' })
    });
    assert.equal(res.status, 400);
  } finally { await close(); }
});

test('accepts a valid submission and it shows up in admin inquiries', async () => {
  const { baseUrl, db, close } = startTestApp();
  try {
    upsertAdminUser(db, 'admin', bcrypt.hashSync('secret123', 10));
    const cookie = (await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret123' })
    })).headers.get('set-cookie');

    const postRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean Dupont', email: 'jean@example.com', message: 'Interessé par ce bien.', propertyRef: 42 })
    });
    assert.equal(postRes.status, 201);

    const listRes = await fetch(`${baseUrl}/admin/api/inquiries`, { headers: { cookie } });
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].email, 'jean@example.com');
    assert.equal(list[0].property_ref, 42);
  } finally { await close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/inquiries.test.js`
Expected: FAIL — 404 on `POST /api/inquiries`

- [ ] **Step 3: Implement `server/routes/inquiries.js`**

```js
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
```

- [ ] **Step 4: Mount the router in `server/app.js`**

Add near the top:
```js
const { createInquiriesRouter } = require('./routes/inquiries');
```

Add after the properties router mount:
```js
app.use('/api/inquiries', createInquiriesRouter(db));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/inquiries.test.js`
Expected: PASS

- [ ] **Step 6: Run the full backend test suite before moving to assets/frontend**

Run: `node --test tests/`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/routes/inquiries.js server/app.js tests/inquiries.test.js
git commit -m "feat: add public inquiries submission endpoint"
```

---

### Task 7: Brand assets & seed script

**Files:**
- Create: `public/img/brand/*`, `public/img/services/*`, `public/img/properties/*`, `public/favicon.png` (copied from project source files)
- Create: `server/seed.js`
- Create: `tests/seed.test.js`

**Interfaces:**
- Consumes: `createDb`, `upsertAdminUser` (Task 2)
- Produces: `seedDatabase(db, { adminUsername, adminPassword }) -> { propertiesInserted }` (server/seed.js), consumed by nothing else in code but run as a CLI script before first launch

- [ ] **Step 1: Copy brand and service imagery from the project source files**

Run from the project root:
```bash
mkdir -p public/img/brand public/img/services public/img/properties
cp "Logo EFIELD IMMO sur fond transparent BV1.png" public/img/brand/logo.png
cp "Logo EFIELD IMMO sur fond transparent BV1.png" public/favicon.png
cp "Firefly Luxury cinematic commercial for a premium real estate compan.png" public/img/brand/hero-home.png
cp "PICS/2-xmmnanLHakyh0FdtQgO.png" public/img/brand/about-aerial.png
cp "PICS/dVkzLtBzoiGfVzRGbtovT.png" public/img/brand/divider-coast.png
cp "PICS/ZqbF7vnySs6gpKv8G4T2D.png" public/img/brand/divider-gold.png
cp "PICS/NNAEjhZLGwm6xd5wGA5gw.png" public/img/brand/divider-plots.png
cp "PICS/FSiy-e9MVwV-W2oTmev47.png" public/img/services/construction.png
cp "PICS/0Cq5z_OqZiBm6w3Z1BjdD.png" public/img/services/land.png
cp "PICS/q3-uCcRH4QstVITKYgxZW.png" public/img/services/investment.png
cp "PICS/terrains Maurice HP.png" public/img/properties/grand-baie-1.png
cp "PICS/0Cq5z_OqZiBm6w3Z1BjdD.png" public/img/properties/grand-baie-2.png
cp "PICS/0Cq5z_OqZiBm6w3Z1BjdD.png" public/img/properties/tamarin-1.png
cp "PICS/NNAEjhZLGwm6xd5wGA5gw.png" public/img/properties/tamarin-2.png
cp "PICS/2-xmmnanLHakyh0FdtQgO.png" public/img/properties/riviere-noire-1.png
cp "PICS/q3-uCcRH4QstVITKYgxZW.png" public/img/properties/riviere-noire-2.png
```

- [ ] **Step 2: Verify the files copied**

Run: `ls public/img/brand public/img/services public/img/properties`
Expected: each directory lists the files copied above.

- [ ] **Step 3: Write the failing test**

`tests/seed.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createDb } = require('../server/db');
const { seedDatabase } = require('../server/seed');

function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'efield-seed-test-'));
  return path.join(dir, 'test.sqlite');
}

test('seedDatabase inserts the admin user and 3 sample properties with images', () => {
  const db = createDb(tmpDbPath());
  const result = seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  assert.equal(result.propertiesInserted, 3);

  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
  assert.ok(admin);

  const properties = db.prepare('SELECT * FROM properties').all();
  assert.equal(properties.length, 3);
  assert.ok(properties.every(p => p.featured === 1));

  const images = db.prepare('SELECT * FROM property_images').all();
  assert.equal(images.length, 6);
});

test('seedDatabase is idempotent for properties on repeat runs', () => {
  const db = createDb(tmpDbPath());
  seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  const second = seedDatabase(db, { adminUsername: 'admin', adminPassword: 'secret123' });
  assert.equal(second.propertiesInserted, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM properties').get().c, 3);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test tests/seed.test.js`
Expected: FAIL — `Cannot find module '../server/seed'`

- [ ] **Step 5: Implement `server/seed.js`**

```js
require('dotenv').config();
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createDb, upsertAdminUser } = require('./db');

const SAMPLE_PROPERTIES = [
  {
    status: 'sale', type: 'residential-land', location: 'Grand Baie',
    title_fr: 'Terrain Résidentiel — Grand Baie', title_en: 'Residential Land — Grand Baie',
    description_fr: "Terrain plat, viabilisé, dans un quartier prisé du nord de l'île. Idéal pour la construction d'une villa familiale ou d'un investissement locatif. Accès rapide aux plages et commodités.",
    description_en: 'Flat, serviced plot in a sought-after neighbourhood in the north of the island. Ideal for building a family villa or a rental investment. Quick access to beaches and amenities.',
    price: 3500000, currency: 'MUR', bedrooms: 0, garages: 0, parking: 0, land_area_m2: 650, floor_area_m2: null,
    featured: 1, images: ['grand-baie-1.png', 'grand-baie-2.png']
  },
  {
    status: 'invest', type: 'residential-subdivision', location: 'Tamarin',
    title_fr: 'Projet en Cours — Morcellement Tamarin', title_en: 'Ongoing Project — Tamarin Subdivision',
    description_fr: "Nouveau morcellement résidentiel au cœur de la côte ouest, avec vue sur les montagnes. Lots de 400 à 900 m² avec toutes les infrastructures incluses. Possibilité de financement.",
    description_en: 'New residential subdivision in the heart of the west coast, with mountain views. Plots from 400 to 900 sqm with all infrastructure included. Financing available.',
    price: 4200000, currency: 'MUR', bedrooms: 0, garages: 0, parking: 0, land_area_m2: 400, floor_area_m2: null,
    featured: 1, images: ['tamarin-1.png', 'tamarin-2.png']
  },
  {
    status: 'sale', type: 'residential-villa', location: 'Rivière Noire',
    title_fr: 'Villa en Construction — Rivière Noire', title_en: 'Villa Under Construction — Rivière Noire',
    description_fr: 'Villa contemporaine 4 chambres avec piscine, jardin tropical et finitions haut de gamme. Projet éligible au dispositif PDS pour investisseurs étrangers. Rendement locatif estimé à 5-7% par an.',
    description_en: 'Contemporary 4-bedroom villa with pool, tropical garden and high-end finishes. Project eligible under the PDS scheme for foreign investors. Estimated rental yield of 5-7% per year.',
    price: 27000000, currency: 'MUR', bedrooms: 4, garages: 2, parking: 2, land_area_m2: 1300, floor_area_m2: 250,
    featured: 1, images: ['riviere-noire-1.png', 'riviere-noire-2.png']
  }
];

function seedDatabase(db, { adminUsername, adminPassword }) {
  upsertAdminUser(db, adminUsername, bcrypt.hashSync(adminPassword, 10));

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM properties').get();
  if (count > 0) return { propertiesInserted: 0 };

  const insertProperty = db.prepare(`
    INSERT INTO properties (status, type, title_fr, title_en, description_fr, description_en,
      location, price, currency, bedrooms, garages, parking, land_area_m2, floor_area_m2, featured)
    VALUES (@status, @type, @title_fr, @title_en, @description_fr, @description_en, @location,
      @price, @currency, @bedrooms, @garages, @parking, @land_area_m2, @floor_area_m2, @featured)
  `);
  const insertImage = db.prepare('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)');

  for (const property of SAMPLE_PROPERTIES) {
    const { images, ...fields } = property;
    const info = insertProperty.run(fields);
    images.forEach((filename, index) => {
      insertImage.run(info.lastInsertRowid, `/img/properties/${filename}`, index);
    });
  }

  return { propertiesInserted: SAMPLE_PROPERTIES.length };
}

if (require.main === module) {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'efield-immo.sqlite');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD not set — using insecure default "changeme123". Set it in .env before deploying.');
  }
  const db = createDb(dbPath);
  const result = seedDatabase(db, { adminUsername, adminPassword });
  console.log(`Seed complete. Admin user: ${adminUsername}. Properties inserted: ${result.propertiesInserted}.`);
}

module.exports = { seedDatabase, SAMPLE_PROPERTIES };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/seed.test.js`
Expected: PASS

- [ ] **Step 7: Run the seed script against the real dev database**

```bash
cp .env.example .env
node server/seed.js
```
Expected output: `Seed complete. Admin user: admin. Properties inserted: 3.` (edit `.env` to set a real `ADMIN_PASSWORD` before doing this for anything beyond local dev)

- [ ] **Step 8: Commit**

```bash
git add public/img public/favicon.png server/seed.js tests/seed.test.js
git commit -m "feat: add DB seed script and copy brand/property imagery"
```

---

### Task 8: Fonts and shared design system CSS

**Files:**
- Create: `public/fonts/dm-sans/*.ttf`, `public/fonts/libre-baskerville/*.otf` (extracted from the project's font zips)
- Create: `public/css/fonts.css`, `public/css/styles.css`

**Interfaces:**
- Produces: CSS custom properties (`--color-gold`, `--color-cream`, `--color-blue`, `--color-offwhite`, `--color-subtitle`, `--color-body`) and component classes (`.site-header`, `.nav`, `.lang-toggle`, `.btn`, `.btn-primary`, `.btn-outline`, `.hero`, `.section`, `.stats-band`, `.stat`, `.card-grid`, `.service-card`, `.property-card`, `.testimonial-card`, `.search-bar`, `.form-field`, `.whatsapp-button`, `.site-footer`, `.gallery-main`, `.gallery-thumbs`) that every page task (10–15) and the admin pages (17–18) rely on.

- [ ] **Step 1: Extract the font files**

```bash
python -c "
import zipfile
zipfile.ZipFile('dm-sans.zip').extractall('public/fonts/dm-sans')
zipfile.ZipFile('libre-baskerville.zip').extractall('public/fonts/libre-baskerville')
"
```

- [ ] **Step 2: Verify extraction**

Run: `ls public/fonts/dm-sans public/fonts/libre-baskerville`
Expected: `DMSans-Regular.ttf DMSans-Italic.ttf DMSans-Medium.ttf DMSans-MediumItalic.ttf DMSans-Bold.ttf DMSans-BoldItalic.ttf` and `LibreBaskerville-Regular.otf LibreBaskerville-Italic.otf LibreBaskerville-Bold.otf`

- [ ] **Step 3: Write `public/css/fonts.css`**

```css
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-Italic.ttf') format('truetype'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-Medium.ttf') format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-MediumItalic.ttf') format('truetype'); font-weight: 500; font-style: italic; font-display: swap; }
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'DM Sans'; src: url('/fonts/dm-sans/DMSans-BoldItalic.ttf') format('truetype'); font-weight: 700; font-style: italic; font-display: swap; }
@font-face { font-family: 'Libre Baskerville'; src: url('/fonts/libre-baskerville/LibreBaskerville-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Libre Baskerville'; src: url('/fonts/libre-baskerville/LibreBaskerville-Italic.otf') format('opentype'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'Libre Baskerville'; src: url('/fonts/libre-baskerville/LibreBaskerville-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
```

- [ ] **Step 4: Write `public/css/styles.css`**

```css
@import url('fonts.css');

:root {
  --color-gold: #B6A062;
  --color-cream: #F7EDD4;
  --color-blue: #204C8E;
  --color-offwhite: #FFFDFA;
  --color-subtitle: #5C4E3D;
  --color-body: #454240;
  --font-heading: 'Libre Baskerville', Georgia, serif;
  --font-body: 'DM Sans', Arial, sans-serif;
  --container-width: 1200px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--font-body); color: var(--color-body); background: var(--color-offwhite); line-height: 1.6; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }

h1, h2, h3 { font-family: var(--font-heading); color: var(--color-subtitle); margin: 0 0 0.5em; }
h1 { font-size: clamp(2.2rem, 5vw, 3.5rem); font-weight: 700; letter-spacing: 0.02em; }
h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 600; }
h3 { font-size: 1.3rem; font-weight: 500; }
p { margin: 0 0 1em; }
.eyebrow { color: var(--color-gold); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.8rem; }

.container { max-width: var(--container-width); margin: 0 auto; padding: 0 1.5rem; }
.section { padding: 4rem 0; }
.section-alt { background: var(--color-cream); }
.section-header { max-width: 640px; margin-bottom: 2.5rem; }

.btn { display: inline-block; font-family: var(--font-body); font-weight: 700; padding: 0.85em 1.75em; border-radius: 4px; border: 2px solid transparent; cursor: pointer; font-size: 0.95rem; transition: opacity 0.2s ease; }
.btn-primary { background: var(--color-gold); color: #fff; }
.btn-outline { background: transparent; border-color: currentColor; color: var(--color-offwhite); }
.btn-outline-dark { background: transparent; border-color: var(--color-gold); color: var(--color-subtitle); }
.btn:hover { opacity: 0.85; }

.site-header { position: sticky; top: 0; z-index: 50; background: var(--color-offwhite); border-bottom: 1px solid var(--color-cream); }
.site-header .container { display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; padding-bottom: 1rem; gap: 1rem; }
.site-header .logo img { height: 48px; }
.nav { display: flex; gap: 1.5rem; align-items: center; }
.nav a { font-weight: 500; }
.nav a:hover { color: var(--color-gold); }
.lang-toggle { display: flex; gap: 0.25rem; border: 1px solid var(--color-gold); border-radius: 4px; overflow: hidden; }
.lang-toggle button { border: none; background: transparent; padding: 0.3em 0.6em; cursor: pointer; font-family: var(--font-body); }
.lang-toggle button.active { background: var(--color-gold); color: #fff; }

.hero { position: relative; min-height: 80vh; display: flex; align-items: flex-end; background-size: cover; background-position: center; color: #fff; }
.hero::before { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15)); }
.hero-content { position: relative; padding: 3rem 0; }
.hero-content h1 { color: #fff; }
.hero-buttons { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }

.stats-band { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 2rem; text-align: center; }
.stat .stat-number { font-family: var(--font-heading); font-size: 2.4rem; color: var(--color-gold); }

.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.75rem; }
.service-card, .property-card, .testimonial-card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(92,78,61,0.08); }
.service-card img, .property-card img { width: 100%; height: 190px; object-fit: cover; }
.service-card .card-body, .property-card .card-body, .testimonial-card { padding: 1.5rem; }
.property-card .price { color: var(--color-gold); font-weight: 700; margin: 0.25em 0; }
.property-card .meta { display: flex; gap: 1rem; color: var(--color-subtitle); font-size: 0.9rem; flex-wrap: wrap; }
.badge-featured { display: inline-block; background: var(--color-gold); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 0.25em 0.6em; border-radius: 3px; margin-bottom: 0.5em; }

.search-bar { background: var(--color-subtitle); color: #fff; padding: 1.5rem; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
.search-bar label { display: block; font-size: 0.8rem; margin-bottom: 0.3em; }
.search-bar select, .search-bar input { padding: 0.5em; border-radius: 4px; border: none; min-width: 160px; font-family: var(--font-body); }
.search-advanced { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 1rem; }
.search-toggle { background: none; border: none; color: var(--color-cream); text-decoration: underline; cursor: pointer; font-family: var(--font-body); }

.form-field { margin-bottom: 1rem; }
.form-field label { display: block; font-weight: 500; margin-bottom: 0.3em; }
.form-field input, .form-field select, .form-field textarea { width: 100%; padding: 0.7em; border: 1px solid var(--color-cream); border-radius: 4px; font-family: var(--font-body); }
.form-success { color: var(--color-blue); font-weight: 500; margin-top: 1em; }
.form-error { color: #b3261e; font-weight: 500; margin-top: 1em; }

.whatsapp-button { position: fixed; bottom: 1.5rem; right: 1.5rem; width: 56px; height: 56px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 100; }
.whatsapp-button svg { width: 28px; height: 28px; fill: #fff; }

.site-footer { background: var(--color-subtitle); color: var(--color-cream); padding: 3rem 0 1.5rem; }
.site-footer h3 { color: var(--color-cream); }
.site-footer a:hover { color: var(--color-gold); }
.footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
.footer-bottom { border-top: 1px solid rgba(247,237,212,0.2); padding-top: 1.5rem; font-size: 0.85rem; text-align: center; }

.gallery-main { width: 100%; height: 420px; object-fit: cover; border-radius: 8px; }
.gallery-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.5rem; }
.gallery-thumbs img { height: 90px; object-fit: cover; border-radius: 4px; cursor: pointer; transition: transform 0.2s ease; }
.gallery-thumbs img:hover { transform: scale(1.05); }
.characteristics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }

@media (max-width: 768px) {
  .site-header .nav { display: none; }
  .search-bar { flex-direction: column; align-items: stretch; }
}
```

- [ ] **Step 5: Verify the stylesheet has the classes later tasks depend on**

```bash
node -e "
const c = require('fs').readFileSync('public/css/styles.css', 'utf8');
const required = ['--color-gold', '--color-blue', '.btn-primary', '.hero', '.whatsapp-button', '.search-bar', '.gallery-main', '.site-footer'];
const missing = required.filter(s => !c.includes(s));
if (missing.length) { throw new Error('missing: ' + missing.join(', ')); }
console.log('styles.css OK');
"
```
Expected: `styles.css OK`

- [ ] **Step 6: Commit**

```bash
git add public/fonts public/css
git commit -m "feat: add self-hosted brand fonts and shared design system CSS"
```

---

### Task 9: Bilingual content (i18n dictionaries + toggle)

**Files:**
- Create: `public/i18n/fr.json`, `public/i18n/en.json`
- Create: `public/js/i18n.js`

**Interfaces:**
- Produces: `window.EfieldI18n.init() -> Promise<void>` and `window.EfieldI18n.t(path) -> string`, consumed by `public/js/partials.js` (Task 10) and every page's inline script (Tasks 11–16, 17–18)
- Dictionary keys under `nav.*`, `footer.*`, `home.*`, `about.*`, `services.*`, `propertiesPage.*`, `propertyDetail.*`, `contact.*`, `whatsapp.*` — referenced by page markup via `data-i18n="section.key"`

- [ ] **Step 1: Write `public/i18n/fr.json`**

```json
{
  "nav": { "home": "Accueil", "about": "À propos", "services": "Nos services", "properties": "Nos biens", "contact": "Contact" },
  "whatsapp": { "label": "Discuter sur WhatsApp" },
  "footer": {
    "addressTitle": "Adresse", "address": "Port-Louis, Île Maurice — Disponibles dans toutes les régions de l'île",
    "phoneTitle": "Téléphone & WhatsApp", "phoneHours": "Disponible du lundi au samedi, 8h–18h",
    "emailTitle": "Email", "emailNote": "Réponse garantie sous 24h ouvrées",
    "linksTitle": "Liens Rapides", "socialTitle": "Réseaux Sociaux",
    "socialNote": "Suivez-nous sur Facebook, Instagram et TikTok pour découvrir nos dernières opportunités.",
    "legalTitle": "Mentions Légales", "legal": "Agence immobilière agréée à l'île Maurice. Politique de confidentialité · Conditions générales d'utilisation.",
    "copyright": "© 2026 EFIELD IMMO. Tous droits réservés."
  },
  "home": {
    "heroTitle": "Donnez vie à votre projet immobilier à l'île Maurice",
    "heroSubtitle": "Que vous souhaitiez acheter un terrain, investir ou développer un projet, nous vous accompagnons à chaque étape avec expertise et transparence.",
    "ctaLand": "Voir nos terrains", "ctaProject": "Confier mon projet", "ctaSearch": "Rechercher un bien",
    "whyEyebrow": "POURQUOI NOUS", "whyTitle": "L'immobilier à Maurice, un projet de vie",
    "whyIntro": "L'immobilier à Maurice ne se résume pas à un simple achat. C'est un projet de vie, un investissement stratégique et une opportunité unique. Nous sommes là pour le concrétiser avec vous, à chaque étape et en toute transparence.",
    "stat1Number": "150+", "stat1Label": "Projets réalisés", "stat1Text": "Des dizaines de familles, d'investisseurs locaux et d'expatriés ont concrétisé leur rêve avec nous.",
    "stat2Number": "15+", "stat2Label": "Années d'expertise", "stat2Text": "Une connaissance approfondie du marché immobilier mauricien, de ses opportunités et de ses spécificités.",
    "stat3Number": "100%", "stat3Label": "Accompagnement A à Z", "stat3Text": "De la recherche du terrain à la remise des clés, nous gérons chaque étape de votre projet.",
    "stat4Number": "2x", "stat4Label": "Clients locaux & expatriés", "stat4Text": "Spécialistes des projets pour résidents mauriciens comme pour investisseurs internationaux.",
    "missionsEyebrow": "NOS MISSIONS", "missionsTitle": "Ce qui nous guide au quotidien",
    "missionsText": "Accompagner chaque client, local ou expatrié, avec la même exigence : trouver le bon terrain ou le bon bien, sécuriser chaque démarche administrative et juridique, et livrer des projets de qualité dans les délais annoncés.",
    "servicesEyebrow": "NOS SERVICES", "servicesTitle": "Des solutions immobilières complètes",
    "servicesIntro": "De l'acquisition de terrain au développement complet de votre projet, nous mettons à votre disposition notre savoir-faire, notre réseau et notre expertise locale pour garantir votre réussite.",
    "featuredEyebrow": "BIENS EN VEDETTE", "featuredTitle": "Projets & Biens Sélectionnés",
    "featuredIntro": "Découvrez une sélection de nos propriétés et projets actuellement disponibles à l'île Maurice, soigneusement sélectionnés pour leur localisation, leur potentiel et la qualité de leur environnement.",
    "testimonialsEyebrow": "TÉMOIGNAGES", "testimonialsTitle": "Ce que disent nos clients",
    "testimonial1Name": "Marie-Claire D. — Résidente Mauricienne, Quatre Bornes",
    "testimonial1Quote": "J'avais un terrain en héritage que je souhaitais valoriser en construisant une villa pour ma famille. L'équipe a géré toutes les démarches administratives, coordonné les architectes et les entrepreneurs. Six mois plus tard, nous avons reçu les clés.",
    "testimonial2Name": "Thomas & Isabelle R. — Investisseurs Français, Paris",
    "testimonial2Quote": "Nous cherchions à investir à Maurice depuis la France sans avoir à nous déplacer à chaque étape. Leur équipe a tout géré à distance : identification du bien, montage juridique PDS, suivi de construction.",
    "statSatisfiedNumber": "97%", "statSatisfiedLabel": "Clients satisfaits",
    "statOnTimeNumber": "92%", "statOnTimeLabel": "Projets dans les délais",
    "statReferralNumber": "85%", "statReferralLabel": "Clients par recommandation",
    "contactCtaTitle": "Discutons de votre projet dès aujourd'hui",
    "contactCtaIntro": "Un premier échange est toujours gratuit et sans engagement. Nous étudions votre situation, vos objectifs et votre budget pour vous proposer les solutions les plus adaptées.",
    "contactCtaButton": "Parlez-nous de votre projet"
  },
  "about": {
    "eyebrow": "NOTRE DIFFÉRENCE", "title": "Pourquoi nous faire confiance ?",
    "intro": "Parce que chaque projet est unique, nous vous offrons un accompagnement personnalisé, basé sur la transparence, l'écoute et une parfaite connaissance du marché mauricien.",
    "diff1Title": "Accompagnement Personnalisé", "diff1Text": "Un conseiller dédié vous suit du premier contact jusqu'à la finalisation de votre projet. Chaque dossier est traité avec une attention individuelle et un suivi rigoureux.",
    "diff2Title": "Transparence Totale", "diff2Text": "Nous vous informons à chaque étape : prix du marché, contraintes légales, délais réalistes. Aucune surprise, aucune commission cachée.",
    "diff3Title": "Connaissance du Terrain", "diff3Text": "Nés et actifs à Maurice, nous connaissons chaque région, chaque micro-marché, les projets d'infrastructure à venir et les zones à fort potentiel.",
    "diff4Title": "Réseau de Partenaires", "diff4Text": "Architectes, notaires, entrepreneurs, avocats fiscalistes, banques locales — notre réseau de partenaires qualifiés vous garantit des prestations de qualité à chaque étape.",
    "expatEyebrow": "POUR LES EXPATRIÉS", "expatTitle": "Investir à l'île Maurice en toute sérénité",
    "expatIntro": "L'île Maurice est l'une des places les plus attractives d'Afrique et de l'Océan Indien pour les investisseurs internationaux, avec un cadre légal sécurisé et une fiscalité parmi les plus avantageuses au monde.",
    "expatWhyTitle": "Pourquoi Maurice ?",
    "expatBullet1": "Impôt sur le revenu plafonné à 15%", "expatBullet2": "Pas de taxe sur les plus-values immobilières",
    "expatBullet3": "Pas de droits de succession pour les non-résidents", "expatBullet4": "Stabilité politique et économique reconnue",
    "expatBullet5": "Accès à un réseau de conventions fiscales internationales",
    "expatProcessTitle": "Un processus simplifié pour les étrangers",
    "expatProcessText": "Les investisseurs étrangers peuvent acquérir des biens immobiliers à Maurice via des dispositifs réglementés comme le PDS (Property Development Scheme) ou l'IRS, permettant d'obtenir un permis de résidence permanent. Nous vous guidons pas à pas dans ces démarches."
  },
  "services": {
    "eyebrow": "NOS SERVICES", "title": "Des solutions immobilières complètes",
    "intro": "Que vous soyez un particulier à la recherche du terrain idéal, un promoteur souhaitant développer un morcellement ou un investisseur étranger désireux de s'établir à Maurice, nous avons la solution adaptée à votre situation.",
    "service1Title": "Achat & Vente de Terrains", "service1Text": "Nous vous accompagnons dans l'identification et l'acquisition des meilleurs terrains disponibles à Maurice, adaptés à votre projet et à votre budget. Notre réseau exclusif nous permet d'accéder à des opportunités off-market.",
    "service2Title": "Morcellement", "service2Text": "Experts en morcellement foncier à l'île Maurice, nous gérons l'ensemble des démarches administratives, légales et techniques pour vous permettre de valoriser au mieux votre propriété ou d'investir dans un projet de lotissement.",
    "service3Title": "Construction", "service3Text": "De la conception architecturale à la livraison, notre équipe supervise chaque phase de votre chantier, avec les meilleurs entrepreneurs locaux pour garantir qualité, respect des délais et maîtrise du budget.",
    "service4Title": "Investissement Expatriés", "service4Text": "Nous offrons un service dédié aux investisseurs étrangers souhaitant acquérir un bien à Maurice. Accompagnement juridique, fiscal et administratif pour simplifier chaque étape de votre investissement depuis l'étranger."
  },
  "propertiesPage": {
    "title": "Nos Biens", "intro": "Recherchez parmi nos terrains, villas et projets disponibles à l'île Maurice.",
    "statusLabel": "Statut", "statusAll": "Tous", "statusSale": "Acheter", "statusRent": "Louer", "statusInvest": "Investissement",
    "typeLabel": "Type", "typeAll": "Tous types de biens immobiliers",
    "typeLand": "Terrain", "typeVilla": "Villa", "typeSubdivision": "Morcellement", "typeOffice": "Bureau",
    "locationLabel": "Localisation", "locationPlaceholder": "Saisissez la référence de la zone ou de la propriété",
    "refineButton": "Affiner la recherche", "searchButton": "Recherche",
    "priceMinLabel": "Prix minimum", "priceMaxLabel": "Prix maximum", "bedroomsLabel": "Chambres", "garagesLabel": "Garages",
    "parkingLabel": "Parking", "landAreaLabel": "Superficie terrain (m²)", "floorAreaLabel": "Superficie au sol (m²)",
    "noResults": "Aucun bien ne correspond à votre recherche pour le moment.", "viewDetails": "Voir le détail", "featuredBadge": "En vedette"
  },
  "propertyDetail": {
    "characteristicsTitle": "Caractéristiques", "descriptionTitle": "Description",
    "bedroomsLabel": "Chambres", "garagesLabel": "Garages", "parkingLabel": "Parking",
    "landAreaLabel": "Terrain", "floorAreaLabel": "Surface habitable", "priceLabel": "Prix",
    "contactFormTitle": "Formulaire de contact", "refLabel": "Réf du bien", "nameLabel": "Nom Prénom",
    "emailLabel": "Email", "phoneLabel": "Numéro de téléphone", "hasPropertyLabel": "Avez-vous un bien à vendre ?",
    "yesLabel": "Oui", "noLabel": "Non", "messageLabel": "Message", "sendButton": "Envoyer",
    "successMessage": "Merci, votre message a bien été envoyé. Nous vous répondrons sous 24h ouvrées.",
    "errorMessage": "Une erreur est survenue, veuillez réessayer."
  },
  "contact": {
    "eyebrow": "CONTACTEZ-NOUS", "title": "Contactez-nous",
    "intro": "Notre équipe est à votre disposition pour répondre à toutes vos questions et vous accompagner dans votre projet immobilier à l'île Maurice.",
    "formTitle": "Parlez-nous de votre projet", "nameLabel": "Nom complet", "namePlaceholder": "Votre nom et prénom",
    "emailLabel": "Email", "phoneLabel": "Téléphone (WhatsApp accepté)",
    "projectTypeLabel": "Type de projet", "projectTypePlaceholder": "Achat de terrain · Construction · Morcellement · Investissement expatrié",
    "budgetLabel": "Budget approximatif", "budgetUnder5": "Moins de 5M MUR", "budget5to15": "5–15M MUR",
    "budget15to30": "15–30M MUR", "budgetOver30": "Plus de 30M MUR",
    "messageLabel": "Message", "sendButton": "Envoyer",
    "successMessage": "Merci, votre message a bien été envoyé. Nous vous répondrons sous 24h ouvrées.",
    "errorMessage": "Une erreur est survenue, veuillez réessayer.",
    "addressTitle": "Adresse", "address": "Port-Louis, Île Maurice — Disponibles dans toutes les régions de l'île",
    "phoneTitle": "Téléphone & WhatsApp", "phoneHours": "Disponible du lundi au samedi, 8h–18h",
    "emailTitle": "Email", "emailNote": "Réponse garantie sous 24h ouvrées",
    "hoursNote": "Réponse sous 24h ouvrées", "consultNote": "Consultation initiale gratuite",
    "langNote": "Disponibles en français, anglais et créole"
  }
}
```

- [ ] **Step 2: Write `public/i18n/en.json`**

```json
{
  "nav": { "home": "Home", "about": "About", "services": "Services", "properties": "Properties", "contact": "Contact" },
  "whatsapp": { "label": "Chat on WhatsApp" },
  "footer": {
    "addressTitle": "Address", "address": "Port Louis, Mauritius — Available across all regions of the island",
    "phoneTitle": "Phone & WhatsApp", "phoneHours": "Available Monday to Saturday, 8am–6pm",
    "emailTitle": "Email", "emailNote": "Guaranteed reply within 24 business hours",
    "linksTitle": "Quick Links", "socialTitle": "Social Media",
    "socialNote": "Follow us on Facebook, Instagram and TikTok to discover our latest opportunities.",
    "legalTitle": "Legal Notice", "legal": "Licensed real estate agency in Mauritius. Privacy policy · Terms of use.",
    "copyright": "© 2026 EFIELD IMMO. All rights reserved."
  },
  "home": {
    "heroTitle": "Bring your real estate project in Mauritius to life",
    "heroSubtitle": "Whether you want to buy land, invest or develop a project, we support you at every step with expertise and transparency.",
    "ctaLand": "View our land", "ctaProject": "Start my project", "ctaSearch": "Search a property",
    "whyEyebrow": "WHY US", "whyTitle": "Real estate in Mauritius, a life project",
    "whyIntro": "Real estate in Mauritius is not just a purchase. It's a life project, a strategic investment and a unique opportunity. We're here to make it happen with you, at every step and in complete transparency.",
    "stat1Number": "150+", "stat1Label": "Projects completed", "stat1Text": "Dozens of families, local investors and expatriates have made their dream a reality with us.",
    "stat2Number": "15+", "stat2Label": "Years of expertise", "stat2Text": "In-depth knowledge of the Mauritian real estate market, its opportunities and its specificities.",
    "stat3Number": "100%", "stat3Label": "End-to-end support", "stat3Text": "From finding the land to handing over the keys, we manage every step of your project.",
    "stat4Number": "2x", "stat4Label": "Local & expatriate clients", "stat4Text": "Specialists in projects for Mauritian residents as well as international investors.",
    "missionsEyebrow": "OUR MISSION", "missionsTitle": "What guides us every day",
    "missionsText": "Supporting every client, local or expatriate, with the same standard: finding the right land or property, securing every administrative and legal step, and delivering quality projects on the announced timeline.",
    "servicesEyebrow": "OUR SERVICES", "servicesTitle": "Complete real estate solutions",
    "servicesIntro": "From land acquisition to the full development of your project, we put our know-how, our network and our local expertise at your service to guarantee your success.",
    "featuredEyebrow": "FEATURED PROPERTIES", "featuredTitle": "Selected Projects & Properties",
    "featuredIntro": "Discover a selection of our properties and projects currently available in Mauritius, carefully selected for their location, potential and the quality of their surroundings.",
    "testimonialsEyebrow": "TESTIMONIALS", "testimonialsTitle": "What our clients say",
    "testimonial1Name": "Marie-Claire D. — Mauritian resident, Quatre Bornes",
    "testimonial1Quote": "I had inherited land that I wanted to develop by building a villa for my family. The team handled all the administrative steps and coordinated the architects and contractors. Six months later, we received the keys.",
    "testimonial2Name": "Thomas & Isabelle R. — French investors, Paris",
    "testimonial2Quote": "We wanted to invest in Mauritius from France without having to travel for every step. Their team handled everything remotely: identifying the property, structuring the PDS purchase, and following the construction.",
    "statSatisfiedNumber": "97%", "statSatisfiedLabel": "Satisfied clients",
    "statOnTimeNumber": "92%", "statOnTimeLabel": "Projects delivered on time",
    "statReferralNumber": "85%", "statReferralLabel": "Clients from referrals",
    "contactCtaTitle": "Let's discuss your project today",
    "contactCtaIntro": "A first conversation is always free and without obligation. We look at your situation, your goals and your budget to propose the solutions that suit you best.",
    "contactCtaButton": "Tell us about your project"
  },
  "about": {
    "eyebrow": "OUR DIFFERENCE", "title": "Why trust us?",
    "intro": "Because every project is unique, we offer personalized support, based on transparency, listening and a thorough knowledge of the Mauritian market.",
    "diff1Title": "Personalized Support", "diff1Text": "A dedicated advisor follows you from the first contact through to the completion of your project. Every file is handled with individual attention and rigorous follow-up.",
    "diff2Title": "Total Transparency", "diff2Text": "We keep you informed at every step: market prices, legal constraints, realistic timelines. No surprises, no hidden commissions.",
    "diff3Title": "Local Knowledge", "diff3Text": "Born and active in Mauritius, we know every region, every micro-market, upcoming infrastructure projects and high-potential areas.",
    "diff4Title": "Partner Network", "diff4Text": "Architects, notaries, contractors, tax lawyers, local banks — our network of qualified partners guarantees quality service at every stage.",
    "expatEyebrow": "FOR EXPATRIATES", "expatTitle": "Invest in Mauritius with complete peace of mind",
    "expatIntro": "Mauritius is one of the most attractive destinations in Africa and the Indian Ocean for international investors, with a secure legal framework and one of the most advantageous tax systems in the world.",
    "expatWhyTitle": "Why Mauritius?",
    "expatBullet1": "Income tax capped at 15%", "expatBullet2": "No capital gains tax on real estate",
    "expatBullet3": "No inheritance tax for non-residents", "expatBullet4": "Recognized political and economic stability",
    "expatBullet5": "Access to a network of international tax treaties",
    "expatProcessTitle": "A simplified process for foreigners",
    "expatProcessText": "Foreign investors can acquire real estate in Mauritius through regulated schemes such as the PDS (Property Development Scheme) or the IRS, which allow a permanent residence permit to be obtained. We guide you step by step through these procedures."
  },
  "services": {
    "eyebrow": "OUR SERVICES", "title": "Complete real estate solutions",
    "intro": "Whether you are an individual looking for the ideal plot of land, a developer wishing to create a subdivision, or a foreign investor looking to settle in Mauritius, we have the solution suited to your situation.",
    "service1Title": "Land Purchase & Sale", "service1Text": "We support you in identifying and acquiring the best available land in Mauritius, suited to your project and your budget. Our exclusive network gives us access to off-market opportunities.",
    "service2Title": "Subdivision", "service2Text": "Experts in land subdivision in Mauritius, we manage all administrative, legal and technical steps to help you make the most of your property or invest in a subdivision project.",
    "service3Title": "Construction", "service3Text": "From architectural design to delivery, our team supervises every phase of your construction, working with the best local contractors to guarantee quality, timelines and budget control.",
    "service4Title": "Expatriate Investment", "service4Text": "We offer a dedicated service for foreign investors wishing to acquire property in Mauritius. Legal, tax and administrative support to simplify every step of your investment from abroad."
  },
  "propertiesPage": {
    "title": "Our Properties", "intro": "Search among our land, villas and projects available in Mauritius.",
    "statusLabel": "Status", "statusAll": "All", "statusSale": "Buy", "statusRent": "Rent", "statusInvest": "Investment",
    "typeLabel": "Type", "typeAll": "All property types",
    "typeLand": "Land", "typeVilla": "Villa", "typeSubdivision": "Subdivision", "typeOffice": "Office",
    "locationLabel": "Location", "locationPlaceholder": "Enter the area or property reference",
    "refineButton": "Refine your search", "searchButton": "Search",
    "priceMinLabel": "Minimum price", "priceMaxLabel": "Maximum price", "bedroomsLabel": "Bedrooms", "garagesLabel": "Garages",
    "parkingLabel": "Parking", "landAreaLabel": "Land area (sqm)", "floorAreaLabel": "Floor area (sqm)",
    "noResults": "No property matches your search yet.", "viewDetails": "View details", "featuredBadge": "Featured"
  },
  "propertyDetail": {
    "characteristicsTitle": "Characteristics", "descriptionTitle": "Description",
    "bedroomsLabel": "Bedrooms", "garagesLabel": "Garages", "parkingLabel": "Parking",
    "landAreaLabel": "Land", "floorAreaLabel": "Living area", "priceLabel": "Price",
    "contactFormTitle": "Contact form", "refLabel": "Property ref.", "nameLabel": "Full name",
    "emailLabel": "Email", "phoneLabel": "Phone number", "hasPropertyLabel": "Do you have a property to sell?",
    "yesLabel": "Yes", "noLabel": "No", "messageLabel": "Message", "sendButton": "Send",
    "successMessage": "Thank you, your message has been sent. We will reply within 24 business hours.",
    "errorMessage": "Something went wrong, please try again."
  },
  "contact": {
    "eyebrow": "CONTACT US", "title": "Contact Us",
    "intro": "Our team is available to answer all your questions and support you in your real estate project in Mauritius.",
    "formTitle": "Tell us about your project", "nameLabel": "Full name", "namePlaceholder": "Your first and last name",
    "emailLabel": "Email", "phoneLabel": "Phone (WhatsApp accepted)",
    "projectTypeLabel": "Project type", "projectTypePlaceholder": "Land purchase · Construction · Subdivision · Expatriate investment",
    "budgetLabel": "Approximate budget", "budgetUnder5": "Under 5M MUR", "budget5to15": "5–15M MUR",
    "budget15to30": "15–30M MUR", "budgetOver30": "Over 30M MUR",
    "messageLabel": "Message", "sendButton": "Send",
    "successMessage": "Thank you, your message has been sent. We will reply within 24 business hours.",
    "errorMessage": "Something went wrong, please try again.",
    "addressTitle": "Address", "address": "Port Louis, Mauritius — Available across all regions of the island",
    "phoneTitle": "Phone & WhatsApp", "phoneHours": "Available Monday to Saturday, 8am–6pm",
    "emailTitle": "Email", "emailNote": "Guaranteed reply within 24 business hours",
    "hoursNote": "Reply within 24 business hours", "consultNote": "Free initial consultation",
    "langNote": "Available in French, English and Creole"
  }
}
```

- [ ] **Step 3: Write `public/js/i18n.js`**

```js
(function () {
  const STORAGE_KEY = 'efield-lang';

  async function loadDictionary(lang) {
    const res = await fetch(`/i18n/${lang}.json`);
    return res.json();
  }

  function getByPath(obj, keyPath) {
    return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  function applyDictionary(dict) {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = getByPath(dict, el.getAttribute('data-i18n'));
      if (value !== undefined) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const value = getByPath(dict, el.getAttribute('data-i18n-placeholder'));
      if (value !== undefined) el.setAttribute('placeholder', value);
    });
  }

  function setActiveToggleButton(lang) {
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  async function setLanguage(lang) {
    const dict = await loadDictionary(lang);
    window.__efieldDict = dict;
    applyDictionary(dict);
    setActiveToggleButton(lang);
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.dispatchEvent(new CustomEvent('efield:lang-changed', { detail: { lang, dict } }));
  }

  function initLangToggle() {
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
    });
  }

  window.EfieldI18n = {
    init: async function () {
      initLangToggle();
      const saved = localStorage.getItem(STORAGE_KEY);
      const lang = saved === 'en' ? 'en' : 'fr';
      await setLanguage(lang);
    },
    t: function (keyPath) {
      return getByPath(window.__efieldDict || {}, keyPath);
    }
  };
})();
```

- [ ] **Step 4: Verify both dictionaries are valid JSON with matching keys**

```bash
node -e "
const fr = require('./public/i18n/fr.json');
const en = require('./public/i18n/en.json');
function keys(obj, prefix) {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? keys(v, prefix + k + '.') : [prefix + k]);
}
const frKeys = keys(fr, '').sort();
const enKeys = keys(en, '').sort();
if (JSON.stringify(frKeys) !== JSON.stringify(enKeys)) {
  throw new Error('fr.json and en.json key sets differ');
}
console.log('i18n OK — ' + frKeys.length + ' keys match in both languages');
"
```
Expected: `i18n OK — <N> keys match in both languages`

- [ ] **Step 5: Commit**

```bash
git add public/i18n public/js/i18n.js
git commit -m "feat: add FR/EN content dictionaries and language toggle"
```

---

### Task 10: Shared header/footer partials + WhatsApp button

**Files:**
- Create: `public/partials/header.html`, `public/partials/footer.html`
- Create: `public/js/partials.js`
- Create: `tests/partials.test.js`

**Interfaces:**
- Consumes: `window.EfieldI18n.init()` (Task 9)
- Produces: `window.EfieldPartials.init() -> Promise<void>`, called by every page (Tasks 11–16) via `<div id="site-header"></div>` / `<div id="site-footer"></div>` placeholders

- [ ] **Step 1: Write the failing test**

`tests/partials.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('header and footer partials are served with expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const header = await (await fetch(`${baseUrl}/partials/header.html`)).text();
    assert.match(header, /class="site-header"/);
    assert.match(header, /lang-toggle/);
    assert.match(header, /data-i18n="nav.properties"/);

    const footer = await (await fetch(`${baseUrl}/partials/footer.html`)).text();
    assert.match(footer, /class="site-footer"/);
    assert.match(footer, /whatsapp-button/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/partials.test.js`
Expected: FAIL — 404 for `/partials/header.html`

- [ ] **Step 3: Write `public/partials/header.html`**

```html
<div class="container">
  <a href="/index.html" class="logo"><img src="/img/brand/logo.png" alt="EFIELD IMMO"></a>
  <nav class="nav">
    <a href="/index.html" data-i18n="nav.home">Accueil</a>
    <a href="/about.html" data-i18n="nav.about">À propos</a>
    <a href="/services.html" data-i18n="nav.services">Nos services</a>
    <a href="/properties.html" data-i18n="nav.properties">Nos biens</a>
    <a href="/contact.html" data-i18n="nav.contact">Contact</a>
  </nav>
  <div class="lang-toggle">
    <button type="button" data-lang="fr">FR</button>
    <button type="button" data-lang="en">EN</button>
  </div>
</div>
```

Note: this file's root element is wrapped by the page's own `<header class="site-header" id="site-header">` container (see Task 11), so the partial itself only needs the inner `.container`.

- [ ] **Step 4: Write `public/partials/footer.html`**

```html
<div class="container">
  <div class="footer-grid">
    <div>
      <img src="/img/brand/logo.png" alt="EFIELD IMMO" style="height:56px;margin-bottom:1rem;">
    </div>
    <div>
      <h3 data-i18n="footer.addressTitle">Adresse</h3>
      <p data-i18n="footer.address">Port-Louis, Île Maurice</p>
      <h3 data-i18n="footer.phoneTitle">Téléphone & WhatsApp</h3>
      <p>+230 XXX XXXX</p>
      <p data-i18n="footer.phoneHours"></p>
    </div>
    <div>
      <h3 data-i18n="footer.emailTitle">Email</h3>
      <p>efieldimmo@gmail.com</p>
      <p data-i18n="footer.emailNote"></p>
    </div>
    <div>
      <h3 data-i18n="footer.linksTitle">Liens Rapides</h3>
      <p><a href="/properties.html" data-i18n="nav.properties">Nos biens</a></p>
      <p><a href="/services.html" data-i18n="nav.services">Nos services</a></p>
      <p><a href="/about.html" data-i18n="nav.about">À propos</a></p>
      <p><a href="/contact.html" data-i18n="nav.contact">Contact</a></p>
    </div>
    <div>
      <h3 data-i18n="footer.socialTitle">Réseaux Sociaux</h3>
      <p data-i18n="footer.socialNote"></p>
    </div>
  </div>
  <div class="footer-bottom">
    <p data-i18n="footer.legal"></p>
    <p data-i18n="footer.copyright"></p>
  </div>
</div>
<a class="whatsapp-button" href="https://wa.me/23057000000" target="_blank" rel="noopener" aria-label="WhatsApp">
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 1.9 6.5L4 29l7.7-1.9A11.9 11.9 0 0 0 16 27c6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-2 0-3.8-.6-5.4-1.6l-.4-.2-4.6 1.1 1.1-4.5-.2-.4A9.7 9.7 0 0 1 5.3 15c0-5.9 4.8-10.8 10.7-10.8S26.8 9.1 26.8 15 22 24.8 16 24.8zm5.9-8.1c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.6.2-.2.2-.3.3-.5.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.4-.2-.6-.5-.5-.7-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.1 3.1 1.3 3.3c.2.2 2.3 3.4 5.5 4.8.8.3 1.4.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>
</a>
```

- [ ] **Step 5: Write `public/js/partials.js`**

```js
(function () {
  async function includePartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    const res = await fetch(url);
    el.innerHTML = await res.text();
  }

  function highlightActiveNavLink() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a').forEach((link) => {
      if (link.getAttribute('href') === `/${current}`) link.classList.add('active-link');
    });
  }

  window.EfieldPartials = {
    init: async function () {
      await Promise.all([
        includePartial('#site-header', '/partials/header.html'),
        includePartial('#site-footer', '/partials/footer.html')
      ]);
      highlightActiveNavLink();
      await window.EfieldI18n.init();
    }
  };
})();
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/partials.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/partials public/js/partials.js tests/partials.test.js
git commit -m "feat: add shared header/footer partials and WhatsApp button"
```

---

### Task 11: Home page

**Files:**
- Modify: `public/index.html` (replace the Task 1 placeholder)
- Create: `public/js/home.js`
- Create: `tests/home-page.test.js`

**Interfaces:**
- Consumes: `GET /api/properties` (`primaryImage` field, Task 4), `window.EfieldPartials.init()` (Task 10), `document` event `efield:lang-changed` (Task 9)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/home-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('home page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/index.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="home.heroTitle"/);
    assert.match(html, /id="featured-properties"/);
    assert.match(html, /src="\/js\/home\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/home-page.test.js`
Expected: FAIL — placeholder `index.html` doesn't contain any of these markers

- [ ] **Step 3: Write `public/index.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EFIELD IMMO — Immobilier à l'île Maurice</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="hero" style="background-image:url('/img/brand/hero-home.png');">
    <div class="container hero-content">
      <h1 data-i18n="home.heroTitle">Donnez vie à votre projet immobilier à l'île Maurice</h1>
      <p data-i18n="home.heroSubtitle">Que vous souhaitiez acheter un terrain, investir ou développer un projet, nous vous accompagnons à chaque étape avec expertise et transparence.</p>
      <div class="hero-buttons">
        <a class="btn btn-primary" href="/properties.html?status=sale&amp;type=residential-land" data-i18n="home.ctaLand">Voir nos terrains</a>
        <a class="btn btn-outline" href="/contact.html" data-i18n="home.ctaProject">Confier mon projet</a>
        <a class="btn btn-outline" href="/properties.html" data-i18n="home.ctaSearch">Rechercher un bien</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="home.whyEyebrow">POURQUOI NOUS</p>
        <h2 data-i18n="home.whyTitle">L'immobilier à Maurice, un projet de vie</h2>
        <p data-i18n="home.whyIntro"></p>
      </div>
      <div class="stats-band">
        <div class="stat"><div class="stat-number" data-i18n="home.stat1Number">150+</div><h3 data-i18n="home.stat1Label"></h3><p data-i18n="home.stat1Text"></p></div>
        <div class="stat"><div class="stat-number" data-i18n="home.stat2Number">15+</div><h3 data-i18n="home.stat2Label"></h3><p data-i18n="home.stat2Text"></p></div>
        <div class="stat"><div class="stat-number" data-i18n="home.stat3Number">100%</div><h3 data-i18n="home.stat3Label"></h3><p data-i18n="home.stat3Text"></p></div>
        <div class="stat"><div class="stat-number" data-i18n="home.stat4Number">2x</div><h3 data-i18n="home.stat4Label"></h3><p data-i18n="home.stat4Text"></p></div>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <p class="eyebrow" data-i18n="home.missionsEyebrow">NOS MISSIONS</p>
      <h2 data-i18n="home.missionsTitle"></h2>
      <p data-i18n="home.missionsText"></p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="home.servicesEyebrow">NOS SERVICES</p>
        <h2 data-i18n="home.servicesTitle"></h2>
        <p data-i18n="home.servicesIntro"></p>
      </div>
      <div class="card-grid">
        <div class="service-card">
          <img src="/img/services/land.png" alt="Achat et vente de terrains">
          <div class="card-body"><h3 data-i18n="services.service1Title"></h3><p data-i18n="services.service1Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/brand/divider-plots.png" alt="Morcellement">
          <div class="card-body"><h3 data-i18n="services.service2Title"></h3><p data-i18n="services.service2Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/services/construction.png" alt="Construction">
          <div class="card-body"><h3 data-i18n="services.service3Title"></h3><p data-i18n="services.service3Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/services/investment.png" alt="Investissement expatriés">
          <div class="card-body"><h3 data-i18n="services.service4Title"></h3><p data-i18n="services.service4Text"></p></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="home.featuredEyebrow"></p>
        <h2 data-i18n="home.featuredTitle"></h2>
        <p data-i18n="home.featuredIntro"></p>
      </div>
      <div class="card-grid" id="featured-properties"></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="home.testimonialsEyebrow"></p>
        <h2 data-i18n="home.testimonialsTitle"></h2>
      </div>
      <div class="card-grid">
        <div class="testimonial-card"><p data-i18n="home.testimonial1Quote"></p><strong data-i18n="home.testimonial1Name"></strong></div>
        <div class="testimonial-card"><p data-i18n="home.testimonial2Quote"></p><strong data-i18n="home.testimonial2Name"></strong></div>
      </div>
      <div class="stats-band" style="margin-top:2.5rem;">
        <div class="stat"><div class="stat-number" data-i18n="home.statSatisfiedNumber"></div><p data-i18n="home.statSatisfiedLabel"></p></div>
        <div class="stat"><div class="stat-number" data-i18n="home.statOnTimeNumber"></div><p data-i18n="home.statOnTimeLabel"></p></div>
        <div class="stat"><div class="stat-number" data-i18n="home.statReferralNumber"></div><p data-i18n="home.statReferralLabel"></p></div>
      </div>
    </div>
  </section>

  <section class="section section-alt" style="text-align:center;">
    <div class="container">
      <h2 data-i18n="home.contactCtaTitle"></h2>
      <p data-i18n="home.contactCtaIntro"></p>
      <a class="btn btn-primary" href="/contact.html" data-i18n="home.contactCtaButton"></a>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script src="/js/home.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

- [ ] **Step 4: Write `public/js/home.js`**

```js
(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  function applyDictToNode(node) {
    const dict = window.__efieldDict || {};
    node.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = el.getAttribute('data-i18n').split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict);
      if (value !== undefined) el.textContent = value;
    });
  }

  function renderFeatured(properties) {
    const container = document.getElementById('featured-properties');
    if (!container) return;
    const lang = currentLang();
    container.innerHTML = properties.slice(0, 3).map((p) => `
      <a class="property-card" href="/property.html?id=${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          <span class="badge-featured" data-i18n="propertiesPage.featuredBadge"></span>
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta"><span>${p.location}</span></p>
        </div>
      </a>
    `).join('');
    applyDictToNode(container);
  }

  let cachedProperties = [];

  async function loadFeatured() {
    const res = await fetch('/api/properties');
    const all = await res.json();
    cachedProperties = all.filter((p) => p.featured);
    renderFeatured(cachedProperties);
  }

  document.addEventListener('DOMContentLoaded', loadFeatured);
  document.addEventListener('efield:lang-changed', () => renderFeatured(cachedProperties));
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/home-page.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/js/home.js tests/home-page.test.js
git commit -m "feat: build the home page"
```

---

### Task 12: About page

**Files:**
- Create: `public/about.html`
- Create: `tests/about-page.test.js`

**Interfaces:**
- Consumes: `window.EfieldPartials.init()` (Task 10), `about.*` i18n keys (Task 9)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/about-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('about page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/about.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="about.title"/);
    assert.match(html, /data-i18n="about.diff4Title"/);
    assert.match(html, /data-i18n="about.expatBullet5"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/about-page.test.js`
Expected: FAIL — `/about.html` returns 404

- [ ] **Step 3: Write `public/about.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>À propos — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="about.eyebrow">NOTRE DIFFÉRENCE</p>
        <h1 data-i18n="about.title">Pourquoi nous faire confiance ?</h1>
        <p data-i18n="about.intro"></p>
      </div>
      <div class="card-grid">
        <div class="service-card"><div class="card-body"><h3 data-i18n="about.diff1Title"></h3><p data-i18n="about.diff1Text"></p></div></div>
        <div class="service-card"><div class="card-body"><h3 data-i18n="about.diff2Title"></h3><p data-i18n="about.diff2Text"></p></div></div>
        <div class="service-card"><div class="card-body"><h3 data-i18n="about.diff3Title"></h3><p data-i18n="about.diff3Text"></p></div></div>
        <div class="service-card"><div class="card-body"><h3 data-i18n="about.diff4Title"></h3><p data-i18n="about.diff4Text"></p></div></div>
      </div>
    </div>
  </section>

  <section class="hero" style="min-height:50vh;background-image:url('/img/brand/about-aerial.png');">
    <div class="container hero-content">
      <p class="eyebrow" style="color:var(--color-cream);" data-i18n="about.expatEyebrow">POUR LES EXPATRIÉS</p>
      <h2 style="color:#fff;" data-i18n="about.expatTitle"></h2>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <p data-i18n="about.expatIntro"></p>
      <h3 data-i18n="about.expatWhyTitle"></h3>
      <ul>
        <li data-i18n="about.expatBullet1"></li>
        <li data-i18n="about.expatBullet2"></li>
        <li data-i18n="about.expatBullet3"></li>
        <li data-i18n="about.expatBullet4"></li>
        <li data-i18n="about.expatBullet5"></li>
      </ul>
      <h3 data-i18n="about.expatProcessTitle"></h3>
      <p data-i18n="about.expatProcessText"></p>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/about-page.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/about.html tests/about-page.test.js
git commit -m "feat: build the about page"
```

---

### Task 13: Services page

**Files:**
- Create: `public/services.html`
- Create: `tests/services-page.test.js`

**Interfaces:**
- Consumes: `window.EfieldPartials.init()` (Task 10), `services.*` i18n keys (Task 9)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/services-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('services page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/services.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="site-footer"/);
    assert.match(html, /data-i18n="services.title"/);
    assert.match(html, /data-i18n="services.service4Text"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/services-page.test.js`
Expected: FAIL — `/services.html` returns 404

- [ ] **Step 3: Write `public/services.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nos services — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <p class="eyebrow" data-i18n="services.eyebrow">NOS SERVICES</p>
        <h1 data-i18n="services.title">Des solutions immobilières complètes</h1>
        <p data-i18n="services.intro"></p>
      </div>
      <div class="card-grid">
        <div class="service-card">
          <img src="/img/services/land.png" alt="Achat et vente de terrains">
          <div class="card-body"><h3 data-i18n="services.service1Title"></h3><p data-i18n="services.service1Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/brand/divider-plots.png" alt="Morcellement">
          <div class="card-body"><h3 data-i18n="services.service2Title"></h3><p data-i18n="services.service2Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/services/construction.png" alt="Construction">
          <div class="card-body"><h3 data-i18n="services.service3Title"></h3><p data-i18n="services.service3Text"></p></div>
        </div>
        <div class="service-card">
          <img src="/img/services/investment.png" alt="Investissement expatriés">
          <div class="card-body"><h3 data-i18n="services.service4Title"></h3><p data-i18n="services.service4Text"></p></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-alt" style="text-align:center;">
    <div class="container">
      <h2 data-i18n="home.contactCtaTitle"></h2>
      <p data-i18n="home.contactCtaIntro"></p>
      <a class="btn btn-primary" href="/contact.html" data-i18n="home.contactCtaButton"></a>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/services-page.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/services.html tests/services-page.test.js
git commit -m "feat: build the services page"
```

---

### Task 14: Nos Biens page (search, filter, listing grid)

**Files:**
- Create: `public/properties.html`
- Create: `public/js/properties.js`
- Create: `tests/properties-page.test.js`

**Interfaces:**
- Consumes: `GET /api/properties` with query filters (Task 4), `window.EfieldPartials.init()` / `window.EfieldI18n.t()` (Tasks 9–10)
- Produces: nothing consumed by later tasks (leaf page). Links to `property.html?id=<id>` (Task 15).

- [ ] **Step 1: Write the failing test**

`tests/properties-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('properties page has the expected search form and grid', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/properties.html`)).text();
    assert.match(html, /id="site-header"/);
    assert.match(html, /id="search-form"/);
    assert.match(html, /id="advanced-fields"/);
    assert.match(html, /id="properties-grid"/);
    assert.match(html, /src="\/js\/properties\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/properties-page.test.js`
Expected: FAIL — `/properties.html` returns 404

- [ ] **Step 3: Write `public/properties.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nos biens — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="section">
    <div class="container">
      <div class="section-header">
        <h1 data-i18n="propertiesPage.title">Nos Biens</h1>
        <p data-i18n="propertiesPage.intro"></p>
      </div>

      <form class="search-bar" id="search-form">
        <div>
          <label for="status" data-i18n="propertiesPage.statusLabel">Statut</label>
          <select id="status" name="status">
            <option value="" data-i18n="propertiesPage.statusAll">Tous</option>
            <option value="sale" data-i18n="propertiesPage.statusSale">Acheter</option>
            <option value="rent" data-i18n="propertiesPage.statusRent">Louer</option>
            <option value="invest" data-i18n="propertiesPage.statusInvest">Investissement</option>
          </select>
        </div>
        <div>
          <label for="type" data-i18n="propertiesPage.typeLabel">Type</label>
          <select id="type" name="type">
            <option value="" data-i18n="propertiesPage.typeAll">Tous types de biens immobiliers</option>
            <option value="residential-land" data-i18n="propertiesPage.typeLand">Terrain</option>
            <option value="residential-villa" data-i18n="propertiesPage.typeVilla">Villa</option>
            <option value="residential-subdivision" data-i18n="propertiesPage.typeSubdivision">Morcellement</option>
            <option value="commercial-office" data-i18n="propertiesPage.typeOffice">Bureau</option>
          </select>
        </div>
        <div>
          <label for="location" data-i18n="propertiesPage.locationLabel">Localisation</label>
          <input type="text" id="location" name="location" data-i18n-placeholder="propertiesPage.locationPlaceholder">
        </div>
        <button type="submit" class="btn btn-primary" data-i18n="propertiesPage.searchButton">Recherche</button>
        <button type="button" class="search-toggle" id="toggle-advanced" data-i18n="propertiesPage.refineButton">Affiner la recherche</button>

        <div class="search-advanced" id="advanced-fields" hidden>
          <div><label for="minPrice" data-i18n="propertiesPage.priceMinLabel"></label><input type="number" id="minPrice" name="minPrice"></div>
          <div><label for="maxPrice" data-i18n="propertiesPage.priceMaxLabel"></label><input type="number" id="maxPrice" name="maxPrice"></div>
          <div><label for="bedrooms" data-i18n="propertiesPage.bedroomsLabel"></label><input type="number" id="bedrooms" name="bedrooms" min="0"></div>
          <div><label for="garages" data-i18n="propertiesPage.garagesLabel"></label><input type="number" id="garages" name="garages" min="0"></div>
          <div><label for="parking" data-i18n="propertiesPage.parkingLabel"></label><input type="number" id="parking" name="parking" min="0"></div>
          <div><label for="minLandArea" data-i18n="propertiesPage.landAreaLabel"></label><input type="number" id="minLandArea" name="minLandArea"></div>
          <div><label for="minFloorArea" data-i18n="propertiesPage.floorAreaLabel"></label><input type="number" id="minFloorArea" name="minFloorArea"></div>
        </div>
      </form>

      <p id="no-results" data-i18n="propertiesPage.noResults" hidden></p>
      <div class="card-grid" id="properties-grid" style="margin-top:2rem;"></div>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script src="/js/properties.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

- [ ] **Step 4: Write `public/js/properties.js`**

```js
(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  let lastResults = [];

  function renderResults(properties) {
    const grid = document.getElementById('properties-grid');
    const noResults = document.getElementById('no-results');
    const lang = currentLang();
    if (!properties.length) {
      grid.innerHTML = '';
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;
    const bedroomsLabel = (window.EfieldI18n && window.EfieldI18n.t('propertiesPage.bedroomsLabel')) || '';
    grid.innerHTML = properties.map((p) => `
      <a class="property-card" href="/property.html?id=${p.id}">
        <img src="${p.primaryImage || '/img/brand/hero-home.png'}" alt="${lang === 'en' ? p.title_en : p.title_fr}">
        <div class="card-body">
          <h3>${lang === 'en' ? p.title_en : p.title_fr}</h3>
          <p class="price">${formatPrice(p)}</p>
          <p class="meta">
            <span>${p.location}</span>
            ${p.bedrooms ? `<span>${p.bedrooms} ${bedroomsLabel}</span>` : ''}
          </p>
        </div>
      </a>
    `).join('');
  }

  function formToQuery(form) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  async function runSearch(form) {
    const query = formToQuery(form);
    const res = await fetch(`/api/properties${query ? '?' + query : ''}`);
    lastResults = await res.json();
    renderResults(lastResults);
  }

  function fillFormFromUrl(form) {
    const urlParams = new URLSearchParams(window.location.search);
    let hasAdvanced = false;
    urlParams.forEach((value, key) => {
      const field = form.elements.namedItem(key);
      if (field) {
        field.value = value;
        if (!['status', 'type', 'location'].includes(key)) hasAdvanced = true;
      }
    });
    if (hasAdvanced) document.getElementById('advanced-fields').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const advanced = document.getElementById('advanced-fields');
    const toggleBtn = document.getElementById('toggle-advanced');

    toggleBtn.addEventListener('click', () => { advanced.hidden = !advanced.hidden; });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(form);
    });

    fillFormFromUrl(form);
    runSearch(form);
  });

  document.addEventListener('efield:lang-changed', () => renderResults(lastResults));
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/properties-page.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/properties.html public/js/properties.js tests/properties-page.test.js
git commit -m "feat: build the Nos Biens search and listing page"
```

---

### Task 15: Property detail page (gallery, characteristics, inquiry form)

**Files:**
- Create: `public/property.html`
- Create: `public/js/property-detail.js`
- Create: `tests/property-detail-page.test.js`

**Interfaces:**
- Consumes: `GET /api/properties/:id` (Task 4), `POST /api/inquiries` (Task 6), `window.EfieldPartials.init()` / `EfieldI18n` (Tasks 9–10)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/property-detail-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('property detail page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/property.html`)).text();
    assert.match(html, /id="gallery-main"/);
    assert.match(html, /id="gallery-thumbs"/);
    assert.match(html, /id="characteristics"/);
    assert.match(html, /id="inquiry-form"/);
    assert.match(html, /name="propertyRef"/);
    assert.match(html, /src="\/js\/property-detail\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/property-detail-page.test.js`
Expected: FAIL — `/property.html` returns 404

- [ ] **Step 3: Write `public/property.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Détail du bien — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="section">
    <div class="container">
      <h1 id="property-title"></h1>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:2rem;">
        <div>
          <img id="gallery-main" class="gallery-main" src="" alt="">
          <div class="gallery-thumbs" id="gallery-thumbs"></div>

          <h2 data-i18n="propertyDetail.characteristicsTitle" style="margin-top:2rem;"></h2>
          <div class="characteristics-grid" id="characteristics"></div>

          <h2 data-i18n="propertyDetail.descriptionTitle"></h2>
          <p id="property-description"></p>
        </div>

        <div>
          <h2 data-i18n="propertyDetail.contactFormTitle"></h2>
          <form id="inquiry-form">
            <div class="form-field"><label data-i18n="propertyDetail.refLabel"></label><input type="text" id="refDisplay" name="propertyRef" disabled></div>
            <div class="form-field"><label data-i18n="propertyDetail.nameLabel"></label><input type="text" name="name" required></div>
            <div class="form-field"><label data-i18n="propertyDetail.emailLabel"></label><input type="email" name="email" required></div>
            <div class="form-field"><label data-i18n="propertyDetail.phoneLabel"></label><input type="tel" name="phone"></div>
            <div class="form-field">
              <label data-i18n="propertyDetail.hasPropertyLabel"></label>
              <select name="hasPropertyToSell">
                <option value="yes" data-i18n="propertyDetail.yesLabel"></option>
                <option value="no" data-i18n="propertyDetail.noLabel" selected></option>
              </select>
            </div>
            <div class="form-field"><label data-i18n="propertyDetail.messageLabel"></label><textarea name="message" rows="4" required></textarea></div>
            <button type="submit" class="btn btn-primary" data-i18n="propertyDetail.sendButton"></button>
            <p class="form-success" id="form-success" hidden data-i18n="propertyDetail.successMessage"></p>
            <p class="form-error" id="form-error" hidden data-i18n="propertyDetail.errorMessage"></p>
          </form>
        </div>
      </div>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script src="/js/property-detail.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

Note: `#refDisplay` is a disabled `<input>`, which browsers exclude from `FormData` — so it never overwrites the real `propertyRef` value set programmatically in Step 4's submit handler.

- [ ] **Step 4: Write `public/js/property-detail.js`**

```js
(function () {
  function currentLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function formatPrice(property) {
    return new Intl.NumberFormat('fr-FR').format(property.price) + ' ' + property.currency;
  }

  function getPropertyId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function t(path) {
    const dict = window.__efieldDict || {};
    return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), dict) || '';
  }

  let currentProperty = null;

  function renderProperty(property) {
    const lang = currentLang();
    document.getElementById('property-title').textContent = lang === 'en' ? property.title_en : property.title_fr;
    document.getElementById('property-description').textContent = lang === 'en' ? property.description_en : property.description_fr;

    const images = property.images.length ? property.images : [{ url: '/img/brand/hero-home.png' }];
    document.getElementById('gallery-main').src = images[0].url;
    const thumbs = document.getElementById('gallery-thumbs');
    thumbs.innerHTML = images.map((img) => `<img src="${img.url}" alt="">`).join('');
    thumbs.querySelectorAll('img').forEach((thumb) => {
      thumb.addEventListener('click', () => { document.getElementById('gallery-main').src = thumb.src; });
    });

    const characteristics = [];
    if (property.bedrooms) characteristics.push([t('propertyDetail.bedroomsLabel'), property.bedrooms]);
    if (property.garages) characteristics.push([t('propertyDetail.garagesLabel'), property.garages]);
    if (property.parking) characteristics.push([t('propertyDetail.parkingLabel'), property.parking]);
    if (property.land_area_m2) characteristics.push([t('propertyDetail.landAreaLabel'), `${property.land_area_m2} m²`]);
    if (property.floor_area_m2) characteristics.push([t('propertyDetail.floorAreaLabel'), `${property.floor_area_m2} m²`]);
    characteristics.push([t('propertyDetail.priceLabel'), formatPrice(property)]);
    document.getElementById('characteristics').innerHTML = characteristics
      .map(([label, value]) => `<div><strong>${label}</strong><div>${value}</div></div>`).join('');

    document.getElementById('refDisplay').value = property.id;
  }

  async function loadProperty() {
    const id = getPropertyId();
    if (!id) return;
    const res = await fetch(`/api/properties/${id}`);
    if (!res.ok) return;
    currentProperty = await res.json();
    renderProperty(currentProperty);
  }

  function wireForm() {
    const form = document.getElementById('inquiry-form');
    const success = document.getElementById('form-success');
    const error = document.getElementById('form-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      success.hidden = true; error.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      data.propertyRef = currentProperty ? currentProperty.id : null;
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('inquiry submission failed');
        form.reset();
        success.hidden = false;
      } catch (e) {
        error.hidden = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => { loadProperty(); wireForm(); });
  document.addEventListener('efield:lang-changed', () => { if (currentProperty) renderProperty(currentProperty); });
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/property-detail-page.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/property.html public/js/property-detail.js tests/property-detail-page.test.js
git commit -m "feat: build the property detail page with gallery and inquiry form"
```

---

### Task 16: Contact page

**Files:**
- Create: `public/contact.html`
- Create: `public/js/contact.js`
- Create: `tests/contact-page.test.js`

**Interfaces:**
- Consumes: `POST /api/inquiries` (Task 6), `window.EfieldPartials.init()` (Task 10)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/contact-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('contact page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/contact.html`)).text();
    assert.match(html, /id="contact-form"/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="message"/);
    assert.match(html, /src="\/js\/contact\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contact-page.test.js`
Expected: FAIL — `/contact.html` returns 404

- [ ] **Step 3: Write `public/contact.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <header class="site-header" id="site-header"></header>

  <section class="section">
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
      <div>
        <p class="eyebrow" data-i18n="contact.eyebrow">CONTACTEZ-NOUS</p>
        <h1 data-i18n="contact.title">Contactez-nous</h1>
        <p data-i18n="contact.intro"></p>

        <h3 data-i18n="contact.addressTitle"></h3>
        <p data-i18n="contact.address"></p>
        <h3 data-i18n="contact.phoneTitle"></h3>
        <p>+230 XXX XXXX</p>
        <p data-i18n="contact.phoneHours"></p>
        <h3 data-i18n="contact.emailTitle"></h3>
        <p>efieldimmo@gmail.com</p>
        <p data-i18n="contact.emailNote"></p>
        <p data-i18n="contact.consultNote"></p>
        <p data-i18n="contact.langNote"></p>
      </div>

      <div>
        <h2 data-i18n="contact.formTitle"></h2>
        <form id="contact-form">
          <div class="form-field"><label data-i18n="contact.nameLabel"></label><input type="text" name="name" data-i18n-placeholder="contact.namePlaceholder" required></div>
          <div class="form-field"><label data-i18n="contact.emailLabel"></label><input type="email" name="email" required></div>
          <div class="form-field"><label data-i18n="contact.phoneLabel"></label><input type="tel" name="phone"></div>
          <div class="form-field"><label data-i18n="contact.projectTypeLabel"></label><input type="text" name="projectType" data-i18n-placeholder="contact.projectTypePlaceholder"></div>
          <div class="form-field">
            <label data-i18n="contact.budgetLabel"></label>
            <select name="budgetRange">
              <option value="under5" data-i18n="contact.budgetUnder5"></option>
              <option value="5to15" data-i18n="contact.budget5to15"></option>
              <option value="15to30" data-i18n="contact.budget15to30"></option>
              <option value="over30" data-i18n="contact.budgetOver30"></option>
            </select>
          </div>
          <div class="form-field"><label data-i18n="contact.messageLabel"></label><textarea name="message" rows="4" required></textarea></div>
          <button type="submit" class="btn btn-primary" data-i18n="contact.sendButton"></button>
          <p class="form-success" id="form-success" hidden data-i18n="contact.successMessage"></p>
          <p class="form-error" id="form-error" hidden data-i18n="contact.errorMessage"></p>
        </form>
      </div>
    </div>
  </section>

  <footer class="site-footer" id="site-footer"></footer>

  <script src="/js/i18n.js"></script>
  <script src="/js/partials.js"></script>
  <script src="/js/contact.js"></script>
  <script>document.addEventListener('DOMContentLoaded', () => window.EfieldPartials.init());</script>
</body>
</html>
```

- [ ] **Step 4: Write `public/js/contact.js`**

```js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
    const error = document.getElementById('form-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      success.hidden = true; error.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('contact submission failed');
        form.reset();
        success.hidden = false;
      } catch (e) {
        error.hidden = false;
      }
    });
  });
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/contact-page.test.js`
Expected: PASS

- [ ] **Step 6: Run the full frontend + backend test suite**

Run: `node --test tests/`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add public/contact.html public/js/contact.js tests/contact-page.test.js
git commit -m "feat: build the contact page"
```

---

### Task 17: Admin login page

**Files:**
- Create: `public/css/admin.css`
- Create: `public/admin/login.html`
- Create: `public/js/admin.js`
- Create: `tests/admin-login-page.test.js`

**Interfaces:**
- Consumes: `POST /admin/api/login` (Task 3)
- Produces: `wireLoginForm()` (internal to `public/js/admin.js`, extended by Task 18 with dashboard wiring in the same file)

- [ ] **Step 1: Write the failing test**

`tests/admin-login-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('admin login page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/admin/login.html`)).text();
    assert.match(html, /id="login-form"/);
    assert.match(html, /name="username"/);
    assert.match(html, /name="password"/);
    assert.match(html, /src="\/js\/admin\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-login-page.test.js`
Expected: FAIL — `/admin/login.html` returns 404

- [ ] **Step 3: Write `public/css/admin.css`**

```css
body.admin-body { background: var(--color-cream); }
.login-card { max-width: 400px; margin: 4rem auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); text-align: center; }
.admin-shell { padding: 2rem 1.5rem; }
.admin-topbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; }
.tab-buttons { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.tab-buttons button { padding: 0.5em 1em; border: 1px solid var(--color-gold); background: #fff; cursor: pointer; border-radius: 4px; font-family: var(--font-body); }
.tab-buttons button.active { background: var(--color-gold); color: #fff; }
.tab-panel[hidden] { display: none; }
.admin-table { width: 100%; border-collapse: collapse; margin-top: 1rem; background: #fff; }
.admin-table th, .admin-table td { text-align: left; padding: 0.6em; border-bottom: 1px solid var(--color-cream); }
.property-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.image-thumb-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0; }
.image-thumb-row span { position: relative; }
.image-thumb-row img { width: 80px; height: 60px; object-fit: cover; border-radius: 4px; }
.image-thumb-row button { position: absolute; top: -6px; right: -6px; background: #b3261e; color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; }
```

- [ ] **Step 4: Write `public/admin/login.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion admin — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="admin-body">
  <div class="login-card">
    <img src="/img/brand/logo.png" alt="EFIELD IMMO" style="height:60px;margin-bottom:1.5rem;">
    <h1>Espace admin</h1>
    <form id="login-form">
      <div class="form-field"><label>Nom d'utilisateur</label><input type="text" name="username" required></div>
      <div class="form-field"><label>Mot de passe</label><input type="password" name="password" required></div>
      <button type="submit" class="btn btn-primary">Se connecter</button>
      <p class="form-error" id="login-error" hidden>Identifiants invalides.</p>
    </form>
  </div>
  <script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `public/js/admin.js`**

```js
(function () {
  async function api(path, options) {
    return fetch(path, { credentials: 'same-origin', ...options });
  }

  function wireLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) {
        window.location.href = '/admin/dashboard.html';
      } else {
        document.getElementById('login-error').hidden = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireLoginForm();
  });

  window.EfieldAdminApi = { api };
})();
```

Note: `window.EfieldAdminApi` exposes the `api()` helper so Task 18 can extend this same file with dashboard logic without redefining the fetch wrapper.

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/admin-login-page.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/css/admin.css public/admin/login.html public/js/admin.js tests/admin-login-page.test.js
git commit -m "feat: build the admin login page"
```

---

### Task 18: Admin dashboard (property CRUD UI + inquiries table)

**Files:**
- Create: `public/admin/dashboard.html`
- Modify: `public/js/admin.js` (add dashboard wiring alongside the Task 17 login wiring)
- Create: `tests/admin-dashboard-page.test.js`

**Interfaces:**
- Consumes: `api()` helper (Task 17, same file), `GET /api/properties`/`GET /api/properties/:id` (Task 4), `GET/POST/PUT/DELETE /admin/api/properties(/:id)`, `POST/DELETE .../images` (Task 5), `GET /admin/api/inquiries` (Task 6), `GET /admin/api/session` + `POST /admin/api/logout` (Task 3)
- Produces: nothing consumed by later tasks (leaf page)

- [ ] **Step 1: Write the failing test**

`tests/admin-dashboard-page.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers');

test('admin dashboard page has the expected structure', async () => {
  const { baseUrl, close } = startTestApp();
  try {
    const html = await (await fetch(`${baseUrl}/admin/dashboard.html`)).text();
    assert.match(html, /id="properties-tbody"/);
    assert.match(html, /id="property-form"/);
    assert.match(html, /id="image-upload-section"/);
    assert.match(html, /id="inquiries-tbody"/);
    assert.match(html, /id="logout-btn"/);
    assert.match(html, /src="\/js\/admin\.js"/);
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-dashboard-page.test.js`
Expected: FAIL — `/admin/dashboard.html` returns 404

- [ ] **Step 3: Write `public/admin/dashboard.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tableau de bord — EFIELD IMMO</title>
  <link rel="icon" href="/favicon.png">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="admin-body">
  <div class="container admin-shell">
    <div class="admin-topbar">
      <img src="/img/brand/logo.png" alt="EFIELD IMMO" style="height:44px;">
      <div>
        <span id="admin-username"></span>
        <button type="button" class="btn btn-outline-dark" id="logout-btn">Déconnexion</button>
      </div>
    </div>

    <div class="tab-buttons">
      <button type="button" data-tab="properties" class="active">Biens</button>
      <button type="button" data-tab="inquiries">Messages</button>
    </div>

    <div class="tab-panel" id="tab-properties">
      <button type="button" class="btn btn-primary" id="new-property-btn">+ Ajouter un bien</button>
      <table class="admin-table">
        <thead><tr><th>Titre</th><th>Statut</th><th>Lieu</th><th>Prix</th><th>Vedette</th><th></th></tr></thead>
        <tbody id="properties-tbody"></tbody>
      </table>

      <div id="property-form-section" hidden>
        <h2 id="property-form-title">Nouveau bien</h2>
        <form id="property-form">
          <div class="property-form-grid">
            <div class="form-field"><label>Statut</label>
              <select name="status"><option value="sale">Vente</option><option value="rent">Location</option><option value="invest">Investissement</option></select>
            </div>
            <div class="form-field"><label>Type</label>
              <select name="type">
                <option value="residential-land">Terrain</option>
                <option value="residential-villa">Villa</option>
                <option value="residential-subdivision">Morcellement</option>
                <option value="commercial-office">Bureau</option>
              </select>
            </div>
            <div class="form-field"><label>Titre (FR)</label><input type="text" name="title_fr" required></div>
            <div class="form-field"><label>Titre (EN)</label><input type="text" name="title_en" required></div>
            <div class="form-field"><label>Localisation</label><input type="text" name="location" required></div>
            <div class="form-field"><label>Prix (MUR)</label><input type="number" name="price" required></div>
            <div class="form-field"><label>Chambres</label><input type="number" name="bedrooms" value="0"></div>
            <div class="form-field"><label>Garages</label><input type="number" name="garages" value="0"></div>
            <div class="form-field"><label>Parking</label><input type="number" name="parking" value="0"></div>
            <div class="form-field"><label>Superficie terrain (m²)</label><input type="number" name="land_area_m2"></div>
            <div class="form-field"><label>Superficie au sol (m²)</label><input type="number" name="floor_area_m2"></div>
            <div class="form-field"><label><input type="checkbox" name="featured"> En vedette</label></div>
          </div>
          <div class="form-field"><label>Description (FR)</label><textarea name="description_fr" rows="3" required></textarea></div>
          <div class="form-field"><label>Description (EN)</label><textarea name="description_en" rows="3" required></textarea></div>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
          <button type="button" class="btn btn-outline-dark" id="cancel-property-btn">Annuler</button>
        </form>

        <div id="image-upload-section" hidden>
          <h3>Photos</h3>
          <div class="image-thumb-row" id="image-thumb-row"></div>
          <input type="file" id="image-file-input" multiple accept="image/*">
        </div>
      </div>
    </div>

    <div class="tab-panel" id="tab-inquiries" hidden>
      <table class="admin-table">
        <thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Bien</th><th>Message</th></tr></thead>
        <tbody id="inquiries-tbody"></tbody>
      </table>
    </div>
  </div>

  <script src="/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 4: Replace `public/js/admin.js` with the login wiring plus dashboard wiring**

```js
(function () {
  async function api(path, options) {
    return fetch(path, { credentials: 'same-origin', ...options });
  }

  function wireLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const res = await api('/admin/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) {
        window.location.href = '/admin/dashboard.html';
      } else {
        document.getElementById('login-error').hidden = false;
      }
    });
  }

  let allProperties = [];
  let currentEditId = null;

  function renderPropertiesTable() {
    const tbody = document.getElementById('properties-tbody');
    if (!tbody) return;
    tbody.innerHTML = allProperties.map((p) => `
      <tr>
        <td>${p.title_fr}</td>
        <td>${p.status}</td>
        <td>${p.location}</td>
        <td>${p.price}</td>
        <td>${p.featured ? 'Oui' : 'Non'}</td>
        <td>
          <button type="button" data-edit="${p.id}">Modifier</button>
          <button type="button" data-delete="${p.id}">Supprimer</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openPropertyForm(Number(btn.getAttribute('data-edit'))));
    });
    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteProperty(Number(btn.getAttribute('data-delete'))));
    });
  }

  async function loadProperties() {
    const res = await api('/api/properties');
    allProperties = await res.json();
    renderPropertiesTable();
  }

  async function deleteProperty(id) {
    if (!window.confirm('Supprimer ce bien ?')) return;
    await api(`/admin/api/properties/${id}`, { method: 'DELETE' });
    await loadProperties();
  }

  function fillFormWithProperty(property) {
    const form = document.getElementById('property-form');
    Object.entries(property).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = !!value;
      else field.value = value == null ? '' : value;
    });
  }

  function renderImageThumbs(property) {
    const row = document.getElementById('image-thumb-row');
    row.innerHTML = (property.images || []).map((img) => `
      <span><img src="${img.url}" alt=""><button type="button" data-remove-image="${img.id}">x</button></span>
    `).join('');
    row.querySelectorAll('[data-remove-image]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/admin/api/properties/${property.id}/images/${btn.getAttribute('data-remove-image')}`, { method: 'DELETE' });
        const updated = await (await api(`/api/properties/${property.id}`)).json();
        renderImageThumbs(updated);
      });
    });
  }

  async function openPropertyForm(id) {
    const section = document.getElementById('property-form-section');
    if (!section) return;
    section.hidden = false;
    document.getElementById('property-form').reset();
    document.getElementById('image-upload-section').hidden = true;
    if (id) {
      currentEditId = id;
      document.getElementById('property-form-title').textContent = 'Modifier le bien';
      const property = await (await api(`/api/properties/${id}`)).json();
      fillFormWithProperty(property);
      document.getElementById('image-upload-section').hidden = false;
      renderImageThumbs(property);
    } else {
      currentEditId = null;
      document.getElementById('property-form-title').textContent = 'Nouveau bien';
    }
  }

  function wirePropertyForm() {
    const newBtn = document.getElementById('new-property-btn');
    if (!newBtn) return;
    newBtn.addEventListener('click', () => openPropertyForm(null));
    document.getElementById('cancel-property-btn').addEventListener('click', () => {
      document.getElementById('property-form-section').hidden = true;
    });

    const form = document.getElementById('property-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.featured = form.elements.namedItem('featured').checked;
      const method = currentEditId ? 'PUT' : 'POST';
      const url = currentEditId ? `/admin/api/properties/${currentEditId}` : '/admin/api/properties';
      const res = await api(url, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await res.json();
      currentEditId = currentEditId || result.id;
      await loadProperties();
      await openPropertyForm(currentEditId);
    });

    document.getElementById('image-file-input').addEventListener('change', async (event) => {
      if (!currentEditId || !event.target.files.length) return;
      const formData = new FormData();
      Array.from(event.target.files).forEach((file) => formData.append('images', file));
      await api(`/admin/api/properties/${currentEditId}/images`, { method: 'POST', body: formData });
      const updated = await (await api(`/api/properties/${currentEditId}`)).json();
      renderImageThumbs(updated);
      event.target.value = '';
    });
  }

  function renderInquiriesTable(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    if (!tbody) return;
    tbody.innerHTML = inquiries.map((i) => `
      <tr>
        <td>${new Date(i.created_at).toLocaleString()}</td>
        <td>${i.name}</td>
        <td>${i.email}</td>
        <td>${i.phone || ''}</td>
        <td>${i.property_ref || ''}</td>
        <td>${i.message}</td>
      </tr>
    `).join('');
  }

  async function loadInquiries() {
    const res = await api('/admin/api/inquiries');
    renderInquiriesTable(await res.json());
  }

  function wireTabs() {
    const buttons = document.querySelectorAll('.tab-buttons button');
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-properties').hidden = btn.getAttribute('data-tab') !== 'properties';
        document.getElementById('tab-inquiries').hidden = btn.getAttribute('data-tab') !== 'inquiries';
        if (btn.getAttribute('data-tab') === 'inquiries') loadInquiries();
      });
    });
  }

  function wireLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      await api('/admin/api/logout', { method: 'POST' });
      window.location.href = '/admin/login.html';
    });
  }

  async function initDashboard() {
    const usernameEl = document.getElementById('admin-username');
    if (!usernameEl) return;
    const sessionRes = await api('/admin/api/session');
    if (!sessionRes.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
    const session = await sessionRes.json();
    usernameEl.textContent = session.username;
    wireTabs();
    wirePropertyForm();
    wireLogout();
    await loadProperties();
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireLoginForm();
    initDashboard();
  });
})();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/admin-dashboard-page.test.js`
Expected: PASS

- [ ] **Step 6: Run the full test suite**

Run: `node --test tests/`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add public/admin/dashboard.html public/js/admin.js tests/admin-dashboard-page.test.js
git commit -m "feat: build the admin dashboard for property CRUD and inquiries"
```

---

### Task 19: npm scripts, README, and manual smoke test

**Files:**
- Modify: `package.json` (add `scripts`)
- Create: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–18
- Produces: nothing (final integration task)

- [ ] **Step 1: Add scripts to `package.json`**

Open `package.json` and set the `"scripts"` field to:
```json
"scripts": {
  "start": "node server/index.js",
  "seed": "node server/seed.js",
  "test": "node --test tests/"
}
```

- [ ] **Step 2: Run the full test suite one more time**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 3: Write `README.md`**

```markdown
# EFIELD IMMO Website

Bilingual (FR/EN) real-estate site for EFIELD IMMO (Île Maurice), with a
public marketing + property-search site and a small admin panel for
managing listings and viewing form submissions. Single Node/Express app,
SQLite database, no external services.

## Setup

\`\`\`bash
npm install
cp .env.example .env
\`\`\`

Edit `.env` and set a real `SESSION_SECRET`, `ADMIN_USERNAME` and
`ADMIN_PASSWORD` before running the seed script anywhere beyond local dev.

## Seed the database

\`\`\`bash
npm run seed
\`\`\`

Creates the admin account (from `.env`) and 3 sample property listings.
Safe to re-run — it will not duplicate properties if they already exist,
but will update the admin password if `.env` changes.

## Run

\`\`\`bash
npm start
\`\`\`

Visit `http://localhost:3000` for the public site and
`http://localhost:3000/admin/login.html` for the admin panel.

## Tests

\`\`\`bash
npm test
\`\`\`

## Project structure

- `server/` — Express app, routes, SQLite schema, seed script
- `public/` — static site (plain HTML/CSS/vanilla JS), `public/admin/` for
  the admin panel, `public/i18n/` for the FR/EN dictionaries
- `data/` — SQLite database file lives here at runtime (gitignored)
- `tests/` — `node --test` suite covering every route and the seed script

## Deployment note

This runs identically on any host that can run a Node.js process: set
`PORT`, `DB_PATH`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` as
environment variables, run `npm install && npm run seed && npm start`, and
persist the SQLite file at `DB_PATH` across restarts/deploys.
```

- [ ] **Step 4: Manual smoke test (perform in a real browser against `npm start`)**

Run `npm run seed` then `npm start`, then in a browser check each of the
following. This is the verification called out in the spec's Testing plan
(no automated browser test framework is introduced for this project):

- [ ] Home page loads, hero image and 3 CTA buttons are visible, "Nos nouveautés"/featured properties section shows the 3 seeded properties, stats band and testimonials render.
- [ ] Clicking the `EN` toggle switches all visible text to English instantly (no reload); switching back to `FR` restores French; the choice persists after a page refresh.
- [ ] Nav links reach About, Services, Nos Biens, Contact; each page renders with header/footer/WhatsApp button.
- [ ] On Nos Biens: default view shows all 3 properties; filtering by Status/Type/Location narrows results; "Affiner la recherche" reveals the extra fields and a price/bedroom filter narrows results further; an out-of-range filter shows the "no results" message.
- [ ] Clicking a property card opens its detail page with the correct gallery (clicking a thumbnail swaps the main image), characteristics, and description in the current language.
- [ ] Submitting the property inquiry form with valid data shows the success message and clears the form; submitting with a missing required field is blocked by the browser's built-in validation.
- [ ] Submitting the Contact page form succeeds the same way.
- [ ] The WhatsApp floating button opens `https://wa.me/...` in a new tab.
- [ ] Visiting `/admin/dashboard.html` directly while logged out redirects to `/admin/login.html`.
- [ ] Logging in with the wrong password shows an error; logging in with the seeded admin credentials reaches the dashboard and shows the 3 seeded properties in the table.
- [ ] Adding a new property through the dashboard form makes it appear both in the admin table and on the public Nos Biens page; uploading images for it shows thumbnails in the dashboard and on the public detail page.
- [ ] Editing a property's price/title and deleting a property are both reflected immediately on the public site.
- [ ] The "Messages" tab lists the inquiries submitted earlier in this checklist, newest first.
- [ ] Logging out returns to the login page, and the dashboard is no longer reachable without logging in again.
- [ ] Resize the browser to a mobile width and confirm the layout doesn't overflow horizontally on the home, Nos Biens, and property detail pages.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "chore: add npm scripts and README with setup and smoke-test instructions"
```
