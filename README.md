# Surgical Forms App

A full-stack web application for managing surgical forms, user accounts, audit logs, and monthly call hours for Registered Surgical Assistants (RSAs) and Business Assistants.

---

## Features

- **User Authentication** (Admin, RSA, Business Assistant roles)
- **Surgical Form Management** (Create, View, Edit, Delete, Upload files)
- **User Management** (Admin only)
- **Audit Logs**
- **Monthly Call Hours Planner**
- **Role-based Access Control**
- **Responsive UI** (React)
- **Secure File Uploads**

---

## Tech Stack

- **Frontend:** React, TypeScript, react-icons
- **Backend:** Node.js, Express, PostgreSQL, Multer
- **Database:** PostgreSQL (cloud or local)
- **Deployment:** Render.com (or any Node/React-friendly host)

---

## Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/yourusername/surgical-forms-app.git
cd surgical-forms-app
```

### 2. Setup the Backend

```sh
cd backend
npm install
```

- Create a `.env` file in the `backend` folder:
  ```
  DATABASE_URL=your_postgres_connection_string
  ```

- **Create the required tables** (example for PostgreSQL):

  ```sql
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    fullName VARCHAR(255) NOT NULL
  );

  CREATE TABLE forms (
    id SERIAL PRIMARY KEY,
    patientName VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    insuranceCompany VARCHAR(255) NOT NULL,
    healthCenterName VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    timeIn TIME NOT NULL,
    timeOut TIME NOT NULL,
    doctorName VARCHAR(255) NOT NULL,
    procedure TEXT NOT NULL,
    caseType VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    createdBy VARCHAR(255) NOT NULL,
    surgeryFormFileUrl VARCHAR(255),
    createdAt TIMESTAMP,
    lastModified TIMESTAMP
  );

  CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    action VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details JSONB
  );

  CREATE TABLE call_hours (
    id SERIAL PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    assignments JSONB NOT NULL
  );

  CREATE TABLE health_centers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address VARCHAR(255),
    phone VARCHAR(50),
    contact_person VARCHAR(255)
);
  ```

### 3. Setup the Frontend

```sh
cd ../frontend
npm install
```

### 4. Development

- **Start the backend:**
  ```sh
  cd backend
  npm start
  ```
- **Start the frontend:**
  ```sh
  cd ../frontend
  npm start
  ```

### 5. Build for Production

- **Build the frontend:**
  ```sh
  cd frontend
  npm run build
  ```
- The backend will serve the production build automatically.

---

## Deployment

- Deploy both `frontend` and `backend` to [Render](https://render.com/) or your preferred host.
- Set the `DATABASE_URL` environment variable in your deployment settings.
- The backend serves the React build and static uploads.

---

## File Uploads

- Uploaded files are stored in `/backend/uploads` and served at `/uploads/filename`.
- For production, consider using a cloud storage solution (e.g., AWS S3).

---

## Customization

- **Change favicon, app name, and description:**  
  Edit `frontend/public/index.html` and `frontend/public/manifest.json`.
- **Icons:**  
  Uses [react-icons](https://react-icons.github.io/react-icons/).

---

## License

MIT

---

## Credits

Developed by Pablo Hernandez Borges
Inspired by the needs of surgical assistants and business staff at ProAssisting.

## Copilot & AI Assistance

This project was developed with the help of **GitHub Copilot** to accelerate development, improve code quality, and assist with best practices. Transparency in the use of AI tools is important for this project.
