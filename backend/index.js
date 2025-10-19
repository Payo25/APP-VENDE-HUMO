require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
});

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Log all environment variables at startup for debugging
// console.log('ENV VARS:', process.env);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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
  const {
    patientName, dob, insuranceCompany,
    healthCenterName, timeIn, timeOut, doctorName, procedure, caseType, status, createdByUserId, date
  } = req.body;
  // Validate required fields
  if (!patientName || !dob || !insuranceCompany || !healthCenterName || !date || !doctorName || !procedure || !caseType || !status || !createdByUserId || !req.file || (caseType !== 'Cancelled' && (!timeIn || !timeOut))) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO forms (patientName, dob, insuranceCompany, healthCenterName, date, timeIn, timeOut, doctorName, procedure, caseType, status, createdByUserId, surgeryFormFileUrl, createdAt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [patientName, dob, insuranceCompany, healthCenterName, date, timeIn, timeOut, doctorName, procedure, caseType, status, createdByUserId, `/uploads/${req.file.filename}`, new Date().toISOString()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
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
      paramCount++;
      setClause += (setClause ? ', ' : '') + `surgeryformfileurl = $${paramCount}`;
      values.push(`/uploads/${req.file.filename}`);
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
    const result = await pool.query('SELECT id, username, role, fullname FROM users ORDER BY id DESC');
    // Map fullname to fullName for frontend compatibility and remove raw fullname
    const users = result.rows.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullname
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
  const { role, fullName, username } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, fullName = $2, username = $3 WHERE id = $4 RETURNING id, username, role, fullName',
      [role, fullName, username, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
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
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
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
    if (exists.rows.length > 0) {
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
    res.json({ success: true });
  } catch (err) {
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
  const indexPath = path.join(__dirname, '../frontend/build/index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('ERROR: frontend/build/index.html not found. Make sure the frontend is built before starting the backend.');
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
/ /   A c t i v a n d o   l o g i n   c o n   i d e n t i d a d   l i s t a  
 / /   A c t i v a n d o   l o g i n   c o n   i d e n t i d a d   c o r r e g i d a  
 / /   A c t i v a n d o   l o g i n   c o n   i d e n t i d a d   c o r r e g i d a  
 