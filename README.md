# EFIELD IMMO Website

Bilingual (FR/EN) real-estate site for EFIELD IMMO (Île Maurice), with a
public marketing + property-search site and a small admin panel for
managing listings and viewing form submissions. Single Node/Express app,
SQLite database, no external services.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set a real `SESSION_SECRET`, `ADMIN_USERNAME` and
`ADMIN_PASSWORD` before running the seed script anywhere beyond local dev.

## Seed the database

```bash
npm run seed
```

Creates the admin account (from `.env`) and 3 sample property listings.
Safe to re-run — it will not duplicate properties if they already exist,
but will update the admin password if `.env` changes.

## Run

```bash
npm start
```

Visit `http://localhost:3000` for the public site and
`http://localhost:3000/admin/login.html` for the admin panel.

## Tests

```bash
npm test
```

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
