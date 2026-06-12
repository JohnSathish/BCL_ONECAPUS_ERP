'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchEligibleMajors, fetchEligibleMinors } from '@/services/academic-engine';

export function useEligibleMajors(params: {
  programVersionId: string;
  semesterSequence: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['eligible-majors', params.programVersionId, params.semesterSequence],
    queryFn: () =>
      fetchEligibleMajors({
        programVersionId: params.programVersionId,
        semesterSequence: params.semesterSequence,
      }),
    enabled: Boolean(params.enabled && params.programVersionId && params.semesterSequence),
  });
}

export function useEligibleMinors(params: {
  programVersionId: string;
  majorSubjectSlug: string;
  semesterSequence: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      'eligible-minors',
      params.programVersionId,
      params.majorSubjectSlug,
      params.semesterSequence,
    ],
    queryFn: () =>
      fetchEligibleMinors({
        programVersionId: params.programVersionId,
        majorSubjectSlug: params.majorSubjectSlug,
        semesterSequence: params.semesterSequence,
      }),
    enabled: Boolean(
      params.enabled &&
      params.programVersionId &&
      params.majorSubjectSlug &&
      params.semesterSequence,
    ),
  });
}
