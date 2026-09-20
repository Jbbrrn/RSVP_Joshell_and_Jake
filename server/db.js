const path = require('path');
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}
const mysql = require('mysql2/promise');

const ca = process.env.DB_CA ? process.env.DB_CA.replace(/\\n/g, '\n') : undefined;

module.exports = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: ca ? { ca } : undefined, // Aiven requires SSL
  waitForConnections: true,
  connectionLimit: 5,
});
