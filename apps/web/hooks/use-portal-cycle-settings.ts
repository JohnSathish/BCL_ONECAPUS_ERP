'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApplicantMe, fetchPortalInfo } from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { resolvePortalCycleSettings } from '@/components/admissions-portal/cycle-settings';

export function usePortalCycleSettings() {
  const enabled = useAuthQueryEnabled();

  const portalInfo = useQuery({
    queryKey: ['admissions-portal-info'],
    queryFn: fetchPortalInfo,
  });

  const me = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const settings = useMemo(
    () =>
      resolvePortalCycleSettings({
        portalInfo: portalInfo.data,
        applicant: me.data,
      }),
    [portalInfo.data, me.data],
  );

  return {
    settings,
    isLoading: portalInfo.isLoading || (enabled && me.isLoading),
    portalInfo: portalInfo.data,
  };
}
