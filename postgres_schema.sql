-- ============================================================
-- GAFA AML Training Platform — PostgreSQL Schema (Neon)
-- Run this ENTIRE script in Neon SQL Editor (one shot)
-- ============================================================

-- 0. Enable UUID extension (required for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DROP ANY EXISTING TABLES (reverse dependency order)
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS investigations CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS TABLE (replaces Supabase auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROFILES TABLE (role storage, linked to users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 1. CUSTOMERS TABLE
-- ============================================================
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT UNIQUE NOT NULL,
  account_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  date_of_birth DATE,
  occupation TEXT,
  income NUMERIC(12,2),
  country TEXT,
  pan_aadhaar TEXT,
  pep_flag BOOLEAN DEFAULT FALSE,
  last_review DATE,
  risk_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  account_number TEXT,
  amount NUMERIC(12,2) NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  transaction_type TEXT,
  country TEXT,
  country_risk_level TEXT,
  is_new_device BOOLEAN DEFAULT FALSE,
  degree_centrality NUMERIC,
  path_length_hops INTEGER,
  balance_before NUMERIC(12,2),
  balance_after NUMERIC(12,2),
  days_since_last_transaction NUMERIC,
  user_transaction_count_7d INTEGER,
  transaction_frequency_1hr NUMERIC,
  destination_id TEXT,
  rule_triggered TEXT,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  risk_score NUMERIC(5,2),
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ALERTS TABLE
-- ============================================================
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  customer_name TEXT,
  risk_level TEXT,
  rule_triggered TEXT,
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  case_id UUID,
  transaction_id TEXT,
  amount NUMERIC(12,2),
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. RULES TABLE
-- ============================================================
CREATE TABLE rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  threshold TEXT,
  status TEXT DEFAULT 'active',
  alert_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. DOCUMENTS TABLE (KYC uploads)
-- ============================================================
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id),
  document_type TEXT,
  file_name TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. NOTES TABLE
-- ============================================================
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id),
  content TEXT NOT NULL,
  analyst_name TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INVESTIGATIONS TABLE (SAR cases)
-- ============================================================
CREATE TABLE investigations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  customer_name TEXT,
  risk_level TEXT,
  alert_type TEXT,
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  investigation_notes TEXT,
  decision TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. SEED DATA — AML Rules
-- ============================================================
INSERT INTO rules (name, description, threshold, status, alert_count) VALUES
  ('Structuring', 'Multiple deposits just below reporting limit', '2,00,000', 'active', 0),
  ('Velocity Spike', 'Transaction frequency anomaly vs user baseline', '5+ per hour OR 3x average', 'active', 0),
  ('Dormancy Activation', 'Inactive account suddenly active', '90+ days dormant', 'active', 0),
  ('Geographic Risk', 'Transaction involving high-risk jurisdiction', 'FATF grey/blacklist', 'active', 0),
  ('Rapid Fund Movement', 'Large funds moved out quickly after deposit', '80% of balance moved', 'active', 0),
  ('New Device High Value', 'High value transaction from unrecognised device', '2x average amount', 'active', 0),
  ('Layering', 'Multiple rapid transfers indicating layering', '4+ hops, centrality >0.5', 'active', 0),
  ('Round Tripping', 'Funds sent and received back from same counterparty', 'Same amount +/-5%, within 48hrs', 'active', 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. SEED DATA — 5 AML-appropriate customer rows
-- ============================================================
INSERT INTO customers (customer_id, account_number, name, normalized_name, date_of_birth, occupation, income, country, pan_aadhaar, pep_flag, last_review) VALUES
  ('CUST001', 'ACC10001', 'Mohammed Al-Rashid', 'mohammed al-rashid', '1978-03-15', 'Government Official', 45000, 'Nigeria', 'PAN001', TRUE, '2024-01-10'),
  ('CUST002', 'ACC10002', 'Priya Sharma', 'priya sharma', '1990-07-22', 'Business Owner', 120000, 'UAE', 'PAN002', FALSE, '2024-03-05'),
  ('CUST003', 'ACC10003', 'Rajesh Mehta', 'rajesh mehta', '1985-11-08', 'Salaried Employee', 35000, 'India', 'PAN003', FALSE, '2024-02-18'),
  ('CUST004', 'ACC10004', 'Amira Hassan', 'amira hassan', '1972-05-30', 'Import/Export Trader', 80000, 'Nigeria', 'PAN004', FALSE, '2023-12-01'),
  ('CUST005', 'ACC10005', 'Vikram Nair', 'vikram nair', '1995-09-14', 'IT Consultant', 60000, 'India', 'PAN005', FALSE, '2024-04-20')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE — All tables and seed data created
-- No RLS policies (handled by Express.js API auth layer)
-- ============================================================
