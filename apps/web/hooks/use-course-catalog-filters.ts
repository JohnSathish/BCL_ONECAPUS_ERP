'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CourseListParams } from '@/types/programs';

export type CourseCatalogFilterState = {
  departmentId: string;
  courseType: string;
  deliveryType: string;
  programVersionId: string;
  semesterSequence: string;
  category: string;
};

const emptyFilters: CourseCatalogFilterState = {
  departmentId: '',
  courseType: '',
  deliveryType: '',
  programVersionId: '',
  semesterSequence: '',
  category: '',
};

export function useCourseCatalogFilters() {
  const [filters, setFilters] = useState<CourseCatalogFilterState>(emptyFilters);

  const hasCurriculumFilters = Boolean(
    filters.programVersionId || filters.semesterSequence || filters.category,
  );

  const hasActiveFilters = useMemo(() => Object.values(filters).some((v) => v !== ''), [filters]);

  const setFilter = useCallback(
    <K extends keyof CourseCatalogFilterState>(key: K, value: CourseCatalogFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  const toQueryParams = useCallback(
    (search?: string, page = 1): CourseListParams => ({
      page,
      limit: 30,
      search: search?.trim() || undefined,
      departmentId: filters.departmentId || undefined,
      courseType: filters.courseType || undefined,
      deliveryType: filters.deliveryType || undefined,
      programVersionId: filters.programVersionId || undefined,
      semesterSequence: filters.semesterSequence ? Number(filters.semesterSequence) : undefined,
      category: filters.category || undefined,
    }),
    [filters],
  );

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
    hasCurriculumFilters,
    toQueryParams,
  };
}
