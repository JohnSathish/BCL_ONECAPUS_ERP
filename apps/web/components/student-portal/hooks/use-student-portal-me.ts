'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStudentPortalMe } from '@/services/student-portal';

export function useStudentPortalMe(options?: { enabled?: boolean }) {
  const authReady = useAuthQueryEnabled();
  const enabled = options?.enabled !== false && authReady;

  return useQuery({
    queryKey: ['student-portal', 'me'],
    queryFn: fetchStudentPortalMe,
    enabled,
    staleTime: 60_000,
  });
}
