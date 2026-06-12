'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSupportDataRows } from '@/services/support-data';
import { LOOKUP_CATEGORY_TO_TYPE } from '@/types/support-data';

export function resolveSupportDataCategory(categoryOrLookupType: string): string {
  if (LOOKUP_CATEGORY_TO_TYPE[categoryOrLookupType]) return categoryOrLookupType;
  const fromType = Object.entries(LOOKUP_CATEGORY_TO_TYPE).find(
    ([, t]) => t === categoryOrLookupType,
  );
  if (fromType) return fromType[0];
  return categoryOrLookupType;
}

export function useSupportData(
  categoryOrLookupType: string,
  options?: {
    activeOnly?: boolean;
    campusId?: string;
    enabled?: boolean;
  },
) {
  const category = resolveSupportDataCategory(categoryOrLookupType);

  return useQuery({
    queryKey: ['support-data', category, options?.activeOnly ?? true, options?.campusId],
    queryFn: () =>
      fetchSupportDataRows(category, {
        activeOnly: options?.activeOnly ?? true,
        campusId: options?.campusId,
      }),
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupportDataOptions(
  categoryOrLookupType: string,
  options?: { activeOnly?: boolean; campusId?: string; enabled?: boolean },
) {
  const query = useSupportData(categoryOrLookupType, options);
  return {
    ...query,
    options: (query.data ?? []).map((r) => ({
      value: r.code,
      label: r.label,
      id: r.id,
      metadata: r.metadata,
    })),
  };
}
