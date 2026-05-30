-- Migration 003: Seed default medical norms for all age groups
-- Idempotent: adds unique index then uses ON CONFLICT DO NOTHING.
-- These defaults match ICAO/flight-medicine guidelines used in US 4.1.

-- Step 1: Ensure age_group is unique so ON CONFLICT resolves correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_norms_age_group
  ON medical_norms (age_group);

-- Step 2: Insert defaults; silently skip if row already exists
INSERT INTO medical_norms (age_group, min_heart_rate, max_heart_rate, spo2_min, stress_max, duration_threshold, delta_hr_percent)
VALUES
  ('18-25', 60, 100, 95.0, 75.0, 30, 25.0),
  ('26-40', 60, 100, 95.0, 75.0, 30, 25.0),
  ('41-60', 60, 95,  95.0, 70.0, 30, 20.0),
  ('61+',   55, 90,  94.0, 65.0, 30, 15.0)
ON CONFLICT (age_group) DO NOTHING;
