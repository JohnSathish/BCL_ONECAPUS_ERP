import { Injectable } from '@nestjs/common';

export type ProfessionalTaxSlab = {
  minGross: number;
  maxGross?: number;
  amount: number;
};

export type ProfessionalTaxConfig = {
  enabled?: boolean;
  state?: string;
  /** Month (1–12) where PT is charged at double rate (e.g. February in Meghalaya). */
  doubleMonth?: number;
  slabs: ProfessionalTaxSlab[];
};

export const DEFAULT_MEGHALAYA_PT: ProfessionalTaxConfig = {
  enabled: true,
  state: 'MEGHALAYA',
  doubleMonth: 2,
  slabs: [
    { minGross: 0, maxGross: 5000, amount: 0 },
    { minGross: 5001, maxGross: 7500, amount: 110 },
    { minGross: 7501, maxGross: 10000, amount: 130 },
    { minGross: 10001, maxGross: 12500, amount: 150 },
    { minGross: 12501, maxGross: 15000, amount: 180 },
    { minGross: 15001, amount: 208 },
  ],
};

@Injectable()
export class ProfessionalTaxService {
  normalizeConfig(raw?: unknown): ProfessionalTaxConfig {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_MEGHALAYA_PT };
    }
    const obj = raw as Record<string, unknown>;
    const slabs = Array.isArray(obj.slabs)
      ? (obj.slabs as ProfessionalTaxSlab[]).filter(
          (s) => typeof s.minGross === 'number' && typeof s.amount === 'number',
        )
      : DEFAULT_MEGHALAYA_PT.slabs;
    return {
      enabled: obj.enabled !== false,
      state:
        typeof obj.state === 'string' ? obj.state : DEFAULT_MEGHALAYA_PT.state,
      doubleMonth:
        typeof obj.doubleMonth === 'number'
          ? obj.doubleMonth
          : DEFAULT_MEGHALAYA_PT.doubleMonth,
      slabs: slabs.length ? slabs : DEFAULT_MEGHALAYA_PT.slabs,
    };
  }

  /** Monthly professional tax from taxable gross (sum of earnings). */
  compute(grossSalary: number, month: number, rawConfig?: unknown): number {
    const config = this.normalizeConfig(rawConfig);
    if (!config.enabled || grossSalary <= 0) return 0;

    let amount = 0;
    for (const slab of config.slabs) {
      const inRange =
        grossSalary >= slab.minGross &&
        (slab.maxGross == null || grossSalary <= slab.maxGross);
      if (inRange) {
        amount = slab.amount;
        break;
      }
    }

    if (config.doubleMonth === month && amount > 0) {
      amount *= 2;
    }
    return amount;
  }

  preview(grossSalary: number, month: number, rawConfig?: unknown) {
    const config = this.normalizeConfig(rawConfig);
    const matchedSlab = config.slabs.find(
      (s) =>
        grossSalary >= s.minGross &&
        (s.maxGross == null || grossSalary <= s.maxGross),
    );
    const baseAmount = matchedSlab?.amount ?? 0;
    const doubled = config.doubleMonth === month && baseAmount > 0;
    const amount = this.compute(grossSalary, month, config);

    return {
      grossSalary,
      month,
      state: config.state,
      enabled: config.enabled,
      matchedSlab: matchedSlab ?? null,
      baseAmount,
      doubled,
      amount,
    };
  }
}
