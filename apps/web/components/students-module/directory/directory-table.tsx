'use client';

import Link from 'next/link';
import { Fragment, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Eye, MoreHorizontal } from 'lucide-react';

import { DirectoryAttendanceBadge } from '@/components/students-module/directory/ui/directory-attendance-badge';
import { DirectoryFeeBadge } from '@/components/students-module/directory/ui/directory-fee-badge';
import { DirectoryRowPreview } from '@/components/students-module/directory/directory-row-preview';
import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { DirectorySemesterChip } from '@/components/students-module/directory/ui/directory-semester-chip';
import { DirectoryStatusPill } from '@/components/students-module/directory/ui/directory-status-pill';
import { DirectoryStudentAvatar } from '@/components/students-module/directory/ui/directory-student-avatar';
import { StudentName } from '@/components/students/student-name';
import { useStudentNameFormat } from '@/components/providers/student-name-format-provider';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DEFAULT_DIRECTORY_COLUMNS,
  type DirectoryColumnId,
} from '@/components/students-module/directory/directory-columns';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  rows: StudentDirectoryRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  virtualize?: boolean;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
  visibleColumns?: DirectoryColumnId[];
  canManage?: boolean;
  className?: string;
};

export const ROW_HEIGHT = 52;

function studentBase(id: string) {
  return `/admin/students/${id}`;
}

function PhotoCell({ row }: { row: StudentDirectoryRow }) {
  return <DirectoryStudentAvatar row={row} size="sm" />;
}

function InlineActions({
  row,
  onOpenProfile,
  canManage,
}: {
  row: StudentDirectoryRow;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
  canManage?: boolean;
}) {
  const { formatStudentName } = useStudentNameFormat();
  const displayName = formatStudentName(row.displayFullName ?? row.fullName);
  const base = studentBase(row.id);
  const links = [
    { label: 'View Profile', href: base },
    ...(canManage ? [{ label: 'Edit Student', href: `${base}?tab=academic` }] : []),
    { label: 'Academic Details', href: `${base}?tab=academic` },
    { label: 'Attendance', href: `${base}?tab=attendance` },
    { label: 'Fees', href: `${base}?tab=fees` },
    { label: 'Subjects', href: `/admin/students/subject-registration?student=${row.id}` },
    { label: 'Documents', href: `${base}?tab=documents` },
    { label: 'Generate ID Card', href: `${base}?tab=id-card` },
    ...(canManage
      ? [{ label: 'Promote', href: `/admin/students/promotion?studentId=${row.id}` }]
      : []),
  ];

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onOpenProfile?.(row)}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 px-2 text-[11px]')}
      >
        <Eye className="mr-1 h-3.5 w-3.5" />
        View
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="More actions"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}
            aria-label={`More actions for ${displayName}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {links.map((item) => (
            <DropdownMenuItem key={item.label} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DataRow({
  row,
  selectedIds,
  expandedIds,
  onToggleRow,
  toggleExpanded,
  allowExpand = true,
  onOpenProfile,
  visibleColumns,
  canManage,
  colSpan,
}: {
  row: StudentDirectoryRow;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleRow: (id: string) => void;
  toggleExpanded: (id: string) => void;
  allowExpand?: boolean;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
  visibleColumns: DirectoryColumnId[];
  canManage?: boolean;
  colSpan: number;
}) {
  const { formatStudentName } = useStudentNameFormat();
  const displayName = formatStudentName(row.displayFullName ?? row.fullName);
  const statusLabel = row.studentStatus ?? row.academicStatus;
  const expanded = expandedIds.has(row.id);
  const isSelected = selectedIds.has(row.id);
  const show = (id: DirectoryColumnId) => visibleColumns.includes(id);
  const programmeLabel = row.programme ?? '—';
  const majorLabel = row.majorSubject ?? '—';

  return (
    <Fragment>
      <tr
        className={cn(
          'theme-table-row group border-b border-border/30 transition-colors even:bg-muted/10 hover:bg-table-row-hover',
          isSelected && 'bg-primary/5',
        )}
      >
        <td className="w-8 px-1.5 py-1 align-middle">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={isSelected}
            onChange={() => onToggleRow(row.id)}
            aria-label={`Select ${displayName}`}
          />
        </td>
        <td className="w-6 px-0.5 py-1 align-middle">
          {allowExpand ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => toggleExpanded(row.id)}
              aria-label={expanded ? 'Collapse row' : 'Expand row'}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </td>
        {show('student') ? (
          <td className="min-w-[180px] px-1.5 py-1.5 align-middle">
            <div className="flex items-center gap-2">
              <PhotoCell row={row} />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(row)}
                  className="block max-w-[180px] truncate text-left text-xs font-semibold hover:text-primary hover:underline"
                >
                  <StudentName
                    name={row.fullName}
                    displayFullName={row.displayFullName}
                    className="block truncate text-left text-xs font-semibold"
                  />
                </button>
                <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                  {row.email ?? '—'}
                </p>
              </div>
            </div>
          </td>
        ) : null}
        {show('roll') ? (
          <td className="whitespace-nowrap px-1.5 py-1 align-middle">
            <p className="font-mono text-[11px] font-medium">{row.rollNumber ?? '—'}</p>
          </td>
        ) : null}
        {show('nehu') ? (
          <td className="whitespace-nowrap px-1.5 py-1 align-middle">
            <p className="font-mono text-[11px] font-medium">
              {row.universityRollNumber?.trim() || row.admissionNumber?.trim() || '—'}
            </p>
          </td>
        ) : null}
        {show('programme') ? (
          <td className="max-w-[160px] px-1.5 py-1 align-middle">
            <p className="truncate text-[11px] font-medium">{programmeLabel}</p>
            {!show('major') ? (
              <p className="truncate text-[11px] text-muted-foreground">{majorLabel}</p>
            ) : null}
          </td>
        ) : null}
        {show('major') ? (
          <td className="max-w-[120px] px-1.5 py-1 align-middle">
            <p className="truncate text-[11px]">{majorLabel}</p>
          </td>
        ) : null}
        {show('semester') ? (
          <td className="px-1.5 py-1 align-middle">
            <DirectorySemesterChip semester={row.semester} />
          </td>
        ) : null}
        {show('shift') ? (
          <td className="max-w-[88px] px-1.5 py-1 align-middle">
            <span className="truncate text-[11px]">{row.shift ?? '—'}</span>
          </td>
        ) : null}
        {show('contact') ? (
          <td className="whitespace-nowrap px-1.5 py-1 align-middle">
            <span className="text-[11px] tabular-nums">{row.mobileNumber ?? '—'}</span>
          </td>
        ) : null}
        {show('abc') ? (
          <td className="whitespace-nowrap px-1.5 py-1 align-middle">
            <span className="font-mono text-[11px]">{row.abcId?.trim() ? row.abcId : '—'}</span>
          </td>
        ) : null}
        {show('fee') ? (
          <td className="px-1.5 py-1 align-middle">
            <DirectoryFeeBadge row={row} />
          </td>
        ) : null}
        {show('attendance') ? (
          <td className="px-1.5 py-1 align-middle">
            <DirectoryAttendanceBadge row={row} />
          </td>
        ) : null}
        {show('status') ? (
          <td className="px-1.5 py-1 align-middle">
            <DirectoryStatusPill label={statusLabel} />
          </td>
        ) : null}
        {show('actions') ? (
          <td className="sticky right-0 bg-background/95 px-1 py-1 align-middle">
            <InlineActions row={row} onOpenProfile={onOpenProfile} canManage={canManage} />
          </td>
        ) : null}
      </tr>
      <AnimatePresence initial={false}>
        {allowExpand && expanded ? (
          <tr className="border-b border-border/30 bg-muted/15">
            <td colSpan={colSpan} className="px-3 py-2">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden motion-reduce:transition-none"
              >
                <DirectoryRowPreview row={row} expanded={expanded} />
              </motion.div>
            </td>
          </tr>
        ) : null}
      </AnimatePresence>
    </Fragment>
  );
}

export function DirectoryTable({
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  virtualize = false,
  onOpenProfile,
  visibleColumns = DEFAULT_DIRECTORY_COLUMNS,
  canManage,
  className,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);
  const show = (id: DirectoryColumnId) => visibleColumns.includes(id);
  const colSpan = 2 + visibleColumns.length;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id)) && !allSelected;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: virtualize && rows.length > 0,
  });

  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  if (rows.length === 0) {
    return (
      <DirectoryGlassCard className="py-12 text-center">
        <p className="text-sm font-medium text-foreground">No students found</p>
        <p className="mt-1 text-xs text-muted-foreground">Try adjusting filters or search terms.</p>
      </DirectoryGlassCard>
    );
  }

  const header = (
    <thead className="theme-table-header sticky top-0 z-10 border-b border-border/60 backdrop-blur-md">
      <tr className="text-left">
        <th className="w-8 px-1.5 py-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => onToggleAll(e.target.checked)}
            aria-label="Select all rows"
          />
        </th>
        <th className="w-6 px-0.5 py-1.5" aria-hidden />
        {show('student') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Student
          </th>
        ) : null}
        {show('roll') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Roll No
          </th>
        ) : null}
        {show('nehu') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            NEHU Roll No
          </th>
        ) : null}
        {show('programme') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {show('major') ? 'Programme' : 'Programme / Major'}
          </th>
        ) : null}
        {show('major') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Major
          </th>
        ) : null}
        {show('semester') ? (
          <th className="w-12 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sem
          </th>
        ) : null}
        {show('shift') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shift
          </th>
        ) : null}
        {show('contact') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </th>
        ) : null}
        {show('abc') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            ABC ID
          </th>
        ) : null}
        {show('fee') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fee Status
          </th>
        ) : null}
        {show('attendance') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Attendance
          </th>
        ) : null}
        {show('status') ? (
          <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </th>
        ) : null}
        {show('actions') ? (
          <th className="sticky right-0 bg-background/95 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </th>
        ) : null}
      </tr>
    </thead>
  );

  return (
    <DirectoryGlassCard
      glow
      className={cn('hidden min-h-0 flex-col overflow-hidden md:flex', className)}
    >
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          {header}
          <tbody>
            {virtualize && paddingTop > 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            ) : null}
            {virtualize
              ? virtualItems.map((item) => {
                  const row = rows[item.index];
                  if (!row) return null;
                  return (
                    <DataRow
                      key={row.id}
                      row={row}
                      selectedIds={selectedIds}
                      expandedIds={expandedIds}
                      onToggleRow={onToggleRow}
                      toggleExpanded={toggleExpanded}
                      allowExpand={false}
                      onOpenProfile={onOpenProfile}
                      visibleColumns={visibleColumns}
                      canManage={canManage}
                      colSpan={colSpan}
                    />
                  );
                })
              : rows.map((row) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    selectedIds={selectedIds}
                    expandedIds={expandedIds}
                    onToggleRow={onToggleRow}
                    toggleExpanded={toggleExpanded}
                    onOpenProfile={onOpenProfile}
                    visibleColumns={visibleColumns}
                    canManage={canManage}
                    colSpan={colSpan}
                  />
                ))}
            {virtualize && paddingBottom > 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DirectoryGlassCard>
  );
}

export function shouldVirtualizeDirectory(rowsCount: number, _limit: number) {
  return rowsCount > 200;
}
