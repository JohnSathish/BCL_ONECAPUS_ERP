'use client';

import type { LoginContext } from '@/types/login-context';
import { cn } from '@/utils/cn';
import { LOGIN_HERO_ANIMATIONS_ENABLED } from './login-hero.constants';
import { LoginHeroBackground } from './login-hero-background';
import { LoginHeroBrandHeader } from './login-hero-brand-header';
import { LoginHeroKpiShowcase } from './login-hero-kpi-showcase';
import { LoginHeroMobileBranding } from './login-hero-mobile-branding';
import { LoginHeroModuleStrip } from './login-hero-module-strip';
import { LoginHeroTrustBadges } from './login-hero-trust-badges';

type Props = {
  compact?: boolean;
  context?: LoginContext | null;
  contextLoading?: boolean;
};

export function LoginHeroPanel({ compact = false, context = null, contextLoading = false }: Props) {
  void context;
  void contextLoading;

  return (
    <section
      className={cn(
        'login-hero relative flex flex-col overflow-hidden',
        !LOGIN_HERO_ANIMATIONS_ENABLED && 'login-hero-static',
        compact
          ? 'login-hero-compact max-h-[220px] shrink-0 lg:hidden'
          : 'hidden lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden',
      )}
      aria-label="BCL OneCampus ERP overview"
    >
      <LoginHeroBackground />

      <div
        className={cn(
          'login-hero-content relative z-10 flex flex-1 flex-col',
          compact
            ? 'justify-start gap-2.5 px-4 py-4 sm:gap-3 sm:px-5 sm:py-5'
            : 'mx-auto w-full max-w-xl justify-center gap-5 px-10 py-8 xl:max-w-2xl xl:px-12',
        )}
      >
        <LoginHeroBrandHeader compact={compact} />

        {!compact ? (
          <>
            <div className="login-hero-divider" aria-hidden />
            <LoginHeroTrustBadges />
            <LoginHeroModuleStrip />
            <LoginHeroKpiShowcase />
          </>
        ) : (
          <LoginHeroMobileBranding />
        )}
      </div>
    </section>
  );
}
