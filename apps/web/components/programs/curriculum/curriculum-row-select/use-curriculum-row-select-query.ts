'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { dedupeCurriculumOfferingRows } from '@/components/programs/curriculum/curriculum-filter-utils';
import { fetchCurriculumOfferings } from '@/services/programs';
import type { CurriculumOfferingQuery } from '@/types/curriculum-filters';

import {
  buildInitialPanelFilters,
  panelFiltersToQuery,
  type RowSelectContext,
  type RowSelectPanelFilters,
} from './curriculum-row-select-utils';

const SEARCH_DEBOUNCE_MS = 300;

export function useCurriculumRowSelectQuery(open: boolean, contextDefaults: RowSelectContext) {
  const [showAllMappings, setShowAllMappings] = useState(false);
  const [filters, setFilters] = useState<RowSelectPanelFilters>(() =>
    buildInitialPanelFilters(contextDefaults, false),
  );
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const initializedForOpen = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false;
      return;
    }
    if (initializedForOpen.current) return;
    initializedForOpen.current = true;
    setShowAllMappings(false);
    setSearchInput('');
    setDebouncedSearch('');
    setFilters(buildInitialPanelFilters(contextDefaults, false));
  }, [open, contextDefaults]);

  const effectiveFilters = useMemo(
    (): RowSelectPanelFilters => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const queryParams = useMemo(
    (): CurriculumOfferingQuery => panelFiltersToQuery(effectiveFilters),
    [effectiveFilters],
  );

  const query = useInfiniteQuery({
    queryKey: ['catalog', 'curriculum-row-select', queryParams],
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchCurriculumOfferings({ ...queryParams, page: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const rows = useMemo(() => {
    const flat = query.data?.pages.flatMap((page) => page.data) ?? [];
    return dedupeCurriculumOfferingRows(flat);
  }, [query.data]);

  const total = query.data?.pages[0]?.meta.total ?? 0;

  const patchFilters = (patch: Partial<RowSelectPanelFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const handleShowAllMappings = (next: boolean) => {
    setShowAllMappings(next);
    if (next) {
      setFilters((current) =>
        buildInitialPanelFilters(
          { programVersionId: current.programVersionId || contextDefaults.programVersionId },
          true,
        ),
      );
    } else {
      setFilters(buildInitialPanelFilters(contextDefaults, false));
      setSearchInput('');
      setDebouncedSearch('');
    }
  };

  return {
    showAllMappings,
    setShowAllMappings: handleShowAllMappings,
    filters,
    patchFilters,
    searchInput,
    setSearchInput,
    rows,
    total,
    query,
  };
}
