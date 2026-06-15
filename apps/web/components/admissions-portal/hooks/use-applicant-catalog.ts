'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCatalog } from '@/services/academic-engine';
import { buildSectionsByCategory, normalizeCatalogResponse } from '@/utils/catalog-eligibility';
import type { CatalogSectionRow } from '@/types/academic-engine';

export function useApplicantCatalog(params: {
  programVersionId?: string | null;
  shiftId?: string;
  streamId?: string;
  majorCode?: string;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: [
      'applicant-catalog',
      params.programVersionId,
      params.shiftId,
      params.streamId,
      params.majorCode,
    ],
    queryFn: () =>
      fetchCatalog({
        programVersionId: params.programVersionId!,
        semesterSequence: 1,
        shiftId: params.shiftId,
        streamId: params.streamId,
        majorSubjectSlug: params.majorCode
          ? params.majorCode.toLowerCase().replace(/_/g, '-')
          : undefined,
        includeIneligible: false,
      }),
    enabled: Boolean(params.enabled && params.programVersionId && params.shiftId),
  });

  const normalized = normalizeCatalogResponse(query.data ?? { eligible: [], ineligible: [] });
  const byCategory = buildSectionsByCategory(normalized.eligible);

  const pick = (category: string): CatalogSectionRow[] => byCategory.get(category) ?? [];

  return {
    ...query,
    eligible: normalized.eligible,
    majorOptions: pick('MAJOR'),
    minorOptions: pick('MINOR'),
    mdcOptions: pick('MDC'),
    aecOptions: pick('AEC'),
    secOptions: pick('SEC'),
    vacOptions: pick('VAC'),
  };
}
