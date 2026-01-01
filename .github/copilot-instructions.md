# Copilot instructions for Surgical Forms App

Full-stack medical records app: React (TypeScript) + Node/Express + PostgreSQL + Azure Blob Storage. Backend serves production React build from `backend/build` via IIS/iisnode on Azure App Service.

## Architecture and data flow
- **Frontend** (Create React App): TypeScript SPA in `frontend/` using react-router-dom. Calls backend at `/api` (same origin). Auth is **client-side only** via `localStorage` keys: `user` (username), `role`, `userId`, `fullName`. No JWTs or server sessions.
- **Backend** (`backend/index.js`): Express server with pg connection pool. Auto-migrates schema on startup via `migrateDatabase()`. Serves static build from `./backend/build` in production.
- **Database**: PostgreSQL with snake_case columns. Five tables: `users`, `forms`, `health_centers`, `call_hours`, `audit_logs`. See `backend/schema.sql`.
- **File uploads**: Multer captures files (10MB limit, jpeg/png/gif/pdf). `uploadToBlob()` sends to Azure Blob `uploads` container; returns 10-year SAS URL stored in `forms.surgeryformfileurl`.
- **Date handling quirk**: `pg-types.setTypeParser(1082, val => val)` in index.js forces PostgreSQL DATE columns to return as strings, preventing timezone shifts.

## API endpoints (backend/index.js)
- **Forms**: `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/:id`. POST/PUT accept `multipart/form-data` with optional `surgeryFormFile`. Response maps DB snake_case  camelCase (e.g., `patientname`  `patientName`).
- **Users**: `GET/POST/PUT/DELETE /api/users`, `PUT /api/users/:id/password`. GET returns `{ id, username, role, fullName, hourlyRate }`.
- **Auth**: `POST /api/login` checks bcrypt hash, returns `{ id, username, role, fullName }`, calls `logAudit('LOGIN', username, {userId})`.
- **Audit logs**: `GET /api/audit-logs` returns all logs; `logAudit(action, actor, details)` helper inserts JSONB details.
- **Call hours**: `GET/POST /api/call-hours?month=X&year=Y`. POST requires `actorRole` in body (validates Business Assistant/Team Leader). `assignments` column is JSONB storing `{date: [{id, shift, hours, minutes}]}`.
- **Health centers**: CRUD at `/api/health-centers`. GET returns snake_case (`contact_person`); standardize or map client-side.
- **Health check**: `GET /api/health` returns DB connection status + version.

## Data model conventions
- **Naming**: DB uses `snake_case`; API maps to `camelCase` at boundary. Example: `createdbyuserid` (DB)  `createdByUserId` (API). Always maintain this split.
- **Timestamps**: Every table has `createdat`/`lastmodified`. Always update `lastmodified` on writes.
- **Forms legacy fields**: Prefer `createdByUserId` over deprecated `createdBy`. New fields: `assistanttype`, `firstassistant`, `secondassistant`.
- **JSONB fields**: `call_hours.assignments` (nested objects/arrays), `audit_logs.details` (arbitrary JSON).

## Dev workflows (Windows PowerShell)
**Backend** (requires `DATABASE_URL` env var):
``powershell
cd "c:\Medical App\surgical-forms-app-main\backend"
npm install
npm run init-db  # creates tables from schema.sql
npm start        # runs on port 5043
``
Utilities: `node create-admin.js` (creates admin user), `node test-login.js` (tests auth), `node update-schema.js` (applies migrations).

**Frontend** (proxies to backend via `"proxy": "http://localhost:5043"`):
``powershell
cd "c:\Medical App\surgical-forms-app-main\frontend"
npm install
npm start  # dev server on port 3000
``

**Production build**:
``powershell
cd frontend; npm run build  # outputs to frontend/build
# Copy frontend/build  backend/build for deployment
``

**Azure deployment**: Backend serves `./backend/build` via `web.config` IIS rewrite rules. GitHub Actions workflow auto-deploys on push to main. See `DEPLOYMENT_GUIDE.md`.

## Environment variables
**Required**: `DATABASE_URL` (PostgreSQL connection string with `?sslmode=require` for Azure).  
**Optional**:
- **Azure Blob**: `AZURE_STORAGE_CONNECTION` (connection string with AccountKey). Auto-parsed by `uploadToBlob()`.
- **SendGrid email**: `SENDGRID_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_EMAIL_TO` (comma-separated).
- **Twilio SMS**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_FROM`, `NOTIFICATION_PHONE_TO`.
- `APP_URL` for email link generation.

## Patterns and gotchas
1. **Always map snake_case  camelCase** at API boundary. Example in `GET /api/forms`: `form.patientname`  `patientName`. Never mix casing in API responses.
2. **Forms editing**: `PUT /api/forms/:id` accepts both JSON and `multipart/form-data`. If `req.file` exists, call `uploadToBlob()` and update `surgeryformfileurl`. Always update `lastmodified = new Date().toISOString()`.
3. **Authentication flow**: `POST /api/login` validates bcrypt password, returns user object (no token). Client stores in localStorage. All route protection is **client-side** in `App.tsx` `ProtectedRoute`. Server does not enforce auth except via `actorRole` param checks (e.g., call hours POST).
4. **Audit logging**: Server-side `logAudit()` auto-logs on login. Frontend MAY reference `POST /api/audit-login` or `/api/audit-action` (not implemented). Rely on server-side logging in critical endpoints.
5. **Call hours assignments structure**: JSONB like `{"2026-01-15": [{"id": "3", "shift": "F", "hours": 24, "minutes": 0}]}`. Frontend in `CallHoursPage.tsx` manages this complex state; uses `getDateString(year, month, day)` for keys.
6. **Health centers API inconsistency**: Returns snake_case (`contact_person`, `fax`, `email`). Map to camelCase client-side or refactor server to match other endpoints.
7. **Auto-migration**: `migrateDatabase()` in index.js runs on startup, adds columns if missing (e.g., `contact_person`, `firstassistant`). Safe for production but log carefully.

## Tech stack specifics
- **Frontend**: React 19, TypeScript 4.9, react-router-dom 7, react-icons, jsPDF + html2canvas (PDF export in CallHoursPage).
- **Backend**: Express 5, pg 8 (PostgreSQL driver), bcryptjs (passwords), multer 2 (file uploads), @azure/storage-blob, @sendgrid/mail, twilio.
- **Deployment**: Azure App Service (Windows) with IIS/iisnode. `web.config` rewrites `/`  `build/index.html`, `/api/*`  `index.js`.

If unclear: consult `DEPLOYMENT_GUIDE.md` (Azure config), `NOTIFICATION_SETUP.md` (email/SMS), `schema.sql` (DB structure), or `web.config` (IIS routing).
