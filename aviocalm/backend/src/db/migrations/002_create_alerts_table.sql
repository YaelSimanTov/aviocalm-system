-- Migration 002: Create alerts table and add session_id to patient_baselines
-- Run this script once against an existing aviocalm database.
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add session_id to patient_baselines
--    Needed so the rule engine can store one baseline row per session and use
--    ON CONFLICT (session_id) to safely upsert during calibration.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patient_baselines
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_baselines_session
  ON patient_baselines (session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create alerts table (Epic 4.1)
--    Each row represents one resolved threshold breach with its full duration.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID        NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  session_id       UUID        NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  timestamp        TIMESTAMP   NOT NULL,                         -- breach start time
  duration_seconds INTEGER     NOT NULL DEFAULT 0,               -- how long until stabilisation
  alert_type       VARCHAR(20) NOT NULL CHECK (alert_type IN ('Safety', 'Statistical', 'Panic')),
  description      TEXT        NOT NULL,
  is_read          BOOLEAN     DEFAULT false,
  created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient    ON alerts (patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_session    ON alerts (session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read    ON alerts (is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at);
