'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchEligibleMajors, fetchEligibleMinors } from '@/services/academic-engine';

export function useEligibleMajors(params: {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['eligible-majors', params.programVersionId, params.semesterSequence, params.shiftId],
    queryFn: () =>
      fetchEligibleMajors({
        programVersionId: params.programVersionId,
        semesterSequence: params.semesterSequence,
        shiftId: params.shiftId,
      }),
    enabled: Boolean(params.enabled && params.programVersionId && params.semesterSequence),
  });
}

export function useEligibleMinors(params: {
  programVersionId: string;
  majorSubjectSlug: string;
  semesterSequence: number;
  shiftId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'eligible-minors',
      params.programVersionId,
      params.majorSubjectSlug,
      params.semesterSequence,
      params.shiftId,
    ],
    queryFn: () =>
      fetchEligibleMinors({
        programVersionId: params.programVersionId,
        majorSubjectSlug: params.majorSubjectSlug,
        semesterSequence: params.semesterSequence,
        shiftId: params.shiftId,
      }),
    enabled: Boolean(
      params.enabled &&
      params.programVersionId &&
      params.majorSubjectSlug &&
      params.semesterSequence,
    ),
  });
}
