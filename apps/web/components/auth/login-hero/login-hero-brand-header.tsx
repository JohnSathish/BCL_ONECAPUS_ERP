'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { BASECODE_LABS_WEBSITE } from '@/components/branding/powered-by-basecode-labs';
import { resolveSchoolAwareLogoUrl } from '@/lib/school-admissions-branding';
import {
  resolvePoweredByText,
  resolveProductName,
  resolveProductTagline,
} from '@/lib/branding-defaults';
import type { LoginContext } from '@/types/login-context';

type Props = {
  compact?: boolean;
  context?: LoginContext | null;
};

export function LoginHeroBrandHeader({ compact = false, context = null }: Props) {
  const productName = resolveProductName(context?.productName);
  const productTagline = resolveProductTagline(context?.productTagline);
  const logoSrc = resolveSchoolAwareLogoUrl({
    logoUrl: context?.institution?.logoUrl,
    institutionType: context?.institutionType,
  });
  const institutionName = context?.institution?.displayName?.trim();
  const eyebrow = institutionName
    ? `${institutionName} · Campus portal`
    : 'Campus education platform';

  if (compact) {
    return (
      <header className="login-hero-brand login-hero-brand-mobile flex w-full min-w-0 flex-col items-center text-center">
        <div className="login-hero-logo-mark h-12 w-12" aria-hidden>
          <BrandingLogoImage src={logoSrc} className="h-9 w-9" priority />
        </div>

        <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {productName}
        </h1>
        <p className="login-hero-tagline-mobile mt-0.5 text-xs font-medium text-white/60 sm:text-sm">
          {productTagline}
        </p>
      </header>
    );
  }

  return (
    <header className="login-hero-brand w-full min-w-0">
      <p className="login-hero-eyebrow mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
        {eyebrow}
      </p>

      <div className="login-hero-brand-lockup flex min-w-0 items-center gap-4 sm:gap-5">
        <div className="login-hero-logo-mark h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" aria-hidden>
          <BrandingLogoImage src={logoSrc} className="h-12 w-12 sm:h-14 sm:w-14" priority />
        </div>

        <div className="login-hero-brand-copy min-w-0">
          <h1 className="whitespace-nowrap text-[2.35rem] font-black leading-[1.05] tracking-tight text-white xl:text-[2.75rem]">
            {productName}
          </h1>
          <p className="login-hero-tagline mt-0.5 text-sm font-medium sm:text-[0.9375rem]">
            {productTagline}
          </p>
        </div>
      </div>

      <p className="login-hero-brand-description mt-4 max-w-[520px] border-l-2 border-cyan-400/50 pl-4 text-sm leading-relaxed text-white/75">
        One unified platform for{' '}
        <span className="text-white">
          admissions, academics, attendance, examinations, finance, analytics
        </span>
        , and campus operations.
      </p>
      {context?.showPoweredBy ? (
        <a
          href={BASECODE_LABS_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-[11px] font-medium text-cyan-300/70 underline-offset-2 hover:underline"
        >
          {resolvePoweredByText(context.poweredByText ?? context.poweredBy)}
        </a>
      ) : null}
    </header>
  );
}
