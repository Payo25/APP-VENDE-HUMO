/**
 * Migration script to add assistant_type column to forms table
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addAssistantTypeColumn() {
  try {
    console.log('Adding assistant_type column to forms table...');
    
    await pool.query(`
      ALTER TABLE forms 
      ADD COLUMN IF NOT EXISTS assistanttype VARCHAR(50);
    `);
    
    console.log('✓ Successfully added assistant_type column');
    console.log('Note: Existing records will have NULL for this field');
    
    process.exit(0);
  } catch (err) {
    console.error('Error adding assistant_type column:', err);
    process.exit(1);
  }
}

addAssistantTypeColumn();
