-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    hourly_rate DECIMAL(10,2) DEFAULT 3.00,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create health_centers table
CREATE TABLE IF NOT EXISTS health_centers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(50),
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
    assistanttype VARCHAR(50),
    firstassistant VARCHAR(255),
    secondassistant VARCHAR(255),
    status VARCHAR(50),
    createdbyuserid INTEGER REFERENCES users(id),
    surgeryformfileurl TEXT,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details JSONB
);

-- Create call_hours table for monthly planner
CREATE TABLE IF NOT EXISTS call_hours (
    id SERIAL PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    assignments JSONB NOT NULL,
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastmodified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- Insert default health centers
INSERT INTO health_centers (name, address, phone) VALUES
    ('General Hospital', '123 Main St', '555-0100'),
    ('City Medical Center', '456 Oak Ave', '555-0200'),
    ('Regional Surgery Center', '789 Pine Rd', '555-0300')
ON CONFLICT (name) DO NOTHING;