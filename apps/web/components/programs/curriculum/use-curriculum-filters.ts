'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { countAdvancedCurriculumFilters } from '@/components/programs/curriculum/curriculum-filter-utils';
import {
  curriculumFiltersToQuery,
  emptyCurriculumFilters,
  type CurriculumFilters,
  type CurriculumOfferingQuery,
} from '@/types/curriculum-filters';

const SEMESTER_PARAM = 'sem';

function parseSemesters(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
}

function filtersFromSearchParams(params: URLSearchParams): CurriculumFilters {
  const base = emptyCurriculumFilters();
  return {
    ...base,
    search: params.get('q') ?? '',
    programVersionId: params.get('programVersionId') ?? '',
    departmentId: params.get('departmentId') ?? '',
    categories: params.get('category')?.split(',').filter(Boolean) ?? [],
    semesters: parseSemesters(params.get(SEMESTER_PARAM)),
    streamId: params.get('streamId') ?? '',
    shiftId: params.get('shiftId') ?? '',
    batchId: params.get('batchId') ?? '',
    sharedPool:
      params.get('sharedPool') === 'pool'
        ? 'pool'
        : params.get('sharedPool') === 'programme'
          ? 'programme'
          : '',
    mappingStatus: params.get('mappingStatus') ?? '',
    deliveryType: params.get('deliveryType') ?? '',
    credits: params.get('credits') ?? '',
    enrollmentStatus: params.get('enrollmentStatus') ?? '',
    facultyAssigned:
      params.get('facultyAssigned') === 'true'
        ? 'true'
        : params.get('facultyAssigned') === 'false'
          ? 'false'
          : '',
    versionStatus: params.get('versionStatus') ?? 'ALL',
    quickToggle: params.get('quickToggle') ?? '',
  };
}

function searchParamsFromFilters(filters: CurriculumFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.programVersionId) params.set('programVersionId', filters.programVersionId);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.categories.length) params.set('category', filters.categories.join(','));
  if (filters.semesters.length) params.set(SEMESTER_PARAM, filters.semesters.join(','));
  if (filters.streamId) params.set('streamId', filters.streamId);
  if (filters.shiftId) params.set('shiftId', filters.shiftId);
  if (filters.batchId) params.set('batchId', filters.batchId);
  if (filters.sharedPool) params.set('sharedPool', filters.sharedPool);
  if (filters.mappingStatus) params.set('mappingStatus', filters.mappingStatus);
  if (filters.deliveryType) params.set('deliveryType', filters.deliveryType);
  if (filters.credits) params.set('credits', filters.credits);
  if (filters.enrollmentStatus) params.set('enrollmentStatus', filters.enrollmentStatus);
  if (filters.facultyAssigned) params.set('facultyAssigned', filters.facultyAssigned);
  if (filters.versionStatus && filters.versionStatus !== 'ALL') {
    params.set('versionStatus', filters.versionStatus);
  }
  if (filters.quickToggle) params.set('quickToggle', filters.quickToggle);
  return params;
}

export function useCurriculumFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<CurriculumFilters>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [searchInput, setSearchInput] = useState(filters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const syncingFromUrl = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    syncingFromUrl.current = true;
    const fromUrl = filtersFromSearchParams(searchParams);
    setFilters(fromUrl);
    setSearchInput(fromUrl.search);
    setDebouncedSearch(fromUrl.search);
    queueMicrotask(() => {
      syncingFromUrl.current = false;
    });
  }, [searchParams]);

  // Sync debounced search into filter state for URL persistence.
  useEffect(() => {
    if (syncingFromUrl.current) return;
    setFilters((current) => {
      if (current.search === debouncedSearch) return current;
      return { ...current, search: debouncedSearch };
    });
  }, [debouncedSearch]);

  // Sync filter state to the URL after render — never call router.replace inside setState.
  useEffect(() => {
    if (syncingFromUrl.current) return;
    const nextQs = searchParamsFromFilters(filters).toString();
    const currentQs = searchParams.toString();
    if (nextQs === currentQs) return;
    router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
  }, [filters, pathname, router, searchParams]);

  const patchFilters = useCallback((patch: Partial<CurriculumFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(emptyCurriculumFilters());
    setSearchInput('');
    setDebouncedSearch('');
  }, []);

  const toggleSemester = useCallback((sem: number) => {
    setFilters((current) => {
      const has = current.semesters.includes(sem);
      const semesters = has
        ? current.semesters.filter((s) => s !== sem)
        : [...current.semesters, sem].sort((a, b) => a - b);
      return { ...current, semesters };
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setFilters((current) => {
      const has = current.categories.includes(category);
      const categories = has
        ? current.categories.filter((c) => c !== category)
        : [...current.categories, category];
      return { ...current, categories };
    });
  }, []);

  const queryParams = useMemo(
    (): CurriculumOfferingQuery => curriculumFiltersToQuery(filters, debouncedSearch),
    [filters, debouncedSearch],
  );

  const advancedFilterCount = useMemo(() => countAdvancedCurriculumFilters(filters), [filters]);

  const hasActiveFilters = useMemo(() => {
    const empty = emptyCurriculumFilters();
    return (
      filters.search !== empty.search ||
      filters.programVersionId !== empty.programVersionId ||
      filters.departmentId !== empty.departmentId ||
      filters.categories.length > 0 ||
      filters.semesters.length > 0 ||
      filters.streamId !== empty.streamId ||
      filters.shiftId !== empty.shiftId ||
      filters.batchId !== empty.batchId ||
      filters.sharedPool !== empty.sharedPool ||
      filters.mappingStatus !== empty.mappingStatus ||
      filters.deliveryType !== empty.deliveryType ||
      filters.credits !== empty.credits ||
      filters.enrollmentStatus !== empty.enrollmentStatus ||
      filters.facultyAssigned !== empty.facultyAssigned ||
      filters.versionStatus !== empty.versionStatus ||
      filters.quickToggle !== empty.quickToggle
    );
  }, [filters]);

  return {
    filters,
    searchInput,
    setSearchInput,
    debouncedSearch,
    queryParams,
    hasActiveFilters,
    advancedFilterCount,
    patchFilters,
    resetFilters,
    toggleSemester,
    toggleCategory,
  };
}
