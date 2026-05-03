-- AvioCall Database Schema
-- PostgreSQL Schema for Epic 1 & 2
-- Port: 5433, Database: aviocalm

-- Drop existing tables if they exist
DROP TABLE IF EXISTS scene_stress_scores CASCADE;
DROP TABLE IF EXISTS anxiety_profile CASCADE;
DROP TABLE IF EXISTS medical_norms CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table (Epic 1.1)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Owner', 'Therapist')),
    is_first_login BOOLEAN DEFAULT true,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients Table (Epic 2.1)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    national_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    date_of_birth DATE,
    address TEXT,
    medical_history TEXT,
    phobia_type VARCHAR(50) DEFAULT 'Flight',
    phobia_triggers TEXT,
    calming_factors TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    therapist_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Discharged')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table (Epic 2.2)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    therapist_id UUID NOT NULL REFERENCES users(user_id),
    scheduled_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical Norms Table (Epic 4.1)
CREATE TABLE medical_norms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    age_group VARCHAR(20) NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    min_heart_rate INTEGER NOT NULL,
    max_heart_rate INTEGER NOT NULL,
    min_blood_pressure_systolic INTEGER NOT NULL,
    max_blood_pressure_systolic INTEGER NOT NULL,
    min_blood_pressure_diastolic INTEGER NOT NULL,
    max_blood_pressure_diastolic INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anxiety Profile Table (Epic 3.1)

-- CREATE TABLE "anxiety_profiles" (
--     "LogID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     "SessionID" UUID NOT NULL,
--     "RecordedAt" TIMESTAMP NOT NULL,
--     "VrState" VARCHAR(50) NOT NULL,
--     "Difficulty" VARCHAR(50) NOT NULL,
--     "HeartRate" INTEGER,
--     "StressScore" INTEGER,
--     "SpO2" INTEGER,
--     "TherapistAction" VARCHAR(50) DEFAULT 'None'
-- );
-- CREATE TABLE anxiety_profile (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     patient_id UUID NOT NULL REFERENCES patients(id),
--     session_id UUID NOT NULL,
--     timestamp TIMESTAMP NOT NULL,
--     heart_rate INTEGER,
--     blood_pressure_systolic INTEGER,
--     blood_pressure_diastolic INTEGER,
--     gsr DECIMAL(10,4),
--     spo2 DECIMAL(5,2),
--     respiration_rate DECIMAL(8,2),
--     stress_level DECIMAL(5,2),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Scene Stress Scores Table (Epic 3.1)
CREATE TABLE scene_stress_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    session_id UUID NOT NULL,
    scene_id VARCHAR(50) NOT NULL,
    weighted_stress_score DECIMAL(5,2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    peak_stress_level DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_patients_therapist ON patients(therapist_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_therapist ON appointments(therapist_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_anxiety_profile_patient ON anxiety_profile(patient_id);
CREATE INDEX idx_anxiety_profile_session ON anxiety_profile(session_id);
CREATE INDEX idx_anxiety_profile_timestamp ON anxiety_profile(timestamp);
CREATE INDEX idx_scene_stress_patient ON scene_stress_scores(patient_id);
CREATE INDEX idx_scene_stress_session ON scene_stress_scores(session_id);

-- Insert default owner user (admin / Admin123!)
-- Password: Admin123! (meets requirements: 8+ chars, uppercase, lowercase, special, number)
INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name) VALUES 
('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'random_salt_here', 'Owner', false, 'System', 'Administrator');

-- Insert basic medical norms
INSERT INTO medical_norms (age_group, health_status, min_heart_rate, max_heart_rate, min_blood_pressure_systolic, max_blood_pressure_systolic, min_blood_pressure_diastolic, max_blood_pressure_diastolic) VALUES 
('18-25', 'Healthy', 60, 100, 90, 120, 60, 80),
('26-40', 'Healthy', 60, 100, 90, 130, 60, 85),
('41-60', 'Healthy', 60, 100, 90, 140, 60, 90),
('18-25', 'At Risk', 70, 110, 95, 130, 65, 85),
('26-40', 'At Risk', 70, 110, 95, 140, 65, 90),
('41-60', 'At Risk', 70, 110, 95, 150, 65, 95);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


