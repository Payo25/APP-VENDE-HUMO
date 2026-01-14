const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://surgicaladmin:Alondra2633658$@surgical-db-new.postgres.database.azure.com:5432/postgres?sslmode=require";

const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    // Find Veronica Millan
    const usersResult = await pool.query(
      "SELECT id, username, fullname FROM users WHERE username LIKE '%millan%' OR fullname LIKE '%Millan%'"
    );
    
    console.log('=== USER INFO ===');
    console.log(usersResult.rows);
    
    if (usersResult.rows.length > 0) {
      const user = usersResult.rows[0];
      const userId = user.id;
      
      // Count forms
      const formsResult = await pool.query(
        'SELECT COUNT(*) as count FROM forms WHERE createdbyuserid = $1',
        [userId]
      );
      
      console.log(`\n=== FORMS COUNT FOR ${user.fullname} ===`);
      console.log(`Total forms: ${formsResult.rows[0].count}`);
      
      // Get recent forms
      const recentForms = await pool.query(
        'SELECT id, patientname, date, lastmodified FROM forms WHERE createdbyuserid = $1 ORDER BY lastmodified DESC LIMIT 5',
        [userId]
      );
      
      console.log('\n=== MOST RECENT 5 FORMS ===');
      console.table(recentForms.rows);
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
