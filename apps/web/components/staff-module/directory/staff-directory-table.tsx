'use client';

import Link from 'next/link';
import { Eye, IdCard, MoreHorizontal, User } from 'lucide-react';

import { DirectoryGlassCard } from '@/components/students-module/directory/ui/directory-glass-card';
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
import {
  DEFAULT_STAFF_COLUMNS,
  type StaffColumnId,
} from '@/components/staff-module/directory/staff-columns';
import type { StaffDirectoryRow } from '@/types/staff';
import { formatShortDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

type Props = {
  rows: StaffDirectoryRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  visibleColumns?: StaffColumnId[];
  canManage?: boolean;
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
  const tone =
    type === 'TEACHING'
      ? 'bg-sky-100 text-sky-800'
      : type === 'NON_TEACHING'
        ? 'bg-amber-100 text-amber-800'
        : type === 'ADMIN'
          ? 'bg-violet-100 text-violet-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', tone)}>
      {staffTypeLabel(type)}
    </span>
  );
}

function FlagBadge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={cn('text-[11px] font-medium', ok ? 'text-emerald-700' : 'text-rose-600')}>
      {ok ? yes : no}
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

export function StaffDirectoryTable({
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  visibleColumns = DEFAULT_STAFF_COLUMNS,
  canManage = false,
}: Props) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const show = (id: StaffColumnId) => visibleColumns.includes(id);

  return (
    <DirectoryGlassCard className="hidden overflow-hidden md:flex md:min-h-0 md:flex-col">
      <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
        <table className="w-full min-w-[1180px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
              {show('staff') ? <th className="px-2 py-2">Staff</th> : null}
              {show('code') ? <th className="px-2 py-2">Code</th> : null}
              {show('type') ? <th className="px-2 py-2">Type</th> : null}
              {show('department') ? <th className="px-2 py-2">Department</th> : null}
              {show('designation') ? <th className="px-2 py-2">Designation</th> : null}
              {show('quarter') ? <th className="px-2 py-2">Quarter</th> : null}
              {show('shift') ? <th className="px-2 py-2">Shift</th> : null}
              {show('portal') ? <th className="px-2 py-2">Portal</th> : null}
              {show('rfid') ? <th className="px-2 py-2">RFID</th> : null}
              {show('timetable') ? <th className="px-2 py-2">Timetable</th> : null}
              {show('subjects') ? <th className="px-2 py-2">Subjects</th> : null}
              {show('status') ? <th className="px-2 py-2">Status</th> : null}
              {show('joined') ? <th className="px-2 py-2">Joined</th> : null}
              {show('actions') ? (
                <th className="sticky right-0 bg-background px-2 py-2 text-right">Actions</th>
              ) : null}
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
                {show('staff') ? (
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <PhotoCell row={row} />
                      <div className="min-w-0">
                        <Link
                          href={staffBase(row.id)}
                          className="block max-w-[180px] truncate font-semibold hover:text-primary hover:underline"
                        >
                          {row.fullName}
                        </Link>
                        <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">
                          {row.email ?? row.mobile ?? '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                ) : null}
                {show('code') ? (
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {row.employeeCode || row.shortCode || '—'}
                  </td>
                ) : null}
                {show('type') ? (
                  <td className="px-2 py-1.5">
                    <TypeBadge type={row.staffType} />
                  </td>
                ) : null}
                {show('department') ? (
                  <td className="max-w-[140px] truncate px-2 py-1.5">{row.department ?? '—'}</td>
                ) : null}
                {show('designation') ? (
                  <td className="max-w-[160px] px-2 py-1.5">
                    <RoleChips row={row} />
                  </td>
                ) : null}
                {show('quarter') ? (
                  <td className="px-2 py-1.5 font-mono text-[10px]">{row.quarter ?? '—'}</td>
                ) : null}
                {show('shift') ? (
                  <td className="px-2 py-1.5">{row.shift ?? row.teachingShiftLabel ?? '—'}</td>
                ) : null}
                {show('portal') ? (
                  <td className="px-2 py-1.5">
                    {row.portalActive ? (
                      <span className="text-[11px] font-medium text-emerald-700">Active</span>
                    ) : row.portalPending ? (
                      <span className="text-[11px] font-medium text-amber-700">Pending</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </td>
                ) : null}
                {show('rfid') ? (
                  <td className="px-2 py-1.5">
                    <FlagBadge ok={Boolean(row.rfidNo?.trim())} yes="Assigned" no="Not Assigned" />
                  </td>
                ) : null}
                {show('timetable') ? (
                  <td className="px-2 py-1.5">
                    <FlagBadge
                      ok={row.timetableSections > 0 || row.subjectAssignments > 0}
                      yes="Assigned"
                      no="Not Assigned"
                    />
                  </td>
                ) : null}
                {show('subjects') ? (
                  <td className="px-2 py-1.5 tabular-nums">{row.subjectAssignments}</td>
                ) : null}
                {show('status') ? (
                  <td className="px-2 py-1.5">
                    <StatusPill status={row.status} />
                  </td>
                ) : null}
                {show('joined') ? (
                  <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-muted-foreground">
                    {row.joiningDate ? formatShortDate(row.joiningDate) : '—'}
                  </td>
                ) : null}
                {show('actions') ? (
                  <td className="sticky right-0 bg-background/95 px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={staffBase(row.id)}
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'sm' }),
                          'h-7 w-7 p-0',
                        )}
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
                          {canManage ? (
                            <DropdownMenuItem asChild>
                              <Link href={`${staffBase(row.id)}?tab=employment`}>Edit staff</Link>
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem asChild>
                            <Link href={`${staffBase(row.id)}?tab=subjects`}>
                              Subject assignments
                            </Link>
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
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium">No staff found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try changing your search criteria or clearing some filters.
          </p>
        </div>
      ) : null}
    </DirectoryGlassCard>
  );
}
