-- Clear all existing records from the table
DELETE FROM medical_norms;

-- Insert the corrected data combining medical baselines and system thresholds
INSERT INTO medical_norms (age_group, min_heart_rate, max_heart_rate, spo2_min, stress_max, duration_threshold, delta_hr_percent) VALUES 
('18-25', 60, 100, 95.0, 75.0, 30, 25.0),
('26-40', 60, 100, 95.0, 75.0, 30, 25.0),
('41-60', 60, 100, 95.0, 70.0, 25, 20.0),
('60+', 60, 100, 95.0, 65.0, 20, 20.0);


INSERT INTO medical_norms (age_group, min_heart_rate, max_heart_rate, spo2_min, stress_max, duration_threshold, delta_hr_percent) VALUES 
('6-12', 70, 120, 95.0, 80.0, 30, 30.0),
('13-17', 60, 100, 95.0, 80.0, 30, 30.0);