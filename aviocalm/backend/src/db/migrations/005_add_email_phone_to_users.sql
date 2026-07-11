-- Migration 005: Add email and phone_number columns to the users table
-- Run once against an existing aviocalm database.
-- Idempotent: ADD COLUMN IF NOT EXISTS prevents errors on repeated runs.
-- Both columns are nullable so existing rows are unaffected.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email        VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Index on email enables fast uniqueness checks during registration
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
