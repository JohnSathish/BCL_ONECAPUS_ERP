'use client';

import {
  Eye,
  KeyRound,
  LockKeyhole,
  LogIn,
  Mail,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Unlock,
} from 'lucide-react';
import type { PortalUserRow } from '@/types/administration';
import { AdminStatusPill } from './ui/admin-status-pill';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type Props = {
  rows: PortalUserRow[];
  selectedIds: Set<string>;
  rowOffset?: number;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onView: (row: PortalUserRow) => void;
  onEdit: (row: PortalUserRow) => void;
  onActivate: (row: PortalUserRow) => void;
  onSuspend: (row: PortalUserRow) => void;
  onResetPassword: (row: PortalUserRow) => void;
  onForcePasswordReset: (row: PortalUserRow) => void;
  onUnlockLogin: (row: PortalUserRow) => void;
  onSendCredentials: (row: PortalUserRow) => void;
  onImpersonate: (row: PortalUserRow) => void;
  canManage: boolean;
  canImpersonate: boolean;
};

const AVATAR_COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];

function avatarColor(name: string) {
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function roleTone(slug?: string) {
  const value = (slug ?? '').toLowerCase();
  if (value.includes('faculty') || value.includes('teacher')) {
    return 'bg-violet-100 text-violet-700';
  }
  if (value.includes('student')) return 'bg-sky-100 text-sky-700';
  if (value.includes('parent') || value.includes('guardian')) {
    return 'bg-amber-100 text-amber-800';
  }
  if (value.includes('alumni')) return 'bg-teal-100 text-teal-800';
  return 'bg-slate-100 text-slate-700';
}

export function PortalUsersTable({
  rows,
  selectedIds,
  rowOffset = 0,
  onToggle,
  onToggleAll,
  onView,
  onEdit,
  onActivate,
  onSuspend,
  onResetPassword,
  onForcePasswordReset,
  onUnlockLogin,
  onSendCredentials,
  onImpersonate,
  canManage,
  canImpersonate,
}: Props) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50/80 text-left text-xs font-semibold text-slate-500">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="w-12 px-2 py-3">#</th>
            <th className="px-3 py-3">User</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Department</th>
            <th className="px-3 py-3">Shift</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Last Login</th>
            <th className="w-28 px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No portal users match these filters.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const initials = row.name.slice(0, 2).toUpperCase();
              const role = row.roles[0];
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-slate-100 hover:bg-slate-50/80',
                    selectedIds.has(row.id) && 'bg-primary/5',
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggle(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="px-2 py-3 text-slate-500">{rowOffset + index + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                          avatarColor(row.name),
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{row.name}</p>
                        <p className="truncate text-xs text-slate-500">{row.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        roleTone(role?.slug),
                      )}
                    >
                      {role?.name ?? '—'}
                    </span>
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-3 text-slate-600">
                    {row.department?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    {row.shift?.name ? (
                      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                        {row.shift.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <AdminStatusPill status={row.accountStatus} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                    {row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-500"
                          onClick={() => onEdit(row)}
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-500"
                          onClick={() => onView(row)}
                          aria-label={`View ${row.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(row)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          {canManage ? (
                            <>
                              <DropdownMenuItem onClick={() => onEdit(row)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              {row.accountStatus !== 'active' ? (
                                <DropdownMenuItem onClick={() => onActivate(row)}>
                                  <ShieldCheck className="mr-2 h-4 w-4" /> Activate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => onSuspend(row)}>
                                  <ShieldOff className="mr-2 h-4 w-4" /> Suspend
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => onResetPassword(row)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Reset password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onForcePasswordReset(row)}>
                                <LockKeyhole className="mr-2 h-4 w-4" /> Force password change
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onUnlockLogin(row)}>
                                <Unlock className="mr-2 h-4 w-4" /> Unlock account
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onSendCredentials(row)}>
                                <Mail className="mr-2 h-4 w-4" /> Send credentials
                              </DropdownMenuItem>
                            </>
                          ) : null}
                          {canImpersonate ? (
                            <DropdownMenuItem onClick={() => onImpersonate(row)}>
                              <LogIn className="mr-2 h-4 w-4" /> Login as user
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
