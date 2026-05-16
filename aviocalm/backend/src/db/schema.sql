-- AvioCall Database Schema
-- PostgreSQL Schema for Epic 1 & 2
-- Port: 5433, Database: aviocalm

-- Drop existing tables if they exist
DROP TABLE IF EXISTS scene_stress_scores CASCADE;
DROP TABLE IF EXISTS anxiety_profiles CASCADE;
DROP TABLE IF EXISTS medical_norms CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
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

-- Treatment Decisions Table (Epic 4.3 - Asynchronous Recommendation & Audit)
-- Logs system recommendations vs. patient's actual difficulty selections
CREATE TABLE treatment_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    suggested_difficulty INTEGER NOT NULL CHECK (suggested_difficulty >= 1 AND suggested_difficulty <= 5),
    actual_difficulty_selected_by_patient INTEGER NOT NULL CHECK (actual_difficulty_selected_by_patient >= 1 AND actual_difficulty_selected_by_patient <= 5),
    system_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session Difficulty Levels Table (Epic 4.3 - Multi-Difficulty Session Mapping)
-- Stores individual difficulty levels within a single session for chronological tracking
CREATE TABLE session_difficulty_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    difficulty_level VARCHAR(50) NOT NULL CHECK (difficulty_level IN ('Easy', 'Medium', 'Hard', 'None')),
    vr_state VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


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
CREATE INDEX idx_treatment_decisions_session ON treatment_decisions(session_id);
CREATE INDEX idx_treatment_decisions_patient ON treatment_decisions(patient_id);
CREATE INDEX idx_session_difficulty_levels_session ON session_difficulty_levels(session_id);

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


