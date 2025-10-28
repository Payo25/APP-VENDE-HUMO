require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

async function addFaxEmailColumns() {
  try {
    console.log('Adding fax and email columns to health_centers table...');
    
    await pool.query(`
      ALTER TABLE health_centers 
      ADD COLUMN IF NOT EXISTS fax VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
    
    console.log('✅ Successfully added fax and email columns to health_centers table');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding columns:', err);
    process.exit(1);
  }
}

addFaxEmailColumns();
