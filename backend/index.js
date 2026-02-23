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
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const crypto = require('crypto');

// JWT secret - MUST be set via environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}
const JWT_EXPIRES_IN = '24h'; // Token expires in 24 hours

// Account lockout settings
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Password complexity requirements
function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number.');
  return errors;
}


const app = express();

// Trust proxy (required for rate limiting behind Azure App Service / IIS)
app.set('trust proxy', 1);

// ========== HTTPS REDIRECT (Azure App Service sends X-Forwarded-Proto) ==========
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ========== SECURITY HEADERS (Helmet.js) ==========
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.blob.core.windows.net'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedded resources
}));

// ========== CORS LOCKDOWN ==========
const ALLOWED_ORIGINS = [
  'https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net',
  process.env.APP_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (same-origin, server-to-server, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In development only, allow localhost
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// ========== INPUT SANITIZATION HELPER ==========
// Escape HTML entities to prevent XSS in email templates
function escapeHtml(str) {
  if (!str) return '';
  return sanitizeHtml(String(str), { allowedTags: [], allowedAttributes: {} });
}

// ========== RATE LIMITING ==========
// Strict limiter for login — 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  keyGenerator: (req) => req.ip,
});

// General API limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => req.ip,
});

// Apply general limiter to all /api routes
app.use('/api', apiLimiter);

// ========== JWT AUTHENTICATION MIDDLEWARE ==========
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    // Expired/invalid tokens are authentication failures (401), not authorization failures (403)
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Helper: require specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

// Apply JWT authentication to all /api/* routes EXCEPT login, health, and password reset
const PUBLIC_PATHS = ['/api/login', '/api/health', '/api/forgot-password', '/api/reset-password'];
app.use('/api', (req, res, next) => {
  const fullPath = '/api' + (req.path === '/' ? '' : req.path);
  if (PUBLIC_PATHS.includes(fullPath)) {
    return next();
  }
  authenticateToken(req, res, next);
});

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

    // Add reminder_sent column to track email reminders
    await pool.query(`
      ALTER TABLE personal_schedules
      ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
    `);
    
    // Add contact_person, fax and email columns to health_centers if they don't exist
    await pool.query(`
      ALTER TABLE health_centers 
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
      ADD COLUMN IF NOT EXISTS fax VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);

    // Add fax column to physicians if it doesn't exist
    await pool.query(`
      ALTER TABLE physicians 
      ADD COLUMN IF NOT EXISTS fax VARCHAR(50);
    `);

    // Add account lockout columns to users
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
    `);

    // Add password reset token columns to users
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
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

    // Create invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number INTEGER NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE,
        health_center_id INTEGER,
        health_center_name VARCHAR(255) NOT NULL,
        health_center_address TEXT,
        line_items JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        subtotal DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        created_by_user_id INTEGER,
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
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({ status: 'error' });
  }
});

// Test email endpoint - sends a test email via SendGrid
app.get('/api/test-email', requireRole('Admin'), async (req, res) => {
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
  
  // Generate SAS token for the blob (valid for 1 year)
  const sasToken = generateBlobSASQueryParameters({
    containerName: 'uploads',
    blobName: blobName,
    permissions: BlobSASPermissions.parse('r'), // read permission
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 365 * 24 * 60 * 60 * 1000) // 1 year
  }, new StorageSharedKeyCredential(
    blobServiceClient.accountName,
    process.env.AZURE_STORAGE_CONNECTION.split('AccountKey=')[1].split(';')[0]
  )).toString();
  
  return `${blockBlobClient.url}?${sasToken}`;
}


// --- Forms API using PostgreSQL ---
app.get('/api/forms', requireRole('Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'), async (req, res) => {
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

app.get('/api/forms/:id', requireRole('Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT forms.*, users.fullname AS createdbyfullname, users.username AS createdbyemail
      FROM forms
      LEFT JOIN users ON forms.createdbyuserid = users.id
      WHERE forms.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const form = result.rows[0];
    
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

app.post('/api/forms', requireRole('Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'), upload.single('surgeryFormFile'), async (req, res) => {
  
  const {
    patientName, dob, insuranceCompany,
    healthCenterName, timeIn, timeOut, doctorName, procedure, caseType, assistantType, firstAssistant, secondAssistant, status, createdByUserId, date
  } = req.body;
  
  // Validate required fields
  if (!patientName || !dob || !insuranceCompany || !healthCenterName || !date || !doctorName || !procedure || !caseType || !assistantType || !status || !createdByUserId || !req.file || (caseType !== 'Cancelled' && (!timeIn || !timeOut))) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  
  try {
    // Upload file to Azure Blob Storage and get URL
    const fileUrl = await uploadToBlob(req.file);
    const result = await pool.query(
      `INSERT INTO forms (patientname, dob, insurancecompany, healthcentername, date, timein, timeout, doctorname, procedure, casetype, assistanttype, firstassistant, secondassistant, status, createdbyuserid, surgeryformfileurl, createdat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [patientName, dob, insuranceCompany, healthCenterName, date, timeIn, timeOut, doctorName, procedure, caseType, assistantType, firstAssistant || null, secondAssistant || null, status, createdByUserId, fileUrl, new Date().toISOString()]
    );
    logAudit('FORM_CREATED', req.user.username, { formId: result.rows[0].id, patientName, healthCenterName });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating form:', err.message);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// --- PATCH: Support multipart/form-data for editing forms with/without file ---
app.put('/api/forms/:id', requireRole('Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'), upload.single('surgeryFormFile'), async (req, res) => {
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
    logAudit('FORM_UPDATED', req.user.username, { formId: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/forms/:id', requireRole('Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'), async (req, res) => {
  try {
    await pool.query('DELETE FROM forms WHERE id = $1', [req.params.id]);
    logAudit('FORM_DELETED', req.user.username, { formId: req.params.id });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Users API using PostgreSQL ---
app.get('/api/users', requireRole('Admin', 'Business Assistant', 'Team Leader', 'Scheduler'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, fullname, hourly_rate FROM users ORDER BY id DESC');
    // Non-Admin roles get limited fields (no username/email)
    // BA gets hourlyRate for payroll calculations
    const isAdmin = req.user.role === 'Admin';
    const isBA = req.user.role === 'Business Assistant';
    const users = result.rows.map(user => ({
      id: user.id,
      username: isAdmin ? user.username : undefined,
      role: user.role,
      fullName: user.fullname,
      hourlyRate: (isAdmin || isBA) ? (user.hourly_rate || 3.00) : undefined,
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

const VALID_ROLES = ['Admin', 'Business Assistant', 'Registered Surgical Assistant', 'Team Leader', 'Scheduler'];

app.post('/api/users', requireRole('Admin'), async (req, res) => {
  const { username, role, password, actor, fullName } = req.body;
  if (!username || !role || !password || !fullName) return res.status(400).json({ error: 'Missing fields' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) return res.status(400).json({ error: pwErrors.join(' ') });
  try {
    const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'User exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, role, password, fullName) VALUES ($1, $2, $3, $4) RETURNING id, username, role, fullName',
      [username, role, hashedPassword, fullName]
    );
    logAudit('USER_CREATED', req.user.username, { newUserId: result.rows[0].id, username, role });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/users/:id', requireRole('Admin'), async (req, res) => {
  const { role, fullName, username, hourlyRate } = req.body;
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, fullname = $2, username = $3, hourly_rate = $4 WHERE id = $5 RETURNING id, username, role, fullname, hourly_rate',
      [role, fullName, username, hourlyRate || 3.00, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logAudit('USER_UPDATED', req.user.username, { targetUserId: req.params.id, role, username });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Reassign forms from one user to another ---
app.post('/api/users/:id/reassign-forms', requireRole('Admin'), async (req, res) => {
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

app.delete('/api/users/:id', requireRole('Admin'), async (req, res) => {
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
    logAudit('USER_DELETED', req.user.username, { targetUserId: req.params.id });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Password change endpoint ---
app.put('/api/users/:id/password', requireRole('Admin'), async (req, res) => {
  const userId = req.params.id;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'New password is required.' });
  }
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) return res.status(400).json({ error: pwErrors.join(' ') });
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2', [hashed, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// --- Audit Logs API using PostgreSQL ---
app.get('/api/audit-logs', requireRole('Admin'), async (req, res) => {
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
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      logAudit('LOGIN_LOCKED', username, { userId: user.id, minutesLeft });
      return res.status(423).json({ error: `Account is locked. Try again in ${minutesLeft} minute(s).` });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
        await pool.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockUntil, user.id]);
        logAudit('ACCOUNT_LOCKED', username, { userId: user.id, attempts });
        return res.status(423).json({ error: `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.` });
      } else {
        await pool.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
        logAudit('LOGIN_FAILED', username, { userId: user.id, attempts });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Successful login — reset failed attempts and lock
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }
    logAudit('LOGIN', username, { userId: user.id });
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullname || user.fullName },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ id: user.id, username: user.username, role: user.role, fullName: user.fullname || user.fullName, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Forgot Password (RSA & Team Leader only) ---
app.post('/api/forgot-password', loginLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });
  try {
    const result = await pool.query('SELECT id, role, fullname FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    // Always return success to avoid user enumeration — but only actually send for allowed roles
    if (!user || (user.role !== 'Registered Surgical Assistant' && user.role !== 'Team Leader')) {
      // User not found or role not allowed — return generic success to prevent enumeration
      return res.json({ success: true, message: 'If your account exists and is eligible, a reset link has been sent to your email.' });
    }

    // Find email from rsa_emails table by matching fullname
    const emailResult = await pool.query(
      'SELECT email FROM rsa_emails WHERE LOWER(rsa_name) = LOWER($1)',
      [user.fullname]
    );
    if (emailResult.rows.length === 0) {
      // No email found for user in rsa_emails — return generic success
      return res.json({ success: true, message: 'If your account exists and is eligible, a reset link has been sent to your email.' });
    }

    const recipientEmail = emailResult.rows[0].email;

    // Generate secure reset token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    // H2 fix: Hash token before storing (user gets raw token in email, DB stores hash)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [hashedToken, expires, user.id]);

    const appUrl = process.env.APP_URL || 'https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    if (process.env.SENDGRID_API_KEY) {
      const msg = {
        to: recipientEmail,
        from: process.env.NOTIFICATION_EMAIL_FROM || 'notifications@surgicalforms.com',
        subject: 'Password Reset Request - Proassisting',
        html: `<h2>Password Reset</h2>
          <p>Hello <strong>${escapeHtml(user.fullname)}</strong>,</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#5a67d8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Reset Password</a></p>
          <p style="margin-top:16px;color:#666;font-size:13px">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
      };
      await sgMail.send(msg);
    }

    logAudit('PASSWORD_RESET_REQUESTED', username, { userId: user.id });
    res.json({ success: true, message: 'If your account exists and is eligible, a reset link has been sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Reset Password (via token from email) ---
app.post('/api/reset-password', loginLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });

  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) return res.status(400).json({ error: pwErrors.join(' ') });

  try {
    // H2 fix: Hash incoming token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      'SELECT id, username FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [hashedToken]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const user = result.rows[0];
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
      [hashed, user.id]
    );

    logAudit('PASSWORD_RESET', user.username, { userId: user.id });
    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Call Hours Monthly Planner using PostgreSQL ---
app.get('/api/call-hours', requireRole('Admin', 'Business Assistant', 'Team Leader', 'Scheduler', 'Registered Surgical Assistant'), async (req, res) => {
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

app.post('/api/call-hours', requireRole('Business Assistant', 'Team Leader', 'Scheduler'), async (req, res) => {
  const { month, year, assignments, actorRole } = req.body;
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

app.post('/api/health-centers', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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

app.put('/api/health-centers/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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

app.delete('/api/health-centers/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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

app.post('/api/physicians', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
  const { name, specialty, phone, email, fax } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO physicians (name, specialty, phone, email, fax) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, specialty, phone || '', email || '', fax || '']
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

app.put('/api/physicians/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
  const { name, specialty, phone, email, fax } = req.body;
  try {
    const result = await pool.query(
      'UPDATE physicians SET name=$1, specialty=$2, phone=$3, email=$4, fax=$5, lastmodified=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *',
      [name, specialty, phone || '', email || '', fax || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/physicians/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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
    const scheduleDate = escapeHtml(details.schedule_date || details.scheduleDate || 'N/A');
    const startTime = escapeHtml(details.start_time || details.startTime || '');
    const endTime = escapeHtml(details.end_time || details.endTime || '');
    const physician = escapeHtml(details.physician_name || details.physicianName || '');
    const healthCenter = escapeHtml(details.health_center_name || details.healthCenterName || '');
    const notes = escapeHtml(details.notes || '');
    const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : 'N/A';

    const safeFullName = escapeHtml(rsaFullName);
    let subject, html;
    if (action === 'CREATED') {
      subject = `New Schedule Entry - ${scheduleDate}`;
      html = `<h2>New Schedule Entry</h2>
        <p>Hello <strong>${safeFullName}</strong>,</p>
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
        <p>Hello <strong>${safeFullName}</strong>,</p>
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
        <p>Hello <strong>${safeFullName}</strong>,</p>
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
app.get('/api/personal-schedules', requireRole('Scheduler', 'Business Assistant', 'Team Leader', 'Registered Surgical Assistant'), async (req, res) => {
  let { userId, month, year } = req.query;
  // H1 fix: RSAs can only view their own schedule
  if (req.user.role === 'Registered Surgical Assistant') {
    userId = req.user.id;
  }
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

app.post('/api/personal-schedules', requireRole('Scheduler', 'Business Assistant', 'Team Leader'), async (req, res) => {
  const { userId, scheduleDate, hours, minutes, notes, physicianName, healthCenterName, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO personal_schedules (user_id, schedule_date, hours, minutes, notes, physician_name, health_center_name, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [userId, scheduleDate, hours || 0, minutes || 0, notes || '', physicianName || '', healthCenterName || '', startTime || '', endTime || '']
    );
    res.json(result.rows[0]);
    logAudit('SCHEDULE_CREATED', req.user.username, { scheduleId: result.rows[0].id, userId, scheduleDate });

    // Send email notification to RSA (async, don't block response)
    sendScheduleEmailToRSA(userId, 'CREATED', {
      scheduleDate, startTime, endTime, physicianName, healthCenterName, notes
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/personal-schedules/:id', requireRole('Scheduler', 'Business Assistant', 'Team Leader'), async (req, res) => {
  const { hours, minutes, notes, physicianName, healthCenterName, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      'UPDATE personal_schedules SET hours=$1, minutes=$2, notes=$3, physician_name=$4, health_center_name=$5, start_time=$6, end_time=$7, lastmodified=CURRENT_TIMESTAMP WHERE id=$8 RETURNING *',
      [hours || 0, minutes || 0, notes || '', physicianName || '', healthCenterName || '', startTime || '', endTime || '', req.params.id]
    );
    const updated = result.rows[0];
    logAudit('SCHEDULE_UPDATED', req.user.username, { scheduleId: req.params.id });
    res.json(updated);

    // Send email notification to RSA (async, don't block response)
    if (updated) {
      sendScheduleEmailToRSA(updated.user_id, 'UPDATED', updated);
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/personal-schedules/:id', requireRole('Scheduler', 'Business Assistant', 'Team Leader'), async (req, res) => {
  try {
    // Fetch schedule details before deleting (for email notification)
    const existing = await pool.query('SELECT * FROM personal_schedules WHERE id=$1', [req.params.id]);
    await pool.query('DELETE FROM personal_schedules WHERE id=$1', [req.params.id]);
    logAudit('SCHEDULE_DELETED', req.user.username, { scheduleId: req.params.id });
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
app.get('/api/rsa-emails', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rsa_emails ORDER BY rsa_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/rsa-emails', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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

app.put('/api/rsa-emails/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
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

app.delete('/api/rsa-emails/:id', requireRole('Business Assistant', 'Scheduler'), async (req, res) => {
  try {
    await pool.query('DELETE FROM rsa_emails WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ========== INVOICES ENDPOINTS ==========
app.get('/api/invoices', requireRole('Business Assistant'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices ORDER BY invoice_number DESC');
    res.json(result.rows.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      healthCenterId: inv.health_center_id,
      healthCenterName: inv.health_center_name,
      healthCenterAddress: inv.health_center_address,
      lineItems: inv.line_items,
      notes: inv.notes,
      subtotal: inv.subtotal,
      total: inv.total,
      status: inv.status,
      createdByUserId: inv.created_by_user_id,
      createdAt: inv.createdat,
      lastModified: inv.lastmodified
    })));
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/invoices/next-number', requireRole('Business Assistant'), async (req, res) => {
  try {
    const result = await pool.query('SELECT COALESCE(MAX(invoice_number), 0) + 1 as next FROM invoices');
    res.json({ nextNumber: result.rows[0].next });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/invoices/:id', requireRole('Business Assistant'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = result.rows[0];
    res.json({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      healthCenterId: inv.health_center_id,
      healthCenterName: inv.health_center_name,
      healthCenterAddress: inv.health_center_address,
      lineItems: inv.line_items,
      notes: inv.notes,
      subtotal: inv.subtotal,
      total: inv.total,
      status: inv.status,
      createdByUserId: inv.created_by_user_id,
      createdAt: inv.createdat,
      lastModified: inv.lastmodified
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/invoices', requireRole('Business Assistant'), async (req, res) => {
  const { invoiceNumber, invoiceDate, dueDate, healthCenterName, healthCenterAddress, lineItems, notes, subtotal, total, status, createdByUserId } = req.body;
  if (!invoiceNumber || !invoiceDate || !healthCenterName) {
    return res.status(400).json({ error: 'Invoice number, date, and health center are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, invoice_date, due_date, health_center_name, health_center_address, line_items, notes, subtotal, total, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [invoiceNumber, invoiceDate, dueDate || null, healthCenterName, healthCenterAddress || '', JSON.stringify(lineItems || []), notes || '', subtotal || 0, total || 0, status || 'Pending', createdByUserId || null]
    );
    logAudit('INVOICE_CREATED', req.user.username, { invoiceId: result.rows[0].id, invoiceNumber, healthCenterName });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/invoices/:id', requireRole('Business Assistant'), async (req, res) => {
  const { invoiceNumber, invoiceDate, dueDate, healthCenterName, healthCenterAddress, lineItems, notes, subtotal, total, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE invoices SET invoice_number=$1, invoice_date=$2, due_date=$3, health_center_name=$4, health_center_address=$5, line_items=$6, notes=$7, subtotal=$8, total=$9, status=$10, lastmodified=CURRENT_TIMESTAMP WHERE id=$11 RETURNING *`,
      [invoiceNumber, invoiceDate, dueDate || null, healthCenterName, healthCenterAddress || '', JSON.stringify(lineItems || []), notes || '', subtotal || 0, total || 0, status || 'Pending', req.params.id]
    );
    logAudit('INVOICE_UPDATED', req.user.username, { invoiceId: req.params.id, invoiceNumber });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/invoices/:id', requireRole('Business Assistant'), async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    logAudit('INVOICE_DELETED', req.user.username, { invoiceId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Toggle invoice status
app.put('/api/invoices/:id/status', requireRole('Business Assistant'), async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  try {
    const result = await pool.query(
      'UPDATE invoices SET status=$1, lastmodified=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true, status: result.rows[0].status });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Send invoice via email (with optional file attachment)
const ALLOWED_INVOICE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_INVOICE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPEG, PNG, GIF) are allowed as attachments.'));
    }
  }
});
app.post('/api/invoices/:id/send-email', requireRole('Business Assistant'), invoiceUpload.single('attachment'), async (req, res) => {
  const { recipientEmail } = req.body;
  if (!recipientEmail) return res.status(400).json({ error: 'Recipient email is required' });

  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = result.rows[0];
    const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || []);

    const formatDate = (d) => {
      if (!d) return '';
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };
    const formatCurrency = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

    const lineItemsHtml = lineItems.map((li, i) => `
      <tr style="border-bottom:1px solid #e0e0e0;background:${i % 2 === 0 ? '#fafafa' : '#fff'}">
        <td style="padding:10px 16px;font-size:14px">${escapeHtml(li.description || '')}</td>
        <td style="padding:10px 16px;text-align:center;font-size:14px">${escapeHtml(String(li.qty || 0))}</td>
        <td style="padding:10px 16px;text-align:right;font-size:14px">${formatCurrency(li.unitPrice)}</td>
        <td style="padding:10px 16px;text-align:right;font-size:14px;font-weight:600">${formatCurrency(li.totalPrice)}</td>
      </tr>
    `).join('');

    const html = `
    <div style="max-width:700px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
        <div>
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#1a237e">Proassisting Inc.</h1>
          <p style="margin:4px 0;color:#555;font-size:13px">18761 Chestnut Ct</p>
          <p style="margin:2px 0;color:#555;font-size:13px">Mokena, IL 60448</p>
          <p style="margin:2px 0;color:#555;font-size:13px">(786) 448-9020</p>
          <p style="margin:2px 0;color:#555;font-size:13px">info@proassisting.net</p>
        </div>
        <div style="text-align:right">
          <h2 style="margin:0;font-size:28px;font-weight:800;color:#1a237e">INVOICE #${escapeHtml(String(inv.invoice_number))}</h2>
          <p style="margin:4px 0;font-size:13px;color:#777">Submitted: ${formatDate(inv.invoice_date)}</p>
          ${inv.due_date ? `<p style="margin:4px 0;font-size:13px;color:#777">Due: ${formatDate(inv.due_date)}</p>` : ''}
        </div>
      </div>
      <div style="background:#f5f7ff;padding:14px 18px;border-radius:8px;margin-bottom:20px">
        <p style="margin:0;font-weight:700;color:#1a237e;font-size:12px;text-transform:uppercase;letter-spacing:1px">Invoice For</p>
        <p style="margin:6px 0 2px;font-weight:600;font-size:15px">${escapeHtml(inv.health_center_name || '')}</p>
        ${inv.health_center_address ? `<p style="margin:2px 0;color:#555;font-size:13px">${escapeHtml(inv.health_center_address)}</p>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#1a237e;color:#fff">
            <th style="padding:10px 16px;text-align:left;font-size:12px">Description</th>
            <th style="padding:10px 16px;text-align:center;font-size:12px;width:60px">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;width:100px">Unit Price</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;width:100px">Total Price</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>
      ${inv.notes ? `<div style="background:#f5f7ff;padding:12px 16px;border-radius:8px;margin-bottom:16px"><p style="margin:0;font-weight:700;color:#1a237e;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Notes</p><p style="margin:0;font-size:13px;color:#555">${escapeHtml(inv.notes)}</p></div>` : ''}
      <div style="text-align:right;margin-top:16px">
        <p style="margin:4px 0;font-size:14px"><strong>Subtotal:</strong> ${formatCurrency(inv.subtotal)}</p>
        <div style="display:inline-block;background:#1a237e;color:#fff;padding:10px 24px;border-radius:6px;margin-top:8px">
          <span style="font-weight:800;font-size:16px">TOTAL: ${formatCurrency(inv.total)}</span>
        </div>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e0e0e0"/>
      <p style="text-align:center;color:#999;font-size:11px">This invoice was generated by Proassisting Inc. — adminoffice@proassisting.net</p>
    </div>`;

    const emailFrom = process.env.INVOICE_EMAIL_FROM || process.env.NOTIFICATION_EMAIL_FROM || 'adminoffice@proassisting.net';
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'SendGrid is not configured' });
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const mailMsg = {
      to: recipientEmail,
      from: emailFrom,
      subject: `Invoice #${inv.invoice_number} from Proassisting Inc.`,
      html: html
    };

    // Attach file if provided
    if (req.file) {
      mailMsg.attachments = [{
        content: req.file.buffer.toString('base64'),
        filename: req.file.originalname,
        type: req.file.mimetype,
        disposition: 'attachment'
      }];
    }

    await sgMail.send(mailMsg);

    // Update status to Sent if currently Pending
    if (inv.status === 'Pending') {
      await pool.query("UPDATE invoices SET status='Sent', lastmodified=CURRENT_TIMESTAMP WHERE id=$1", [req.params.id]);
    }

    res.json({ success: true, message: `Invoice emailed to ${recipientEmail}` });
  } catch (err) {
    console.error('Error sending invoice email:', err.message || err);
    const detail = err.response?.body?.errors?.[0]?.message || err.message || 'Unknown error';
    res.status(500).json({ error: `Failed to send email: ${detail}` });
  }
});

// ========== SURGERY REMINDER SYSTEM ==========
// Checks every 5 minutes for surgeries starting within the next 30 minutes
// and sends email reminders to the assigned RSA/Team Leader

// Helper: get current date/time in local timezone (defaults to US Central)
function getLocalNow() {
  const tz = process.env.REMINDER_TIMEZONE || 'America/Chicago';
  const now = new Date();
  const localStr = now.toLocaleString('en-US', { timeZone: tz });
  return new Date(localStr);
}

async function checkAndSendReminders(dryRun = false) {
  const logs = [];
  if (!process.env.SENDGRID_API_KEY) {
    logs.push('SendGrid not configured, skipping reminders');
    return logs;
  }
  try {
    // Get current date and time in LOCAL timezone (not UTC)
    const now = getLocalNow();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMin;
    const reminderWindowEnd = currentMinutes + 30; // 30 minutes from now

    logs.push(`Local time: ${currentHour}:${String(currentMin).padStart(2, '0')} (${todayStr})`);
    logs.push(`Checking for surgeries starting between ${currentMinutes} and ${reminderWindowEnd} minutes from midnight`);

    // Query today's schedules that haven't had reminders sent and have a start_time
    const result = await pool.query(
      `SELECT ps.*, u.fullname 
       FROM personal_schedules ps 
       JOIN users u ON ps.user_id = u.id 
       WHERE ps.schedule_date = $1 
       AND ps.start_time IS NOT NULL 
       AND ps.start_time != '' 
       AND (ps.reminder_sent IS NULL OR ps.reminder_sent = false)`,
      [todayStr]
    );

    logs.push(`Found ${result.rows.length} pending schedule(s) for today`);

    for (const schedule of result.rows) {
      // Parse start_time (format: "HH:MM" or "H:MM")
      const timeParts = schedule.start_time.split(':');
      if (timeParts.length !== 2) {
        logs.push(`Skipping schedule #${schedule.id} - invalid time format: ${schedule.start_time}`);
        continue;
      }
      const scheduleMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

      logs.push(`Schedule #${schedule.id}: ${schedule.fullname} at ${schedule.start_time} (${scheduleMinutes} min) - window: ${currentMinutes}-${reminderWindowEnd}`);

      // Check if the surgery starts within the next 30 minutes (but not already past)
      if (scheduleMinutes > currentMinutes && scheduleMinutes <= reminderWindowEnd) {
        // Look up email from rsa_emails table
        const emailResult = await pool.query(
          'SELECT email FROM rsa_emails WHERE LOWER(rsa_name) = LOWER($1)',
          [schedule.fullname]
        );

        if (emailResult.rows.length === 0) {
          logs.push(`⏰ Reminder skipped for "${schedule.fullname}" - no email found in RSA Emails`);
          if (!dryRun) {
            await pool.query('UPDATE personal_schedules SET reminder_sent = true WHERE id = $1', [schedule.id]);
          }
          continue;
        }

        const recipientEmail = emailResult.rows[0].email;
        const timeRange = escapeHtml(schedule.start_time) + (schedule.end_time ? ` - ${escapeHtml(schedule.end_time)}` : '');
        const physician = escapeHtml(schedule.physician_name || 'N/A');
        const healthCenter = escapeHtml(schedule.health_center_name || 'N/A');
        const notes = escapeHtml(schedule.notes || '');
        const minutesUntil = scheduleMinutes - currentMinutes;

        if (dryRun) {
          logs.push(`✅ WOULD SEND reminder to ${recipientEmail} (${schedule.fullname}) - surgery in ${minutesUntil} min`);
          continue;
        }

        const msg = {
          to: recipientEmail,
          from: process.env.NOTIFICATION_EMAIL_FROM || 'notifications@surgicalforms.com',
          subject: `⏰ Reminder: Surgery in ${minutesUntil} minutes - ${todayStr}`,
          html: `<h2>⏰ Surgery Reminder</h2>
            <p>Hello <strong>${escapeHtml(schedule.fullname)}</strong>,</p>
            <p>This is a reminder that you have a surgery scheduled in approximately <strong>${minutesUntil} minutes</strong>.</p>
            <table style="border-collapse:collapse;width:100%;max-width:500px">
              <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #ddd">${todayStr}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #ddd">${timeRange}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Physician</td><td style="padding:8px;border:1px solid #ddd">${physician}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Health Center</td><td style="padding:8px;border:1px solid #ddd">${healthCenter}</td></tr>
              ${notes ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Notes</td><td style="padding:8px;border:1px solid #ddd">${notes}</td></tr>` : ''}
            </table>
            <p style="margin-top:16px;color:#666">Please prepare accordingly. Good luck!</p>`,
        };

        await sgMail.send(msg);
        logs.push(`⏰ Reminder email sent to ${recipientEmail} (${schedule.fullname}) - surgery at ${schedule.start_time}`);

        // Mark reminder as sent
        await pool.query('UPDATE personal_schedules SET reminder_sent = true WHERE id = $1', [schedule.id]);
      } else if (scheduleMinutes <= currentMinutes) {
        logs.push(`  → Already past, skipping`);
      } else {
        logs.push(`  → Not yet in 30-min window, skipping`);
      }
    }
  } catch (error) {
    logs.push(`❌ Reminder check failed: ${error.message}`);
    console.error('❌ Reminder check failed:', error.message);
  }
  return logs;
}

// Test/debug endpoint to check reminder status
app.get('/api/reminder-check', requireRole('Admin'), async (req, res) => {
  const dryRun = req.query.send !== 'true'; // Default is dry run, add ?send=true to actually send
  const logs = await checkAndSendReminders(dryRun);
  const now = getLocalNow();
  res.json({
    mode: dryRun ? 'DRY RUN (add ?send=true to actually send)' : 'LIVE - emails sent',
    serverTimeUTC: new Date().toISOString(),
    localTime: now.toLocaleString('en-US'),
    timezone: process.env.REMINDER_TIMEZONE || 'America/Chicago',
    logs
  });
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

  // Start the surgery reminder checker (runs every 5 minutes)
  setInterval(checkAndSendReminders, 5 * 60 * 1000);
  // Run once on startup after a short delay
  setTimeout(checkAndSendReminders, 10 * 1000);
  console.log('Surgery reminder checker started (checks every 5 minutes)');

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
