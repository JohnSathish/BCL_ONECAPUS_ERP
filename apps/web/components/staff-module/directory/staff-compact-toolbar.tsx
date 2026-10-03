'use client';

import Link from 'next/link';
import { ChevronDown, Download, FileSpreadsheet, Plus } from 'lucide-react';

import { DirectorySearch } from '@/components/students-module/directory/directory-search';
import {
  STAFF_COLUMNS,
  type StaffColumnId,
} from '@/components/staff-module/directory/staff-columns';
import { StaffSavedViews } from '@/components/staff-module/directory/staff-saved-views';
import {
  countActiveStaffFilters,
  type StaffDirectoryFilters,
} from '@/components/staff-module/directory/staff-filter-utils';
import { STAFF_STATUSES, STAFF_TYPES } from '@/types/staff';
import { useSupportDataOptions } from '@/hooks/use-support-data';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { TEACHING_SHIFT_FILTER_OPTIONS } from '@/components/staff-module/employment/staff-shift-category';
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

type Props = {
  filters: StaffDirectoryFilters;
  totalCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  onFilterChange: (patch: Partial<StaffDirectoryFilters>) => void;
  onResetFilters: () => void;
  departmentOptions: Option[];
  designationOptions: Option[];
  academicRoleOptions?: Option[];
  shiftOptions: Option[];
  canManage: boolean;
  canExport: boolean;
  canImport?: boolean;
  canBulkUpdate?: boolean;
  onDownloadTemplate?: () => void;
  selectedIds: Set<string>;
  onExport: () => void;
  onExportSelected?: () => void;
  exportPending?: boolean;
  visibleColumns: StaffColumnId[];
  onToggleColumn: (id: StaffColumnId) => void;
};

export function StaffCompactToolbar({
  filters,
  totalCount,
  search,
  onSearchChange,
  searchLoading,
  onFilterChange,
  onResetFilters,
  departmentOptions,
  designationOptions,
  academicRoleOptions = [],
  shiftOptions,
  canManage,
  canExport,
  canImport,
  canBulkUpdate,
  onDownloadTemplate,
  selectedIds,
  onExport,
  onExportSelected,
  exportPending,
  visibleColumns,
  onToggleColumn,
}: Props) {
  const activeCount = countActiveStaffFilters(filters);
  const staffTypeData = useSupportDataOptions('staff-types');
  const statusData = useSupportDataOptions('staff-status');
  const staffTypeOptions =
    staffTypeData.options.length > 0
      ? staffTypeData.options.map((o) => ({ id: o.value, label: o.label }))
      : STAFF_TYPES.map((t) => ({ id: t, label: staffTypeLabel(t) }));
  const statusOptions =
    statusData.options.length > 0
      ? statusData.options.map((o) => ({ id: o.value, label: o.label }))
      : STAFF_STATUSES.map((s) => ({ id: s, label: staffTypeLabel(s) }));

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/60 bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <DirectorySearch
            value={search}
            onChange={onSearchChange}
            loading={searchLoading}
            placeholder="Search staff by name, staff code, email, mobile, department..."
            recentKey="staff-directory-recent-searches"
            className="min-w-[220px] flex-1"
          />
          {activeCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10"
              onClick={onResetFilters}
            >
              Clear Filters
            </Button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <FilterPill
            label="Type"
            value={filters.staffType}
            options={staffTypeOptions}
            onChange={(staffType) => onFilterChange({ staffType })}
          />
          <FilterPill
            label="Department"
            value={filters.departmentId}
            options={departmentOptions}
            onChange={(departmentId) => onFilterChange({ departmentId })}
          />
          <FilterPill
            label="Designation"
            value={filters.designationId}
            options={designationOptions}
            onChange={(designationId) => onFilterChange({ designationId })}
          />
          {academicRoleOptions.length > 0 ? (
            <FilterPill
              label="Role"
              value={filters.additionalRoleCode}
              options={academicRoleOptions}
              onChange={(additionalRoleCode) => onFilterChange({ additionalRoleCode })}
            />
          ) : null}
          <FilterPill
            label="Shift"
            value={filters.teachingShiftCategory}
            options={TEACHING_SHIFT_FILTER_OPTIONS.filter((o) => o.id).map((o) => ({
              id: o.id,
              label: o.label,
            }))}
            onChange={(teachingShiftCategory) => onFilterChange({ teachingShiftCategory })}
          />
          <FilterPill
            label="Status"
            value={filters.status}
            options={statusOptions}
            onChange={(status) => onFilterChange({ status })}
          />
          <FilterPill
            label="Leave"
            value={filters.uiOnLeave}
            options={[{ id: 'true', label: 'On leave' }]}
            onChange={(uiOnLeave) =>
              onFilterChange({
                uiOnLeave,
                status:
                  uiOnLeave === 'true'
                    ? 'ON_LEAVE'
                    : filters.status === 'ON_LEAVE'
                      ? ''
                      : filters.status,
              })
            }
          />
          <FilterPill
            label="Teaching"
            value={filters.uiActiveTeaching}
            options={[{ id: 'true', label: 'Active teaching' }]}
            onChange={(uiActiveTeaching) => onFilterChange({ uiActiveTeaching })}
          />
          <FilterPill
            label="Research"
            value={filters.uiHasPublications}
            options={[{ id: 'true', label: 'Has publications' }]}
            onChange={(uiHasPublications) => onFilterChange({ uiHasPublications })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full px-2.5 text-[11px]"
              >
                More Filters
                <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem
                className="text-xs"
                onClick={() =>
                  onFilterChange({ uiHodOnly: filters.uiHodOnly === 'true' ? '' : 'true' })
                }
              >
                {filters.uiHodOnly === 'true' ? '✓ ' : ''}HoD only
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() =>
                  onFilterChange({
                    uiPortalPending: filters.uiPortalPending === 'true' ? '' : 'true',
                  })
                }
              >
                {filters.uiPortalPending === 'true' ? '✓ ' : ''}Portal pending
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() =>
                  onFilterChange({ uiNoSubjects: filters.uiNoSubjects === 'true' ? '' : 'true' })
                }
              >
                {filters.uiNoSubjects === 'true' ? '✓ ' : ''}No subjects
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() =>
                  onFilterChange({ uiNoRfid: filters.uiNoRfid === 'true' ? '' : 'true' })
                }
              >
                {filters.uiNoRfid === 'true' ? '✓ ' : ''}RFID not assigned
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() =>
                  onFilterChange({
                    uiNoDepartment: filters.uiNoDepartment === 'true' ? '' : 'true',
                  })
                }
              >
                {filters.uiNoDepartment === 'true' ? '✓ ' : ''}No department
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {totalCount != null ? (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {totalCount.toLocaleString('en-IN')} staff members
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background px-2.5 py-2 shadow-sm">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="h-8 rounded-lg px-3 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Staff
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/admin/staff/new">Add Manually</Link>
              </DropdownMenuItem>
              {canImport ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin/staff/import">Import Staff</Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {canImport ? (
          <Link
            href="/admin/staff/import"
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'h-8 rounded-lg text-xs',
            )}
          >
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
            Import
          </Link>
        ) : null}
        {canExport ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-lg text-xs"
            disabled={exportPending}
            onClick={onExport}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              Bulk Actions
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {canBulkUpdate ? (
              <DropdownMenuItem asChild>
                <Link href="/admin/staff/bulk-update">Bulk Update</Link>
              </DropdownMenuItem>
            ) : null}
            {canExport ? (
              <DropdownMenuItem className="text-xs" onClick={onExport} disabled={exportPending}>
                Export filtered list
              </DropdownMenuItem>
            ) : null}
            {onExportSelected ? (
              <DropdownMenuItem
                className="text-xs"
                disabled={exportPending || selectedIds.size === 0}
                onClick={onExportSelected}
              >
                Export selected ({selectedIds.size})
              </DropdownMenuItem>
            ) : null}
            {onDownloadTemplate ? (
              <DropdownMenuItem className="text-xs" onClick={onDownloadTemplate}>
                Download import template
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1.5">
          <StaffSavedViews
            currentFilters={filters}
            onApply={(next) => {
              onSearchChange('');
              onFilterChange(next);
            }}
            onReset={onResetFilters}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs">
                Columns
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {STAFF_COLUMNS.map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  disabled={column.locked}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (!column.locked) onToggleColumn(column.id);
                  }}
                >
                  <span className="mr-2 inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[10px]">
                    {visibleColumns.includes(column.id) ? '✓' : ''}
                  </span>
                  {column.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
