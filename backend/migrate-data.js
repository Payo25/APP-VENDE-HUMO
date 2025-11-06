// Migrate data from OLD database to NEW database
const { Pool } = require('pg');

// OLD database connection
const oldPool = new Pool({
    connectionString: 'postgresql://surgical_admin:Alondra2633658$@surgical-db-server.postgres.database.azure.com:5432/surgical_forms?sslmode=require'
});

// NEW database connection
const newPool = new Pool({
    connectionString: 'postgresql://surgicaladmin:Alondra2633658$@surgical-db-new.postgres.database.azure.com:5432/surgical_forms?sslmode=require'
});

async function migrateData() {
    console.log('🚀 Starting data migration...\n');
    
    try {
        // 1. Migrate users (but skip the admin we already created)
        console.log('📋 Migrating users...');
        const usersResult = await oldPool.query('SELECT * FROM users ORDER BY id');
        for (const user of usersResult.rows) {
            // Skip if username already exists (like admin@example.com)
            const checkUser = await newPool.query('SELECT id FROM users WHERE username = $1', [user.username]);
            if (checkUser.rows.length === 0) {
                await newPool.query(
                    `INSERT INTO users (id, username, password, fullname, role, hourly_rate, createdat, lastmodified) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [user.id, user.username, user.password, user.fullname, user.role, user.hourly_rate, user.createdat, user.lastmodified]
                );
                console.log(`  ✅ Migrated user: ${user.username}`);
            } else {
                console.log(`  ⏭️  Skipped existing user: ${user.username}`);
            }
        }
        
        // Update sequence for users
        await newPool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
        
        // 2. Migrate health_centers (but skip defaults we already have)
        console.log('\n📋 Migrating health_centers...');
        const centersResult = await oldPool.query('SELECT * FROM health_centers ORDER BY id');
        for (const center of centersResult.rows) {
            const checkCenter = await newPool.query('SELECT id FROM health_centers WHERE name = $1', [center.name]);
            if (checkCenter.rows.length === 0) {
                await newPool.query(
                    `INSERT INTO health_centers (id, name, address, phone, createdat, lastmodified) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [center.id, center.name, center.address, center.phone, center.createdat, center.lastmodified]
                );
                console.log(`  ✅ Migrated health center: ${center.name}`);
            } else {
                console.log(`  ⏭️  Skipped existing health center: ${center.name}`);
            }
        }
        
        // Update sequence for health_centers
        await newPool.query(`SELECT setval('health_centers_id_seq', (SELECT MAX(id) FROM health_centers))`);
        
        // 3. Migrate forms
        console.log('\n📋 Migrating forms...');
        const formsResult = await oldPool.query('SELECT * FROM forms ORDER BY id');
        for (const form of formsResult.rows) {
            await newPool.query(
                `INSERT INTO forms (id, patientname, dob, insurancecompany, healthcentername, date, timein, timeout, 
                 doctorname, procedure, casetype, status, createdbyuserid, surgeryformfileurl, createdat, lastmodified) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                [form.id, form.patientname, form.dob, form.insurancecompany, form.healthcentername, form.date, 
                 form.timein, form.timeout, form.doctorname, form.procedure, form.casetype, form.status, 
                 form.createdbyuserid, form.surgeryformfileurl, form.createdat, form.lastmodified]
            );
            console.log(`  ✅ Migrated form #${form.id}: ${form.patientname}`);
        }
        
        // Update sequence for forms
        await newPool.query(`SELECT setval('forms_id_seq', (SELECT MAX(id) FROM forms))`);
        
        // 4. Migrate audit_logs
        console.log('\n📋 Migrating audit_logs...');
        const logsResult = await oldPool.query('SELECT * FROM audit_logs ORDER BY id');
        for (const log of logsResult.rows) {
            await newPool.query(
                `INSERT INTO audit_logs (id, timestamp, action, actor, details) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [log.id, log.timestamp, log.action, log.actor, log.details]
            );
        }
        console.log(`  ✅ Migrated ${logsResult.rows.length} audit log entries`);
        
        // Update sequence for audit_logs
        await newPool.query(`SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs))`);
        
        // 5. Migrate call_hours
        console.log('\n📋 Migrating call_hours...');
        const callHoursResult = await oldPool.query('SELECT * FROM call_hours ORDER BY id');
        for (const callHour of callHoursResult.rows) {
            await newPool.query(
                `INSERT INTO call_hours (id, month, year, assignments, createdat, lastmodified) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [callHour.id, callHour.month, callHour.year, callHour.assignments, callHour.createdat, callHour.lastmodified]
            );
            console.log(`  ✅ Migrated call_hours for ${callHour.month}/${callHour.year}`);
        }
        
        // Update sequence for call_hours
        await newPool.query(`SELECT setval('call_hours_id_seq', (SELECT MAX(id) FROM call_hours))`);
        
        console.log('\n✅ Data migration completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Users: ${usersResult.rows.length}`);
        console.log(`   Health Centers: ${centersResult.rows.length}`);
        console.log(`   Forms: ${formsResult.rows.length}`);
        console.log(`   Audit Logs: ${logsResult.rows.length}`);
        console.log(`   Call Hours: ${callHoursResult.rows.length}`);
        
    } catch (error) {
        console.error('❌ Error during migration:', error.message);
        throw error;
    } finally {
        await oldPool.end();
        await newPool.end();
    }
}

// Run the migration
migrateData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
