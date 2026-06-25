'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { fetchCurriculumOfferings } from '@/services/programs';
import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import type { OfferingSection } from '@/types/programs';
import { dedupeCurriculumOfferingRows } from './curriculum-filter-utils';
import { CurriculumAdvancedFiltersDrawer } from './curriculum-advanced-filters-drawer';
import { CurriculumDeliveryList } from './curriculum-delivery-list';
import { CurriculumEmptyState } from './curriculum-empty-state';
import { CurriculumFilterChips } from './curriculum-filter-chips';
import { CurriculumFilterToolbar } from './curriculum-filter-toolbar';
import { useCurriculumFilters } from './use-curriculum-filters';

type Option = { id: string; label: string };

type Props = {
  enabled: boolean;
  canManage: boolean;
  allProgramOptions: Option[];
  departmentOptions: Option[];
  streamOptions: Option[];
  shiftOptions: Option[];
  batchOptions?: Option[];
  streamCount: number;
  onEditMapping: (offering: CurriculumOfferingRow) => void;
  onDeleteMapping: (offering: CurriculumOfferingRow) => void;
  onEditSection: (offering: CurriculumOfferingRow, section: OfferingSection) => void;
  onDeleteSection: (offering: CurriculumOfferingRow, section: OfferingSection) => void;
  deleteOfferingPending: boolean;
  deleteSectionPending: boolean;
  createSectionPending: boolean;
  updateSectionPending: boolean;
};

export function CurriculumDeliveryPanel({
  enabled,
  canManage,
  allProgramOptions,
  departmentOptions,
  streamOptions,
  shiftOptions,
  batchOptions: batchOptionsProp,
  streamCount,
  onEditMapping,
  onDeleteMapping,
  onEditSection,
  onDeleteSection,
  deleteOfferingPending,
  deleteSectionPending,
  createSectionPending,
  updateSectionPending,
}: Props) {
  const {
    filters,
    searchInput,
    setSearchInput,
    queryParams,
    hasActiveFilters,
    advancedFilterCount,
    patchFilters,
    resetFilters,
    toggleSemester,
    toggleCategory,
  } = useCurriculumFilters();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled,
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const batchesQuery = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: enabled && Boolean(institutionId) && !batchOptionsProp,
  });

  const batchOptions = useMemo(() => {
    if (batchOptionsProp?.length) return batchOptionsProp;
    return (batchesQuery.data ?? []).map((b) => ({
      id: b.id,
      label: `${b.batchCode} (${b.admissionYear})`,
    }));
  }, [batchOptionsProp, batchesQuery.data]);

  const curriculumQuery = useInfiniteQuery({
    queryKey: ['catalog', 'curriculum-offerings', queryParams],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchCurriculumOfferings({ ...queryParams, page: pageParam, limit: 30 }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const rows = useMemo(() => {
    const flat = curriculumQuery.data?.pages.flatMap((page) => page.data) ?? [];
    return dedupeCurriculumOfferingRows(flat);
  }, [curriculumQuery.data]);

  const total = curriculumQuery.data?.pages[0]?.meta.total ?? 0;
  const showSemesterGroups = filters.semesters.length !== 1;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !curriculumQuery.hasNextPage || curriculumQuery.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void curriculumQuery.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    curriculumQuery.fetchNextPage,
    curriculumQuery.hasNextPage,
    curriculumQuery.isFetchingNextPage,
  ]);

  const handlePatch = (patch: Partial<typeof filters>) => {
    if ('search' in patch && patch.search === '') {
      setSearchInput('');
    }
    patchFilters(patch);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-2">
        <div>
          <CardTitle>Curriculum & delivery</CardTitle>
          <CardDescription>
            One course master per row; multiple delivery sections underneath
          </CardDescription>
        </div>

        <div className="sticky top-0 z-30 -mx-1 space-y-2">
          <GlassCard className="relative isolate space-y-2 border border-border/60 bg-background/95 p-3 backdrop-blur">
            <CurriculumFilterToolbar
              filters={filters}
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              onPatch={handlePatch}
              onToggleSemester={toggleSemester}
              onReset={resetFilters}
              onOpenAdvanced={() => setAdvancedOpen(true)}
              advancedFilterCount={advancedFilterCount}
              programOptions={allProgramOptions}
            />
            <CurriculumFilterChips
              filters={filters}
              onPatch={handlePatch}
              onReset={resetFilters}
              programOptions={allProgramOptions}
              departmentOptions={departmentOptions}
              streamOptions={streamOptions}
              shiftOptions={shiftOptions}
              batchOptions={batchOptions}
            />
            {!curriculumQuery.isLoading && !curriculumQuery.isError ? (
              <p className="text-xs text-muted-foreground">
                {total.toLocaleString()} matching
                {rows.length < total ? ` · showing ${rows.length}` : ''}
                {hasActiveFilters ? ' · filters active' : ''}
              </p>
            ) : null}
          </GlassCard>
        </div>
      </CardHeader>

      <CardContent>
        {curriculumQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading curriculum…</p>
        ) : curriculumQuery.isError ? (
          <p className="text-sm text-destructive">Could not load curriculum offerings.</p>
        ) : !rows.length ? (
          <CurriculumEmptyState
            filters={filters}
            onReset={resetFilters}
            onOpenAdvanced={() => setAdvancedOpen(true)}
            onClearSemesters={() => patchFilters({ semesters: [] })}
          />
        ) : (
          <>
            <CurriculumDeliveryList
              rows={rows}
              canManage={canManage}
              streamCount={streamCount}
              showSemesterGroups={showSemesterGroups}
              onEditMapping={onEditMapping}
              onDeleteMapping={onDeleteMapping}
              onEditSection={onEditSection}
              onDeleteSection={onDeleteSection}
              deleteOfferingPending={deleteOfferingPending}
              deleteSectionPending={deleteSectionPending}
              createSectionPending={createSectionPending}
              updateSectionPending={updateSectionPending}
            />
            <div ref={loadMoreRef} className="h-8" />
            {curriculumQuery.isFetchingNextPage ? (
              <p className="text-xs text-muted-foreground">Loading more…</p>
            ) : null}
          </>
        )}
      </CardContent>

      <CurriculumAdvancedFiltersDrawer
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filters={filters}
        onChange={patchFilters}
        departmentOptions={departmentOptions}
        streamOptions={streamOptions}
        shiftOptions={shiftOptions}
        batchOptions={batchOptions}
        onToggleCategory={toggleCategory}
      />

      <Button
        type="button"
        size="sm"
        className="glass-card fixed bottom-6 right-4 z-30 h-12 w-12 rounded-full p-0 shadow-lg md:hidden"
        onClick={() => setAdvancedOpen(true)}
        aria-label="Open filters"
      >
        <SlidersHorizontal className="h-5 w-5" />
        {advancedFilterCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {advancedFilterCount}
          </span>
        ) : null}
      </Button>
    </Card>
  );
}
