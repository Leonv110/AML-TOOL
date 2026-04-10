-- ============================================================
-- GAFA AML Training Platform — Supabase Migration
-- Run this ENTIRE script in Supabase SQL Editor (one shot)
-- ============================================================

-- 0. DROP ANY EXISTING TABLES (reverse dependency order)
-- This ensures a clean slate if old tables exist with different schemas
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS investigations CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- 1. CUSTOMERS TABLE (the Bible — everything links to this)
CREATE TABLE IF NOT EXISTS customers (
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TRANSACTIONS TABLE (links to customers via customer_id)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  account_number TEXT,
  amount NUMERIC(12,2) NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  transaction_type TEXT,
  country TEXT,
  country_risk_level TEXT,
  rule_triggered TEXT,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  risk_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  customer_name TEXT,
  risk_level TEXT,
  rule_triggered TEXT,
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  case_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RULES TABLE
CREATE TABLE IF NOT EXISTS rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  threshold TEXT,
  status TEXT DEFAULT 'active',
  alert_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DOCUMENTS TABLE (KYC uploads)
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id),
  document_type TEXT,
  file_name TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 6. NOTES TABLE (analyst comments on customer profiles)
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id),
  content TEXT NOT NULL,
  analyst_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INVESTIGATIONS TABLE (SAR cases)
CREATE TABLE IF NOT EXISTS investigations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  customer_name TEXT,
  risk_level TEXT,
  alert_type TEXT,
  status TEXT DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  investigation_notes TEXT,
  decision TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Insert 8 AML rules
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

-- 9. SEED DATA — 5 AML-appropriate customer rows
INSERT INTO customers (customer_id, account_number, name, normalized_name, date_of_birth, occupation, income, country, pan_aadhaar, pep_flag, last_review) VALUES
  ('CUST001', 'ACC10001', 'Mohammed Al-Rashid', 'mohammed al-rashid', '1978-03-15', 'Government Official', 45000, 'Nigeria', 'PAN001', TRUE, '2024-01-10'),
  ('CUST002', 'ACC10002', 'Priya Sharma', 'priya sharma', '1990-07-22', 'Business Owner', 120000, 'UAE', 'PAN002', FALSE, '2024-03-05'),
  ('CUST003', 'ACC10003', 'Rajesh Mehta', 'rajesh mehta', '1985-11-08', 'Salaried Employee', 35000, 'India', 'PAN003', FALSE, '2024-02-18'),
  ('CUST004', 'ACC10004', 'Amira Hassan', 'amira hassan', '1972-05-30', 'Import/Export Trader', 80000, 'Nigeria', 'PAN004', FALSE, '2023-12-01'),
  ('CUST005', 'ACC10005', 'Vikram Nair', 'vikram nair', '1995-09-14', 'IT Consultant', 60000, 'India', 'PAN005', FALSE, '2024-04-20')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on sensitive tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can SELECT/INSERT/UPDATE/DELETE
-- Using DROP + CREATE pattern (PostgreSQL doesn't support IF NOT EXISTS on CREATE POLICY)

-- CUSTOMERS
DROP POLICY IF EXISTS "Authenticated users can read customers" ON customers;
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;
CREATE POLICY "Authenticated users can delete customers"
  ON customers FOR DELETE TO authenticated USING (true);

-- TRANSACTIONS
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON transactions;
CREATE POLICY "Authenticated users can read transactions"
  ON transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;
CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update transactions" ON transactions;
CREATE POLICY "Authenticated users can update transactions"
  ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON transactions;
CREATE POLICY "Authenticated users can delete transactions"
  ON transactions FOR DELETE TO authenticated USING (true);

-- ALERTS
DROP POLICY IF EXISTS "Authenticated users can read alerts" ON alerts;
CREATE POLICY "Authenticated users can read alerts"
  ON alerts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert alerts" ON alerts;
CREATE POLICY "Authenticated users can insert alerts"
  ON alerts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update alerts" ON alerts;
CREATE POLICY "Authenticated users can update alerts"
  ON alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete alerts" ON alerts;
CREATE POLICY "Authenticated users can delete alerts"
  ON alerts FOR DELETE TO authenticated USING (true);

-- INVESTIGATIONS
DROP POLICY IF EXISTS "Authenticated users can read investigations" ON investigations;
CREATE POLICY "Authenticated users can read investigations"
  ON investigations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert investigations" ON investigations;
CREATE POLICY "Authenticated users can insert investigations"
  ON investigations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update investigations" ON investigations;
CREATE POLICY "Authenticated users can update investigations"
  ON investigations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete investigations" ON investigations;
CREATE POLICY "Authenticated users can delete investigations"
  ON investigations FOR DELETE TO authenticated USING (true);

-- DOCUMENTS
DROP POLICY IF EXISTS "Authenticated users can read documents" ON documents;
CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON documents;
CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON documents;
CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE TO authenticated USING (true);

-- NOTES
DROP POLICY IF EXISTS "Authenticated users can read notes" ON notes;
CREATE POLICY "Authenticated users can read notes"
  ON notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON notes;
CREATE POLICY "Authenticated users can insert notes"
  ON notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON notes;
CREATE POLICY "Authenticated users can delete notes"
  ON notes FOR DELETE TO authenticated USING (true);

-- RULES
DROP POLICY IF EXISTS "Authenticated users can read rules" ON rules;
CREATE POLICY "Authenticated users can read rules"
  ON rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can update rules" ON rules;
CREATE POLICY "Authenticated users can update rules"
  ON rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DONE — All tables, seed data, and RLS policies created
-- ============================================================

