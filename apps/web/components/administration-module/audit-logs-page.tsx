'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  FilterX,
  LayoutGrid,
  LogIn,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchAuditLogs } from '@/services/administration';
import { fetchInstitutions } from '@/services/organization';
import type { AuditLogRow } from '@/types/administration';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const COMMON_MODULES = [
  'Auth',
  'Students',
  'Attendance',
  'Fees',
  'Administration',
  'Staff',
  'Examinations',
  'Library',
  'LMS',
] as const;

type UserTypeFilter = '' | 'Admin' | 'Staff' | 'Student' | 'Guest';

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(dateYmd: string) {
  const d = new Date(`${dateYmd}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function startOfDayIso(dateYmd: string) {
  const d = new Date(`${dateYmd}T00:00:00.000`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function metaString(meta: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function metaBool(meta: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 'success') return true;
    if (value === 'false' || value === 'failed' || value === 'failure') return false;
  }
  return null;
}

function actionStatus(log: AuditLogRow): 'success' | 'failed' {
  const keyed = metaBool(log.metadata, ['success', 'ok', 'succeeded']);
  if (keyed === false) return 'failed';
  if (keyed === true) return 'success';
  const status = metaString(log.metadata, ['status', 'outcome', 'result'])?.toLowerCase();
  if (status && /(fail|error|deny|block|reject)/.test(status)) return 'failed';
  if (/(fail|error|deny|block|reject|unauthorized|forbidden)/i.test(log.action)) return 'failed';
  return 'success';
}

function actionIp(log: AuditLogRow) {
  return (
    metaString(log.metadata, ['ip', 'ipAddress', 'ip_address', 'clientIp', 'remoteAddress']) ?? '—'
  );
}

function actionRole(log: AuditLogRow): UserTypeFilter | 'User' {
  const role = metaString(log.metadata, ['role', 'userType', 'user_type', 'actorRole']);
  if (!role) return log.user ? 'User' : 'Guest';
  const lower = role.toLowerCase();
  if (lower.includes('admin') || lower.includes('super')) return 'Admin';
  if (lower.includes('staff') || lower.includes('faculty') || lower.includes('teacher'))
    return 'Staff';
  if (lower.includes('student')) return 'Student';
  if (lower.includes('guest') || lower.includes('anonymous')) return 'Guest';
  return 'User';
}

function humanizeAction(action: string) {
  const key = action.trim().toLowerCase();
  const known: Record<string, string> = {
    'auth.login': 'User logged in successfully',
    'auth.logout': 'User logged out',
    'auth.login_failed': 'Login attempt failed',
    'auth.password_reset': 'Password was reset',
    'students.create': 'Student record created',
    'students.update': 'Student record updated',
    'students.delete': 'Student record deleted',
    'attendance.mark': 'Attendance marked',
    'fees.payment': 'Fee payment recorded',
  };
  if (known[key]) return known[key];
  if (/(fail|error|deny)/i.test(action)) return 'Action failed or was denied';
  if (/create|insert|add/i.test(action)) return 'Record created';
  if (/update|edit|patch|modify/i.test(action)) return 'Record updated';
  if (/delete|remove/i.test(action)) return 'Record deleted';
  if (/login/i.test(action)) return 'Authentication event';
  if (/export|download/i.test(action)) return 'Data exported';
  return action
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function actionIcon(log: AuditLogRow) {
  const status = actionStatus(log);
  const action = log.action.toLowerCase();
  if (status === 'failed') {
    return { icon: <ShieldAlert className="h-4 w-4" />, tone: 'bg-rose-100 text-rose-700' };
  }
  if (/login|auth/i.test(action)) {
    return { icon: <LogIn className="h-4 w-4" />, tone: 'bg-sky-100 text-sky-700' };
  }
  if (/update|edit|patch|modify/i.test(action)) {
    return { icon: <Pencil className="h-4 w-4" />, tone: 'bg-orange-100 text-orange-700' };
  }
  if (/create|insert|add/i.test(action)) {
    return { icon: <FileText className="h-4 w-4" />, tone: 'bg-emerald-100 text-emerald-700' };
  }
  return { icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-blue-100 text-blue-700' };
}

function roleBadgeClass(role: string) {
  switch (role) {
    case 'Admin':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'Staff':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200';
    case 'Student':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
    case 'Guest':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function AuditLogsPage() {
  useRequireAuth();
  const { branding } = useInstitutionBranding();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [userType, setUserType] = useState<UserTypeFilter>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [detailLog, setDetailLog] = useState<AuditLogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, module, action, userType, fromDate, toDate, pageSize]);

  const institutionsQ = useQuery({
    queryKey: ['institutions'],
    queryFn: fetchInstitutions,
  });

  const institutionName =
    branding?.displayName?.trim() ||
    branding?.shortName?.trim() ||
    institutionsQ.data?.[0]?.name ||
    'Institution';

  const year = new Date().getFullYear();
  const yearLabel = `AY ${year}-${String(year + 1).slice(-2)}`;

  const listParams = useMemo(
    () => ({
      module: module || undefined,
      action: action || debouncedSearch || undefined,
      from: fromDate ? startOfDayIso(fromDate) : undefined,
      to: toDate ? endOfDayIso(toDate) : undefined,
      page: String(page),
      limit: String(pageSize),
    }),
    [module, action, debouncedSearch, fromDate, toDate, page, pageSize],
  );

  const logsQ = useQuery({
    queryKey: ['admin', 'audit', listParams],
    queryFn: () => fetchAuditLogs(listParams),
  });

  const statsQueries = useQueries({
    queries: [
      {
        queryKey: ['admin', 'audit', 'stats', 'total'],
        queryFn: () => fetchAuditLogs({ page: '1', limit: '1' }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'audit', 'stats', 'today'],
        queryFn: () => fetchAuditLogs({ page: '1', limit: '1', from: startOfTodayIso() }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'audit', 'stats', 'failed'],
        queryFn: () => fetchAuditLogs({ page: '1', limit: '1', action: 'fail' }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'audit', 'stats', 'sample'],
        queryFn: () => fetchAuditLogs({ page: '1', limit: '100' }),
        staleTime: 60_000,
      },
    ],
  });

  const [totalStats, todayStats, failedStats, sampleStats] = statsQueries;

  const uniqueUsers = useMemo(() => {
    const ids = new Set(
      (sampleStats.data?.items ?? [])
        .map((l) => l.userId)
        .filter((id): id is string => Boolean(id)),
    );
    return ids.size;
  }, [sampleStats.data?.items]);

  const uniqueModules = useMemo(() => {
    const mods = new Set(
      (sampleStats.data?.items ?? []).map((l) => l.module).filter((m): m is string => Boolean(m)),
    );
    return mods.size;
  }, [sampleStats.data?.items]);

  const rows = useMemo(() => {
    const items = logsQ.data?.items ?? [];
    const q = debouncedSearch.toLowerCase();
    return items.filter((log) => {
      if (userType) {
        const role = actionRole(log);
        if (userType === 'Guest') return role === 'Guest' || !log.user;
        // Exact role match, or unknown role (metadata often absent).
        if (role !== userType && role !== 'User') return false;
      }
      if (!q) return true;
      const hay = [
        log.user?.email,
        log.user?.displayName,
        log.module,
        log.action,
        log.entityType,
        log.entityId,
        humanizeAction(log.action),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logsQ.data?.items, debouncedSearch, userType]);

  const total = logsQ.data?.total ?? 0;
  const totalPages = Math.max(1, logsQ.data?.totalPages ?? 1);

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (module)
      chips.push({ key: 'module', label: `Module: ${module}`, clear: () => setModule('') });
    if (action)
      chips.push({ key: 'action', label: `Action: ${action}`, clear: () => setAction('') });
    if (userType)
      chips.push({
        key: 'userType',
        label: `User Type: ${userType}`,
        clear: () => setUserType(''),
      });
    if (fromDate || toDate) {
      chips.push({
        key: 'date',
        label: `Date: ${fromDate || '…'} → ${toDate || '…'}`,
        clear: () => {
          setFromDate('');
          setToDate('');
        },
      });
    }
    if (debouncedSearch)
      chips.push({
        key: 'search',
        label: `Search: ${debouncedSearch}`,
        clear: () => setSearch(''),
      });
    return chips;
  }, [module, action, userType, fromDate, toDate, debouncedSearch]);

  const clearFilters = () => {
    setSearch('');
    setModule('');
    setAction('');
    setUserType('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const refreshAll = () => {
    void logsQ.refetch();
    for (const q of statsQueries) void q.refetch();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const collected: AuditLogRow[] = [];
      let p = 1;
      let pages = 1;
      const limit = 100;
      const maxRows = 500;
      do {
        const res = await fetchAuditLogs({
          module: module || undefined,
          action: action || debouncedSearch || undefined,
          from: fromDate ? startOfDayIso(fromDate) : undefined,
          to: toDate ? endOfDayIso(toDate) : undefined,
          page: String(p),
          limit: String(limit),
        });
        collected.push(...res.items);
        pages = res.totalPages;
        p += 1;
      } while (p <= pages && collected.length < maxRows);

      const header = [
        'Time',
        'User',
        'Role',
        'Module',
        'Action',
        'Description',
        'Entity',
        'IP',
        'Status',
      ];
      const lines = collected.map((log) => {
        const role = actionRole(log);
        return [
          formatDisplayDateTime(log.createdAt),
          log.user?.email ?? '—',
          role,
          log.module ?? '—',
          log.action,
          humanizeAction(log.action),
          `${log.entityType}${log.entityId ? ` - ${log.entityId}` : ''}`,
          actionIp(log),
          actionStatus(log),
        ]
          .map((cell) => csvEscape(String(cell)))
          .join(',');
      });
      const blob = new Blob([[header.join(','), ...lines].join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <DashboardShell role="admin" title="Audit Logs">
      <AdminShell>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{institutionName}</span>
          <span aria-hidden>·</span>
          <span>{yearLabel}</span>
          <span aria-hidden>·</span>
          <span>ODD Cycle</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Active
          </span>
        </div>

        <AdminPageHeader
          title="Audit Logs"
          subtitle="Platform-wide activity trail and system audit logs."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={refreshAll}
                disabled={logsQ.isFetching}
              >
                <RefreshCw className={cn('h-4 w-4', logsQ.isFetching && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => void exportCsv()}
                disabled={exporting}
              >
                <ArrowDownToLine className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export Logs'}
              </Button>
            </div>
          }
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<FileText className="h-4 w-4 text-sky-600" />}
            iconBg="bg-sky-50 dark:bg-sky-950/40"
            label="Total Logs"
            value={formatNumber(totalStats.data?.total)}
            hint="All time logs"
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            label="Unique Users"
            value={formatNumber(uniqueUsers)}
            hint="From recent sample"
          />
          <StatCard
            icon={<LayoutGrid className="h-4 w-4 text-orange-600" />}
            iconBg="bg-orange-50 dark:bg-orange-950/40"
            label="Modules"
            value={formatNumber(uniqueModules)}
            hint="Distinct modules"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            label="Today's Logs"
            value={formatNumber(todayStats.data?.total)}
            hint="Since midnight"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
            iconBg="bg-rose-50 dark:bg-rose-950/40"
            label="Failed Actions"
            value={formatNumber(failedStats.data?.total)}
            hint="Matching fail*"
          />
        </div>

        <AdminGlassCard className="mb-4 space-y-3 p-4">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by user, module, action…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterSelect
              label="Module"
              value={module}
              onChange={setModule}
              options={COMMON_MODULES.map((m) => ({ value: m, label: m })).concat(
                module && !COMMON_MODULES.includes(module as (typeof COMMON_MODULES)[number])
                  ? [{ value: module, label: module }]
                  : [],
              )}
              placeholder="All modules"
            />
            <div className="space-y-1">
              <Label className="text-[11px]">Action</Label>
              <Input
                className="h-9 w-full min-w-[140px] xl:w-40"
                placeholder="e.g. login"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>
            <FilterSelect
              label="User Type"
              value={userType}
              onChange={(v) => setUserType(v as UserTypeFilter)}
              options={[
                { value: 'Admin', label: 'Admin' },
                { value: 'Staff', label: 'Staff' },
                { value: 'Student', label: 'Student' },
                { value: 'Guest', label: 'Guest' },
              ]}
              placeholder="All types"
            />
            <div className="space-y-1">
              <Label className="text-[11px]">From</Label>
              <Input
                type="date"
                className="h-9"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">To</Label>
              <Input
                type="date"
                className="h-9"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={clearFilters}
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear Filters
            </Button>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Active Filters:</span>
              {activeFilters.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                >
                  {chip.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </AdminGlassCard>

        <AdminGlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-3" />
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Module</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Entity</th>
                  <th className="px-3 py-3">IP Address</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {logsQ.isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Loading audit logs…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      No audit logs match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((log) => {
                    const icon = actionIcon(log);
                    const role = actionRole(log);
                    const status = actionStatus(log);
                    return (
                      <tr key={log.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg',
                              icon.tone,
                            )}
                          >
                            {icon.icon}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDisplayDateTime(log.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {log.user?.email ?? log.user?.displayName ?? 'Anonymous'}
                            </p>
                            <span
                              className={cn(
                                'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                                roleBadgeClass(role),
                              )}
                            >
                              {role}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs font-medium">{log.module ?? '—'}</td>
                        <td className="px-3 py-3">
                          <p className="font-mono text-xs font-semibold">{log.action}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {humanizeAction(log.action)}
                          </p>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                          {log.entityType}
                          {log.entityId ? ` - ${log.entityId.slice(0, 8)}…` : ''}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {actionIp(log)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              status === 'success'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                status === 'success' ? 'bg-emerald-500' : 'bg-rose-500',
                              )}
                            />
                            {status === 'success' ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDetailLog(log)}
                            aria-label="View log details"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {showingFrom} to {showingTo} of {total.toLocaleString('en-IN')} logs
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span className="inline-flex min-w-9 items-center justify-center rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                {page}
              </span>
              <span className="px-1">/ {totalPages}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
            <select
              className="h-8 rounded-md border border-input bg-background px-2"
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
              }
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </AdminGlassCard>

        <Dialog open={Boolean(detailLog)} onOpenChange={(open) => !open && setDetailLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Audit log detail</DialogTitle>
            </DialogHeader>
            {detailLog ? (
              <div className="space-y-3 text-sm">
                <DetailRow label="Time" value={formatDisplayDateTime(detailLog.createdAt)} />
                <DetailRow
                  label="User"
                  value={detailLog.user?.email ?? detailLog.user?.displayName ?? 'Anonymous'}
                />
                <DetailRow label="Module" value={detailLog.module ?? '—'} />
                <DetailRow label="Action" value={detailLog.action} mono />
                <DetailRow label="Description" value={humanizeAction(detailLog.action)} />
                <DetailRow
                  label="Entity"
                  value={`${detailLog.entityType}${detailLog.entityId ? ` · ${detailLog.entityId}` : ''}`}
                  mono
                />
                <DetailRow label="IP" value={actionIp(detailLog)} mono />
                <DetailRow label="Status" value={actionStatus(detailLog)} />
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Metadata
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed">
                    {JSON.stringify(detailLog.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </AdminShell>
    </DashboardShell>
  );
}

function formatNumber(value?: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <AdminGlassCard className="flex items-center gap-3 p-3.5">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xl font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </AdminGlassCard>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <select
        className="h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm xl:w-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
