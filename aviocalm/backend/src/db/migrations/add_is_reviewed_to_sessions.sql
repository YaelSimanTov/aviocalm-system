-- Migration: Add is_reviewed column to sessions table
-- Run this once against the existing database to apply the schema change.
-- New sessions will default to is_reviewed = false (unread).
-- Existing sessions are set to is_reviewed = true so no false "unread" dots appear for old data.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT false;

-- Mark all existing completed sessions as already reviewed
-- so therapists only see dots for truly new sessions going forward.
UPDATE sessions
  SET is_reviewed = true
  WHERE status = 'Completed';
