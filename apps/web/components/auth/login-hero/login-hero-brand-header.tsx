'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';

type Props = {
  compact?: boolean;
};

export function LoginHeroBrandHeader({ compact = false }: Props) {
  if (compact) {
    return (
      <header className="login-hero-brand login-hero-brand-mobile flex w-full min-w-0 flex-col items-center text-center">
        <div className="login-hero-logo-mark h-12 w-12" aria-hidden>
          <BrandingLogoImage src={DEFAULT_LOGIN_LOGO} className="h-9 w-9" priority />
        </div>

        <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
          BCL OneCampus ERP
        </h1>
        <p className="login-hero-tagline-mobile mt-0.5 text-xs font-medium text-white/60 sm:text-sm">
          AI-Powered Campus Management Platform
        </p>
      </header>
    );
  }

  return (
    <header className="login-hero-brand w-full min-w-0">
      <p className="login-hero-eyebrow mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
        BaseCode Labs · OneCampus
      </p>

      <div className="login-hero-brand-lockup flex min-w-0 items-center gap-4 sm:gap-5">
        <div className="login-hero-logo-mark h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" aria-hidden>
          <BrandingLogoImage
            src={DEFAULT_LOGIN_LOGO}
            className="h-12 w-12 sm:h-14 sm:w-14"
            priority
          />
        </div>

        <div className="login-hero-brand-copy min-w-0">
          <h1 className="whitespace-nowrap text-[2.35rem] font-black leading-[1.05] tracking-tight text-white xl:text-[2.75rem]">
            BCL OneCampus ERP
          </h1>
          <p className="login-hero-tagline mt-0.5 text-sm font-medium sm:text-[0.9375rem]">
            AI-Powered Campus Management Platform
          </p>
        </div>
      </div>

      <p className="login-hero-brand-description mt-4 max-w-[520px] border-l-2 border-cyan-400/35 pl-4 text-sm leading-relaxed text-white/70">
        One unified platform for{' '}
        <span className="text-white/90">
          admissions, academics, attendance, examinations, finance, analytics
        </span>
        , and campus operations.
      </p>
    </header>
  );
}
