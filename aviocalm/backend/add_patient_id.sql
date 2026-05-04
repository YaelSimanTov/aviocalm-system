ALTER TABLE anxiety_profiles ADD COLUMN patient_id UUID REFERENCES patients(id);
