import type { ComponentOverride } from './formula-engine.service';
import { buildPfOverridesFromConfig } from './pf-config-overrides';

export type StatutoryOptions = {
  pfExempt?: boolean;
  houseRent?: number;
  cpfRate?: number;
  /** Fixed monthly allowance in ₹ (overrides structure formula when > 0). */
  fixedAllowance?: number;
};

export function buildAssignmentOverrides(
  opts: StatutoryOptions,
): Record<string, ComponentOverride> | undefined {
  const overrides: Record<string, ComponentOverride> = {};

  if (opts.pfExempt) {
    Object.assign(
      overrides,
      buildPfOverridesFromConfig({
        pfEnabled: false,
        employeePfApplicable: false,
        employerPfApplicable: false,
        pfScheme: 'NOT_APPLICABLE',
      }),
    );
  } else if (opts.cpfRate === 8 || opts.cpfRate === 10) {
    Object.assign(
      overrides,
      buildPfOverridesFromConfig({
        pfEnabled: true,
        employeePfApplicable: true,
        employerPfApplicable: true,
        pfScheme: 'CPF',
        employerPfAmount: opts.cpfRate,
      }),
    );
  }
  if (opts.houseRent != null && opts.houseRent >= 0) {
    overrides.HOUSE_RENT = { value: opts.houseRent };
  }
  if (opts.fixedAllowance != null && opts.fixedAllowance > 0) {
    overrides.ALLOWANCE = { value: opts.fixedAllowance };
    overrides.FIXED_ALLOWANCE = { value: opts.fixedAllowance };
  }

  return Object.keys(overrides).length ? overrides : undefined;
}

export function parseAssignmentOverrides(
  overrides?: Record<string, unknown> | null,
): {
  pfExempt: boolean;
  houseRent: number;
  cpfRate?: number;
  fixedAllowance: number;
} {
  if (!overrides || typeof overrides !== 'object') {
    return { pfExempt: false, houseRent: 0, fixedAllowance: 0 };
  }

  const pf = overrides.PF_EMPLOYER as ComponentOverride | undefined;
  const house = overrides.HOUSE_RENT as ComponentOverride | undefined;
  const cpf = overrides.CPF_EMPLOYER as ComponentOverride | undefined;
  const allowance = overrides.ALLOWANCE as ComponentOverride | undefined;
  const fixedAllowance = overrides.FIXED_ALLOWANCE as
    | ComponentOverride
    | undefined;
  const allowanceValue =
    allowance?.value != null
      ? Number(allowance.value)
      : fixedAllowance?.value != null
        ? Number(fixedAllowance.value)
        : 0;

  return {
    pfExempt: pf?.disabled === true || pf?.value === 0,
    houseRent: house?.value != null ? Number(house.value) : 0,
    cpfRate: cpf?.rate === 8 || cpf?.rate === 10 ? cpf.rate : undefined,
    fixedAllowance: allowanceValue,
  };
}

export function mergeStatutoryOverrides(
  existing: Record<string, unknown> | null | undefined,
  opts: StatutoryOptions,
): Record<string, ComponentOverride> | undefined {
  const parsed = parseAssignmentOverrides(existing);
  return buildAssignmentOverrides({
    pfExempt: opts.pfExempt ?? parsed.pfExempt,
    houseRent: opts.houseRent ?? parsed.houseRent,
    cpfRate: opts.cpfRate ?? parsed.cpfRate,
    fixedAllowance: opts.fixedAllowance ?? parsed.fixedAllowance,
  });
}
