-- ============================================================
-- GAFA — User Data Isolation Migration
-- Run this in Supabase SQL Editor to add user-level data isolation
-- ============================================================

-- Add uploaded_by column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

-- Add uploaded_by column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

-- Add uploaded_by column to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

-- Create indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_customers_uploaded_by ON customers(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_transactions_uploaded_by ON transactions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_alerts_uploaded_by ON alerts(uploaded_by);

-- ============================================================
-- NOTE: Existing data will have uploaded_by = NULL.
-- It will NOT be visible to any user until reassigned.
-- To assign existing data to a specific user, run:
--
--   UPDATE customers SET uploaded_by = '<user-uuid>' WHERE uploaded_by IS NULL;
--   UPDATE transactions SET uploaded_by = '<user-uuid>' WHERE uploaded_by IS NULL;
--   UPDATE alerts SET uploaded_by = '<user-uuid>' WHERE uploaded_by IS NULL;
-- ============================================================
