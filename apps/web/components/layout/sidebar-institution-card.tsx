'use client';

import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO, resolveBrandingAssetUrl } from '@/lib/branding-asset';
import { fetchOperationsCenter } from '@/services/dashboard-analytics';
import type { InstitutionBranding } from '@/types/branding';
import { cn } from '@/utils/cn';

type Props = {
  branding?: InstitutionBranding | null;
  active?: boolean;
  collapsed?: boolean;
  className?: string;
};

export function SidebarInstitutionCard({ branding, active, collapsed, className }: Props) {
  const statsQ = useQuery({
    queryKey: ['sidebar', 'institution-stats'],
    queryFn: () => fetchOperationsCenter({}),
    staleTime: 120_000,
    retry: 1,
  });

  const logoSrc = active
    ? (resolveBrandingAssetUrl(branding?.logoUrl) ?? DEFAULT_LOGIN_LOGO)
    : undefined;
  const name = active
    ? (branding?.displayName ?? branding?.shortName ?? 'BCL OneCampus ERP')
    : 'BCL OneCampus ERP';
  const subtitle = active
    ? (branding?.portalSubtitle ?? statsQ.data?.institution.academicYear ?? 'Campus OS')
    : 'Campus OS';
  const location = branding?.address?.split(',').pop()?.trim() ?? 'Active Campus';

  const students = statsQ.data?.institution.studentCount;
  const staff = statsQ.data?.institution.staffCount;

  if (collapsed) {
    return (
      <div className={cn('flex justify-center', className)}>
        {logoSrc ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-active/40 p-1 ring-1 ring-sidebar-border">
            <BrandingLogoImage src={logoSrc} className="h-full w-full" priority />
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
            OC
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-sidebar-active/30 to-sidebar-active/10 p-3 shadow-[inset_0_1px_0_hsl(var(--sidebar-foreground)/0.06)]',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {logoSrc ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/10 p-1 ring-1 ring-sidebar-border/80">
            <BrandingLogoImage src={logoSrc} className="h-full w-full" priority />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.35)]">
            OC
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground">
            {name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-sidebar-muted">{subtitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              Active
            </span>
            <span className="inline-flex items-center gap-0.5 text-[9px] text-sidebar-muted">
              <MapPin className="h-2.5 w-2.5" />
              {location}
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-full z-20 mt-1 hidden rounded-lg border border-sidebar-border bg-sidebar/95 p-2.5 opacity-0 shadow-xl backdrop-blur-md transition group-hover:pointer-events-auto group-hover:block group-hover:opacity-100">
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatPill label="Students" value={students} color="#22c55e" />
          <StatPill label="Staff" value={staff} color="#f59e0b" />
          <StatPill label="Depts" value="—" color="#8b5cf6" />
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value?: number | string;
  color: string;
}) {
  return (
    <div className="rounded-md bg-sidebar-active/40 px-1 py-1.5">
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {value != null ? value.toLocaleString() : '—'}
      </p>
      <p className="text-[9px] text-sidebar-muted">{label}</p>
    </div>
  );
}
