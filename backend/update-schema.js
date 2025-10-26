require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

async function updateSchema() {
  try {
    const sql = fs.readFileSync('schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Schema updated successfully!');
    console.log('✅ health_centers table created');
    console.log('✅ Default health centers added');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating schema:', err.message);
    process.exit(1);
  }
}

updateSchema();
