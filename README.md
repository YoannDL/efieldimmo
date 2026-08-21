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

Notes:
- The project pins `ignore-scripts=true` in `.npmrc`: all dependencies ship
  prebuilt binaries, so no compiler toolchain is ever needed. Use `npm`
  (not pnpm/yarn) to keep the lockfile consistent.
- Optional email notifications: fill in the `SMTP_*` and `NOTIFY_EMAIL`
  variables in `.env` to receive an email for every inquiry. Left empty,
  inquiries are still stored and visible in the admin panel.

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

## Feature highlights

- Bilingual FR/EN with a header toggle; property search filters (type,
  location suggestions) auto-populate from the admin-managed categories.
- Clicking a property opens a modal with gallery, characteristics, map,
  a Print/PDF button and an inquiry form pre-filled with the reference.
- WhatsApp floating button; while a property is open the link is pre-filled
  with a message referencing that property.
- Admin panel: property CRUD (photos are auto-resized to max 1600px JPEG),
  availability (available / reserved / sold shown as badges), featured
  ordering, "Nouveauté" badge for listings under 30 days, category
  management, inquiry follow-up statuses, and a 30-day view-count report.
- Admin-defined search criteria: create a criterion (name FR/EN + type
  "yes/no" or "number", e.g. Piscine or Salles de bain) and it appears in
  the public "Affiner la recherche" panel, on the property form, and in
  the property characteristics automatically.
- Content management: the "Contenu" admin tab edits every text on the site
  (FR and EN, stored as database overrides on top of the defaults in
  public/i18n/) plus site settings: WhatsApp number, displayed phone and
  email, and social media links.

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
