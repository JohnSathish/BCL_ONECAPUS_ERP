'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionBranding } from '@/services/branding';
import { useAuthStore } from '@/store/auth-store';
import type { InstitutionBranding } from '@/types/branding';

export function useInstitutionBranding() {
  const session = useAuthStore((s) => s.session);
  const query = useQuery({
    queryKey: ['institution-branding', session?.user.tenantId],
    queryFn: fetchInstitutionBranding,
    enabled: Boolean(session?.accessToken),
    staleTime: 5 * 60_000,
  });

  const canManageBranding =
    Boolean(session?.user.roles.includes('college-admin')) ||
    Boolean(session?.user.roles.includes('super-admin')) ||
    Boolean(session?.user.permissions?.includes('tenant:manage'));

  const branding = query.data;
  const active = Boolean(branding?.brandingEnabled);

  return {
    ...query,
    branding,
    active,
    canManageBranding,
  };
}

/** Snapshot for reports, PDFs, and ID cards (future-ready). */
export function toBrandingDocumentContext(
  branding: InstitutionBranding | undefined,
): InstitutionBranding | null {
  if (!branding?.brandingEnabled) return null;
  return branding;
}
