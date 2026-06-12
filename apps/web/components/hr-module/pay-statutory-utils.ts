export type StatutoryFormOptions = {
  pfExempt?: boolean;
  houseRent?: number;
  cpfRate?: number;
  fixedAllowance?: number;
};

export function supportsFixedAllowance(payScaleType: string): boolean {
  return ['COLLEGE_NON_TEACHING', 'COLLEGE_TEACHING', 'CONTRACT', 'GUEST', 'VISITING'].includes(
    payScaleType,
  );
}

export function buildStatutoryOverrides(
  opts: StatutoryFormOptions,
): Record<string, unknown> | undefined {
  const overrides: Record<string, unknown> = {};
  if (opts.pfExempt) overrides.PF_EMPLOYER = { disabled: true };
  if (opts.cpfRate === 8 || opts.cpfRate === 10) overrides.CPF_EMPLOYER = { rate: opts.cpfRate };
  if (opts.houseRent != null && opts.houseRent >= 0)
    overrides.HOUSE_RENT = { value: opts.houseRent };
  if (opts.fixedAllowance != null && opts.fixedAllowance > 0) {
    overrides.ALLOWANCE = { value: opts.fixedAllowance };
    overrides.FIXED_ALLOWANCE = { value: opts.fixedAllowance };
  }
  return Object.keys(overrides).length ? overrides : undefined;
}

export function parseStatutoryOverrides(overrides?: Record<string, unknown> | null): {
  pfExempt: boolean;
  houseRent: number;
  cpfRate?: number;
  fixedAllowance: number;
} {
  if (!overrides) return { pfExempt: false, houseRent: 0, fixedAllowance: 0 };
  const pf = overrides.PF_EMPLOYER as { disabled?: boolean } | undefined;
  const house = overrides.HOUSE_RENT as { value?: number } | undefined;
  const cpf = overrides.CPF_EMPLOYER as { rate?: number } | undefined;
  const allowance = overrides.ALLOWANCE as { value?: number } | undefined;
  const fixedAllowanceComp = overrides.FIXED_ALLOWANCE as { value?: number } | undefined;
  const allowanceValue =
    allowance?.value != null
      ? Number(allowance.value)
      : fixedAllowanceComp?.value != null
        ? Number(fixedAllowanceComp.value)
        : 0;
  return {
    pfExempt: pf?.disabled === true,
    houseRent: house?.value != null ? Number(house.value) : 0,
    cpfRate: cpf?.rate === 8 || cpf?.rate === 10 ? cpf.rate : undefined,
    fixedAllowance: allowanceValue,
  };
}
