import { Injectable } from '@nestjs/common';

export type TdsSlab = {
  minIncome: number;
  maxIncome?: number;
  rate: number;
};

export type TdsConfig = {
  enabled?: boolean;
  regime?: 'NEW' | 'OLD';
  standardDeduction?: number;
  cessRate?: number;
  slabs: TdsSlab[];
};

/** FY 2024-25 India new tax regime (simplified annual slabs). */
export const DEFAULT_NEW_REGIME_TDS: TdsConfig = {
  enabled: true,
  regime: 'NEW',
  standardDeduction: 75000,
  cessRate: 4,
  slabs: [
    { minIncome: 0, maxIncome: 300000, rate: 0 },
    { minIncome: 300001, maxIncome: 700000, rate: 5 },
    { minIncome: 700001, maxIncome: 1000000, rate: 10 },
    { minIncome: 1000001, maxIncome: 1200000, rate: 15 },
    { minIncome: 1200001, maxIncome: 1500000, rate: 20 },
    { minIncome: 1500001, rate: 30 },
  ],
};

@Injectable()
export class TdsService {
  normalizeConfig(raw?: unknown): TdsConfig {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_NEW_REGIME_TDS };
    const obj = raw as Record<string, unknown>;
    const slabs = Array.isArray(obj.slabs)
      ? (obj.slabs as TdsSlab[]).filter(
          (s) => typeof s.minIncome === 'number' && typeof s.rate === 'number',
        )
      : DEFAULT_NEW_REGIME_TDS.slabs;
    return {
      enabled: obj.enabled !== false,
      regime: obj.regime === 'OLD' ? 'OLD' : 'NEW',
      standardDeduction:
        typeof obj.standardDeduction === 'number'
          ? obj.standardDeduction
          : DEFAULT_NEW_REGIME_TDS.standardDeduction,
      cessRate:
        typeof obj.cessRate === 'number'
          ? obj.cessRate
          : DEFAULT_NEW_REGIME_TDS.cessRate,
      slabs: slabs.length ? slabs : DEFAULT_NEW_REGIME_TDS.slabs,
    };
  }

  /** Annual tax from gross income (before standard deduction). */
  computeAnnualTax(annualGrossIncome: number, rawConfig?: unknown): number {
    const config = this.normalizeConfig(rawConfig);
    if (!config.enabled || annualGrossIncome <= 0) return 0;

    const income = Math.max(
      0,
      annualGrossIncome - (config.standardDeduction ?? 0),
    );
    let tax = 0;

    for (const slab of config.slabs) {
      const lower = slab.minIncome === 0 ? 0 : slab.minIncome - 1;
      const upper = slab.maxIncome ?? income;
      if (income <= lower) continue;
      const taxable = Math.max(0, Math.min(income, upper) - lower);
      if (taxable > 0) tax += (taxable * slab.rate) / 100;
    }

    const cess = (tax * (config.cessRate ?? 0)) / 100;
    return Math.round(tax + cess);
  }

  /** Monthly TDS from current month taxable gross (annualized). */
  computeMonthlyTds(monthlyTaxableGross: number, rawConfig?: unknown): number {
    const config = this.normalizeConfig(rawConfig);
    if (!config.enabled || monthlyTaxableGross <= 0) return 0;
    const annualTax = this.computeAnnualTax(monthlyTaxableGross * 12, config);
    return Math.round(annualTax / 12);
  }

  preview(monthlyTaxableGross: number, rawConfig?: unknown) {
    const config = this.normalizeConfig(rawConfig);
    const annualGross = monthlyTaxableGross * 12;
    const taxableAfterDeduction = Math.max(
      0,
      annualGross - (config.standardDeduction ?? 0),
    );
    const annualTax = this.computeAnnualTax(annualGross, config);
    const monthlyTds = Math.round(annualTax / 12);

    return {
      monthlyTaxableGross,
      annualGross,
      taxableAfterDeduction,
      regime: config.regime,
      enabled: config.enabled,
      annualTax,
      monthlyTds,
    };
  }
}
