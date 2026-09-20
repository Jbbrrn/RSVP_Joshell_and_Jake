const path = require('path');
const fs = require('fs');

const envPaths = [
  path.resolve(__dirname, '../.env'),
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

const pool = require('../db');
const { normalizeName } = require('../normalize');

// Usage:
//   node scripts/add-guest.js "Full Name" "Role" [max_companions]
// Example:
//   node scripts/add-guest.js "Maria Santos" "Ninang" 2

const args = process.argv.slice(2);
const fullName = args[0];
const role = args[1] || 'Guest';
const maxCompanions = args[2] !== undefined ? Number(args[2]) : 2;

if (!fullName || fullName.length < 3) {
  console.log('Usage: node scripts/add-guest.js "<Full Name>" "<Role>" [max_companions]');
  console.log('Example: node scripts/add-guest.js "Maria Santos" "Ninang" 2');
  process.exit(1);
}

const nameKey = normalizeName(fullName);

(async () => {
  try {
    const [res] = await pool.query(
      `INSERT INTO invited_guest (full_name, name_key, role, max_companions)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         role = VALUES(role),
         max_companions = VALUES(max_companions)`,
      [fullName.trim(), nameKey, role.trim(), maxCompanions]
    );
    console.log(`✓ Guest saved: "${fullName.trim()}" (role: ${role}, max companions: ${maxCompanions}, id: ${res.insertId || 'updated'})`);
  } catch (err) {
    console.error('Error adding guest:', err.message);
  } finally {
    await pool.end();
  }
})();

