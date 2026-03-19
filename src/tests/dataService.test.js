import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../services/dataService';

describe('computeRiskScore', () => {
  it('should return HIGH risk for Nigeria customer with income mismatch', () => {
    const customer = {
      customer_id: 'CUST001',
      name: 'Test Customer',
      country: 'Nigeria',
      income: 45000,
      pep_flag: true,
      created_at: '2020-01-01',
    };

    // Create 12 transactions all on the SAME day to trigger velocity spike (>10 per day = 25pts)
    // Total = 12 * 50000 = 600000 > 5 * 45000 = 225000 → income mismatch 25pts
    // Nigeria = 30pts, PEP = 10pts, Velocity = 25pts → total = 90 (HIGH)
    const now = new Date();
    const transactions = [];
    for (let i = 0; i < 12; i++) {
      transactions.push({
        transaction_date: now.toISOString(),
        amount: 50000,
        transaction_type: 'deposit',
      });
    }

    const result = computeRiskScore(customer, transactions);

    expect(result.score).toBeGreaterThanOrEqual(66);
    expect(result.tier).toBe('HIGH');
    expect(result.breakdown.country_risk).toBe(30);
    expect(result.rules_triggered).toContain('Geographic Risk');
  });

  it('should return LOW risk for India customer with no transactions', () => {
    const customer = {
      customer_id: 'CUST003',
      name: 'Low Risk Customer',
      country: 'India',
      income: 35000,
      pep_flag: false,
      created_at: '2023-01-01',
    };

    const result = computeRiskScore(customer, []);

    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.tier).toBe('LOW');
    expect(result.breakdown.country_risk).toBe(0);
    expect(result.breakdown.income_mismatch).toBe(0);
    expect(result.breakdown.transaction_velocity).toBe(0);
  });

  it('should add 10pts for PEP flag correctly', () => {
    const customerNoPep = {
      customer_id: 'TEST1',
      name: 'No PEP',
      country: 'India',
      income: 50000,
      pep_flag: false,
      created_at: '2023-01-01',
    };

    const customerPep = {
      ...customerNoPep,
      customer_id: 'TEST2',
      name: 'PEP',
      pep_flag: true,
    };

    const rNoPep = computeRiskScore(customerNoPep, []);
    const rPep = computeRiskScore(customerPep, []);

    expect(rPep.score - rNoPep.score).toBe(10);
    expect(rPep.breakdown.account_factors).toBe(10);
    expect(rNoPep.breakdown.account_factors).toBe(0);
    expect(rPep.rules_triggered).toContain('PEP Flag');
  });
});
