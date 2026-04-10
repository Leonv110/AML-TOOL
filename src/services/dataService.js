import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../apiClient';

// ============================================================
// computeRiskScore — Core risk scoring function (pure, no DB)
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
export async function fetchDistinctCountries() {
  try {
    return await apiGet('/api/customers/countries');
  } catch {
    return [];
  }
}

// ============================================================
// AML Rule Generation (Added for Issue 2 & 3)
// ============================================================

export function applyAMLRules(transaction, activeRuleNames) {
  if (activeRuleNames.has('Geographic Risk') && (transaction.country_risk_level === 'High' || transaction.country_risk_level === 'HIGH')) {
    return { triggered: true, rule_name: 'Geographic Risk', severity: 'HIGH' };
  }
  if (activeRuleNames.has('Velocity Spike') && transaction.transaction_frequency_1hr > 5) {
    return { triggered: true, rule_name: 'Velocity Spike', severity: 'HIGH' };
  }
  if (activeRuleNames.has('Dormancy Activation') && transaction.days_since_last_transaction > 30) {
    return { triggered: true, rule_name: 'Dormancy Activation', severity: 'MEDIUM' };
  }
  if (activeRuleNames.has('Structuring') && transaction.amount > 9000 && transaction.amount < 10000) {
    return { triggered: true, rule_name: 'Structuring', severity: 'HIGH' };
  }
  if (activeRuleNames.has('New Device') && transaction.is_new_device) {
    return { triggered: true, rule_name: 'New Device', severity: 'MEDIUM' };
  }
  return { triggered: false };
}

export async function generateAlertsFromTransactions(transactions) {
  try {
    const activeRules = await apiGet('/api/rules');
    const activeRuleNames = new Set((activeRules || []).filter(r => r.status === 'active').map(r => r.name));
    const alertsToInsert = [];
    const flagUpdates = []; // Track which transactions to flag in the DB

    for (const txn of transactions) {
      const ruleResult = applyAMLRules(txn, activeRuleNames);
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
        });
      }
    }

    // Step 1: Create alerts in bulk
    if (alertsToInsert.length > 0) {
      // Send in batches to avoid payload limits
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
  } catch (err) {
    console.error('generateAlertsFromTransactions error:', err);
    return 0;
  }
}
