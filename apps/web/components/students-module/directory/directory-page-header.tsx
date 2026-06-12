'use client';

import Link from 'next/link';
import { ChevronDown, Download, GraduationCap, Import, Plus, Sparkles } from 'lucide-react';

import { DirectorySearch } from '@/components/students-module/directory/directory-search';
import { buildBulkHref } from '@/components/students-module/directory/directory-utils';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

type Props = {
  totalCount: number;
  activeCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  canManage: boolean;
  canExport: boolean;
  canImport: boolean;
  selectedIds: Set<string>;
  filters: DirectoryFilters;
  onQuickAdd: () => void;
  onExport: () => void;
  onExportSelected?: () => void;
  exportPending?: boolean;
};

export function DirectoryPageHeader({
  totalCount,
  activeCount,
  search,
  onSearchChange,
  searchLoading,
  canManage,
  canExport,
  canImport,
  selectedIds,
  filters,
  onQuickAdd,
  onExport,
  onExportSelected,
  exportPending,
}: Props) {
  const promoteHref = buildBulkHref('/admin/students/promotion', selectedIds, filters);
  const subjectsHref = buildBulkHref('/admin/students/subject-registration', selectedIds, filters);
  const activePct =
    totalCount > 0 && activeCount != null ? Math.round((activeCount / totalCount) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount.toLocaleString()} students
            {activePct != null ? ` · ${activePct}% active` : ''}
          </p>
        </div>
        <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
          <DirectorySearch value={search} onChange={onSearchChange} loading={searchLoading} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            <Link
              href="/admin/students/new"
              className={cn(
                buttonVariants({ size: 'sm' }),
                'bg-gradient-to-r from-primary to-primary/80 shadow-sm transition-transform hover:scale-[1.02] motion-reduce:hover:scale-100',
              )}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Student
            </Link>
            {canImport ? (
              <Link
                href="/admin/students/import"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'glass-card border-border/60',
                )}
              >
                <Import className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Link>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="glass-card border-border/60"
              onClick={onQuickAdd}
            >
              Quick Add
            </Button>
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="glass-card border-border/60"
            >
              Bulk Actions
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {canManage ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href={subjectsHref}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Assign Subjects
                    {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={promoteHref}>
                    Promote
                    {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                  </Link>
                </DropdownMenuItem>
              </>
            ) : null}
            {canExport ? (
              <DropdownMenuItem disabled={exportPending} onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Export all
              </DropdownMenuItem>
            ) : null}
            {canExport && onExportSelected ? (
              <DropdownMenuItem
                disabled={exportPending || selectedIds.size === 0}
                onClick={onExportSelected}
              >
                Export selected
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Sparkles className="mr-2 h-4 w-4 opacity-50" />
              Generate IDs (soon)
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Send SMS (soon)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
