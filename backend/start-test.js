// Test startup script with better error handling
require('dotenv').config();
const { Pool } = require('pg');

console.log('✅ Environment loaded');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('AZURE_STORAGE_CONNECTION exists:', !!process.env.AZURE_STORAGE_CONNECTION);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

console.log('✅ Pool created');

// Test database connection
pool.query('SELECT NOW() as time, current_database() as db')
  .then(result => {
    console.log('✅ Database connected:', result.rows[0]);
    
    // Test if tables exist
    return pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  })
  .then(result => {
    console.log('✅ Tables found:', result.rows.map(r => r.table_name).join(', '));
    
    // Test users table
    return pool.query('SELECT COUNT(*) as count FROM users');
  })
  .then(result => {
    console.log('✅ Users count:', result.rows[0].count);
    console.log('\n🎉 All checks passed! Starting main server...\n');
    
    // Now start the actual server
    require('./index.js');
    
    // Keep process alive
    console.log('✅ Server should be running. Press Ctrl+C to stop.\n');
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});
