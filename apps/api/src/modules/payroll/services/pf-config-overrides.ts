import type { ComponentOverride } from './formula-engine.service';

export const PF_COMPONENT_CODES = [
  'PF_EMPLOYER',
  'PF_EMPLOYEE',
  'PPF',
  'PF',
  'PF_EARNING',
  'CPF',
  'CPF_EMPLOYER',
  'NPS',
] as const;

export type PfScheme =
  | 'PF_12_PERCENT'
  | 'PF_FIXED_AMOUNT'
  | 'CPF'
  | 'CUSTOM'
  | 'NOT_APPLICABLE';

export type PfConfigSnapshot = {
  pfEnabled: boolean;
  employeePfApplicable: boolean;
  employerPfApplicable: boolean;
  pfScheme: string;
  employeePfAmount?: number | null;
  employerPfAmount?: number | null;
  pfAccountNumber?: string | null;
  uanNumber?: string | null;
  effectiveFrom?: string | Date;
  remarks?: string | null;
};

function disableAllPf(): Record<string, ComponentOverride> {
  const overrides: Record<string, ComponentOverride> = {};
  for (const code of PF_COMPONENT_CODES) {
    overrides[code] = { disabled: true };
  }
  return overrides;
}

export function isPfApplicable(
  config: PfConfigSnapshot | null | undefined,
  asOf?: Date,
): boolean {
  if (!config?.pfEnabled || config.pfScheme === 'NOT_APPLICABLE') return false;
  if (asOf && config.effectiveFrom) {
    const effective = new Date(config.effectiveFrom);
    if (effective > asOf) return false;
  }
  return true;
}

export function buildPfOverridesFromConfig(
  config: PfConfigSnapshot | null | undefined,
  asOf?: Date,
): Record<string, ComponentOverride> {
  if (!isPfApplicable(config, asOf)) {
    return disableAllPf();
  }

  const overrides: Record<string, ComponentOverride> = {};
  const scheme = config!.pfScheme;

  if (scheme === 'CPF') {
    for (const code of [
      'PF_EMPLOYER',
      'PF_EMPLOYEE',
      'PPF',
      'PF',
      'PF_EARNING',
    ] as const) {
      overrides[code] = { disabled: true };
    }
    if (config!.employerPfApplicable) {
      const rate = Number(config!.employerPfAmount) === 8 ? 8 : 10;
      overrides.CPF_EMPLOYER = { rate };
    } else {
      overrides.CPF_EMPLOYER = { disabled: true };
      overrides.CPF = { disabled: true };
    }
    return overrides;
  }

  if (!config!.employerPfApplicable) {
    overrides.PF_EMPLOYER = { disabled: true };
  } else if (scheme === 'PF_FIXED_AMOUNT' || scheme === 'CUSTOM') {
    if (config!.employerPfAmount != null) {
      overrides.PF_EMPLOYER = { value: Number(config!.employerPfAmount) };
    }
  }

  if (!config!.employeePfApplicable) {
    overrides.PF_EMPLOYEE = { disabled: true };
    overrides.PPF = { disabled: true };
    overrides.PF = { disabled: true };
  } else if (scheme === 'PF_FIXED_AMOUNT' || scheme === 'CUSTOM') {
    const employeeAmt = config!.employeePfAmount ?? config!.employerPfAmount;
    const employerAmt = config!.employerPfAmount ?? config!.employeePfAmount;
    if (employeeAmt != null) {
      overrides.PF_EMPLOYEE = { value: Number(employeeAmt) };
    }
    if (employerAmt != null && employeeAmt != null) {
      overrides.PPF = { value: Number(employerAmt) + Number(employeeAmt) };
    } else if (employerAmt != null) {
      overrides.PPF = { value: Number(employerAmt) * 2 };
    }
  }

  return overrides;
}

export function mergeComponentOverrides(
  base: Record<string, ComponentOverride> | null | undefined,
  pfOverrides: Record<string, ComponentOverride>,
): Record<string, ComponentOverride> {
  return { ...(base ?? {}), ...pfOverrides };
}

export function shouldOmitPfPayslipLine(
  code: string,
  pfApplicable: boolean,
): boolean {
  if (pfApplicable) return false;
  return PF_COMPONENT_CODES.includes(
    code.toUpperCase() as (typeof PF_COMPONENT_CODES)[number],
  );
}

export function pfSchemeLabel(scheme: string): string {
  switch (scheme) {
    case 'PF_12_PERCENT':
      return 'PF 12%';
    case 'PF_FIXED_AMOUNT':
      return 'PF Fixed Amount';
    case 'CPF':
      return 'CPF';
    case 'CUSTOM':
      return 'Custom';
    case 'NOT_APPLICABLE':
      return 'Not Applicable';
    default:
      return scheme;
  }
}
