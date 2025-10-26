require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

async function addHourlyRateColumn() {
  try {
    // Add hourly_rate column if it doesn't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 3.00
    `);
    console.log('✅ Added hourly_rate column to users table');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addHourlyRateColumn();
