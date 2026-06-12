'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApiHealthReady } from '@/services/health';

export function useApiHealth(enabled = true) {
  return useQuery({
    queryKey: ['api', 'health', 'ready'],
    queryFn: fetchApiHealthReady,
    enabled,
    staleTime: 30_000,
    retry: 1,
    refetchInterval: 60_000,
  });
}
