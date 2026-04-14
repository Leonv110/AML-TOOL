import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../apiClient';

// ============================================================
// computeRiskScore — Core risk scoring function (pure, no DB)
// ============================================================
export function computeRiskScore(customer, transactions = []) {
  let income_mismatch = 0;
  let crypto_risk = 0;
  let profile_risk = 0;
  const rules_triggered = [];

  // 1. Profile Risk (PEP / HNI)
  if (customer.pep_flag) {
    profile_risk += 50;
    rules_triggered.push('PEP Flag');
  }
  if (customer.hni_flag || customer.occupation?.toLowerCase().includes('hni')) {
    profile_risk += 30;
    rules_triggered.push('HNI Status');
  }

  // 2. Crypto
  if (customer.crypto_flag || customer.occupation?.toLowerCase().includes('crypto') || customer.occupation?.toLowerCase().includes('exchange')) {
    crypto_risk = 50;
    rules_triggered.push('Cryptocurrency Dealings');
  }

  // 3. Income Mismatch
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
      income_mismatch = 50;
      rules_triggered.push('Income Mismatch (>5x)');
    } else if (txnSum > 3 * monthlyIncome) {
      income_mismatch = 25;
      rules_triggered.push('Income Mismatch (>3x)');
    }
  }

  const score = Math.min(income_mismatch + crypto_risk + profile_risk, 100);

  let tier = 'LOW';
  if (score >= 66) tier = 'HIGH';
  else if (score >= 31) tier = 'MEDIUM';

  return {
    score,
    tier,
    breakdown: {
      profile_risk,
      crypto_risk,
      income_mismatch,
    },
    rules_triggered: [...new Set(rules_triggered)],
  };
}

// ============================================================
// Dashboard KPI Queries
// ============================================================
export async function fetchDashboardKPIs() {
  try {
    return await apiGet('/api/dashboard/kpis');
  } catch {
    return { totalCustomers: 0, highRisk: 0, openAlerts: 0, openSAR: 0 };
  }
}

export async function fetchHighRiskCount() {
  try {
    // Single server-side COUNT — no N+1
    const counts = await apiGet('/api/dashboard/counts');
    return counts?.highRisk || 0;
  } catch {
    return 0;
  }
}

// ============================================================
// Customer Queries
// ============================================================
export async function fetchAllCustomers() {
  return apiGet('/api/customers');
}

export async function fetchCustomerById(customerId) {
  return apiGet(`/api/customers/${customerId}`);
}

export async function upsertCustomers(rows) {
  const result = await apiPut('/api/customers/upsert', rows);
  return result.inserted;
}

// ============================================================
// Transaction Queries
// ============================================================
export async function fetchTransactionsForCustomer(customerId) {
  return apiGet(`/api/transactions/customer/${customerId}`);
}

export async function fetchAllTransactions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.minAmount) params.set('minAmount', filters.minAmount);
  if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
  if (filters.country) params.set('country', filters.country);
  if (filters.rule) params.set('rule', filters.rule);
  if (filters.limit) params.set('limit', filters.limit);

  const qs = params.toString();
  return apiGet(`/api/transactions${qs ? `?${qs}` : ''}`);
}

// ============================================================
// Alert Queries
// ============================================================
export async function fetchAlerts(statusFilter) {
  const qs = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
  return apiGet(`/api/alerts${qs}`);
}

export async function fetchAlertsForCustomer(customerId) {
  return apiGet(`/api/alerts/customer/${customerId}`);
}

export async function updateAlertStatus(alertId, status, caseId = null) {
  return apiPatch(`/api/alerts/${alertId}/status`, { status, case_id: caseId });
}

// ============================================================
// Rules Queries
// ============================================================
export async function fetchRules() {
  return apiGet('/api/rules');
}

export async function toggleRuleStatus(ruleId, newStatus) {
  return apiPatch(`/api/rules/${ruleId}/status`, { status: newStatus });
}

export async function fetchAlertCountForRule(ruleName) {
  const result = await apiGet(`/api/alerts/count/${encodeURIComponent(ruleName)}`);
  return result.count || 0;
}

// ============================================================
// Document Queries
// ============================================================
export async function fetchDocumentsForCustomer(customerId) {
  return apiGet(`/api/documents/customer/${customerId}`);
}

export async function uploadDocument(doc) {
  return apiPost('/api/documents', doc);
}

// ============================================================
// Notes Queries
// ============================================================
export async function fetchNotesForCustomer(customerId) {
  return apiGet(`/api/notes/customer/${customerId}`);
}

export async function saveNote(note) {
  return apiPost('/api/notes', note);
}

// ============================================================
// Investigation Queries
// ============================================================
export async function fetchInvestigations() {
  return apiGet('/api/investigations');
}

export async function fetchInvestigationByCaseId(caseId) {
  return apiGet(`/api/investigations/case/${caseId}`);
}

export async function updateInvestigation(id, updates) {
  return apiPatch(`/api/investigations/${id}`, updates);
}

export async function createInvestigation(investigation) {
  return apiPost('/api/investigations', investigation);
}

// ============================================================
// Customer PEP update
// ============================================================
export async function updateCustomerPEP(customerId, pepFlag) {
  return apiPatch(`/api/customers/${customerId}/pep`, { pep_flag: pepFlag });
}

// ============================================================
// Utility: get distinct countries from customers
// ============================================================
// ============================================================
export async function fetchDistinctCountries() {
  try {
    return await apiGet('/api/customers/countries');
  } catch {
    return [];
  }
}

// ============================================================
// Utility: static ISO countries map for KYC/screening form
// ============================================================
export async function fetchApiCountries() {
  try {
    return await apiGet('/api/countries');
  } catch {
    return [];
  }
}

// ============================================================
// Admin — User Management
// ============================================================
export async function fetchAdminUsers() {
  return apiGet('/api/admin/users');
}

export async function adminCreateUser({ email, password, role }) {
  return apiPost('/api/admin/users', { email, password, role });
}

export async function adminUpdateUserRole(userId, role) {
  return apiPatch(`/api/admin/users/${userId}/role`, { role });
}

// ============================================================
// AML Rule Generation (Added for Issue 2 & 3)
// ============================================================

export function applyAMLRules(transaction, activeRuleNames, contextTxns = []) {
  let score = 0;
  let triggered_rules = [];
  const amount = parseFloat(transaction.amount) || 0;

  // 1. Geographic Risk [Weight: 25]
  const highRiskCountries = ['iran', 'north korea', 'myanmar', 'syria', 'yemen', 'afghanistan', 'iraq', 'libya', 'somalia', 'south sudan'];
  const medRiskCountries = ['uae', 'pakistan', 'russia', 'turkey', 'lebanon', 'haiti', 'panama', 'nigeria', 'mali'];
  const country = (transaction.country || '').toLowerCase().trim();
  const riskLevel = (transaction.country_risk_level || '').toLowerCase();
  
  if (activeRuleNames.has('Geographic Risk')) {
    if (highRiskCountries.includes(country) || riskLevel === 'high') {
      if (amount > 15000) {
        score += 35; // Critical flag
        triggered_rules.push('Geographic Risk (High-Risk Country + Significant Value)');
      } else {
        score += 25; 
        triggered_rules.push('Geographic Risk');
      }
    } else if (medRiskCountries.includes(country) || riskLevel === 'medium') {
      score += 15; 
      triggered_rules.push('Geographic Risk (Medium)');
    }
  }

  // 2. Structuring / Clustering [Weight: 25]
  //    Only flag if there's actual clustering evidence (multiple near-threshold txns)
  if (activeRuleNames.has('Structuring')) {
    const isStructuring = (amount >= 9000 && amount < 10000) ||
                          (amount >= 48000 && amount < 50000) ||
                          (amount >= 90000 && amount < 100000) ||
                          (amount >= 900000 && amount < 1000000);
    
    if (isStructuring && contextTxns.length > 0) {
      const thirtyDaysAgo = new Date(transaction.transaction_date || Date.now());
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentSimilar = contextTxns.filter(t => {
        if (new Date(t.transaction_date) < thirtyDaysAgo || t.transaction_id === transaction.transaction_id) return false;
        const amt = parseFloat(t.amount);
        return (amt >= 9000 && amt < 10000) || (amt >= 48000 && amt < 50000);
      });
      if (recentSimilar.length >= 2) {
        score += 25;
        triggered_rules.push('Structuring (Repeated below-threshold amounts)');
      } else if (recentSimilar.length === 1) {
        score += 12;
        triggered_rules.push('Possible Structuring Pattern');
      }
      // Single near-threshold amount with no pattern = not flagged (normal transaction)
    }
  }

  // 3. Velocity Spike [Weight: 25]
  if (activeRuleNames.has('Velocity Spike')) {
    const freq = parseFloat(transaction.transaction_frequency_1hr) || 0;
    const avgFreq = parseFloat(transaction.avg_frequency_1hr) || 2;
    if (freq >= 7) {
      score += 25;
      triggered_rules.push('Velocity Spike (Extreme)');
    } else if (freq >= 4 && freq >= avgFreq * 3) {
      score += 25;
      triggered_rules.push('Velocity Spike (High Context)');
    }
  }

  // 4. Dormancy Activation [Weight: 25]
  if (activeRuleNames.has('Dormancy Activation')) {
    const daysSince = parseFloat(transaction.days_since_last_transaction) || 0;
    if (daysSince >= 45 && amount > 5000) {
      score += 25;
      triggered_rules.push('Dormancy Activation (45d+ & High Value)');
    } else if (daysSince >= 90) {
      score += 25;
      triggered_rules.push('Dormancy Activation (90d+)');
    }
  }

  // 5. Layering [Weight: 25]
  if (activeRuleNames.has('Layering')) {
    const hops = parseFloat(transaction.path_length_hops) || 0;
    const centrality = parseFloat(transaction.degree_centrality) || 0;
    if (hops >= 4 && centrality > 0.5) {
      score += 25;
      triggered_rules.push('Layering (Complex Multi-Hop Network)');
    }
  }

  // 6. PEP / HNI Flag [Weight: 25]
  if (activeRuleNames.has('PEP / HNI Flag')) {
    if ((transaction.pep_flag === true || transaction.pep_flag === 'true') && amount > 5000) {
      score += 25;
      triggered_rules.push('PEP Flag (High Value)');
    } else if (transaction.pep_flag === true || transaction.pep_flag === 'true') {
      score += 25;
      triggered_rules.push('PEP Context');
    }
  }

  // 7. New Device High Value [Weight: 15]
  //    Raised amount threshold to 100K (was 50K)
  if (activeRuleNames.has('New Device High Value')) {
    if (transaction.is_new_device && amount > 20000) {
      score += 25;
      triggered_rules.push('New Device High Value ($20k+)');
    }
  }

  // 8. Rapid Fund Movement [Weight: 25]
  if (activeRuleNames.has('Rapid Fund Movement')) {
    const balBefore = parseFloat(transaction.balance_before) || 0;
    if (balBefore > 0 && amount >= balBefore * 0.85 && amount > 8000) {
      score += 25;
      triggered_rules.push('Rapid Movement (>85% draint)');
    }
  }

  // 9. Income Mismatch [Weight: 25]
  if (activeRuleNames.has('Income Mismatch') && contextTxns.length > 0) {
    const thirtyDaysAgo = new Date(transaction.transaction_date || Date.now());
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSum = contextTxns
      .filter(t => new Date(t.transaction_date) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    if (recentSum >= 1500000) {
      score += 25;
      triggered_rules.push('Income Mismatch (15L+ in 30 days)');
    }
  }

  // --- SCORING THRESHOLD ---
  // A transaction must score >= 25 to be flagged.
  // This means: one strong rule OR two moderate rules must trigger.
  // Score < 25 = normal transaction with minor risk context (NOT flagged).
  let severity = 'LOW';
  if (score >= 50) severity = 'CRITICAL';
  else if (score >= 35) severity = 'HIGH';
  else if (score >= 25) severity = 'MEDIUM';

  return { triggered: score >= 25, rule_name: triggered_rules.join(', '), severity, score };
}

export async function generateAlertsFromTransactions(transactions) {
  const activeRules = await apiGet('/api/rules');
  
  if (!activeRules || !Array.isArray(activeRules)) {
    throw new Error('Failed to fetch AML rules. Please re-login and try again.');
  }
  
  const activeRuleNames = new Set(activeRules.filter(r => r.status === 'active').map(r => r.name));
  console.log(`[AML] Active rules (${activeRuleNames.size}):`, [...activeRuleNames]);
  
  if (activeRuleNames.size === 0) {
    throw new Error('No active rules found. Go to Transaction Monitoring → Rule Library to activate rules.');
  }
  
  const alertsToInsert = [];
  const flagUpdates = [];

  // Group transactions by customer for clustering context
  const txnsByCustomer = {};
  for (const txn of transactions) {
    if (!txnsByCustomer[txn.customer_id]) txnsByCustomer[txn.customer_id] = [];
    txnsByCustomer[txn.customer_id].push(txn);
  }

  for (const txn of transactions) {
    const contextTxns = txnsByCustomer[txn.customer_id] || [];
    const ruleResult = applyAMLRules(txn, activeRuleNames, contextTxns);
    if (ruleResult.triggered) {
      alertsToInsert.push({
        alert_id: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        customer_id: txn.customer_id || txn.user_id,
        customer_name: txn.customer_name || `Customer ${txn.customer_id || txn.user_id}`,
        risk_level: ruleResult.severity,
        rule_triggered: ruleResult.rule_name,
        status: 'open',
        transaction_id: txn.transaction_id,
        amount: txn.amount,
        country: txn.country,
        created_at: new Date().toISOString()
      });
      flagUpdates.push({
        transaction_id: txn.transaction_id,
        flag_reason: ruleResult.rule_name,
        rule_triggered: ruleResult.rule_name,
        risk_score: ruleResult.score
      });
    }
  }

  console.log(`[AML] ${alertsToInsert.length} alerts to create, ${flagUpdates.length} transactions to flag`);

  // Step 1: Create alerts in bulk
  if (alertsToInsert.length > 0) {
    const ALERT_BATCH = 500;
    for (let i = 0; i < alertsToInsert.length; i += ALERT_BATCH) {
      await apiPost('/api/alerts', alertsToInsert.slice(i, i + ALERT_BATCH));
    }
  }

  // Step 2: Update the transaction records with flagged=true
  if (flagUpdates.length > 0) {
    const FLAG_BATCH = 500;
    for (let i = 0; i < flagUpdates.length; i += FLAG_BATCH) {
      await apiPatch('/api/transactions/flag', flagUpdates.slice(i, i + FLAG_BATCH));
    }
  }

  return alertsToInsert.length;
}
