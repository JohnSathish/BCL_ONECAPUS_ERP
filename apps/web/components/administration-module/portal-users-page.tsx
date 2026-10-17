'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Upload, Download, Users, UserCheck, UserX, Clock3, Ban } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PasswordResetSuccessDialog } from '@/components/administration-module/password-reset-success-dialog';
import { PortalUserDrawer } from '@/components/administration-module/portal-user-drawer';
import { PortalUsersBulkBar } from '@/components/administration-module/portal-users-bulk-bar';
import { PortalUsersFilterRail } from '@/components/administration-module/portal-users-filter-rail';
import { PortalUsersTable } from '@/components/administration-module/portal-users-table';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchDepartments } from '@/services/organization';
import { fetchShifts } from '@/services/shifts';
import {
  activatePortalUser,
  bulkActivateUsers,
  bulkResetPasswords,
  createPortalUser,
  fetchPortalUsers,
  fetchRoles,
  fetchUserSummary,
  forcePortalUserPasswordReset,
  impersonateUser,
  resetPortalUserPassword,
  sendUserCredentials,
  suspendPortalUser,
  unlockPortalUserLogin,
  updatePortalUser,
} from '@/services/administration';
import { storeAdminSessionBackup } from '@/components/administration-module/impersonation-banner';
import { useAuthStore } from '@/store/auth-store';
import type { PortalUserFilters, PortalUserRow } from '@/types/administration';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const AUDIENCE_TABS = [
  { id: '', label: 'All Users', countKey: 'total' as const },
  { id: 'students', label: 'Students', countKey: 'students' as const },
  { id: 'faculty', label: 'Faculty', countKey: 'faculty' as const },
  { id: 'staff', label: 'Staff', countKey: 'staff' as const },
  { id: 'parents', label: 'Parents', countKey: 'parents' as const },
  { id: 'alumni', label: 'Alumni', countKey: 'alumni' as const },
  { id: 'others', label: 'Others', countKey: 'others' as const },
];

function percentOf(part: number, total: number) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function PortalUsersPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const { canManageUsers, canImpersonate } = useAdminPermissions();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const [filters, setFilters] = useState<PortalUserFilters>({ page: 1, limit: 10 });
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    password: string | null;
    user: PortalUserRow | null;
  }>({ open: false, password: null, user: null });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: 'create' | 'edit' | 'view';
    user: PortalUserRow | null;
  }>({ open: false, mode: 'view', user: null });

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const summaryQ = useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: fetchUserSummary,
  });
  const usersQ = useQuery({
    queryKey: ['admin', 'users', queryFilters],
    queryFn: () => fetchPortalUsers(queryFilters),
  });
  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: fetchRoles,
  });
  const departmentsQ = useQuery({
    queryKey: ['organization', 'departments', 'portal-users'],
    queryFn: () => fetchDepartments({ status: 'ACTIVE' }),
  });
  const shiftsQ = useQuery({
    queryKey: ['shifts', 'portal-users'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const createMut = useMutation({
    mutationFn: createPortalUser,
    onSuccess: () => {
      invalidate();
      setDrawer({ open: false, mode: 'create', user: null });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updatePortalUser(id, payload),
    onSuccess: () => {
      invalidate();
      setDrawer({ open: false, mode: 'view', user: null });
    },
  });

  const rows = usersQ.data?.items ?? [];
  const roles = (rolesQ.data ?? []).map((r) => ({ slug: r.slug, name: r.name }));

  const toggleAll = () => {
    if (rows.every((r) => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const impersonateMut = useMutation({
    mutationFn: impersonateUser,
    onSuccess: (data) => {
      if (session) storeAdminSessionBackup(session);
      setSession(data);
      window.location.href = '/admin';
    },
  });

  const summary = summaryQ.data;
  const audiences = summary?.audiences;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const total = usersQ.data?.total ?? 0;
  const totalPages = usersQ.data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pageButtons = useMemo(() => {
    const items: Array<number | 'gap'> = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    if (start > 1) items.push(1);
    if (start > 2) items.push('gap');
    for (let number = Math.max(start, 1); number <= end; number += 1) {
      if (!items.includes(number)) items.push(number);
    }
    if (end < totalPages - 1) items.push('gap');
    if (end < totalPages) items.push(totalPages);
    return items;
  }, [page, totalPages]);

  const exportUsers = async () => {
    setExporting(true);
    try {
      const collected: PortalUserRow[] = [];
      let nextPage = 1;
      let pages = 1;
      while (nextPage <= pages && nextPage <= 40) {
        const batch = await fetchPortalUsers({ ...queryFilters, page: nextPage, limit: 100 });
        collected.push(...batch.items);
        pages = batch.totalPages;
        nextPage += 1;
      }
      const header = [
        'Name',
        'Email',
        'Username',
        'Role',
        'Department',
        'Shift',
        'Status',
        'Last login',
      ];
      const lines = [
        header.map(csvCell).join(','),
        ...collected.map((row) =>
          [
            row.name,
            row.email,
            row.username ?? '',
            row.roles.map((role) => role.name).join('; '),
            row.department?.name ?? '',
            row.shift?.name ?? '',
            row.accountStatus,
            row.lastLoginAt ?? '',
          ]
            .map(csvCell)
            .join(','),
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'portal-users.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const statCards = summary
    ? [
        {
          label: 'Total Users',
          value: summary.total,
          hint: 'All registered users',
          icon: Users,
          iconClass: 'bg-sky-100 text-sky-600',
          onClick: () => setFilters((current) => ({ ...current, status: undefined, page: 1 })),
        },
        {
          label: 'Active',
          value: summary.active,
          hint: percentOf(summary.active, summary.total),
          icon: UserCheck,
          iconClass: 'bg-emerald-100 text-emerald-600',
          onClick: () => setFilters((current) => ({ ...current, status: 'active', page: 1 })),
        },
        {
          label: 'Inactive',
          value: summary.inactive,
          hint: percentOf(summary.inactive, summary.total),
          icon: UserX,
          iconClass: 'bg-slate-100 text-slate-500',
          onClick: () => setFilters((current) => ({ ...current, status: 'inactive', page: 1 })),
        },
        {
          label: 'Pending',
          value: summary.pending,
          hint: percentOf(summary.pending, summary.total),
          icon: Clock3,
          iconClass: 'bg-amber-100 text-amber-600',
          onClick: () => setFilters((current) => ({ ...current, status: 'pending', page: 1 })),
        },
        {
          label: 'Suspended',
          value: summary.suspended,
          hint: percentOf(summary.suspended, summary.total),
          icon: Ban,
          iconClass: 'bg-rose-100 text-rose-600',
          onClick: () => setFilters((current) => ({ ...current, status: 'suspended', page: 1 })),
        },
      ]
    : [];

  return (
    <DashboardShell role="admin" title="Portal Users" pageHeader={false}>
      <AdminShell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Portal Users</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage ERP login accounts for students, staff, parents and other users.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageUsers ? (
              <Link
                href="/admin/administration/import-export"
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
              >
                <Upload className="mr-2 h-4 w-4" /> Bulk Import
              </Link>
            ) : null}
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void exportUsers()}
              disabled={exporting}
            >
              <Download className="mr-2 h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
            </Button>
            {canManageUsers ? (
              <Button
                className="h-10 bg-[#1d4ed8] hover:bg-[#1e40af]"
                onClick={() => setDrawer({ open: true, mode: 'create', user: null })}
              >
                <Plus className="mr-2 h-4 w-4" /> Add User
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                    {card.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
                </div>
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    card.iconClass,
                  )}
                >
                  <card.icon className="h-5 w-5" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-lg border-slate-200 pl-9"
              placeholder="Search by name, email, username, role, department…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <PortalUsersFilterRail
            filters={filters}
            roles={roles}
            departments={(departmentsQ.data ?? []).map((department) => ({
              id: department.id,
              name: department.name,
            }))}
            shifts={(shiftsQ.data ?? []).map((shift) => ({ id: shift.id, name: shift.name }))}
            onChange={(next) => {
              setFilters(next);
              setSelectedIds(new Set());
            }}
            onReset={() => {
              setSearch('');
              setFilters({ page: 1, limit });
              setSelectedIds(new Set());
            }}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-3">
            {AUDIENCE_TABS.map((tab) => {
              const active = (filters.audience ?? '') === tab.id;
              const count = tab.countKey === 'total' ? summary?.total : audiences?.[tab.countKey];
              return (
                <button
                  key={tab.id || 'all'}
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      audience: tab.id || undefined,
                      page: 1,
                    }));
                    setSelectedIds(new Set());
                  }}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    active ? 'bg-[#1d4ed8] text-white' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {tab.label}
                  {count != null ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs',
                        active ? 'bg-white/20' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {count.toLocaleString()}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {usersQ.isLoading ? (
            <p className="px-4 py-10 text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <PortalUsersTable
              rows={rows}
              rowOffset={(page - 1) * limit}
              selectedIds={selectedIds}
              onToggle={(id) => {
                const next = new Set(selectedIds);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setSelectedIds(next);
              }}
              onToggleAll={toggleAll}
              onView={(u) => setDrawer({ open: true, mode: 'view', user: u })}
              onEdit={(u) => setDrawer({ open: true, mode: 'edit', user: u })}
              onActivate={async (u) => {
                await activatePortalUser(u.id);
                invalidate();
              }}
              onSuspend={async (u) => {
                await suspendPortalUser(u.id);
                invalidate();
              }}
              onResetPassword={async (u) => {
                const useRoll = u.hasStudentProfile
                  ? window.confirm(
                      'Reset this student password to their college roll number?\n\nOK = roll number (recommended)\nCancel = generate a random password',
                    )
                  : false;
                const res = await resetPortalUserPassword(
                  u.id,
                  u.hasStudentProfile
                    ? { forceReset: true, resetToRoll: useRoll }
                    : { forceReset: true },
                );
                setPasswordDialog({
                  open: true,
                  password: res.generatedPassword ?? null,
                  user: u,
                });
                invalidate();
              }}
              onForcePasswordReset={async (u) => {
                await forcePortalUserPasswordReset(u.id);
                alert('User must change password on next login.');
                invalidate();
              }}
              onUnlockLogin={async (u) => {
                const res = await unlockPortalUserLogin(u.id);
                alert(
                  `Account unlocked. Cleared ${res.clearedAttempts ?? 0} failed attempt record(s).`,
                );
                invalidate();
              }}
              onSendCredentials={async (u) => {
                const res = await sendUserCredentials(u.id);
                setPasswordDialog({
                  open: true,
                  password: res.generatedPassword ?? null,
                  user: u,
                });
                invalidate();
              }}
              onImpersonate={(u) => impersonateMut.mutate(u.id)}
              canManage={canManageUsers}
              canImpersonate={canImpersonate}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {from} to {to} of {total.toLocaleString()} users
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                value={limit}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    limit: Number(event.target.value),
                    page: 1,
                  }))
                }
                aria-label="Rows per page"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: page - 1 }))}
              >
                Previous
              </Button>
              {pageButtons.map((item, index) =>
                item === 'gap' ? (
                  <span key={`gap-${index}`} className="px-1">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, page: item }))}
                    className={cn(
                      'h-8 min-w-8 rounded-md px-2 text-sm',
                      item === page ? 'bg-[#1d4ed8] text-white' : 'hover:bg-slate-100',
                    )}
                  >
                    {item}
                  </button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <PortalUsersBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onActivate={async () => {
            await bulkActivateUsers([...selectedIds]);
            setSelectedIds(new Set());
            invalidate();
          }}
          onResetPasswords={async () => {
            await bulkResetPasswords([...selectedIds]);
            invalidate();
          }}
          onSendCredentials={async () => {
            for (const id of selectedIds) await sendUserCredentials(id);
          }}
        />

        <PortalUserDrawer
          open={drawer.open}
          mode={drawer.mode}
          user={drawer.user}
          roles={roles}
          onClose={() => setDrawer({ open: false, mode: 'view', user: null })}
          loading={createMut.isPending || updateMut.isPending}
          onSubmit={(payload) => {
            if (drawer.mode === 'create') createMut.mutate(payload);
            else if (drawer.user) updateMut.mutate({ id: drawer.user.id, payload });
          }}
        />

        <PasswordResetSuccessDialog
          open={passwordDialog.open}
          password={passwordDialog.password}
          userLabel={
            passwordDialog.user?.displayName ||
            passwordDialog.user?.name ||
            passwordDialog.user?.email ||
            null
          }
          email={passwordDialog.user?.email ?? null}
          mobile={passwordDialog.user?.mobile ?? null}
          onOpenChange={(open) =>
            setPasswordDialog((prev) => ({
              ...prev,
              open,
              ...(open ? {} : { password: null, user: null }),
            }))
          }
        />

        {(createMut.error || updateMut.error || impersonateMut.error) && (
          <p className="mt-4 text-sm text-destructive">
            {apiErrorMessage(
              createMut.error ?? updateMut.error ?? impersonateMut.error,
              'Action failed',
            )}
          </p>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
