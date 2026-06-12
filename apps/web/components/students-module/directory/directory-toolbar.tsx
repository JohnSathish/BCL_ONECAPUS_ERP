'use client';

import Link from 'next/link';

import { erpInputCompact } from '@/components/erp/form-primitives';
import { Button, buttonVariants } from '@/components/ui/button';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { cn } from '@/utils/cn';

type Props = {
  canManage: boolean;
  canExport: boolean;
  canImport: boolean;
  selectedCount: number;
  filters: DirectoryFilters;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
  onQuickAdd: () => void;
  onExport: () => void;
  exportPending?: boolean;
};

export function DirectoryToolbar({
  canManage,
  canExport,
  canImport,
  selectedCount,
  filters,
  onFilterChange,
  onQuickAdd,
  onExport,
  exportPending,
}: Props) {
  const promoteHref =
    selectedCount > 0
      ? `/admin/students/promotion?ids=${encodeURIComponent('bulk')}`
      : '/admin/students/promotion';
  const subjectsHref = '/admin/students/subject-registration';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(
            erpInputCompact,
            'min-w-[200px] flex-1 rounded-md border border-border bg-card px-2.5',
          )}
          placeholder="Search name, reg no, roll, mobile, Aadhaar…"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
        />
        {selectedCount > 0 ? (
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium">
            {selectedCount} selected
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <>
            <Link href="/admin/students/new" className={cn(buttonVariants({ size: 'sm' }))}>
              Add Student
            </Link>
            <Button type="button" size="sm" variant="outline" onClick={onQuickAdd}>
              Quick Add
            </Button>
          </>
        ) : null}
        {canImport && canManage ? (
          <Link
            href="/admin/students/import"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Import
          </Link>
        ) : null}
        {canExport ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exportPending}
            onClick={onExport}
          >
            Export
          </Button>
        ) : null}
        {canManage ? (
          <>
            <Link
              href={promoteHref}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Promote
            </Link>
            <Link
              href={subjectsHref}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Assign Subjects
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
