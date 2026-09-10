'use client';

import type { LoginContext } from '@/types/login-context';
import { cn } from '@/utils/cn';
import { LOGIN_HERO_ANIMATIONS_ENABLED } from './login-hero.constants';
import { LoginHeroBackground } from './login-hero-background';
import { LoginHeroBrandHeader } from './login-hero-brand-header';
import { LoginHeroEcosystem } from './login-hero-ecosystem';
import { LoginHeroKpiShowcase } from './login-hero-kpi-showcase';
import { LoginHeroMobileBranding } from './login-hero-mobile-branding';

type Props = {
  compact?: boolean;
  context?: LoginContext | null;
  contextLoading?: boolean;
  schoolSis?: boolean;
};

export function LoginHeroPanel({
  compact = false,
  context = null,
  contextLoading = false,
  schoolSis = false,
}: Props) {
  void contextLoading;
  const schoolHero = schoolSis || context?.institutionType === 'SCHOOL';
  const productName =
    context?.productName?.trim() ||
    (schoolSis || context?.schoolProduct === 'SECONDARY_SIS'
      ? "St. Luke's School ERP"
      : schoolHero
        ? 'School ERP'
        : 'Campus ERP');

  return (
    <section
      className={cn(
        'login-hero relative flex flex-col overflow-hidden',
        !LOGIN_HERO_ANIMATIONS_ENABLED && 'login-hero-static',
        compact
          ? 'login-hero-compact max-h-[220px] shrink-0 lg:hidden'
          : 'hidden lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden',
      )}
      aria-label={`${productName} overview`}
    >
      <LoginHeroBackground />

      <div
        className={cn(
          'login-hero-content relative z-10 flex flex-1 flex-col',
          compact
            ? 'justify-start gap-2.5 px-4 py-4 sm:gap-3 sm:px-5 sm:py-5'
            : 'mx-auto w-full max-w-xl justify-center gap-3 px-6 py-5 xl:max-w-2xl xl:gap-4 xl:px-10 xl:py-6',
        )}
      >
        <LoginHeroBrandHeader compact={compact} context={context} schoolSis={schoolSis} />

        {!compact ? (
          schoolHero ? (
            <p className="max-w-[520px] border-l-2 border-cyan-400/50 pl-4 text-sm leading-relaxed text-white/75">
              School office tools for classes, students, staff, and the academic year — separate
              from the college Campus ERP.
            </p>
          ) : LOGIN_HERO_ANIMATIONS_ENABLED ? (
            <>
              <LoginHeroEcosystem context={context} />
              <LoginHeroKpiShowcase />
            </>
          ) : (
            <>
              <div className="login-hero-divider" aria-hidden />
              <LoginHeroKpiShowcase />
            </>
          )
        ) : schoolHero ? (
          <p className="text-center text-xs font-medium text-white/70">School office sign-in</p>
        ) : (
          <LoginHeroMobileBranding />
        )}
      </div>
    </section>
  );
}
