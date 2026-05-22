import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../apiClient';

// ============================================================
// Rule Engine Config — mirrors api-server/rules_config.json
// These are defaults; the backend config is the authoritative source.
// ============================================================
const RULE_CFG = {
  INCOME_MISMATCH: { RSF_HIGH_THRESHOLD: 5, RSF_MEDIUM_THRESHOLD: 3, LOOKBACK_DAYS: 30 },
  TRANSACTION_VELOCITY: { SPIKE_MULTIPLIER: 5, BASELINE_MONTHS: 3, MIN_COUNT_TO_TRIGGER: 20 },
  SCORING: { HIGH_THRESHOLD: 50, MEDIUM_THRESHOLD: 25 },
};

// ============================================================
// computeRiskScore — Core risk scoring function (pure, no DB)
// ============================================================
export function computeRiskScore(customer, transactions = [], screeningResult = null) {
  let transaction_risk = 0;
  let screening_risk = 0;
  const rules_triggered = [];

  // 1. Screening Risk (Max 50)
  if (screeningResult) {
    if (screeningResult.match === 'Match') {
      screening_risk += 50;
      rules_triggered.push(`Screening: Confirmed Match (${screeningResult.score}%)`);
    } else if (screeningResult.match === 'Possible Match') {
      screening_risk += 30;
      rules_triggered.push(`Screening: Possible Match (${screeningResult.score}%)`);
    }
  }

  // Add baseline profile risks to screening risk if screening API wasn't conclusive
  if (customer.pep_flag) {
    screening_risk += 30;
    rules_triggered.push('PEP Flag');
  }
  if (customer.hni_flag || customer.occupation?.toLowerCase().includes('hni')) {
    screening_risk += 15;
    rules_triggered.push('HNI Status');
  }
  if (customer.crypto_flag || customer.occupation?.toLowerCase().includes('crypto') || customer.occupation?.toLowerCase().includes('exchange')) {
    screening_risk += 25;
    rules_triggered.push('Cryptocurrency Dealings');
  }
  screening_risk = Math.min(screening_risk, 50);

  // 2. Transactions Risk (Max 50) — Two components:
  //    A) Severity (max 35pts): Based on the HIGHEST risk score among flagged transactions
  //       → Scaled from 0-100 transaction score to 0-35 points
  //    B) Frequency (max 15pts): Based on HOW MANY transactions were flagged
  //       → 1 flagged = 3pts, 2-4 = 6pts, 5-9 = 10pts, 10+ = 15pts
  //    Total = Severity + Frequency, capped at 50
  let max_txn_score = 0;
  let flagged_count = 0;
  let avg_txn_score = 0;
  if (transactions && transactions.length > 0) {
    const flaggedTxns = transactions.filter(t => 
      (t.flagged === true || t.flagged === 'true') && t.risk_score
    );
    flagged_count = flaggedTxns.length;
    if (flagged_count > 0) {
      const scores = flaggedTxns.map(t => parseFloat(t.risk_score));
      max_txn_score = Math.max(...scores);
      avg_txn_score = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }
  
  // A) Severity component: max score scaled to 35 points
  const severity = Math.min(Math.round((max_txn_score / 100) * 35), 35);
  
  // B) Frequency component: number of flagged txns scaled to 15 points
  let frequency = 0;
  if (flagged_count >= 10) frequency = 15;
  else if (flagged_count >= 5) frequency = 10;
  else if (flagged_count >= 2) frequency = 6;
  else if (flagged_count >= 1) frequency = 3;
  
  transaction_risk = Math.min(severity + frequency, 50);
  
  if (transaction_risk > 0) {
    rules_triggered.push(
      `Transaction Risk: Severity ${severity}/35 (max alert score: ${max_txn_score}) + Frequency ${frequency}/15 (${flagged_count} flagged txn${flagged_count !== 1 ? 's' : ''})`
    );
  }

  const score = Math.min(transaction_risk + screening_risk, 100);

  let tier = 'LOW';
  if (score >= 50) tier = 'CRITICAL';
  else if (score >= 35) tier = 'HIGH';
  else if (score >= 25) tier = 'MEDIUM';

  return {
    score,
    tier,
    breakdown: {
      transaction_risk,
      screening_risk,
      severity,
      frequency,
      flagged_count,
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

export async function adminDeleteUser(userId) {
  return apiDelete(`/api/admin/users/${userId}`);
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
        triggered_rules.push('Geographic Risk (+35: High-Risk Country + Significant Value)');
      } else {
        score += 25;
        triggered_rules.push('Geographic Risk (+25: High-Risk Country)');
      }
    } else if (medRiskCountries.includes(country) || riskLevel === 'medium') {
      score += 15;
      triggered_rules.push('Geographic Risk (+15: Medium-Risk Country)');
    }
  }

  // 2. Structuring / Clustering [Weight: 25]
  //    Only flag if there's actual clustering evidence (multiple near-threshold txns)
  if (activeRuleNames.has('Structuring')) {
    const isStructuring = amount < 1000000 && amount >= 50000;

    if (isStructuring && contextTxns.length > 0) {
      const thirtyDaysAgo = new Date(transaction.transaction_date || Date.now());
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let sumBelowThreshold = amount;
      let countBelowThreshold = 1;

      contextTxns.forEach(t => {
        if (new Date(t.transaction_date) >= thirtyDaysAgo && t.transaction_id !== transaction.transaction_id) {
          const amt = parseFloat(t.amount);
          if (amt < 1000000 && amt >= 50000) {
            sumBelowThreshold += amt;
            countBelowThreshold += 1;
          }
        }
      });

      if (sumBelowThreshold >= 1000000 && countBelowThreshold >= 2) {
        score += 25;
        triggered_rules.push(`Structuring (+25: Breaking ₹10L limit, ${countBelowThreshold} txns summing to ₹${sumBelowThreshold.toLocaleString()})`);
      } else if (sumBelowThreshold >= 800000 && countBelowThreshold >= 3) {
        score += 15;
        triggered_rules.push(`Possible Structuring (+15: ${countBelowThreshold} txns summing to ₹${sumBelowThreshold.toLocaleString()})`);
      }
    }
  }

  // 3. Velocity Spike [Weight: 35]
  if (activeRuleNames.has('Velocity Spike')) {
    const freq = parseFloat(transaction.transaction_frequency_1hr) || 0;
    const avgFreq = parseFloat(transaction.avg_frequency_1hr) || 2;

    // Connect to time of day (odd hours e.g. IST midnight to 5AM)
    const txDate = new Date(transaction.transaction_date || Date.now());
    const istHour = (txDate.getUTCHours() + 5.5) % 24;
    const isOddHour = istHour >= 0 && istHour <= 5;

    if (freq >= 7 && isOddHour) {
      score += 35;
      triggered_rules.push(`Velocity Spike (+35: ${freq} txns/hr at Odd Hours)`);
    } else if (freq >= 4 && freq >= avgFreq * 3) {
      score += 25;
      triggered_rules.push(`Velocity Spike (+25: ${freq} txns/hr vs avg ${avgFreq.toFixed(1)})`);
    } else if (isOddHour && amount > 10000) {
      score += 15;
      triggered_rules.push('Velocity Spike (+15: Odd Hour Activity > ₹10k)');
    }
  }

  // 4. Dormancy Activation [Weight: 25]
  if (activeRuleNames.has('Dormancy Activation')) {
    const daysSince = parseFloat(transaction.days_since_last_transaction) || 0;
    if (daysSince >= 45 && amount > 5000) {
      score += 25;
      triggered_rules.push(`Dormancy Activation (+25: ${daysSince.toFixed(0)}d inactive & High Value)`);
    } else if (daysSince >= 90) {
      score += 25;
      triggered_rules.push(`Dormancy Activation (+25: ${daysSince.toFixed(0)}d inactive)`);
    }
  }

  // 5. Layering [Weight: 25]
  if (activeRuleNames.has('Layering')) {
    const hops = parseFloat(transaction.path_length_hops) || 0;
    const centrality = parseFloat(transaction.degree_centrality) || 0;
    if (hops >= 4 && centrality > 0.5) {
      score += 25;
      triggered_rules.push(`Layering (+25: ${hops} hops, centrality ${centrality.toFixed(2)})`);
    }
  }

  // 6. PEP / HNI Flag [Weight: 25]
  if (activeRuleNames.has('PEP / HNI Flag')) {
    if ((transaction.pep_flag === true || transaction.pep_flag === 'true') && amount > 5000) {
      score += 25;
      triggered_rules.push('PEP Flag (+25: High Value)');
    } else if (transaction.pep_flag === true || transaction.pep_flag === 'true') {
      score += 25;
      triggered_rules.push('PEP Flag (+25)');
    }
  }

  // 7. New Device High Value [Weight: 10]
  //    Keep rule but reduce weightage significantly (used to be 25)
  if (activeRuleNames.has('New Device High Value')) {
    if (transaction.is_new_device && amount > 20000) {
      score += 10;
      triggered_rules.push('New Device (+10: First time device & > ₹20k)');
    }
  }

  // 8. Rapid Fund Movement [Weight: 35]
  if (activeRuleNames.has('Rapid Fund Movement')) {
    const balBefore = parseFloat(transaction.balance_before) || 0;
    if (balBefore > 0 && amount >= balBefore * 0.85 && amount > 8000) {
      score += 35;
      triggered_rules.push(`Rapid Movement (+35: ${((amount/balBefore)*100).toFixed(0)}% drain)`);
    }
  }

  // 8b. Cryptocurrency Activity [Weight: 35]
  if (activeRuleNames.has('Cryptocurrency Activity')) {
    if ((transaction.transaction_type || '').toLowerCase().includes('crypto') ||
      (transaction.destination_id || '').toLowerCase().includes('crypto')) {
      score += 35;
      triggered_rules.push('Cryptocurrency Activity (+35)');
    }
  }

  // 9. Income Mismatch — RSF = (|TotalCredits - TotalDebits|) / Stated Monthly Income [Weight: 25]
  // Mentor formula: RSF > 5x = HIGH risk (e.g. ₹1,50,000 balance / ₹20,000 income = 7.5x)
  if (activeRuleNames.has('Income Mismatch') && contextTxns.length > 0) {
    const refDate = new Date(transaction.transaction_date || Date.now());
    const cutoff = new Date(refDate.getTime() - RULE_CFG.INCOME_MISMATCH.LOOKBACK_DAYS * 86400000);
    const recentTxns = contextTxns.filter(t => new Date(t.transaction_date) >= cutoff);

    const totalCredits = recentTxns
      .filter(t => (t.transaction_type || '').toLowerCase() === 'credit')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const totalDebits = recentTxns
      .filter(t => (t.transaction_type || '').toLowerCase() !== 'credit')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const netBalance = Math.abs(totalCredits - totalDebits);

    // Use customer income from the transaction object if enriched, else skip
    const monthlyIncome = parseFloat(transaction.customer_income) || 0;
    if (monthlyIncome > 0) {
      const rsf = netBalance / monthlyIncome;
      if (rsf > RULE_CFG.INCOME_MISMATCH.RSF_HIGH_THRESHOLD) {
        score += 35;
        triggered_rules.push(`Income Mismatch (+35: RSF ${rsf.toFixed(1)}x vs ₹${monthlyIncome.toLocaleString('en-IN')} income)`);
      } else if (rsf > RULE_CFG.INCOME_MISMATCH.RSF_MEDIUM_THRESHOLD) {
        score += 20;
        triggered_rules.push(`Income Mismatch (+20: RSF ${rsf.toFixed(1)}x)`);
      }
    } else {
      // Fallback: flag if net balance is very high (no income data)
      if (netBalance >= 1500000) {
        score += 25;
        triggered_rules.push('Income Mismatch (+25: ₹15L+ net in 30d — income unknown)');
      }
    }
  }

  // 10. Transaction Quantity Spike [Weight: 25]
  // Mentor rule: avg customer has 5-6 txns/month; sudden jump to 100+ = alert
  if (activeRuleNames.has('Velocity Spike') && contextTxns.length > 0) {
    const refDate = new Date(transaction.transaction_date || Date.now());
    const thisMonthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const currentMonthCount = contextTxns.filter(t => new Date(t.transaction_date) >= thisMonthStart).length;

    if (currentMonthCount >= RULE_CFG.TRANSACTION_VELOCITY.MIN_COUNT_TO_TRIGGER) {
      // Compare to 3-month rolling average
      const threeMonthsAgo = new Date(thisMonthStart);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - RULE_CFG.TRANSACTION_VELOCITY.BASELINE_MONTHS);
      const historicCount = contextTxns.filter(t => {
        const d = new Date(t.transaction_date);
        return d >= threeMonthsAgo && d < thisMonthStart;
      }).length;
      const avgMonthly = historicCount / RULE_CFG.TRANSACTION_VELOCITY.BASELINE_MONTHS;
      if (avgMonthly > 0 && currentMonthCount > avgMonthly * RULE_CFG.TRANSACTION_VELOCITY.SPIKE_MULTIPLIER) {
        score += 25;
        triggered_rules.push(`Quantity Spike (+25: ${currentMonthCount} txns vs avg ${avgMonthly.toFixed(1)})`);
      }
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
