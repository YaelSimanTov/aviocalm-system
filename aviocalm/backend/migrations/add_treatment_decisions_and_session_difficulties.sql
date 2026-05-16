-- Migration for Epic 4, User Story 4.3: Asynchronous Recommendation & Audit
-- This migration adds support for treatment decisions and session difficulty tracking

-- Create TreatmentDecisions table
CREATE TABLE IF NOT EXISTS treatment_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id),
    suggested_difficulty INTEGER NOT NULL CHECK (suggested_difficulty >= 1 AND suggested_difficulty <= 5),
    actual_difficulty_selected_by_patient INTEGER NOT NULL CHECK (actual_difficulty_selected_by_patient >= 1 AND actual_difficulty_selected_by_patient <= 5),
    system_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create SessionDifficultyLevels table to track multiple difficulties per session
CREATE TABLE IF NOT EXISTS session_difficulty_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    vr_state VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_treatment_decisions_session ON treatment_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_treatment_decisions_patient ON treatment_decisions(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_decisions_timestamp ON treatment_decisions(system_timestamp);
CREATE INDEX IF NOT EXISTS idx_session_difficulty_levels_session ON session_difficulty_levels(session_id);
CREATE INDEX IF NOT EXISTS idx_session_difficulty_levels_started_at ON session_difficulty_levels(started_at);

-- Create updated_at trigger function for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_treatment_decisions_updated_at ON treatment_decisions;
CREATE TRIGGER update_treatment_decisions_updated_at BEFORE UPDATE ON treatment_decisions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the tables
COMMENT ON TABLE treatment_decisions IS 'Stores system-recommended and patient-selected difficulty levels for treatment sessions (Epic 4.3)';
COMMENT ON TABLE session_difficulty_levels IS 'Tracks chronological difficulty level changes within a single session (Epic 4.3)';
