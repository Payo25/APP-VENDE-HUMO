# Copilot instructions for Surgical Forms App

Full‑stack app: React (TypeScript) + Node/Express + PostgreSQL + Azure Blob Storage. The backend also serves the production React build from `backend/build`.

## Architecture and data flow
- Frontend (CRA) under `frontend/` calls the API at `/api` (same origin). Routes live in `src/App.tsx`; auth is client‑side via `localStorage` keys `user`, `role`, `userId`.
- Backend (`backend/index.js`) endpoints:
  - Forms: `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/:id` (PUT accepts JSON or `multipart/form-data` with `surgeryFormFile`).
  - Users: `GET/POST/PUT/DELETE /api/users`, password: `PUT /api/users/:id/password`.
  - Auth: `POST /api/login` → `{ id, username, role, fullName }` (no JWT; stored client‑side).
  - Audit logs: `GET /api/audit-logs` and `logAudit()` helper used server‑side.
  - Call hours: `GET/POST /api/call-hours` (writes require `actorRole` of Business Assistant/Team Leader).
  - Health centers: CRUD at `/api/health-centers`.
- File uploads go to Azure Blob `uploads` container; server returns a long‑lived SAS URL used directly in the UI.

## Data model and naming
- Schema: `backend/schema.sql` (tables: users, forms, audit_logs, call_hours, health_centers).
- Convention: DB uses snake_case; API maps to camelCase for the UI (see `/api/forms` mapping). Keep this consistent for new fields.
- Forms: prefer `createdByUserId` (legacy `createdBy` may appear but is being phased out). `call_hours.assignments` is JSONB (object or string accepted by API).

## Dev workflows (Windows PowerShell)
- Backend (requires `DATABASE_URL`):
  ```powershell
  cd "c:\\Medical App\\surgical-forms-app-main\\backend"; npm install; npm run init-db; npm start
  ```
  Utilities: `node create-admin.js`, `node test-login.js`, `node update-schema.js`.
- Frontend dev:
  ```powershell
  cd "c:\\Medical App\\surgical-forms-app-main\\frontend"; npm install; npm start
  ```
- Production: build UI and ensure backend serves `./backend/build` (App Service rewrite via `web.config`).

## Environment and integrations
- Required: `DATABASE_URL`. Optional: `AZURE_STORAGE_CONNECTION` (Blob), SendGrid: `SENDGRID_API_KEY` + `NOTIFICATION_EMAIL_*`, Twilio: `TWILIO_*`, `APP_URL` for email links. See `NOTIFICATION_SETUP.md` and `AZURE_MIGRATION_GUIDE.md`.
- Uploads: 10MB limit; mimetypes jpeg/png/gif/pdf; see `multer` + `uploadToBlob()`.

## Patterns and gotchas
- Keep snake_case in DB, map to camelCase at the API boundary; always update `lastmodified` on writes (see PUT `/api/forms/:id`).
- Support both JSON updates and `multipart/form-data` with optional `surgeryFormFile` when editing forms.
- No server sessions/JWT; client gates routes. For sensitive writes, validate explicit intent (e.g., `actorRole`).
- Frontend references `POST /api/audit-login` and `/api/audit-action` but backend lacks these; either add thin wrappers calling `logAudit()` or update the UI to rely on server‑side logging already in place.
- Health centers GET returns snake_case; map to `contactPerson` client‑side or standardize the API before broad UI changes.

If anything is unclear (build serving path, auth expectations, audit endpoints), flag it and we’ll refine these notes.