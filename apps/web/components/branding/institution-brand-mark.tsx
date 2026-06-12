'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { Sparkles } from 'lucide-react';
import { DEFAULT_LOGIN_LOGO, resolveBrandingAssetUrl } from '@/lib/branding-asset';
import type { InstitutionBranding } from '@/types/branding';
import { cn } from '@/utils/cn';

type Props = {
  branding?: InstitutionBranding | null;
  active?: boolean;
  collapsed?: boolean;
  className?: string;
};

export function InstitutionBrandMark({ branding, active, collapsed, className }: Props) {
  const logoSrc = active
    ? (resolveBrandingAssetUrl(branding?.logoUrl) ?? DEFAULT_LOGIN_LOGO)
    : undefined;
  const title = active
    ? (branding?.shortName ?? branding?.displayName ?? 'BCL OneCampus ERP')
    : 'BCL OneCampus ERP';
  const subtitle = active ? (branding?.portalSubtitle ?? 'Campus OS') : 'Campus OS';

  const iconStyle =
    active && branding?.primaryColor && branding?.accentColor
      ? {
          background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor})`,
        }
      : undefined;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {logoSrc ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 p-1 ring-1 ring-sidebar-border">
          <BrandingLogoImage
            src={logoSrc}
            className="h-full w-full"
            priority={logoSrc === DEFAULT_LOGIN_LOGO}
          />
        </div>
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow)]"
          style={iconStyle}
        >
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{subtitle}</p>
        </div>
      ) : null}
    </div>
  );
}
