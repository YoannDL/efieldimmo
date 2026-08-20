# EFIELD IMMO Website — Design Spec

Date: 2026-08-20

## 1. Purpose

Build a real-estate agency website for EFIELD IMMO (Île Maurice / Mauritius),
covering both a public marketing + property-search site and a minimal admin
panel for the client to manage property listings and view form submissions,
without needing a database administrator or a third-party CMS.

Source material (all in the project root):
- `PROJET WEB EFIELD IMMO.pdf` — sitemap, page-by-page wireframe notes, search
  filter fields, listing/detail layout references.
- `Presentation efield immo.pptx` — full page copy (hero, stats, services,
  differentiators, expat/tax info, testimonials, contact, footer) and 3
  sample property listings.
- `CHARTE GRAPHIQUE EFIED IMMO.docx` — color palette, typography, photo
  direction.
- `Logo EFIELD IMMO sur fond transparent BV1.png` — logo, transparent
  background.
- `PICS/` — premium aerial/lifestyle photography and abstract brand
  illustrations (gold/green/tropical, matching the palette).
- `dm-sans.zip`, `libre-baskerville.zip` — the two brand font families.

## 2. Scope decisions (confirmed with client)

- **Hero media**: static photo (one of the provided premium images), not
  video — no video file was supplied.
- **Chat**: floating WhatsApp click-to-chat button instead of an AI chatbot.
- **Forms**: contact + property-inquiry submissions are saved directly to
  the app's own database and viewable in the admin panel (no third-party
  form service).
- **Listings data**: real backend + minimal admin panel for CRUD, seeded
  with the 3 sample properties from the presentation.
- **Language**: bilingual FR/EN with a client-side toggle. French copy comes
  directly from the source documents; English is a translation of it.
- **Explicitly out of scope**: multi-admin roles/permissions, image
  CDN/optimization pipeline, real AI chatbot, payment processing, anything
  beyond one admin account.

## 3. Architecture

Single self-contained **Node.js + Express** app, one process, backed by
**SQLite** (file-based, no separate DB server). Chosen over a split
frontend/backend or a BaaS (e.g. Supabase) because it has zero external
service dependencies, is trivial to run locally (`npm start`) and to deploy
on almost any low-cost host or small VPS, and keeps the "as simple as
possible but fully working" brief.

```
/server
  app.js                 – Express app, static file serving, route mounting
  db.js                  – SQLite connection + schema bootstrap/migrations
  routes/
    properties.js         – public GET endpoints (list + filter, detail)
    inquiries.js           – POST contact form / property inquiry
    admin.js               – login, session check, CRUD for properties,
                              list submitted inquiries
  middleware/auth.js      – session-based admin auth guard
/public
  index.html, about.html, services.html, properties.html,
  property.html, contact.html
  /css, /js, /img (brand assets copied in), /fonts (DM Sans, Libre
  Baskerville, self-hosted from the provided zips)
  /i18n/fr.json, /i18n/en.json
/admin (served by the same app, guarded by auth middleware)
  login.html, dashboard.html (list/add/edit/delete listings, view inquiries)
```

No frontend build step / framework — plain HTML/CSS/vanilla JS keeps the
"low-cost, mainly frontend" spirit for the public site, while the admin
panel is deliberately minimal (plain forms, no SPA framework).

## 4. Data model (SQLite)

**properties**
`id, status (sale/rent/invest), type (residential/commercial + subtype),
title_fr, title_en, description_fr, description_en, location, price,
currency, bedrooms, garages, parking, land_area_m2, floor_area_m2,
featured (bool), created_at`

**property_images**
`id, property_id (FK), url, sort_order`

**inquiries**
`id, name, email, phone, property_ref (nullable), has_property_to_sell
(bool, nullable), project_type (nullable), budget_range (nullable),
message, created_at`

**admin_users**
`id, username, password_hash` — single seeded row; no self-registration.

## 5. Public site — pages & content

Matches the sitemap in `PROJET WEB EFIELD IMMO.pdf`:

1. **Home** — full-bleed hero photo with headline "Donnez vie à votre projet
   immobilier à l'île Maurice" + subcopy + 3 CTA buttons: "Voir nos terrains"
   (→ Nos Biens, pre-filtered to land for sale), "Confier mon projet" (→
   Contact), "Rechercher un bien" (→ Nos Biens, unfiltered); "Pourquoi nous" stats band (150+ projets, 15+ years,
   100% accompagnement A-Z, 2x locaux & expatriés); Services preview (4
   cards); Featured properties (3, `featured=true` from DB); Testimonials +
   satisfaction stats; Contact CTA band.
2. **About us** — mission/differentiators content from the presentation
   ("Notre différence": accompagnement personnalisé, transparence totale,
   connaissance du terrain, réseau de partenaires) and the expat/investment
   section (Mauritius tax advantages, PDS/IRS schemes).
3. **Services** — the 4 service cards with full descriptions (Achat & Vente
   de Terrains, Morcellement, Construction, Investissement Expatriés),
   matching the service imagery already in `PICS/`.
4. **Nos Biens** — search bar (status / type / location + "Affiner la
   recherche" expandable row: price min/max, bedrooms, garages, parking,
   land area, floor area) filtering a client-side-rendered grid fed by
   `GET /api/properties`; clicking a card opens the detail page.
5. **Property detail** — photo gallery (main + thumbnails), title,
   characteristics grid, description, inquiry form (posts to
   `POST /api/inquiries` with the property reference pre-filled), WhatsApp
   button.
6. **Contact** — agency info (address, phone/WhatsApp, email, socials),
   general contact form (posts to `POST /api/inquiries`).

Every page: header nav + logo, language toggle (FR/EN), footer (contact
summary, quick links, legal mentions placeholder), WhatsApp floating button.

## 6. Admin panel

- `/admin/login` — username + password → session cookie.
- `/admin` (guarded) — table of properties (edit/delete/add-new), a form for
  create/edit (all fields from the data model, multi-image upload saved to
  `/public/img/properties/`), and a read-only table of inquiries
  (newest first).
- No password-reset flow; the one admin account is seeded via an env var or
  a one-time setup script.

## 7. Visual design

From the brand charter:
- Colors: `#B6A062` (primary gold — CTAs/links/icons), `#F7EDD4` (cream
  accent), `#204C8E` (blue accent), `#FFFDFA` (off-white background),
  `#5C4E3D` (subtitles), `#454240` (body text).
- Type: **Libre Baskerville** for headings/subtitles (H1 very large/bold/
  spaced, H2 elegant semi-bold, H3 medium), **DM Sans** for body text and
  CTAs (CTA = discreet bold). Both self-hosted from the provided font zips.
- Photography: bright, natural, elegant, modern, tropical — use the
  supplied aerial/villa photography and gold-toned abstract illustrations
  as section backgrounds/dividers.

## 8. Testing / verification plan

- Manual smoke test of every page in a real browser (desktop + mobile
  viewport) after implementation: nav, language toggle, property search/
  filter, property detail gallery, both forms submitting successfully and
  appearing in the admin inquiries table, admin login guard (rejects
  unauthenticated access), admin CRUD round-trip (add → appears on Nos
  Biens → edit → delete → disappears).
- No automated test framework is being introduced given the scope; this is
  a content-driven site rather than logic-heavy software.

## 9. Deployment note

Out of scope for this task (client hasn't asked for hosting yet) — the app
is built to run identically locally and on a low-cost Node host later
(`npm start`, `PORT` + admin credentials via environment variables, SQLite
file persisted on disk).
