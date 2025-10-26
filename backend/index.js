require('dotenv').config();
const { Pool } = require('pg');
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
    res.json({ 
      status: 'ok', 
      database: result.rows[0],
      userCount: userCheck.rows[0].count,
      hasEnvVar: !!process.env.DATABASE_URL
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      hasEnvVar: !!process.env.DATABASE_URL
    });
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
      dob: form.dob,
      insuranceCompany: form.insurancecompany,
      healthCenterName: form.healthcentername,
      date: form.date,
      timeIn: form.timein,
      timeOut: form.timeout,
      doctorName: form.doctorname,
      procedure: form.procedure,
      caseType: form.casetype,
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
    // Format dates for HTML input compatibility
    const formatDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';
    const camelCaseForm = {
      id: form.id,
      patientName: form.patientname,
      dob: formatDate(form.dob),
      insuranceCompany: form.insurancecompany,
      healthCenterName: form.healthcentername,
      date: formatDate(form.date),
      timeIn: form.timein,
      timeOut: form.timeout,
      doctorName: form.doctorname,
      procedure: form.procedure,
      caseType: form.casetype,
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
    healthCenterName, timeIn, timeOut, doctorName, procedure, caseType, status, createdByUserId, date
  } = req.body;
  
  // Validate required fields
  if (!patientName || !dob || !insuranceCompany || !healthCenterName || !date || !doctorName || !procedure || !caseType || !status || !createdByUserId || !req.file || (caseType !== 'Cancelled' && (!timeIn || !timeOut))) {
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
      `INSERT INTO forms (patientname, dob, insurancecompany, healthcentername, date, timein, timeout, doctorname, procedure, casetype, status, createdbyuserid, surgeryformfileurl, createdat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [patientName, dob, insuranceCompany, healthCenterName, date, timeIn, timeOut, doctorName, procedure, caseType, status, createdByUserId, fileUrl, new Date().toISOString()]
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

app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
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
  if (actorRole !== 'Business Assistant') return res.status(403).json({ error: 'Forbidden' });
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
  const { name, address, phone, contactPerson } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    const result = await pool.query(
      'INSERT INTO health_centers (name, address, phone, contact_person) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, address || '', phone || '', contactPerson || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/health-centers/:id', async (req, res) => {
  const { name, address, phone, contactPerson } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    const result = await pool.query(
      'UPDATE health_centers SET name=$1, address=$2, phone=$3, contact_person=$4 WHERE id=$5 RETURNING *',
      [name, address || '', phone || '', contactPerson || '', req.params.id]
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
