'use client';

import Link from 'next/link';
import { Eye, IdCard, MoreHorizontal, User } from 'lucide-react';

import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
import { STAFF_TYPE_COLORS } from '@/components/staff-module/add-staff/constants';
import { roleChipLabel } from '@/components/staff-module/employment/employment-utils';
import {
  staffStatusTone,
  staffTypeLabel,
} from '@/components/staff-module/directory/staff-filter-utils';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StaffDirectoryRow } from '@/types/staff';
import { formatShortDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

type Props = {
  rows: StaffDirectoryRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
};

function staffBase(id: string) {
  return `/admin/staff/${id}`;
}

function PhotoCell({ row }: { row: StaffDirectoryRow }) {
  const src = resolveUploadAssetUrl(row.photoUrl ?? undefined);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-border/60" />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground ring-1 ring-border/60">
      <User className="h-3.5 w-3.5" />
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = staffStatusTone(status);
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        tone === 'success' && 'bg-emerald-500/15 text-emerald-700',
        tone === 'warning' && 'bg-amber-500/15 text-amber-800',
        tone === 'danger' && 'bg-rose-500/15 text-rose-700',
        tone === 'default' && 'bg-muted text-muted-foreground',
      )}
    >
      {staffTypeLabel(status)}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const gradient = STAFF_TYPE_COLORS[type] ?? STAFF_TYPE_COLORS.ALL;
  return (
    <span
      className={cn(
        'inline-flex rounded-full border border-border/40 bg-gradient-to-br px-1.5 py-0.5 text-[9px] font-medium',
        gradient,
      )}
    >
      {staffTypeLabel(type)}
    </span>
  );
}

function RoleChips({ row }: { row: StaffDirectoryRow }) {
  return (
    <div className="flex max-w-[160px] flex-wrap gap-0.5">
      {row.designation ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium">
          {row.designation}
        </span>
      ) : null}
      {(row.additionalRoles ?? []).map((r) => (
        <span
          key={r.code}
          className="rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-medium text-primary"
        >
          {roleChipLabel(r.code, r.label)}
        </span>
      ))}
      {!row.designation && !(row.additionalRoles ?? []).length ? '—' : null}
    </div>
  );
}

export function StaffDirectoryTable({ rows, selectedIds, onToggleRow, onToggleAll }: Props) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <DirectoryGlassCard className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[960px] text-xs">
        <thead>
          <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="Select all"
              />
            </th>
            <th className="px-2 py-2">Staff</th>
            <th className="px-2 py-2">Code</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2">Department</th>
            <th className="px-2 py-2">Quarter</th>
            <th className="px-2 py-2">Designation</th>
            <th className="px-2 py-2">Shift</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Portal</th>
            <th className="px-2 py-2">Subjects</th>
            <th className="px-2 py-2">Joined</th>
            <th className="px-2 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-border/40 transition-colors hover:bg-muted/30',
                selectedIds.has(row.id) && 'bg-primary/5',
              )}
            >
              <td className="px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={() => onToggleRow(row.id)}
                  aria-label={`Select ${row.fullName}`}
                />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <PhotoCell row={row} />
                  <div className="min-w-0">
                    <Link
                      href={staffBase(row.id)}
                      className="flex items-center gap-1 truncate font-medium hover:text-primary hover:underline"
                    >
                      {row.shortCode ? (
                        <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold text-primary">
                          {row.shortCode}
                        </span>
                      ) : null}
                      {row.fullName}
                    </Link>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {row.email ?? row.mobile ?? '—'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-1.5 font-mono text-[10px]">{row.employeeCode}</td>
              <td className="px-2 py-1.5">
                <TypeBadge type={row.staffType} />
              </td>
              <td className="max-w-[120px] truncate px-2 py-1.5">{row.department ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono text-[10px]">{row.quarter ?? '—'}</td>
              <td className="max-w-[160px] px-2 py-1.5">
                <RoleChips row={row} />
              </td>
              <td className="px-2 py-1.5">{row.shift ?? '—'}</td>
              <td className="px-2 py-1.5">
                <StatusPill status={row.status} />
              </td>
              <td className="px-2 py-1.5">
                {row.portalActive ? (
                  <span className="text-[10px] text-emerald-600">Active</span>
                ) : row.portalPending ? (
                  <span className="text-[10px] text-amber-600">Pending</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">None</span>
                )}
              </td>
              <td className="px-2 py-1.5 tabular-nums">{row.subjectAssignments}</td>
              <td className="px-2 py-1.5 whitespace-nowrap text-[10px] text-muted-foreground">
                {row.joiningDate ? formatShortDate(row.joiningDate) : '—'}
              </td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center justify-end gap-0.5">
                  <Link
                    href={staffBase(row.id)}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}
                    title="View profile"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'sm' }),
                          'h-7 w-7 p-0',
                        )}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={staffBase(row.id)}>View profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${staffBase(row.id)}?tab=subjects`}>Subject assignments</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`${staffBase(row.id)}?tab=id-card`}>
                          <IdCard className="mr-2 inline h-3.5 w-3.5" />
                          ID Card
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/staff/assignments?staff=${row.id}`}>
                          Teaching workspace
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No staff members found.</p>
      ) : null}
    </DirectoryGlassCard>
  );
}
