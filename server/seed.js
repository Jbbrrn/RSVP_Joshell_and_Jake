const path = require('path');
const fs = require('fs');

const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

const pool = require('./db');
const { normalizeName } = require('./normalize');

// Initial guests from design reference
const initialGuests = [
  { fullName: 'Emma Sullivan', role: 'Bridesmaid', maxCompanions: 2 },
  { fullName: 'James Dalton', role: 'Family', maxCompanions: 1 },
  { fullName: 'Mia Kapoor', role: 'Bridesmaid', maxCompanions: 2 },
  { fullName: 'Liam Turner', role: 'Family', maxCompanions: 1 },
  { fullName: 'Ava Singh', role: 'Guest', maxCompanions: 2 },
  { fullName: 'Ethan Wright', role: 'Family', maxCompanions: 1 },
];

async function seed() {
  console.log('Seeding initial guests...');
  for (const g of initialGuests) {
    const key = normalizeName(g.fullName);
    await pool.query(
      `INSERT INTO invited_guest (full_name, name_key, role, max_companions)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role), max_companions = VALUES(max_companions)`,
      [g.fullName, key, g.role, g.maxCompanions]
    );
    console.log(`✓ Added/updated guest: ${g.fullName} (${g.role})`);
  }
  console.log('Done!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

