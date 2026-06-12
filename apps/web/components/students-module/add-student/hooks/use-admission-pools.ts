'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchAdmissionPools } from '@/services/students';

export function useAdmissionPools(params: {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  majorSubjectSlug?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'admission-pools',
      params.programVersionId,
      params.semesterSequence,
      params.shiftId,
      params.majorSubjectSlug,
    ],
    queryFn: () =>
      fetchAdmissionPools({
        programVersionId: params.programVersionId,
        semesterSequence: params.semesterSequence,
        shiftId: params.shiftId,
        majorSubjectSlug: params.majorSubjectSlug,
      }),
    enabled: Boolean(params.enabled && params.programVersionId && params.semesterSequence),
  });
}
