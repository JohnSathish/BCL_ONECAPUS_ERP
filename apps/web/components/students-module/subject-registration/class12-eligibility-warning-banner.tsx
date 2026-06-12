'use client';

type Props = {
  className?: string;
  variant?: 'admin' | 'student';
};

export function Class12EligibilityWarningBanner({ className, variant = 'admin' }: Props) {
  const suffix =
    variant === 'admin'
      ? ' Admin override is available for ineligible courses.'
      : ' Contact the admissions office to update your Class XII record.';

  return (
    <p
      className={
        className ??
        'rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200'
      }
    >
      Eligibility rules partially unavailable — Class XII subjects not recorded.{suffix}
    </p>
  );
}
