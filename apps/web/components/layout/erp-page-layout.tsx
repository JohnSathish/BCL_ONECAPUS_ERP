'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { AcademicContextStrip } from '@/components/layout/academic-context-strip';
import { cn } from '@/utils/cn';

type ErpPageLayoutContextValue = {
  shellTitle?: string;
};

const ErpPageLayoutContext = createContext<ErpPageLayoutContextValue>({});

export function useErpPageLayout() {
  return useContext(ErpPageLayoutContext);
}

/** Measures topbar + banner heights and writes CSS variables (no hardcoded px offsets). */
export function ErpChromeMeasurer() {
  useEffect(() => {
    const root = document.documentElement;

    const measure = () => {
      const topbar = document.getElementById('erp-topbar');
      const banner = document.getElementById('erp-license-banner');
      const topbarHeight = topbar?.getBoundingClientRect().height ?? 56;
      const bannerHeight = banner?.getBoundingClientRect().height ?? 0;
      root.style.setProperty('--erp-topbar-height', `${topbarHeight}px`);
      root.style.setProperty('--erp-banner-height', `${bannerHeight}px`);
    };

    measure();

    const observer = new ResizeObserver(measure);
    const topbar = document.getElementById('erp-topbar');
    const banner = document.getElementById('erp-license-banner');
    if (topbar) observer.observe(topbar);
    if (banner) observer.observe(banner);

    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return null;
}

export function ErpPageLayoutProvider({
  shellTitle,
  children,
}: {
  shellTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ErpPageLayoutContext.Provider value={{ shellTitle }}>{children}</ErpPageLayoutContext.Provider>
  );
}

/** Standard content wrapper — always starts below measured global chrome. */
export function ErpPageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'erp-page-content w-full max-w-full min-w-0',
        'pt-[var(--erp-page-header-gap,0.75rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Page title safe area — below global navbar, never overlapping it. */
export function ErpPageHeaderSection({
  title,
  subtitle,
  breadcrumb,
  actions,
  hideContextStrip,
  className,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  hideContextStrip?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'erp-page-header mb-5 min-w-0 scroll-mt-[var(--erp-content-offset,4rem)]',
        className,
      )}
    >
      {!hideContextStrip ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <AcademicContextStrip className="max-w-full whitespace-normal sm:truncate" />
        </div>
      ) : null}
      {breadcrumb ? <div className="mb-2 text-xs text-muted-foreground">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl lg:text-[1.65rem] lg:leading-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Compact module hero — reduces vertical space vs full page header. */
export function ErpPageHero({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'erp-page-hero mb-5 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-card to-background p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {icon}
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
      </div>
      {children}
    </section>
  );
}
