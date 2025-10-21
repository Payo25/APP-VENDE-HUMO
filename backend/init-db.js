require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

async function initDatabase() {
  try {
    // Read the schema file
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    console.log('Database schema created successfully');

    // Create an admin user if it doesn't exist
    const adminPassword = await require('bcryptjs').hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (username, password, fullname, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
    `, ['admin@example.com', adminPassword, 'Admin User', 'Admin']);
    
    console.log('Admin user created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

initDatabase();