'use client';

import Link from 'next/link';
import { Fragment, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Edit,
  Eye,
  GraduationCap,
  IdCard,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react';

import { DirectoryFeeBadge } from '@/components/students-module/directory/ui/directory-fee-badge';
import { DirectoryHealthIndicators } from '@/components/students-module/directory/directory-health-indicators';
import { DirectoryRowPreview } from '@/components/students-module/directory/directory-row-preview';
import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { DirectoryRegistrationBadge } from '@/components/students-module/directory/ui/directory-registration-badge';
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
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  rows: StudentDirectoryRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  virtualize?: boolean;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
};

export const ROW_HEIGHT = 44;
const COL_COUNT = 17;

function studentBase(id: string) {
  return `/admin/students/${id}`;
}

function PhotoCell({ row }: { row: StudentDirectoryRow }) {
  return <DirectoryStudentAvatar row={row} size="sm" />;
}

function InlineActions({
  row,
  onOpenProfile,
}: {
  row: StudentDirectoryRow;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
}) {
  const { formatStudentName } = useStudentNameFormat();
  const displayName = formatStudentName(row.displayFullName ?? row.fullName);
  const base = studentBase(row.id);
  const quick = [
    { label: 'View', action: () => onOpenProfile?.(row), icon: Eye, href: undefined },
    { label: 'Edit', href: `${base}?tab=edit`, icon: Edit },
    {
      label: 'Academics',
      href: `/admin/students/subject-registration?student=${row.id}`,
      icon: GraduationCap,
    },
    { label: 'Promote', href: `/admin/students/promotion?studentId=${row.id}`, icon: TrendingUp },
    { label: 'ID Card', href: `${base}?tab=id-card`, icon: IdCard },
    { label: 'Fee Ledger', href: `${base}?tab=fees`, icon: CreditCard },
    { label: 'Attendance', href: `${base}?tab=attendance`, icon: TrendingUp },
  ] as const;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {quick.slice(0, 3).map((a) => {
        const Icon = a.icon;
        if ('action' in a && a.action) {
          return (
            <button
              key={a.label}
              type="button"
              title={a.label}
              onClick={a.action}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-6 w-6 p-0 text-muted-foreground hover:text-primary',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        }
        return (
          <Link
            key={a.label}
            href={a.href!}
            title={a.label}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-6 w-6 p-0 text-muted-foreground hover:text-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="More"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-6 w-6 p-0')}
            aria-label={`More actions for ${displayName}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {quick.map((a) =>
            'action' in a && a.action ? (
              <DropdownMenuItem key={a.label} onClick={a.action}>
                {a.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={a.label} asChild disabled={'disabled' in a && a.disabled}>
                <Link href={a.href!}>{a.label}</Link>
              </DropdownMenuItem>
            ),
          )}
          <DropdownMenuItem asChild>
            <Link href={`${base}?tab=documents`}>Documents</Link>
          </DropdownMenuItem>
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
}: {
  row: StudentDirectoryRow;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleRow: (id: string) => void;
  toggleExpanded: (id: string) => void;
  allowExpand?: boolean;
  onOpenProfile?: (row: StudentDirectoryRow) => void;
}) {
  const { formatStudentName } = useStudentNameFormat();
  const displayName = formatStudentName(row.displayFullName ?? row.fullName);
  const statusLabel = row.studentStatus ?? row.academicStatus;
  const expanded = expandedIds.has(row.id);
  const isSelected = selectedIds.has(row.id);

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
        <td className="w-9 px-1 py-1 align-middle">
          <PhotoCell row={row} />
        </td>
        <td className="whitespace-nowrap px-1.5 py-1 align-middle">
          <p className="font-mono text-[11px] font-medium">{row.enrollmentNumber}</p>
        </td>
        <td className="whitespace-nowrap px-1.5 py-1 align-middle">
          <p className="font-mono text-[11px] font-medium">{row.rollNumber ?? '—'}</p>
        </td>
        <td className="max-w-[160px] px-1.5 py-1 align-middle">
          <button
            type="button"
            onClick={() => onOpenProfile?.(row)}
            className="block w-full truncate text-left text-xs font-medium hover:text-primary hover:underline"
          >
            <StudentName
              name={row.fullName}
              displayFullName={row.displayFullName}
              className="block w-full truncate text-left text-xs font-medium hover:text-primary hover:underline"
            />
          </button>
        </td>
        <td className="max-w-[140px] px-1.5 py-1 align-middle">
          <p className="truncate text-[11px]">{row.programme ?? '—'}</p>
        </td>
        <td className="max-w-[100px] px-1.5 py-1 align-middle">
          <p className="truncate text-[11px] font-medium text-primary/90">
            {row.majorSubject ? `Major: ${row.majorSubject}` : '—'}
          </p>
        </td>
        <td className="px-1.5 py-1 align-middle">
          <DirectorySemesterChip semester={row.semester} />
        </td>
        <td className="max-w-[72px] px-1.5 py-1 align-middle">
          <span className="truncate text-[11px]">{row.shift ?? '—'}</span>
        </td>
        <td className="whitespace-nowrap px-1.5 py-1 align-middle">
          <span className="text-[11px] tabular-nums">{row.mobileNumber ?? '—'}</span>
        </td>
        <td className="px-1.5 py-1 align-middle">
          <DirectoryRegistrationBadge status={row.registrationStatus} />
        </td>
        <td className="px-1.5 py-1 align-middle">
          <DirectoryFeeBadge row={row} />
        </td>
        <td className="px-1.5 py-1 align-middle">
          <DirectoryHealthIndicators row={row} compact />
        </td>
        <td className="px-1.5 py-1 align-middle">
          <DirectoryStatusPill label={statusLabel} />
        </td>
        <td className="px-1 py-1 align-middle">
          <InlineActions row={row} onOpenProfile={onOpenProfile} />
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {allowExpand && expanded ? (
          <tr className="border-b border-border/30 bg-muted/15">
            <td colSpan={COL_COUNT} className="px-3 py-2">
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
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);
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
        <th className="w-9 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Photo
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Reg No
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Roll No
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Name
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Programme
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Major
        </th>
        <th className="w-12 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sem
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Shift
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mobile
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Subjects
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fee
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Health
        </th>
        <th className="px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </th>
        <th className="w-[88px] px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Actions
        </th>
      </tr>
    </thead>
  );

  return (
    <DirectoryGlassCard glow className="hidden overflow-hidden md:block">
      <div ref={parentRef} className="max-h-[calc(100vh-280px)] min-h-[420px] overflow-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          {header}
          <tbody>
            {virtualize && paddingTop > 0 ? (
              <tr>
                <td colSpan={COL_COUNT} style={{ height: paddingTop, padding: 0, border: 0 }} />
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
                  />
                ))}
            {virtualize && paddingBottom > 0 ? (
              <tr>
                <td colSpan={COL_COUNT} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DirectoryGlassCard>
  );
}

export function shouldVirtualizeDirectory(rowsCount: number, limit: number) {
  return rowsCount > 30 || limit >= 50;
}
