-- Migration 006: Add sequential human-readable kit_number to the kits table
-- Run once against an existing aviocalm database.
-- SERIAL automatically backfills existing rows with sequential integers
-- and auto-increments for every new kit going forward.
-- The UUID primary key (kit_id) is unchanged — all FK relationships remain intact.

ALTER TABLE kits ADD COLUMN kit_number SERIAL UNIQUE;
