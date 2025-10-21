-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create forms table
CREATE TABLE IF NOT EXISTS forms (
    id SERIAL PRIMARY KEY,
    patientname VARCHAR(255) NOT NULL,
    dob DATE,
    insurancecompany VARCHAR(255),
    healthcentername VARCHAR(255),
    date DATE,
    timein VARCHAR(50),
    timeout VARCHAR(50),
    doctorname VARCHAR(255),
    procedure TEXT,
    casetype VARCHAR(100),
    status VARCHAR(50),
    createdbyuserid INTEGER REFERENCES users(id),
    surgeryformfileurl TEXT,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);