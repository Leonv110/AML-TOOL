// ============================================================
// aiService.js — AI Pattern Analysis (Gemini placeholder)
// ============================================================

/**
 * Build a structured payload from customer and transaction data.
 * Returns the exact 7-field JSON shape required by the Gemini API.
 */
export function buildPayload(customer, transactions, triggeredRule) {
  const income = parseFloat(customer.income) || 0;

  // Calculate monthly volume (sum of last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTxns = (transactions || []).filter(t => {
    const d = new Date(t.transaction_date);
    return d >= thirtyDaysAgo;
  });
  const monthly_volume = recentTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // Deposit count in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7Days = (transactions || []).filter(t => {
    const d = new Date(t.transaction_date);
    return d >= sevenDaysAgo;
  });
  const deposit_count_7_days = last7Days.filter(t =>
    (t.transaction_type || '').toLowerCase().includes('deposit') ||
    (t.transaction_type || '').toLowerCase().includes('credit')
  ).length;

  // Average deposit amount
  const deposits = (transactions || []).filter(t =>
    (t.transaction_type || '').toLowerCase().includes('deposit') ||
    (t.transaction_type || '').toLowerCase().includes('credit')
  );
  const average_deposit = deposits.length > 0
    ? deposits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) / deposits.length
    : 0;

  // High risk country exposure
  const highRiskCountries = ['nigeria', 'iran', 'north korea', 'myanmar'];
  const high_risk_country_exposure = highRiskCountries.includes((customer.country || '').toLowerCase()) ||
    (transactions || []).some(t => highRiskCountries.includes((t.country || '').toLowerCase()));

  // Dormancy period (days since oldest transaction gap)
  let dormancy_period_days = 0;
  if (transactions && transactions.length > 1) {
    const sorted = [...transactions].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
    let maxGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (new Date(sorted[i].transaction_date) - new Date(sorted[i - 1].transaction_date)) / (1000 * 60 * 60 * 24);
      if (gap > maxGap) maxGap = gap;
    }
    dormancy_period_days = Math.round(maxGap);
  }

  return {
    income,
    monthly_volume: Math.round(monthly_volume * 100) / 100,
    deposit_count_7_days,
    average_deposit: Math.round(average_deposit * 100) / 100,
    high_risk_country_exposure,
    dormancy_period_days,
    triggered_rule: triggeredRule || 'Unknown',
  };
}

/**
 * Call Gemini API to generate AI pattern analysis.
 *
 * ONE-LINE SWAP POINT — replace with real Gemini API call
 * When ready: use import.meta.env.VITE_GEMINI_KEY
 * return await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + import.meta.env.VITE_GEMINI_KEY, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ contents: [{ parts: [{ text: SYSTEM_PROMPT + JSON.stringify(payload) }] }] })
 * }).then(r => r.json());
 *
 * CRITICAL SYSTEM PROMPT CONSTRAINT:
 * The AI must ALWAYS use probabilistic language: "likely", "possible", "may indicate", "suggests", "consistent with"
 * The AI must NEVER use: "is committing fraud", "is laundering money", "is guilty", "confirmed fraud"
 * The AI must ALWAYS end with: "This analysis is based on statistical patterns and does not constitute a finding of wrongdoing."
 */
export async function callGemini(payload) {
  // ONE-LINE SWAP POINT — replace simulated response below with real Gemini API call above

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const ruleDescriptions = {
    'Structuring': 'structured deposits below reporting thresholds',
    'Velocity Spike': 'unusual transaction frequency patterns',
    'Dormancy Activation': 'sudden reactivation of a dormant account',
    'Geographic Risk': 'transactions involving high-risk jurisdictions',
    'Rapid Fund Movement': 'rapid movement of funds post-deposit',
    'New Device High Value': 'high-value transactions from unrecognized patterns',
    'Layering': 'complex layering of transactions through multiple intermediaries',
    'Round Tripping': 'funds that may be returning to origin through circular transactions',
  };

  const ruleDesc = ruleDescriptions[payload.triggered_rule] || 'anomalous transaction patterns';
  const incomeRatio = payload.income > 0 ? (payload.monthly_volume / payload.income).toFixed(1) : 'N/A';

  return {
    sections: [
      {
        title: 'Pattern Observed',
        points: [
          `Transaction volume of $${payload.monthly_volume.toLocaleString()} over the past 30 days may suggest activity inconsistent with the declared income of $${payload.income.toLocaleString()} (ratio: ${incomeRatio}x).`,
          `${payload.deposit_count_7_days} deposit(s) detected in the last 7 days with an average value of $${payload.average_deposit.toLocaleString()}, which could indicate ${ruleDesc}.`,
          payload.dormancy_period_days > 30
            ? `A dormancy gap of ${payload.dormancy_period_days} days was observed, suggesting possible account reactivation for illicit purposes.`
            : `Transaction activity appears relatively continuous with no significant dormancy periods.`,
        ],
      },
      {
        title: 'AML Typology Match',
        points: [
          `The triggered rule "${payload.triggered_rule}" is consistent with known AML typologies related to ${ruleDesc}.`,
          payload.high_risk_country_exposure
            ? 'Geographic risk exposure detected — transactions may involve jurisdictions on FATF grey/blacklists.'
            : 'No high-risk jurisdiction exposure identified in the current transaction set.',
        ],
      },
      {
        title: 'Risk Indicators',
        points: [
          `Monthly volume to income ratio: ${incomeRatio}x — ${parseFloat(incomeRatio) > 3 ? 'this is likely elevated and warrants further review' : 'within potentially acceptable range'}.`,
          `Deposit frequency (7-day): ${payload.deposit_count_7_days} transactions — ${payload.deposit_count_7_days > 5 ? 'this may suggest structuring behavior' : 'frequency appears moderate'}.`,
          `High-risk country exposure: ${payload.high_risk_country_exposure ? 'Yes — additional due diligence is likely warranted' : 'No'}.`,
        ],
      },
      {
        title: 'Investigative Direction',
        points: [
          'Review source of funds documentation and verify against declared income.',
          'Check for matching patterns in counterparty transactions to identify possible layering.',
          'Consider requesting enhanced due diligence (EDD) if income mismatch is confirmed.',
          payload.high_risk_country_exposure
            ? 'Evaluate correspondent banking relationships for jurisdictional risk.'
            : 'No immediate jurisdictional concerns, but monitor for changes.',
        ],
      },
    ],
    disclaimer: 'This analysis is based on statistical patterns and does not constitute a finding of wrongdoing.',
  };
}
