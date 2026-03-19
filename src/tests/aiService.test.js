import { describe, it, expect } from 'vitest';
import { buildPayload } from '../services/aiService';

describe('buildPayload', () => {
  it('should return correct 7-field JSON shape from sample customer data', () => {
    const customer = {
      customer_id: 'CUST001',
      name: 'Test Customer',
      country: 'Nigeria',
      income: 45000,
    };

    const now = new Date();
    const transactions = [
      {
        transaction_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 50000,
        transaction_type: 'deposit',
        country: 'Nigeria',
      },
      {
        transaction_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 30000,
        transaction_type: 'credit',
        country: 'UAE',
      },
    ];

    const result = buildPayload(customer, transactions, 'Structuring');

    expect(result).toHaveProperty('income');
    expect(result).toHaveProperty('monthly_volume');
    expect(result).toHaveProperty('deposit_count_7_days');
    expect(result).toHaveProperty('average_deposit');
    expect(result).toHaveProperty('high_risk_country_exposure');
    expect(result).toHaveProperty('dormancy_period_days');
    expect(result).toHaveProperty('triggered_rule');

    expect(result.income).toBe(45000);
    expect(result.triggered_rule).toBe('Structuring');
    expect(result.high_risk_country_exposure).toBe(true);
    expect(typeof result.monthly_volume).toBe('number');
    expect(typeof result.deposit_count_7_days).toBe('number');
  });

  it('should have all 7 required fields with no undefined or null values', () => {
    const customer = {
      customer_id: 'CUST002',
      name: 'Clean Customer',
      country: 'India',
      income: 60000,
    };

    const result = buildPayload(customer, [], 'Velocity Spike');

    const requiredFields = [
      'income',
      'monthly_volume',
      'deposit_count_7_days',
      'average_deposit',
      'high_risk_country_exposure',
      'dormancy_period_days',
      'triggered_rule',
    ];

    for (const field of requiredFields) {
      expect(result[field]).not.toBeUndefined();
      expect(result[field]).not.toBeNull();
    }

    expect(Object.keys(result).length).toBe(7);
  });
});
