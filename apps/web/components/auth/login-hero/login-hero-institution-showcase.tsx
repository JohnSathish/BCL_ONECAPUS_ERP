'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { MapPin } from 'lucide-react';
import { resolveBrandingAssetUrl } from '@/lib/branding-asset';
import type { LoginContext } from '@/types/login-context';

type Props = {
  context: LoginContext | null;
  loading?: boolean;
};

export function LoginHeroInstitutionShowcase({ context, loading }: Props) {
  if (loading) {
    return <div className="login-glass-compact h-12 animate-pulse rounded-lg" aria-hidden />;
  }

  if (!context) return null;

  const { institution } = context;
  const logoSrc = resolveBrandingAssetUrl(institution.logoUrl);
  const location = [institution.campusName, institution.address].filter(Boolean).join(' · ');
  const badges = institution.badges ?? [];
  const hasContent = institution.displayName || location || badges.length > 0 || logoSrc;

  if (!hasContent) return null;

  return (
    <div className="login-glass-compact flex items-center gap-3 rounded-lg px-3 py-2.5">
      {logoSrc ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/5 p-0.5">
          <BrandingLogoImage src={logoSrc} className="h-full w-full" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/95">{institution.displayName}</p>
        {location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/55">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {location}
          </p>
        ) : null}
        {badges.length > 0 ? (
          <p className="mt-1 truncate text-[10px] text-cyan-100/75">
            {badges.slice(0, 2).join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
