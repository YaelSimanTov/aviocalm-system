-- Migration 004: Create vr_events table
-- Stores real VR session events forwarded from Unity via the vr_system_log Socket.io event.
-- Each row represents one tagged Debug.Log message intercepted by the Unity logging system.
-- Idempotent: all statements use IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS vr_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp   TIMESTAMP   NOT NULL DEFAULT NOW(),
    tag         VARCHAR(50) NOT NULL,   -- Unity log tag: '[User Action]', '[Flight Event]', '[System Event]', '[Flight Phase]'
    message     TEXT        NOT NULL    -- remainder of the log string after the tag
);

CREATE INDEX IF NOT EXISTS idx_vr_events_session   ON vr_events (session_id);
CREATE INDEX IF NOT EXISTS idx_vr_events_timestamp ON vr_events (timestamp);
