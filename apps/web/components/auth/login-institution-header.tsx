'use client';

import { Loader2 } from 'lucide-react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO, resolveBrandingAssetUrl } from '@/lib/branding-asset';
import type { LoginContext } from '@/types/login-context';
import { cn } from '@/utils/cn';

type Props = {
  context: LoginContext | null;
  loading?: boolean;
  waitingForApi?: boolean;
  errorMessage?: string | null;
};

function formatInstitutionLocation(campusName?: string, address?: string) {
  const campus = campusName?.trim();
  const addr = address?.trim();
  if (!campus && !addr) return '';
  if (!campus) return addr!;
  if (!addr) return campus;

  const campusCity = campus.split(',')[0]?.trim().toLowerCase();
  if (campusCity && addr.toLowerCase().includes(campusCity)) {
    return addr;
  }

  return campus.includes(',') ? campus : `${campus}, ${addr}`;
}

export function LoginInstitutionHeader({
  context,
  loading,
  waitingForApi = false,
  errorMessage,
}: Props) {
  if (loading && waitingForApi) {
    return (
      <header className="login-institution-header shrink-0 border-b border-border/40 bg-card/80 px-4 pb-3 pt-4 backdrop-blur-md sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Connecting to API server…</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Waiting for the backend to finish starting. This usually resolves within a few seconds
              after you run npm run dev.
            </p>
          </div>
        </div>
      </header>
    );
  }

  if (loading) {
    return (
      <header className="login-institution-header shrink-0 border-b border-border/40 bg-card/80 px-4 pb-3 pt-4 backdrop-blur-md sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex gap-3 sm:gap-4">
          <div className="h-11 w-11 shrink-0 rounded-lg bg-muted sm:h-12 sm:w-12" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-48 max-w-full rounded bg-muted sm:h-6" />
            <div className="h-3 w-32 max-w-full rounded bg-muted" />
            <div className="h-3 w-40 max-w-full rounded bg-muted" />
          </div>
        </div>
      </header>
    );
  }

  if (!context) {
    return (
      <header className="login-institution-header shrink-0 border-b border-border/40 bg-card/80 px-4 pb-3 pt-4 backdrop-blur-md sm:px-6 sm:pb-4 sm:pt-5">
        <p className="text-sm text-danger" role="alert">
          {errorMessage ??
            'Institution portal not found for this domain. Run npm run dev:setup if this is your first local start.'}
        </p>
      </header>
    );
  }

  const { institution, poweredBy, showPoweredBy } = context;
  const logoSrc = resolveBrandingAssetUrl(institution.logoUrl) ?? DEFAULT_LOGIN_LOGO;
  const locationLine = formatInstitutionLocation(institution.campusName, institution.address);
  const subtitle = institution.portalSubtitle ?? 'Campus ERP Portal';

  return (
    <header
      className={cn(
        'login-institution-header login-institution-header-accent shrink-0 border-b border-border/40 bg-card/90 px-4 pb-3 pt-4 backdrop-blur-md sm:px-6 sm:pb-4 sm:pt-5',
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-3 sm:gap-4">
        <div className="login-institution-logo flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/30 p-1 ring-1 ring-border/50 sm:h-12 sm:w-12">
          <BrandingLogoImage
            src={logoSrc}
            className="h-full w-full"
            priority={logoSrc === DEFAULT_LOGIN_LOGO}
          />
        </div>

        <div className="login-institution-copy min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">
            {institution.displayName}
          </h2>

          {locationLine ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{locationLine}</p>
          ) : null}

          <p className="mt-1 text-[11px] font-medium text-muted-foreground/90">{subtitle}</p>

          {showPoweredBy ? (
            <p className="mt-1 hidden text-[10px] font-medium text-primary/85 sm:block">
              Powered by {poweredBy}
            </p>
          ) : null}
        </div>
      </div>

      {institution.badges && institution.badges.length > 0 ? (
        <div className="mt-2.5 hidden flex-wrap gap-1.5 sm:flex">
          {institution.badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex max-w-full rounded-full border border-border/50 bg-muted/35 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
