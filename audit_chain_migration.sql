-- ============================================================
-- AUDIT LOG ELEVATION MIGRATION
-- Adds hash-chain columns for Pillar 1 (Tamper-Evident Chain)
-- Run this in Neon SQL Editor
-- ============================================================

-- Add prev_hash for chain linking
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash TEXT;

-- Add auto-incrementing sequence number for gap detection
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS sequence_number BIGSERIAL;

-- Index for efficient chain verification and session queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_sequence ON audit_logs(sequence_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time ON audit_logs(actor_id, timestamp);
