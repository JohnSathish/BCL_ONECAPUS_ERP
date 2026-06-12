'use client';

import { DirectoryFilterRail } from '@/components/students-module/directory/directory-filter-rail';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';

type Props = {
  filters: DirectoryFilters;
  totalCount?: number;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
  onOpenAdvanced: () => void;
  onResetFilters: () => void;
  programOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
  departmentOptions: { id: string; label: string }[];
  sessionOptions: { id: string; label: string }[];
  categoryOptions: { id: string; label: string }[];
  religionOptions?: { id: string; label: string }[];
};

/** Filters-only command bar — search and primary actions live in {@link DirectoryPageHeader}. */
export function DirectoryCommandBar(props: Props) {
  return <DirectoryFilterRail {...props} />;
}
