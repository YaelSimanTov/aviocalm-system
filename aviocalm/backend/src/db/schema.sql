-- AvioCall Database Schema
-- PostgreSQL Schema for Epic 1, 2, & 6
-- Port: 5433, Database: aviocalm

-- Drop existing tables if they exist (order matters for foreign key dependencies)
DROP TABLE IF EXISTS scene_stress_scores CASCADE;
DROP TABLE IF EXISTS anxiety_profiles CASCADE;
DROP TABLE IF EXISTS medical_norms CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS patient_assignments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS kits CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
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

-- Sessions Table (New Epic 2.3 & 3.1)
-- Manages concurrent clinic sessions and historical treatment data
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_minutes INTEGER,
    overall_hrv_rmssd DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Halted'))
);

-- Anxiety Profiles Table (Epic 3.1)
CREATE TABLE anxiety_profiles (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id VARCHAR(20) NOT NULL REFERENCES patients(national_id),
    session_id UUID NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    vr_state VARCHAR(50) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    heart_rate INTEGER,
    stress_score INTEGER,
    spo2 INTEGER,
    therapist_action VARCHAR(50) DEFAULT 'None',
    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Scene Stress Scores Table (Epic 3.1)
CREATE TABLE scene_stress_scores (
    score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id),
    vr_state VARCHAR(50) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    avg_heart_rate DECIMAL(5,2) NOT NULL,
    peak_stress_score DECIMAL(5,2) NOT NULL,
    calculated_weighted_score DECIMAL(5,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scene_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);



-- Medical Norms Table (Epic 4.1)
CREATE TABLE medical_norms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    age_group VARCHAR(20) NOT NULL,
    min_heart_rate INTEGER NOT NULL,
    max_heart_rate INTEGER NOT NULL,
    spo2_min FLOAT NOT NULL,
    stress_max FLOAT NOT NULL,
    duration_threshold INTEGER NOT NULL,
    delta_hr_percent FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient Baselines Table (Epic 4.1)
CREATE TABLE patient_baselines (
    baseline_id SERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id),
    avg_resting_hr FLOAT NOT NULL,
    avg_resting_stress FLOAT NOT NULL,
    calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices Table (Epic 6.1)
-- Manages individual hardware devices (VR headsets and smartwatches)
CREATE TABLE devices (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('VR', 'Watch')),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Broken', 'Maintenance')),
    last_seen TIMESTAMP
);

-- Kits Table (Epic 6.1)
-- Packages VR and Watch devices into assignable working units
CREATE TABLE kits (
    kit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vr_device_id UUID NOT NULL REFERENCES devices(device_id),
    watch_device_id UUID NOT NULL REFERENCES devices(device_id)
);

-- Patient Assignments Table (Epic 6.2)
-- Tracks which kit is currently assigned to which patient
CREATE TABLE patient_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    kit_id UUID NOT NULL REFERENCES kits(kit_id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP
);

-- Create unique partial index to prevent double-booking of kits
-- Only applies to active assignments (where unassigned_at IS NULL)
CREATE UNIQUE INDEX idx_unique_active_kit ON patient_assignments (kit_id) WHERE unassigned_at IS NULL;

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_patients_therapist ON patients(therapist_id);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_anxiety_profiles_session ON anxiety_profiles(session_id);
CREATE INDEX idx_anxiety_profiles_timestamp ON anxiety_profiles(recorded_at);
CREATE INDEX idx_scene_stress_scores_patient ON scene_stress_scores(patient_id);
CREATE INDEX idx_scene_stress_scores_session ON scene_stress_scores(session_id);
CREATE INDEX idx_scene_stress_scores_vrstate ON scene_stress_scores(vr_state);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_kits_vr_device ON kits(vr_device_id);
CREATE INDEX idx_kits_watch_device ON kits(watch_device_id);
CREATE INDEX idx_patient_assignments_patient ON patient_assignments(patient_id);
CREATE INDEX idx_patient_assignments_kit ON patient_assignments(kit_id);
CREATE INDEX idx_patient_assignments_assigned_at ON patient_assignments(assigned_at);

-- Insert default owner user (admin / Admin123!)
-- Password: Admin123! (meets requirements: 8+ chars, uppercase, lowercase, special, number)
INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name) VALUES 
('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'random_salt_here', 'Owner', false, 'System', 'Administrator');

-- Insert basic medical norms with safety thresholds
INSERT INTO medical_norms (age_group, min_heart_rate, max_heart_rate, spo2_min, stress_max, duration_threshold, delta_hr_percent) VALUES 
('18-25', 60, 100, 95.0, 75.0, 30, 25.0),
('26-40', 60, 100, 95.0, 75.0, 30, 25.0),
('41-60', 60, 100, 94.0, 70.0, 25, 20.0),
('60+', 70, 110, 96.0, 65.0, 20, 20.0);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


