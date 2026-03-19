import { supabase } from '../supabaseClient';

// ============================================================
// computeRiskScore — Core risk scoring function
// ============================================================
export function computeRiskScore(customer, transactions = []) {
  let country_risk = 0;
  let income_mismatch = 0;
  let transaction_velocity = 0;
  let account_factors = 0;
  const rules_triggered = [];

  // --- Country Risk (max 30pts) ---
  const highRiskCountries = ['nigeria', 'iran', 'north korea', 'myanmar'];
  const mediumRiskCountries = ['uae', 'pakistan', 'afghanistan'];
  const customerCountry = (customer.country || '').toLowerCase();

  if (highRiskCountries.includes(customerCountry)) {
    country_risk = 30;
    rules_triggered.push('Geographic Risk');
  } else if (mediumRiskCountries.includes(customerCountry)) {
    country_risk = 15;
    rules_triggered.push('Geographic Risk');
  }

  // --- Income Mismatch (max 25pts) ---
  const monthlyIncome = parseFloat(customer.income) || 0;
  if (monthlyIncome > 0 && transactions.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTxns = transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= thirtyDaysAgo;
    });
    const txnSum = recentTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    if (txnSum > 5 * monthlyIncome) {
      income_mismatch = 25;
      rules_triggered.push('Structuring');
    } else if (txnSum > 3 * monthlyIncome) {
      income_mismatch = 15;
      rules_triggered.push('Structuring');
    } else if (txnSum > 1 * monthlyIncome) {
      income_mismatch = 5;
    }
  }

  // --- Transaction Velocity (max 25pts) ---
  if (transactions.length > 0) {
    const txnsByDay = {};
    transactions.forEach(t => {
      const day = new Date(t.transaction_date).toISOString().split('T')[0];
      txnsByDay[day] = (txnsByDay[day] || 0) + 1;
    });
    const maxTxnsInDay = Math.max(...Object.values(txnsByDay), 0);

    if (maxTxnsInDay > 10) {
      transaction_velocity = 25;
      rules_triggered.push('Velocity Spike');
    } else if (maxTxnsInDay > 5) {
      transaction_velocity = 15;
      rules_triggered.push('Velocity Spike');
    } else if (maxTxnsInDay > 2) {
      transaction_velocity = 8;
    }
  }

  // --- Account Factors (max 20pts) ---
  if (customer.pep_flag) {
    account_factors += 10;
    rules_triggered.push('PEP Flag');
  }
  if (customer.created_at) {
    const accountAge = (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const hasLargeTxn = transactions.some(t => parseFloat(t.amount) > 50000);
    if (accountAge < 90 && hasLargeTxn) {
      account_factors += 10;
      rules_triggered.push('New Device High Value');
    }
  }
  account_factors = Math.min(account_factors, 20);

  const score = Math.min(country_risk + income_mismatch + transaction_velocity + account_factors, 100);

  let tier = 'LOW';
  if (score >= 66) tier = 'HIGH';
  else if (score >= 31) tier = 'MEDIUM';

  return {
    score,
    tier,
    breakdown: {
      country_risk,
      income_mismatch,
      transaction_velocity,
      account_factors,
    },
    rules_triggered: [...new Set(rules_triggered)],
  };
}

// ============================================================
// Dashboard KPI Queries
// ============================================================
export async function fetchDashboardKPIs() {
  const results = { totalCustomers: 0, highRisk: 0, openAlerts: 0, openSAR: 0 };

  if (!supabase) return results;

  const [custRes, alertRes, sarRes] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('investigations').select('id', { count: 'exact', head: true }).eq('status', 'draft_sar'),
  ]);

  results.totalCustomers = custRes.count || 0;
  results.openAlerts = alertRes.count || 0;
  results.openSAR = sarRes.count || 0;

  return results;
}

export async function fetchHighRiskCount() {
  if (!supabase) return 0;
  const { data: customers } = await supabase.from('customers').select('*');
  if (!customers) return 0;

  let highCount = 0;
  for (const cust of customers) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', cust.customer_id);
    const result = computeRiskScore(cust, txns || []);
    if (result.score >= 66) highCount++;
  }
  return highCount;
}

// ============================================================
// Customer Queries
// ============================================================
export async function fetchAllCustomers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchCustomerById(customerId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCustomers(rows) {
  if (!supabase) throw new Error('Supabase not configured');
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('customers').upsert(batch, { onConflict: 'customer_id' });
    if (error) throw error;
    inserted += batch.length;
  }
  return inserted;
}

// ============================================================
// Transaction Queries
// ============================================================
export async function fetchTransactionsForCustomer(customerId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAllTransactions(filters = {}) {
  if (!supabase) return [];
  let query = supabase.from('transactions').select('*');

  if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
  if (filters.endDate) query = query.lte('transaction_date', filters.endDate);
  if (filters.minAmount) query = query.gte('amount', parseFloat(filters.minAmount));
  if (filters.maxAmount) query = query.lte('amount', parseFloat(filters.maxAmount));
  if (filters.country) query = query.eq('country', filters.country);
  if (filters.rule) query = query.ilike('rule_triggered', `%${filters.rule}%`);

  query = query.order('transaction_date', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// Alert Queries
// ============================================================
export async function fetchAlerts(statusFilter) {
  if (!supabase) return [];
  let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchAlertsForCustomer(customerId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateAlertStatus(alertId, status, caseId = null) {
  if (!supabase) return;
  const update = { status };
  if (caseId) update.case_id = caseId;
  const { error } = await supabase.from('alerts').update(update).eq('alert_id', alertId);
  if (error) throw error;
}

// ============================================================
// Rules Queries
// ============================================================
export async function fetchRules() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('rules').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function toggleRuleStatus(ruleId, newStatus) {
  if (!supabase) return;
  const { error } = await supabase.from('rules').update({ status: newStatus }).eq('id', ruleId);
  if (error) throw error;
}

export async function fetchAlertCountForRule(ruleName) {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('rule_triggered', ruleName);
  if (error) return 0;
  return count || 0;
}

// ============================================================
// Document Queries
// ============================================================
export async function fetchDocumentsForCustomer(customerId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('customer_id', customerId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadDocument(doc) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('documents').insert(doc);
  if (error) throw error;
}

// ============================================================
// Notes Queries
// ============================================================
export async function fetchNotesForCustomer(customerId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveNote(note) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('notes').insert(note);
  if (error) throw error;
}

// ============================================================
// Investigation Queries
// ============================================================
export async function fetchInvestigations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('investigations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchInvestigationByCaseId(caseId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('investigations')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateInvestigation(id, updates) {
  if (!supabase) return;
  const { error } = await supabase
    .from('investigations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function createInvestigation(investigation) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('investigations').insert(investigation).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// Customer PEP update
// ============================================================
export async function updateCustomerPEP(customerId, pepFlag) {
  if (!supabase) return;
  const { error } = await supabase
    .from('customers')
    .update({ pep_flag: pepFlag })
    .eq('customer_id', customerId);
  if (error) throw error;
}

// ============================================================
// Utility: get distinct countries from customers
// ============================================================
export async function fetchDistinctCountries() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('customers').select('country');
  if (error) return [];
  const unique = [...new Set((data || []).map(d => d.country).filter(Boolean))];
  return unique.sort();
}
