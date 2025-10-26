require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

async function testLogin() {
  try {
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin@example.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('✅ User found:');
    console.log('   Username:', user.username);
    console.log('   Full Name:', user.fullname);
    console.log('   Role:', user.role);
    console.log('   Password hash:', user.password.substring(0, 20) + '...');
    
    // Test password
    const testPassword = 'admin123';
    const match = await bcrypt.compare(testPassword, user.password);
    
    if (match) {
      console.log('✅ Password "admin123" is CORRECT');
    } else {
      console.log('❌ Password "admin123" does NOT match');
      console.log('Creating new password hash...');
      
      const newHash = await bcrypt.hash('admin123', 10);
      await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newHash, 'admin@example.com']);
      console.log('✅ Password updated successfully');
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testLogin();
