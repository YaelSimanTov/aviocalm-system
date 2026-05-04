-- Fix for anxiety_profiles table - Add missing patient_id column
-- Run this command manually in PostgreSQL:
-- psql -U postgres -d aviocalm -f fix_anxiety_profiles.sql

ALTER TABLE anxiety_profiles ADD COLUMN patient_id UUID REFERENCES patients(id);

-- Verify the column was added
\d anxiety_profiles;
