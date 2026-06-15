'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStudentDashboard } from '@/services/student-portal';

export function useStudentDashboard(options?: { enabled?: boolean }) {
  const authEnabled = useAuthQueryEnabled();
  const enabled = authEnabled && (options?.enabled ?? true);

  const query = useQuery({
    queryKey: ['student-portal', 'dashboard'],
    queryFn: fetchStudentDashboard,
    enabled,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
