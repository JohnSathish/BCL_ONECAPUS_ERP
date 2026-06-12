'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { MapPin } from 'lucide-react';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';
import type { BrandingPreviewSnapshot } from './branding-preview-types';

type Props = {
  snapshot: BrandingPreviewSnapshot;
  compact?: boolean;
  className?: string;
};

export function BrandingLoginPreview({ snapshot, compact, className }: Props) {
  const logoSrc = snapshot.logoPreview ?? DEFAULT_LOGIN_LOGO;
  const locationLine = [snapshot.campusName, snapshot.address].filter(Boolean).join(' · ');
  const primary = snapshot.primaryColor ?? '#2563eb';
  const accent = snapshot.accentColor ?? '#7c3aed';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg',
        className,
      )}
      style={
        {
          '--preview-primary': primary,
          '--preview-accent': accent,
        } as React.CSSProperties
      }
    >
      <div className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live preview
        </p>
        {!snapshot.brandingEnabled ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Branding disabled — default platform theme will apply
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'relative',
          compact ? 'min-h-[320px]' : 'min-h-[420px]',
          snapshot.loginBackgroundStyle === 'gradient' &&
            'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900',
          snapshot.loginBackgroundStyle === 'mesh' &&
            'bg-[radial-gradient(ellipse_at_top,_var(--preview-primary)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom,_var(--preview-accent)_0%,_transparent_50%)] bg-slate-950',
          snapshot.loginBackgroundStyle === 'solid' && 'bg-[var(--preview-primary)]',
        )}
      >
        <div className="flex h-full min-h-[inherit] flex-col lg:flex-row">
          {!compact ? (
            <div className="hidden flex-1 flex-col justify-end p-6 lg:flex">
              <div className="login-glass-compact max-w-sm rounded-xl p-4">
                <p className="text-sm font-semibold text-white/95">{snapshot.displayName}</p>
                {locationLine ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/60">
                    <MapPin className="h-3 w-3" />
                    {locationLine}
                  </p>
                ) : null}
                {snapshot.badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {snapshot.badges.slice(0, 4).map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white/85"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex w-full flex-col bg-card/95 backdrop-blur-sm lg:max-w-[280px]">
            <header className="border-b border-border/40 px-4 pb-3 pt-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30 p-1 ring-1 ring-border/50"
                  style={{ boxShadow: `0 0 0 1px ${primary}22` }}
                >
                  <BrandingLogoImage src={logoSrc} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-foreground">
                    {snapshot.displayName}
                  </h3>
                  {locationLine ? (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {locationLine}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {snapshot.portalSubtitle ?? 'Campus ERP Portal'}
                  </p>
                </div>
              </div>
              {snapshot.badges.length > 0 && compact ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {snapshot.badges.slice(0, 3).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <div className="flex flex-1 flex-col justify-center px-4 py-6">
              <div className="mx-auto w-full max-w-[220px] space-y-3">
                <div className="h-2 w-16 rounded bg-muted" />
                <div className="h-9 rounded-lg border border-border bg-background" />
                <div className="h-9 rounded-lg border border-border bg-background" />
                <div
                  className="h-9 rounded-lg text-center text-xs font-medium leading-9 text-white"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
                >
                  Sign in
                </div>
              </div>
              {snapshot.showPoweredBy ? (
                <p className="mt-4 text-center text-[9px] text-muted-foreground">
                  Powered by BCL OneCampus ERP
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
