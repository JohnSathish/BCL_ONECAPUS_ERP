'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Clock3,
  Eye,
  KeyRound,
  Lock,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Unlock,
  UserCheck,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  createErpUser,
  fetchErpUser,
  fetchErpUsers,
  fetchErpUsersOptions,
  fetchErpUsersSummary,
  resetErpUserPassword,
  runErpUserAction,
  updateErpUser,
  type ErpUserAction,
} from '@/services/erp-users';
import { useAuthStore } from '@/store/auth-store';
import type {
  ErpUserDetail,
  ErpUserFormPayload,
  ErpUserRow,
  ErpUsersFilters,
} from '@/types/erp-users';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/format-date';
import { ErpUserDetailDrawer } from './erp-user-detail-drawer';
import { ErpUserFormDialog } from './erp-user-form-dialog';
import { ErpUserPasswordDialog } from './erp-user-password-dialog';
import { ErpUserStatusPill } from './erp-user-status-pill';

const ACTION_CONFIRM: Partial<Record<ErpUserAction, string>> = {
  deactivate:
    'Deactivate this ERP account? The user is signed out now and cannot sign in until it is activated again.',
  lock: 'Lock this ERP account? The user is signed out now and cannot sign in until it is unlocked.',
  'revoke-sessions': 'Sign this user out of every device now?',
  'force-password-change':
    'Require a new password at next sign-in? The user is signed out of every device now.',
};

const ACTION_DONE: Record<ErpUserAction, string> = {
  activate: 'Account activated.',
  deactivate: 'Account deactivated and signed out.',
  lock: 'Account locked and signed out.',
  unlock: 'Account unlocked.',
  'force-password-change': 'The user must set a new password at next sign-in.',
  'revoke-sessions': 'All sessions signed out.',
};

const selectClass = 'h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm';

type SortKey = 'accountCode' | 'name' | 'username' | 'email' | 'lastLoginAt' | 'createdAt';

export function ErpUsersPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const { canReadUsers, canManageUsers, canManageRbac } = useAdminPermissions();
  const currentUserId = useAuthStore((s) => s.session?.user?.id);
  const canEdit = canManageUsers && canManageRbac;

  const [filters, setFilters] = useState<ErpUsersFilters>({
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortDir: 'desc',
  });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [form, setForm] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    user: ErpUserDetail | null;
  }>({
    open: false,
    mode: 'create',
    user: null,
  });
  const [viewId, setViewId] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<ErpUserRow | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const summaryQ = useQuery({
    queryKey: ['admin', 'erp-users', 'summary'],
    queryFn: fetchErpUsersSummary,
    enabled: canReadUsers,
  });
  const optionsQ = useQuery({
    queryKey: ['admin', 'erp-users', 'options'],
    queryFn: fetchErpUsersOptions,
    enabled: canReadUsers,
  });
  const listQ = useQuery({
    queryKey: ['admin', 'erp-users', 'list', queryFilters],
    queryFn: () => fetchErpUsers(queryFilters),
    enabled: canReadUsers,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'erp-users'] });

  const saveMut = useMutation({
    mutationFn: (payload: ErpUserFormPayload) =>
      form.mode === 'create' ? createErpUser(payload) : updateErpUser(form.user!.id, payload),
    onSuccess: (saved) => {
      setForm({ open: false, mode: 'create', user: null });
      setNotice({
        tone: 'ok',
        text:
          form.mode === 'create'
            ? `${saved.name} was created as ${saved.accountCode}. They sign in at the ERP login page with username "${saved.username}".`
            : `${saved.name} was updated.`,
      });
      void refresh();
    },
  });

  const actionMut = useMutation({
    mutationFn: ({ row, action }: { row: ErpUserRow; action: ErpUserAction }) =>
      runErpUserAction(row.id, action),
    onSuccess: (_data, vars) => {
      setNotice({ tone: 'ok', text: `${vars.row.name}: ${ACTION_DONE[vars.action]}` });
      void refresh();
    },
    onError: (error) => setNotice({ tone: 'error', text: apiErrorMessage(error, 'Action failed') }),
  });

  const passwordMut = useMutation({
    mutationFn: (payload: {
      newPassword: string;
      confirmPassword: string;
      forcePasswordChange: boolean;
    }) => resetErpUserPassword(passwordFor!.id, payload),
    onSuccess: () => {
      setNotice({
        tone: 'ok',
        text: `Password reset for ${passwordFor?.name}. They were signed out of every device.`,
      });
      setPasswordFor(null);
      void refresh();
    },
  });

  const openEdit = async (row: ErpUserRow) => {
    saveMut.reset();
    try {
      const detail = await fetchErpUser(row.id);
      setForm({ open: true, mode: 'edit', user: detail });
    } catch (error) {
      setNotice({ tone: 'error', text: apiErrorMessage(error, 'Could not load this user') });
    }
  };

  const runAction = (row: ErpUserRow, action: ErpUserAction) => {
    const question = ACTION_CONFIRM[action];
    if (question && !window.confirm(question)) return;
    actionMut.mutate({ row, action });
  };

  const setSort = (key: SortKey) =>
    setFilters((current) => ({
      ...current,
      sortBy: key,
      sortDir: current.sortBy === key && current.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));

  const summary = summaryQ.data;
  const rows = listQ.data?.items ?? [];
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const total = listQ.data?.total ?? 0;
  const totalPages = listQ.data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const cards = [
    {
      label: 'Total ERP Users',
      value: summary?.total,
      hint: 'Separate ERP portal accounts',
      icon: Users,
      tone: 'bg-sky-100 text-sky-600',
      status: undefined,
    },
    {
      label: 'Active Users',
      value: summary?.active,
      hint: 'Can sign in',
      icon: UserCheck,
      tone: 'bg-emerald-100 text-emerald-600',
      status: 'active',
    },
    {
      label: 'Inactive Users',
      value: summary ? summary.inactive + summary.locked : undefined,
      hint: summary ? `${summary.locked} locked` : '',
      icon: Ban,
      tone: 'bg-slate-100 text-slate-500',
      status: 'inactive',
    },
    {
      label: 'Pending Activation',
      value: summary?.pendingActivation,
      hint: 'Active, never signed in',
      icon: Clock3,
      tone: 'bg-amber-100 text-amber-600',
      status: 'pending',
    },
    {
      label: 'Administrators',
      value: summary?.administrators,
      hint: 'Super Admin and admin roles',
      icon: ShieldCheck,
      tone: 'bg-violet-100 text-violet-600',
      status: undefined,
    },
    {
      label: 'Signed In Now',
      value: summary?.signedIn,
      hint: 'Users with a live session',
      icon: Wifi,
      tone: 'bg-teal-100 text-teal-600',
      status: undefined,
    },
  ];

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <button
      type="button"
      onClick={() => setSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-slate-800"
    >
      {label}
      {filters.sortBy === sortKey ? (
        filters.sortDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );

  if (!canReadUsers) {
    return (
      <DashboardShell role="admin" title="ERP Users" pageHeader={false}>
        <AdminShell>
          <p className="py-10 text-sm text-slate-500">
            You do not have permission to view ERP users.
          </p>
        </AdminShell>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" title="ERP Users" pageHeader={false}>
      <AdminShell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d4ed8]/10 text-[#1d4ed8]">
              <UserCog className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">ERP Users</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Administrative accounts for the main ERP dashboard. These are separate from student,
                staff, faculty and parent logins. Menus follow the assigned role.
              </p>
            </div>
          </div>
          {canEdit ? (
            <Button
              className="h-10 bg-[#1d4ed8] hover:bg-[#1e40af]"
              onClick={() => {
                saveMut.reset();
                setForm({ open: true, mode: 'create', user: null });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Create ERP User
            </Button>
          ) : null}
        </div>

        {notice ? (
          <div
            className={cn(
              'mt-4 flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm',
              notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700',
            )}
          >
            <span>{notice.text}</span>
            <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {cards.map((card) => (
            <button
              key={card.label}
              type="button"
              disabled={card.status === undefined && card.label !== 'Total ERP Users'}
              onClick={() =>
                setFilters((current) => ({ ...current, status: card.status, page: 1 }))
              }
              className={cn(
                'rounded-2xl border bg-white p-4 text-left shadow-sm transition',
                filters.status && filters.status === card.status
                  ? 'border-[#1d4ed8]'
                  : 'border-slate-200 hover:border-sky-200',
                'disabled:cursor-default disabled:hover:border-slate-200',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                    {card.value == null ? '—' : card.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
                </div>
                <span
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.tone)}
                >
                  <card.icon className="h-5 w-5" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-lg border-slate-200 pl-9"
              placeholder="Search name, username, email, mobile, ERP ID, employee ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters((current) => ({ ...current, page: 1 }));
              }}
            />
          </div>
          <select
            className={selectClass}
            aria-label="Status"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((c) => ({ ...c, status: e.target.value || undefined, page: 1 }))
            }
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending activation</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </select>
          <select
            className={selectClass}
            aria-label="Role"
            value={filters.role ?? ''}
            onChange={(e) =>
              setFilters((c) => ({ ...c, role: e.target.value || undefined, page: 1 }))
            }
          >
            <option value="">All roles</option>
            {(optionsQ.data?.roles ?? []).map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            aria-label="Department"
            value={filters.departmentId ?? ''}
            onChange={(e) =>
              setFilters((c) => ({ ...c, departmentId: e.target.value || undefined, page: 1 }))
            }
          >
            <option value="">All departments</option>
            {(optionsQ.data?.departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            aria-label="ERP access"
            value={filters.erpAccess ?? ''}
            onChange={(e) =>
              setFilters((c) => ({ ...c, erpAccess: e.target.value || undefined, page: 1 }))
            }
          >
            <option value="">ERP access: any</option>
            <option value="enabled">ERP access on</option>
            <option value="disabled">ERP access off</option>
          </select>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              setSearch('');
              setFilters({ page: 1, limit, sortBy: 'createdAt', sortDir: 'desc' });
            }}
          >
            Reset
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-3">
                    <SortHeader label="User ID" sortKey="accountCode" />
                  </th>
                  <th className="px-3 py-3">
                    <SortHeader label="Name" sortKey="name" />
                  </th>
                  <th className="px-3 py-3">
                    <SortHeader label="Username" sortKey="username" />
                  </th>
                  <th className="px-3 py-3">
                    <SortHeader label="Email" sortKey="email" />
                  </th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Designation</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">
                    <SortHeader label="Last Login" sortKey="lastLoginAt" />
                  </th>
                  <th className="px-3 py-3">
                    <SortHeader label="Created" sortKey="createdAt" />
                  </th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                      Loading ERP users…
                    </td>
                  </tr>
                ) : listQ.isError ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-rose-600">
                      {apiErrorMessage(listQ.error, 'Could not load ERP users')}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                      {total === 0 && !debouncedSearch && !filters.status
                        ? 'No ERP users yet. Use Create ERP User to add the first one.'
                        : 'No ERP users match these filters.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const self = row.id === currentUserId;
                    return (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
                          {row.accountCode}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          {row.employeeId ? (
                            <p className="text-xs text-slate-500">Emp. {row.employeeId}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{row.username ?? '—'}</td>
                        <td className="max-w-[200px] truncate px-3 py-3 text-slate-600">
                          {row.email}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-slate-600">
                          {row.department?.name ?? '—'}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-3 text-slate-600">
                          {row.designation ?? '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              row.isAdministrator
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-slate-100 text-slate-700',
                            )}
                          >
                            {row.role?.name ?? 'No role'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <ErpUserStatusPill row={row} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : 'Never'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {formatDisplayDate(row.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500"
                              onClick={() => setViewId(row.id)}
                              aria-label={`View ${row.name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canManageUsers ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-slate-500"
                                    aria-label={`More actions for ${row.name}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewId(row.id)}>
                                    <Eye className="mr-2 h-4 w-4" /> View
                                  </DropdownMenuItem>
                                  {canEdit ? (
                                    <DropdownMenuItem onClick={() => void openEdit(row)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                  ) : null}
                                  {row.status === 'inactive' ? (
                                    <DropdownMenuItem onClick={() => runAction(row, 'activate')}>
                                      <ShieldCheck className="mr-2 h-4 w-4" /> Activate
                                    </DropdownMenuItem>
                                  ) : !self ? (
                                    <DropdownMenuItem onClick={() => runAction(row, 'deactivate')}>
                                      <ShieldOff className="mr-2 h-4 w-4" /> Deactivate
                                    </DropdownMenuItem>
                                  ) : null}
                                  {row.status === 'locked' ? (
                                    <DropdownMenuItem onClick={() => runAction(row, 'unlock')}>
                                      <Unlock className="mr-2 h-4 w-4" /> Unlock
                                    </DropdownMenuItem>
                                  ) : row.status === 'active' && !self ? (
                                    <DropdownMenuItem onClick={() => runAction(row, 'lock')}>
                                      <Lock className="mr-2 h-4 w-4" /> Lock
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      passwordMut.reset();
                                      setPasswordFor(row);
                                    }}
                                  >
                                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => runAction(row, 'force-password-change')}
                                  >
                                    <LockKeyhole className="mr-2 h-4 w-4" /> Force Password Change
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => runAction(row, 'revoke-sessions')}
                                  >
                                    <LogOut className="mr-2 h-4 w-4" /> Sign Out All Sessions
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Showing {from} to {to} of {total.toLocaleString()} ERP users
            </span>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                value={limit}
                aria-label="Rows per page"
                onChange={(e) =>
                  setFilters((c) => ({ ...c, limit: Number(e.target.value), page: 1 }))
                }
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setFilters((c) => ({ ...c, page: page - 1 }))}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setFilters((c) => ({ ...c, page: page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <ErpUserFormDialog
          open={form.open}
          mode={form.mode}
          user={form.user}
          options={optionsQ.data}
          saving={saveMut.isPending}
          error={saveMut.error ? apiErrorMessage(saveMut.error, 'Could not save') : null}
          onClose={() => setForm({ open: false, mode: 'create', user: null })}
          onSubmit={(payload) => saveMut.mutate(payload)}
        />

        <ErpUserPasswordDialog
          open={Boolean(passwordFor)}
          userName={passwordFor?.name ?? null}
          saving={passwordMut.isPending}
          error={
            passwordMut.error
              ? apiErrorMessage(passwordMut.error, 'Could not reset password')
              : null
          }
          onClose={() => setPasswordFor(null)}
          onSubmit={(payload) => passwordMut.mutate(payload)}
        />

        <ErpUserDetailDrawer userId={viewId} onClose={() => setViewId(null)} />
      </AdminShell>
    </DashboardShell>
  );
}
