/** Mirrors server defaults in PasswordPolicyService. */
export const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
} as const;

export type PasswordPolicyRules = typeof DEFAULT_PASSWORD_POLICY;

export type PasswordPolicyCheck = {
  id: string;
  label: string;
  passed: boolean;
};

export type PasswordPolicyResult = {
  checks: PasswordPolicyCheck[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  strengthScore: number;
  isValid: boolean;
  firstError: string | null;
};

export function evaluatePasswordPolicy(
  password: string,
  rules: PasswordPolicyRules = DEFAULT_PASSWORD_POLICY,
): PasswordPolicyResult {
  const checks: PasswordPolicyCheck[] = [
    {
      id: 'length',
      label: `At least ${rules.minLength} characters`,
      passed: password.length >= rules.minLength && password.length <= rules.maxLength,
    },
    {
      id: 'upper',
      label: 'One uppercase letter (A–Z)',
      passed: !rules.requireUpper || /[A-Z]/.test(password),
    },
    {
      id: 'lower',
      label: 'One lowercase letter (a–z)',
      passed: !rules.requireLower || /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'One number (0–9)',
      passed: !rules.requireNumber || /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'One special character (!@#$…)',
      passed: !rules.requireSpecial || /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const strengthScore = password.length === 0 ? 0 : Math.round((passedCount / checks.length) * 100);

  let strength: PasswordPolicyResult['strength'] = 'weak';
  if (strengthScore >= 100) strength = 'strong';
  else if (strengthScore >= 80) strength = 'good';
  else if (strengthScore >= 40) strength = 'fair';

  const firstFailed = checks.find((check) => !check.passed);
  const firstError =
    password.length === 0
      ? null
      : firstFailed
        ? `Password must meet all requirements (${firstFailed.label.toLowerCase()}).`
        : null;

  return {
    checks,
    strength,
    strengthScore,
    isValid: checks.every((check) => check.passed),
    firstError,
  };
}
