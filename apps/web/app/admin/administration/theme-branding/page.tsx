'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BrandingStudio, BrandingStudioLoading } from '@/components/branding/branding-studio';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  fetchBrandingAudit,
  fetchInstitutionBranding,
  fetchThemeSettings,
} from '@/services/branding';

export default function ThemeBrandingPage() {
  useRequireAuth();
  const { canManageBranding } = useInstitutionBranding();

  const { data, isLoading } = useQuery({
    queryKey: ['institution-branding'],
    queryFn: fetchInstitutionBranding,
  });

  const { data: theme, isLoading: themeLoading } = useQuery({
    queryKey: ['theme-settings'],
    queryFn: fetchThemeSettings,
  });

  const { data: audit = [] } = useQuery({
    queryKey: ['institution-branding-audit'],
    queryFn: () => fetchBrandingAudit(25),
  });

  return (
    <DashboardShell role="admin" title="Theme Studio">
      {isLoading || themeLoading || !data || !theme ? (
        <BrandingStudioLoading />
      ) : (
        <BrandingStudio
          initialData={data}
          initialTheme={theme}
          audit={audit}
          canManage={canManageBranding}
        />
      )}
    </DashboardShell>
  );
}
