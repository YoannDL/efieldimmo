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
