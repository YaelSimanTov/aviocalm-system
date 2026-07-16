-- Migration 007: Add pre-computed KPI columns to the sessions table.
-- These columns are populated once when a session ends (in completeSessionWithHRV),
-- replacing on-the-fly aggregation in the analytics API endpoint.
-- All columns are nullable so existing completed sessions remain valid rows.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avg_heart_rate        INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avg_spo2              INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avg_stress_score      DECIMAL(5,2);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_relaxed_percent  INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_moderate_percent INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time_panic_percent    INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_data_points     INTEGER;
