require('dotenv').config();
const { Pool } = require('pg');
const types = require('pg-types');

// Force PostgreSQL to return DATE columns as strings (not Date objects)
// This prevents timezone conversion issues
types.setTypeParser(1082, val => val); // 1082 is the OID for DATE type

// Database connection pool for Azure PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: true } : false
});

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');


const app = express();
app.use(cors());
app.use(express.json());

// Auto-migrate database on startup
async function migrateDatabase() {
  try {
    console.log('🔄 Checking database schema...');
    
    // Create physicians table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS physicians (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        specialty VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create personal_schedules table for individual RSA schedules
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personal_schedules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        schedule_date DATE NOT NULL,
        hours INTEGER DEFAULT 0,
        minutes INTEGER DEFAULT 0,
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        notes TEXT,
        physician_name VARCHAR(255),
        health_center_name VARCHAR(255),
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Drop the unique constraint if it exists (allow multiple entries per day)
    await pool.query(`
      ALTER TABLE personal_schedules DROP CONSTRAINT IF EXISTS personal_schedules_user_id_schedule_date_key;
    `);

    // Add physician_name, health_center_name, start_time, end_time columns if they don't exist
    await pool.query(`
      ALTER TABLE personal_schedules
      ADD COLUMN IF NOT EXISTS physician_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS health_center_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS start_time VARCHAR(10),
      ADD COLUMN IF NOT EXISTS end_time VARCHAR(10);
    `);
    
    // Add contact_person, fax and email columns to health_centers if they don't exist
    await pool.query(`
      ALTER TABLE health_centers 
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
      ADD COLUMN IF NOT EXISTS fax VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
    
    // Add firstassistant and secondassistant columns to forms if they don't exist
    await pool.query(`
      ALTER TABLE forms 
      ADD COLUMN IF NOT EXISTS firstassistant VARCHAR(255),
      ADD COLUMN IF NOT EXISTS secondassistant VARCHAR(255);
    `);

    // Create rsa_emails table for managing RSA notification emails
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rsa_emails (
        id SERIAL PRIMARY KEY,
        rsa_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        notes TEXT,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Database schema updated');
  } catch (err) {
    console.error('❌ Database migration error:', err.message);
  }
}

// Run migration on startup
migrateDatabase();

// Configure SendGrid for email notifications
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set, email notifications disabled');
}

// Configure Twilio for SMS notifications
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio configured');
} else {
  console.warn('⚠️ Twilio credentials not set, SMS notifications disabled');
}

// Helper function to send email notification
async function sendEmailNotification(subject, message) {
  if (!process.env.SENDGRID_API_KEY || !process.env.NOTIFICATION_EMAIL_TO) {
    console.log('Email notification skipped (not configured)');
    return;
  }
  
  try {
    const msg = {
      to: process.env.NOTIFICATION_EMAIL_TO.split(','), // Can send to multiple emails
      from: process.env.NOTIFICATION_EMAIL_FROM || 'notifications@surgicalforms.com',
      subject: subject,
      html: message,
    };
    await sgMail.send(msg);
    console.log('✅ Email notification sent');
  } catch (error) {
    console.error('❌ Email notification failed:', error.message);
  }
}

// Helper function to send SMS notification
async function sendSMSNotification(message) {
  if (!twilioClient || !process.env.NOTIFICATION_PHONE_TO || !process.env.TWILIO_PHONE_FROM) {
    console.log('SMS notification skipped (not configured)');
    return;
  }
  
  try {
    const phoneNumbers = process.env.NOTIFICATION_PHONE_TO.split(',');
    for (const phoneNumber of phoneNumbers) {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_FROM,
        to: phoneNumber.trim()
      });
    }
    console.log('✅ SMS notification sent');
  } catch (error) {
    console.error('❌ SMS notification failed:', error.message);
  }
}

// Log all environment variables at startup for debugging
// console.log('ENV VARS:', process.env);

// Database health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Debug: Check a specific form's date
    const formCheck = await pool.query('SELECT id, date, dob FROM forms ORDER BY id DESC LIMIT 1');
    const formData = formCheck.rows[0] || {};
    
    res.json({ 
      status: 'ok', 
      database: result.rows[0],
      userCount: userCheck.rows[0].count,
      hasEnvVar: !!process.env.DATABASE_URL,
      sendgridConfigured: !!process.env.SENDGRID_API_KEY,
      emailFrom: process.env.NOTIFICATION_EMAIL_FROM || 'not set',
      sampleFormDate: formData.date,
      sampleFormDateType: typeof formData.date,
      sampleFormDob: formData.dob,
      sampleFormDobType: typeof formData.dob
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      hasEnvVar: !!process.env.DATABASE_URL
    });
  }
});

// Test email endpoint - sends a test email via SendGrid
app.get('/api/test-email', async (req, res) => {
  const toEmail = req.query.to;
  if (!toEmail) return res.status(400).json({ error: 'Provide ?to=email@example.com' });
  
  if (!process.env.SENDGRID_API_KEY) {
    return res.json({ success: false, error: 'SENDGRID_API_KEY not set' });
  }
  
  try {
    const msg = {
      to: toEmail,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'notifications@surgicalforms.com',
      subject: 'Test Email from Surgical App',
      html: '<h2>Test Email</h2><p>If you received this, SendGrid is working correctly!</p>',
    };
    await sgMail.send(msg);
    res.json({ success: true, message: `Test email sent to ${toEmail} from ${msg.from}` });
  } catch (error) {
    res.json({ success: false, error: error.message, details: error.response ? error.response.body : null });
  }
});

// Serve frontend static build
app.use(express.static(path.join(__dirname, 'build')));

// Azure Blob Storage setup for file uploads
const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION;
let blobServiceClient;
let containerClient;

if (azureStorageConnectionString) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(azureStorageConnectionString);
    containerClient = blobServiceClient.getContainerClient('uploads');
    console.log('✅ Azure Blob Storage configured');
  } catch (err) {
    console.error('❌ Error configuring Azure Blob Storage:', err.message);
  }
} else {
  console.warn('⚠️ AZURE_STORAGE_CONNECTION not set, file uploads will fail');
}

// Use memory storage for multer (files will be in memory temporarily)
const storage = multer.memoryStorage();

// File filter to accept images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to upload file to Azure Blob Storage and return SAS URL
async function uploadToBlob(file) {
  if (!containerClient) {
    throw new Error('Azure Blob Storage not configured');
  }
  
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const blobName = uniqueSuffix + '-' + file.originalname;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    }
  });
  
  // Generate SAS token for the blob (valid for 10 years)
  const sasToken = generateBlobSASQueryParameters({
    containerName: 'uploads',
    blobName: blobName,
    permissions: BlobSASPermissions.parse('r'), // read permission
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 315360000000) // 10 years
  }, new StorageSharedKeyCredential(
    blobServiceClient.accountName,
    process.env.AZURE_STORAGE_CONNECTION.split('AccountKey=')[1].split(';')[0]
  )).toString();
  
  return `${blockBlobClient.url}?${sasToken}`;
}


// --- Forms API using PostgreSQL ---
app.get('/api/forms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT forms.*, users.fullname AS createdbyfullname, users.username AS createdbyemail
      FROM forms
      LEFT JOIN users ON forms.createdbyuserid = users.id
      ORDER BY forms.id DESC
    `);
    // Map DB fields to camelCase for frontend compatibility
    const forms = result.rows.map(form => ({
      id: form.id,
      patientName: form.patientname,
      dob: form.dob ? new Date(form.dob).toISOString().split('T')[0] : null,
      insuranceCompany: form.insurancecompany,
      healthCenterName: form.healthcentername,
      date: form.date ? new Date(form.date).toISOString().split('T')[0] : null,
      timeIn: form.timein,
      timeOut: form.timeout,
      doctorName: form.doctorname,
      procedure: form.procedure,
      caseType: form.casetype,
      assistantType: form.assistanttype,
      firstAssistant: form.firstassistant,
      secondAssistant: form.secondassistant,
      status: form.status,
      createdBy: form.createdby, // legacy
      createdByUserId: form.createdbyuserid,
      createdByFullName: form.createdbyfullname,
      createdByEmail: form.createdbyemail,
      surgeryFormFileUrl: form.surgeryformfileurl,
      createdAt: form.createdat,
      lastModified: form.lastmodified,
    }));
    res.json(forms);
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/forms/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT forms.*, users.fullname AS createdbyfullname, users.username AS createdbyemail
      FROM forms
      LEFT JOIN users ON forms.createdbyuserid = users.id
      WHERE forms.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const form = result.rows[0];
    
    // Debug logging
    console.log('Raw form.date from DB:', form.date, 'Type:', typeof form.date);
    console.log('Raw form.dob from DB:', form.dob, 'Type:', typeof form.dob);
    
    const camelCaseForm = {
      id: form.id,
      patientName: form.patientname,
      dob: form.dob ? new Date(form.dob).toISOString().split('T')[0] : null,
      insuranceCompany: form.insurancecompany,
      healthCenterName: form.healthcentername,
      date: form.date ? new Date(form.date).toISOString().split('T')[0] : null,
      timeIn: form.timein,
      timeOut: form.timeout,
      doctorName: form.doctorname,
      procedure: form.procedure,
      caseType: form.casetype,
      assistantType: form.assistanttype,
      firstAssistant: form.firstassistant,
      secondAssistant: form.secondassistant,
      status: form.status,
      createdBy: form.createdby, // legacy
      createdByUserId: form.createdbyuserid,
      createdByFullName: form.createdbyfullname,
      createdByEmail: form.createdbyemail,
      surgeryFormFileUrl: form.surgeryformfileurl,
      createdAt: form.createdat,
      lastModified: form.lastmodified,
    };
    res.json(camelCaseForm);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/forms', upload.single('surgeryFormFile'), async (req, res) => {
  console.log('=== Form submission received ===');
  console.log('Body:', req.body);
  console.log('File:', req.file);
  
  const {
    patientName, dob, insuranceCompany,
    healthCenterName, timeIn, timeOut, doctorName, procedure, caseType, assistantType, firstAssistant, secondAssistant, status, createdByUserId, date
  } = req.body;
  
  // Validate required fields
  if (!patientName || !dob || !insuranceCompany || !healthCenterName || !date || !doctorName || !procedure || !caseType || !assistantType || !status || !createdByUserId || !req.file || (caseType !== 'Cancelled' && (!timeIn || !timeOut))) {
    console.log('Validation failed:', {
      patientName: !!patientName,
      dob: !!dob,
      insuranceCompany: !!insuranceCompany,
      healthCenterName: !!healthCenterName,
      date: !!date,
      doctorName: !!doctorName,
      procedure: !!procedure,
      caseType: !!caseType,
      status: !!status,
      createdByUserId: !!createdByUserId,
      file: !!req.file,
      timeIn: !!timeIn,
      timeOut: !!timeOut
    });
    return res.status(400).json({ error: 'All fields are required.' });
  }
  
  try {
    console.log('Uploading file to Azure Blob Storage...');
    console.log('Container client exists:', !!containerClient);
    console.log('File details:', { name: req.file.originalname, size: req.file.size, type: req.file.mimetype });
    
    // Upload file to Azure Blob Storage and get URL
    const fileUrl = await uploadToBlob(req.file);
    console.log('File uploaded to:', fileUrl);
    
    console.log('Inserting into database...');
    const result = await pool.query(
      `INSERT INTO forms (patientname, dob, insurancecompany, healthcentername, date, timein, timeout, doctorname, procedure, casetype, assistanttype, firstassistant, secondassistant, status, createdbyuserid, surgeryformfileurl, createdat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [patientName, dob, insuranceCompany, healthCenterName, date, timeIn, timeOut, doctorName, procedure, caseType, assistantType, firstAssistant || null, secondAssistant || null, status, createdByUserId, fileUrl, new Date().toISOString()]
    );
    console.log('Form created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating form:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to create form', details: err.message, stack: err.stack });
  }
});

// --- PATCH: Support multipart/form-data for editing forms with/without file ---
app.put('/api/forms/:id', upload.single('surgeryFormFile'), async (req, res) => {
  try {
    // Explicit mapping from camelCase to DB columns
    const fieldMap = {
      patientName: 'patientname',
      dob: 'dob',
      insuranceCompany: 'insurancecompany',
      healthCenterName: 'healthcentername',
      date: 'date',
      timeIn: 'timein',
      timeOut: 'timeout',
      doctorName: 'doctorname',
      procedure: 'procedure',
      caseType: 'casetype',
      assistantType: 'assistanttype',
      status: 'status',
      createdBy: 'createdby',
      surgeryFormFileUrl: 'surgeryformfileurl',
      createdAt: 'createdat',
    };
    // Use req.body for text fields, req.file for file
    const fields = Object.keys(req.body).filter(k => fieldMap[k]);
    const values = fields.map(k => req.body[k]);
    let setClause = fields.map((k, i) => `${fieldMap[k]} = $${i + 1}`).join(', ');
    let paramCount = fields.length;
    // If a new file is uploaded, update surgeryFormFileUrl
    if (req.file) {
      const fileUrl = await uploadToBlob(req.file);
      paramCount++;
      setClause += (setClause ? ', ' : '') + `surgeryformfileurl = $${paramCount}`;
      values.push(fileUrl);
    }
    // Always update lastModified
    paramCount++;
    setClause += (setClause ? ', ' : '') + `lastmodified = $${paramCount}`;
    values.push(new Date().toISOString());
    // id param
    paramCount++;
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE forms SET ${setClause} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/forms/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM forms WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Users API using PostgreSQL ---
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, fullname, hourly_rate FROM users ORDER BY id DESC');
    // Map fullname to fullName for frontend compatibility and remove raw fullname
    const users = result.rows.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullname,
      hourlyRate: user.hourly_rate || 3.00
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, role, password, actor, fullName } = req.body;
  if (!username || !role || !password || !fullName) return res.status(400).json({ error: 'Missing fields' });
  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'User exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, role, password, fullName) VALUES ($1, $2, $3, $4) RETURNING id, username, role, fullName',
      [username, role, hashedPassword, fullName]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { role, fullName, username, hourlyRate } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, fullname = $2, username = $3, hourly_rate = $4 WHERE id = $5 RETURNING id, username, role, fullname, hourly_rate',
      [role, fullName, username, hourlyRate || 3.00, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Reassign forms from one user to another ---
app.post('/api/users/:id/reassign-forms', async (req, res) => {
  try {
    const fromUserId = req.params.id;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }

    // Check if target user exists
    const targetUser = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (targetUser.rows.length === 0) {
      return res.status(400).json({ error: 'Target user does not exist.' });
    }

    // Reassign all forms
    const result = await pool.query(
      'UPDATE forms SET createdbyuserid = $1, lastmodified = $2 WHERE createdbyuserid = $3',
      [targetUserId, new Date().toISOString(), fromUserId]
    );

    res.json({ 
      success: true, 
      reassignedCount: result.rowCount,
      message: `Successfully reassigned ${result.rowCount} form(s)` 
    });
  } catch (err) {
    console.error('Error reassigning forms:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    // Check if user has created any forms
    const formsCheck = await pool.query(
      'SELECT COUNT(*) FROM forms WHERE createdbyuserid = $1',
      [req.params.id]
    );
    const formsCount = parseInt(formsCheck.rows[0].count);
    
    if (formsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete user. This user has created ${formsCount} form(s). Please reassign or delete those forms first.`,
        formsCount: formsCount
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Password change endpoint ---
app.put('/api/users/:id/password', async (req, res) => {
  const userId = req.params.id;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'New password is required.' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// --- Audit Logs API using PostgreSQL ---
app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

function logAudit(action, actor, details) {
  pool.query(
    'INSERT INTO audit_logs (timestamp, action, actor, details) VALUES ($1, $2, $3, $4)',
    [new Date().toISOString(), action, actor, JSON.stringify(details)]
  ).catch(() => {});
}

// --- Login API ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    console.log('User query result:', result.rows.length, 'rows');
    const user = result.rows[0];
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('User found, checking password...');
    const match = await bcrypt.compare(password, user.password);
    console.log('Password match:', match);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    logAudit('LOGIN', username, { userId: user.id });
    res.json({ id: user.id, username: user.username, role: user.role, fullName: user.fullname || user.fullName });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Call Hours Monthly Planner using PostgreSQL ---
app.get('/api/call-hours', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'Missing params' });
  try {
    const result = await pool.query(
      'SELECT assignments FROM call_hours WHERE month = $1 AND year = $2',
      [Number(month), Number(year)]
    );
    res.json(result.rows[0]?.assignments || {});
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/call-hours', async (req, res) => {
  const { month, year, assignments, actorRole } = req.body;
  if (actorRole !== 'Business Assistant' && actorRole !== 'Team Leader') return res.status(403).json({ error: 'Forbidden' });
  if (!month || !year || !assignments) return res.status(400).json({ error: 'Missing params' });
  try {
    const exists = await pool.query(
      'SELECT 1 FROM call_hours WHERE month = $1 AND year = $2',
      [Number(month), Number(year)]
    );
    
    const isUpdate = exists.rows.length > 0;
    
    if (isUpdate) {
      await pool.query(
        'UPDATE call_hours SET assignments = $1 WHERE month = $2 AND year = $3',
        [assignments, Number(month), Number(year)]
      );
    } else {
      await pool.query(
        'INSERT INTO call_hours (month, year, assignments) VALUES ($1, $2, $3)',
        [Number(month), Number(year), assignments]
      );
    }
    
    // Send notifications for new schedules
    if (!isUpdate) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[Number(month) - 1];
      
      // Parse assignments to get user details
      const assignmentData = typeof assignments === 'string' ? JSON.parse(assignments) : assignments;
      const assignedDays = Object.keys(assignmentData).length;
      
      // Email notification
      const emailSubject = `New Call Schedule Added: ${monthName} ${year}`;
      const emailMessage = `
        <h2>New Call Schedule Created</h2>
        <p>A new call schedule has been added for <strong>${monthName} ${year}</strong>.</p>
        <p><strong>Total days scheduled:</strong> ${assignedDays}</p>
        <p>Please log in to the Surgical Forms app to view the complete schedule.</p>
        <p><a href="${process.env.APP_URL || 'https://surgical-backend-abdma0d0fpdme6e8.canadacentral-01.azurewebsites.net'}">View Schedule</a></p>
      `;
      
      // SMS notification
      const smsMessage = `New call schedule added for ${monthName} ${year}. ${assignedDays} days scheduled. Check the Surgical Forms app for details.`;
      
      // Send notifications asynchronously (don't wait for them)
      sendEmailNotification(emailSubject, emailMessage).catch(console.error);
      sendSMSNotification(smsMessage).catch(console.error);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error in call-hours endpoint:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Health Centers API ---
app.get('/api/health-centers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_centers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/health-centers', async (req, res) => {
  const { name, address, phone, fax, email, contactPerson } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    const result = await pool.query(
      'INSERT INTO health_centers (name, address, phone, fax, email, contact_person) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, address || '', phone || '', fax || '', email || '', contactPerson || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/health-centers/:id', async (req, res) => {
  const { name, address, phone, fax, email, contactPerson } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    const result = await pool.query(
      'UPDATE health_centers SET name=$1, address=$2, phone=$3, fax=$4, email=$5, contact_person=$6 WHERE id=$7 RETURNING *',
      [name, address || '', phone || '', fax || '', email || '', contactPerson || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/health-centers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM health_centers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ========== PHYSICIANS ENDPOINTS ==========
app.get('/api/physicians', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM physicians ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/physicians', async (req, res) => {
  const { name, specialty, phone, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO physicians (name, specialty, phone, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, specialty, phone || '', email || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Physician already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

app.put('/api/physicians/:id', async (req, res) => {
  const { name, specialty, phone, email } = req.body;
  try {
    const result = await pool.query(
      'UPDATE physicians SET name=$1, specialty=$2, phone=$3, email=$4, lastmodified=CURRENT_TIMESTAMP WHERE id=$5 RETURNING *',
      [name, specialty, phone || '', email || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/physicians/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM physicians WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper function to send schedule email notification to RSA
async function sendScheduleEmailToRSA(userId, action, details) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('Schedule email skipped (SendGrid not configured)');
    return;
  }
  try {
    // Look up the user's full name
    const userResult = await pool.query('SELECT fullname FROM users WHERE id=$1', [userId]);
    if (userResult.rows.length === 0) return;
    const rsaFullName = userResult.rows[0].fullname;

    // Look up email from rsa_emails table (case-insensitive match)
    const emailResult = await pool.query(
      'SELECT email FROM rsa_emails WHERE LOWER(rsa_name) = LOWER($1)',
      [rsaFullName]
    );
    if (emailResult.rows.length === 0) {
      console.log(`No RSA email found for "${rsaFullName}", schedule notification skipped`);
      return;
    }
    const rsaEmail = emailResult.rows[0].email;

    // Format schedule details for the email
    const scheduleDate = details.schedule_date || details.scheduleDate || 'N/A';
    const startTime = details.start_time || details.startTime || '';
    const endTime = details.end_time || details.endTime || '';
    const physician = details.physician_name || details.physicianName || '';
    const healthCenter = details.health_center_name || details.healthCenterName || '';
    const notes = details.notes || '';
    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : 'N/A';

    let subject, html;
    if (action === 'CREATED') {
      subject = `New Schedule Entry - ${scheduleDate}`;
      html = `<h2>New Schedule Entry</h2>
        <p>Hello <strong>${rsaFullName}</strong>,</p>
        <p>A new schedule entry has been added for you:</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #ddd">${scheduleDate}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #ddd">${timeRange}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Physician</td><td style="padding:8px;border:1px solid #ddd">${physician || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Health Center</td><td style="padding:8px;border:1px solid #ddd">${healthCenter || 'N/A'}</td></tr>
          ${notes ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Notes</td><td style="padding:8px;border:1px solid #ddd">${notes}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;color:#666">Please check your schedule for details.</p>`;
    } else if (action === 'UPDATED') {
      subject = `Schedule Updated - ${scheduleDate}`;
      html = `<h2>Schedule Entry Updated</h2>
        <p>Hello <strong>${rsaFullName}</strong>,</p>
        <p>Your schedule entry has been updated:</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #ddd">${scheduleDate}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #ddd">${timeRange}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Physician</td><td style="padding:8px;border:1px solid #ddd">${physician || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Health Center</td><td style="padding:8px;border:1px solid #ddd">${healthCenter || 'N/A'}</td></tr>
          ${notes ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Notes</td><td style="padding:8px;border:1px solid #ddd">${notes}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;color:#666">Please review your updated schedule.</p>`;
    } else if (action === 'DELETED') {
      subject = `Schedule Entry Removed - ${scheduleDate}`;
      html = `<h2>Schedule Entry Removed</h2>
        <p>Hello <strong>${rsaFullName}</strong>,</p>
        <p>A schedule entry has been removed from your schedule:</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #ddd">${scheduleDate}</td></tr>
          ${startTime ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #ddd">${timeRange}</td></tr>` : ''}
          ${physician ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Physician</td><td style="padding:8px;border:1px solid #ddd">${physician}</td></tr>` : ''}
          ${healthCenter ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Health Center</td><td style="padding:8px;border:1px solid #ddd">${healthCenter}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;color:#666">Please check your schedule for any changes.</p>`;
    }

    const msg = {
      to: rsaEmail,
      from: process.env.NOTIFICATION_EMAIL_FROM || 'notifications@surgicalforms.com',
      subject: subject,
      html: html,
    };
    await sgMail.send(msg);
    console.log(`✅ Schedule email sent to ${rsaEmail} (${rsaFullName}) - ${action}`);
  } catch (error) {
    console.error('❌ Schedule email notification failed:', error.message);
  }
}

// ========== PERSONAL SCHEDULES ENDPOINTS ==========
app.get('/api/personal-schedules', async (req, res) => {
  const { userId, month, year } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM personal_schedules 
       WHERE user_id=$1 
       AND EXTRACT(MONTH FROM schedule_date)=$2 
       AND EXTRACT(YEAR FROM schedule_date)=$3
       ORDER BY schedule_date, id`,
      [userId, month, year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/personal-schedules', async (req, res) => {
  const { userId, scheduleDate, hours, minutes, notes, physicianName, healthCenterName, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO personal_schedules (user_id, schedule_date, hours, minutes, notes, physician_name, health_center_name, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [userId, scheduleDate, hours || 0, minutes || 0, notes || '', physicianName || '', healthCenterName || '', startTime || '', endTime || '']
    );
    res.json(result.rows[0]);

    // Send email notification to RSA (async, don't block response)
    sendScheduleEmailToRSA(userId, 'CREATED', {
      scheduleDate, startTime, endTime, physicianName, healthCenterName, notes
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/personal-schedules/:id', async (req, res) => {
  const { hours, minutes, notes, physicianName, healthCenterName, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      'UPDATE personal_schedules SET hours=$1, minutes=$2, notes=$3, physician_name=$4, health_center_name=$5, start_time=$6, end_time=$7, lastmodified=CURRENT_TIMESTAMP WHERE id=$8 RETURNING *',
      [hours || 0, minutes || 0, notes || '', physicianName || '', healthCenterName || '', startTime || '', endTime || '', req.params.id]
    );
    const updated = result.rows[0];
    res.json(updated);

    // Send email notification to RSA (async, don't block response)
    if (updated) {
      sendScheduleEmailToRSA(updated.user_id, 'UPDATED', updated);
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/personal-schedules/:id', async (req, res) => {
  try {
    // Fetch schedule details before deleting (for email notification)
    const existing = await pool.query('SELECT * FROM personal_schedules WHERE id=$1', [req.params.id]);
    await pool.query('DELETE FROM personal_schedules WHERE id=$1', [req.params.id]);
    res.json({ success: true });

    // Send email notification to RSA (async, don't block response)
    if (existing.rows.length > 0) {
      sendScheduleEmailToRSA(existing.rows[0].user_id, 'DELETED', existing.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ========== RSA EMAILS ENDPOINTS ==========
app.get('/api/rsa-emails', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rsa_emails ORDER BY rsa_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/rsa-emails', async (req, res) => {
  const { rsaName, email, phone, notes } = req.body;
  if (!rsaName || !email) return res.status(400).json({ error: 'Name and email are required' });
  try {
    const result = await pool.query(
      'INSERT INTO rsa_emails (rsa_name, email, phone, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [rsaName, email, phone || '', notes || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/rsa-emails/:id', async (req, res) => {
  const { rsaName, email, phone, notes } = req.body;
  if (!rsaName || !email) return res.status(400).json({ error: 'Name and email are required' });
  try {
    const result = await pool.query(
      'UPDATE rsa_emails SET rsa_name=$1, email=$2, phone=$3, notes=$4, lastmodified=CURRENT_TIMESTAMP WHERE id=$5 RETURNING *',
      [rsaName, email, phone || '', notes || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/rsa-emails/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rsa_emails WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Catch-all: serve React app for all non-API, non-static routes
app.get(/(.*)/, (req, res) => {
  // If the request starts with /api or /uploads, skip
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexPath = path.join(__dirname, 'build/index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('ERROR: build/index.html not found. Make sure the frontend is built before starting the backend.');
    return res.status(500).send('Frontend build not found. Please run "npm run build" in the frontend directory.');
  }
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Log all registered routes for debugging
  if (app._router && app._router.stack) {
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        console.log('Route:', middleware.route.path);
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            console.log('Route:', handler.route.path);
          }
        });
      }
    });
  }
});
