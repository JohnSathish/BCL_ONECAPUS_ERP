'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { fetchCycleDashboard } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { canAccessAdminPortal, isStudentOnlyUser } from '@/lib/permissions/portal-access';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import { cn } from '@/utils/cn';

function formatAyLabel(name: string | undefined) {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed.toUpperCase().startsWith('AY ') ? trimmed : `AY ${trimmed}`;
}

export function AcademicContextStrip({ className }: { className?: string }) {
  const authSession = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const institutionIdFromFilters = useDashboardFiltersStore((s) => s.institutionId);
  const { branding } = useInstitutionBranding();

  const roles = authSession?.user.roles ?? [];
  const permissions = authSession?.user.permissions ?? [];
  const isPortalUser =
    isStudentOnlyUser(roles) || pathname.startsWith('/student') || pathname.startsWith('/staff');
  const canLoadAdminCycle =
    Boolean(authSession) && !isPortalUser && canAccessAdminPortal(roles, permissions);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: canLoadAdminCycle,
    staleTime: 5 * 60_000,
  });

  const institutionId = institutionIdFromFilters ?? institutions.data?.[0]?.id;
  const institution = institutions.data?.find((i) => i.id === institutionId);

  const dashboard = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId, 'context-strip'],
    queryFn: () => fetchCycleDashboard(institutionId!),
    enabled: canLoadAdminCycle && Boolean(institutionId),
    staleTime: 60_000,
  });

  if (!authSession) return null;

  if (isPortalUser) {
    const label = branding?.displayName ?? branding?.shortName;
    if (!label) return null;
    return (
      <p
        className={cn(
          'flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground',
          className,
        )}
        title={label}
      >
        <span className="truncate">{label}</span>
      </p>
    );
  }

  if (!institutionId) return null;

  const ay = formatAyLabel(dashboard.data?.primarySession?.name);
  const cycle = dashboard.data?.currentCycle;
  const isActive = dashboard.data?.primarySession?.status === 'ACTIVE';

  if (!institution?.name && !ay) return null;

  const parts = [institution?.name, ay, cycle ? `${cycle} Cycle` : null].filter(Boolean);

  return (
    <p
      className={cn(
        'flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground',
        className,
      )}
      title={parts.join(' • ')}
    >
      {parts.map((part, index) => (
        <span key={part} className="inline-flex min-w-0 items-center gap-2">
          {index > 0 ? <span className="text-border">•</span> : null}
          <span className="truncate">{part}</span>
        </span>
      ))}
      {isActive ? (
        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Active
        </span>
      ) : null}
    </p>
  );
}
