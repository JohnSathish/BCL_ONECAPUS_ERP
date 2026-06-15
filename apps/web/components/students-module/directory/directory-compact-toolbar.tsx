'use client';

import Link from 'next/link';
import {
  ChevronDown,
  Download,
  GraduationCap,
  ImagePlus,
  Import,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  Settings2,
  TrendingUp,
} from 'lucide-react';

import { DirectoryFilterChips } from '@/components/students-module/directory/directory-filter-chips';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { DirectorySavedViews } from '@/components/students-module/directory/directory-saved-views';
import { DirectorySearch } from '@/components/students-module/directory/directory-search';
import {
  buildBulkHref,
  countActiveFilters,
  optionsToMap,
  type FilterOptionMaps,
} from '@/components/students-module/directory/directory-utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

type Option = { id: string; label: string };

type FilterPillProps = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

function FilterPill({ label, value, options, onChange }: FilterPillProps) {
  const active = Boolean(value);
  const selectedLabel = options.find((o) => o.id === value)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-7 rounded-full border-border/60 bg-background/60 px-2.5 text-[11px] font-medium',
            active && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
          )}
        >
          {active ? (selectedLabel ?? label) : label}
          <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-48 overflow-y-auto p-1">
        <DropdownMenuItem className="text-xs" onClick={() => onChange('')}>
          All
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} className="text-xs" onClick={() => onChange(o.id)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  id: String(s),
  label: `Semester ${s}`,
}));

const FEE_STATUS_OPTIONS: Option[] = [
  { id: 'true', label: 'Fee Due' },
  { id: 'clear', label: 'Paid' },
];

const STATUS_OPTIONS: Option[] = [
  { id: 'STUDYING', label: 'Active' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'DROPPED', label: 'Suspended' },
  { id: 'ALUMNI', label: 'Alumni' },
  { id: 'TRANSFER', label: 'Transfer' },
];

type Props = {
  filters: DirectoryFilters;
  totalCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
  onOpenAdvanced: () => void;
  onResetFilters: () => void;
  onApplySavedView: (filters: DirectoryFilters) => void;
  programOptions: Option[];
  batchOptions: Option[];
  shiftOptions: Option[];
  streamOptions: Option[];
  departmentOptions: Option[];
  sessionOptions: Option[];
  categoryOptions: Option[];
  religionOptions?: Option[];
  canManage: boolean;
  canBulkUpdate?: boolean;
  canManagePhotos?: boolean;
  canExport: boolean;
  canImport: boolean;
  selectedIds: Set<string>;
  onQuickAdd: () => void;
  onExport: () => void;
  onExportSelected?: () => void;
  exportPending?: boolean;
};

export function DirectoryCompactToolbar({
  filters,
  totalCount,
  search,
  onSearchChange,
  searchLoading,
  onFilterChange,
  onOpenAdvanced,
  onResetFilters,
  onApplySavedView,
  programOptions,
  batchOptions,
  shiftOptions,
  departmentOptions,
  canManage,
  canBulkUpdate = false,
  canManagePhotos = false,
  canExport,
  canImport,
  selectedIds,
  onQuickAdd,
  onExport,
  onExportSelected,
  exportPending,
}: Props) {
  const advancedFilterCount = countActiveFilters({
    ...filters,
    search: '',
    programVersionId: '',
    semester: '',
    batchId: '',
    shiftId: '',
    departmentId: '',
    studentStatus: '',
    uiFeeDue: '',
  });

  const optionMaps: FilterOptionMaps = {
    program: optionsToMap(programOptions),
    batch: optionsToMap(batchOptions),
    shift: optionsToMap(shiftOptions),
    stream: {},
    department: optionsToMap(departmentOptions),
    session: {},
    category: {},
    religion: {},
  };

  const bulkUpdateHref = buildBulkHref('/admin/students/bulk-update', selectedIds, filters);
  const photoUploadHref = buildBulkHref('/admin/students/photos/bulk-upload', selectedIds, filters);
  const promoteHref = buildBulkHref('/admin/students/promotion', selectedIds, filters);
  const subjectsHref = buildBulkHref('/admin/students/subject-registration', selectedIds, filters);

  const feeFilterValue = filters.uiFeeDue === 'true' ? 'true' : '';

  return (
    <div className="sticky top-0 z-20 space-y-2">
      <div className="glass-card relative z-30 overflow-visible rounded-xl border border-border/50 px-3 py-3">
        <DirectorySearch value={search} onChange={onSearchChange} loading={searchLoading} />
      </div>

      <div className="glass-card relative z-10 rounded-xl border border-border/50 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <DirectorySavedViews
            currentFilters={filters}
            onApply={onApplySavedView}
            onReset={onResetFilters}
          />
          <FilterPill
            label="Programme"
            value={filters.programVersionId}
            options={programOptions}
            onChange={(v) => onFilterChange({ programVersionId: v })}
          />
          <FilterPill
            label="Semester"
            value={filters.semester}
            options={SEMESTER_OPTIONS}
            onChange={(v) => onFilterChange({ semester: v })}
          />
          <FilterPill
            label="Shift"
            value={filters.shiftId}
            options={shiftOptions}
            onChange={(v) => onFilterChange({ shiftId: v })}
          />
          <FilterPill
            label="Department"
            value={filters.departmentId}
            options={departmentOptions}
            onChange={(v) => onFilterChange({ departmentId: v })}
          />
          <FilterPill
            label="Batch"
            value={filters.batchId}
            options={batchOptions}
            onChange={(v) => onFilterChange({ batchId: v })}
          />
          <FilterPill
            label="Status"
            value={filters.studentStatus}
            options={STATUS_OPTIONS}
            onChange={(v) => onFilterChange({ studentStatus: v })}
          />
          <FilterPill
            label="Fee Status"
            value={feeFilterValue}
            options={FEE_STATUS_OPTIONS}
            onChange={(v) => onFilterChange({ uiFeeDue: v === 'true' ? 'true' : '' })}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              'h-7 rounded-full border-border/60 px-2.5 text-[11px]',
              advancedFilterCount > 0 && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
            )}
            onClick={onOpenAdvanced}
          >
            <Settings2 className="mr-1 h-3 w-3" />
            More Filters
            {advancedFilterCount > 0 ? (
              <span className="ml-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {advancedFilterCount}
              </span>
            ) : null}
          </Button>
          {totalCount != null ? (
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {totalCount.toLocaleString()} records
            </span>
          ) : null}
        </div>

        <DirectoryFilterChips
          filters={filters}
          optionMaps={optionMaps}
          onRemove={(key) => onFilterChange({ [key]: '' })}
          onClearAll={onResetFilters}
          className="mt-1.5"
        />
      </div>

      <div className="glass-card relative z-10 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 px-2.5 py-2">
        {canManage ? (
          <>
            <Link
              href="/admin/students/new"
              className={cn(
                buttonVariants({ size: 'sm' }),
                'h-7 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-2.5 text-[11px] shadow-sm',
              )}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Student
            </Link>
            {canImport ? (
              <Link
                href="/admin/students/import"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'h-7 rounded-lg border-border/60 px-2.5 text-[11px]',
                )}
              >
                <Import className="mr-1 h-3 w-3" />
                Import
              </Link>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-lg border-border/60 px-2.5 text-[11px]"
              onClick={onQuickAdd}
            >
              Quick Add
            </Button>
          </>
        ) : null}

        {canExport ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-lg border-border/60 px-2.5 text-[11px]"
            disabled={exportPending}
            onClick={onExport}
          >
            <Download className="mr-1 h-3 w-3" />
            Export
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-lg border-border/60 px-2.5 text-[11px]"
            >
              Bulk Actions
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {canManage ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href={subjectsHref}>
                    <GraduationCap className="mr-2 h-3.5 w-3.5" />
                    Assign Subjects
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={promoteHref}>
                    <TrendingUp className="mr-2 h-3.5 w-3.5" />
                    Promote Students
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Generate Roll Numbers</DropdownMenuItem>
                <DropdownMenuItem disabled>Generate ID Cards</DropdownMenuItem>
                {canBulkUpdate ? (
                  <DropdownMenuItem asChild>
                    <Link href={bulkUpdateHref}>Bulk Update</Link>
                  </DropdownMenuItem>
                ) : null}
                {canManagePhotos ? (
                  <DropdownMenuItem asChild>
                    <Link href={photoUploadHref}>
                      <ImagePlus className="mr-2 h-3.5 w-3.5" />
                      Bulk Photos
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <MessageSquare className="mr-2 h-3.5 w-3.5" />
                  Bulk SMS
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Bulk Email
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <MessageSquare className="mr-2 h-3.5 w-3.5" />
                  Bulk WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Printer className="mr-2 h-3.5 w-3.5" />
                  Print Reports
                </DropdownMenuItem>
              </>
            ) : null}
            {canExport ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={exportPending} onClick={onExport}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export all (Excel)
                </DropdownMenuItem>
                {onExportSelected ? (
                  <DropdownMenuItem
                    disabled={exportPending || selectedIds.size === 0}
                    onClick={onExportSelected}
                  >
                    Export selected
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
