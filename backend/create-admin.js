require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

async function createAdminUser() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Try to insert admin user
    const result = await pool.query(`
      INSERT INTO users (username, password, fullname, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) 
      DO UPDATE SET password = $2, fullname = $3, role = $4
      RETURNING id, username, fullname, role
    `, ['admin@example.com', hashedPassword, 'Admin User', 'Admin']);
    
    console.log('✅ Admin user created/updated successfully:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('   User ID:', result.rows[0].id);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin user:', err.message);
    process.exit(1);
  }
}

createAdminUser();
