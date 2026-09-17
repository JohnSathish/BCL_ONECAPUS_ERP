'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolUsers } from '@/lib/school-sis/permissions';
import {
  assignSchoolIamRoles,
  bulkSchoolIam,
  cloneSchoolIamRole,
  createSchoolIamUser,
  deleteSchoolIamRole,
  fetchSchoolIamAlerts,
  fetchSchoolIamAudit,
  fetchSchoolIamCatalog,
  fetchSchoolIamDashboard,
  fetchSchoolIamDirectoryPreview,
  fetchSchoolIamInvites,
  fetchSchoolIamLinkOptions,
  fetchSchoolIamLogins,
  fetchSchoolIamRoles,
  fetchSchoolIamSecurity,
  fetchSchoolIamSessions,
  fetchSchoolIamUser,
  fetchSchoolIamUsers,
  impersonateSchoolIamUser,
  importSchoolIamUsers,
  inviteSchoolIamUser,
  provisionSchoolIamDirectory,
  killSchoolIamSession,
  logoutSchoolIamUser,
  resendSchoolIamInvite,
  resetSchoolIamPassword,
  revokeSchoolIamInvite,
  saveSchoolIamRole,
  saveSchoolIamSecurity,
  seedSchoolIamRoles,
  setSchoolIamStatus,
  syncSchoolIamLoginNames,
  testSchoolIamAccess,
} from '@/services/school-iam';
import { fetchSchoolAcademicClasses } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { storeAdminSessionBackup } from '@/components/administration-module/impersonation-banner';

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  );
}

function revealPassword(res: {
  temporaryPassword?: string;
  generatedPassword?: string;
  plainPassword?: string;
}) {
  return res.temporaryPassword || res.generatedPassword || res.plainPassword || '';
}

function iamUserItems(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
  const nested = obj.data;
  if (
    nested &&
    typeof nested === 'object' &&
    Array.isArray((nested as { items?: unknown }).items)
  ) {
    return (nested as { items: Array<Record<string, unknown>> }).items;
  }
  return [];
}

const USERS_PAGE_SIZE_DEFAULT = 10;

const LINKS = [
  { href: '/admin/school-sis/users', label: 'All Users', exact: true, icon: 'users' },
  { href: '/admin/school-sis/users/active', label: 'Active', icon: 'active' },
  { href: '/admin/school-sis/users/invitations', label: 'Invitations', icon: 'invite' },
  { href: '/admin/school-sis/users/locked', label: 'Locked', icon: 'lock' },
  { href: '/admin/school-sis/users/suspended', label: 'Suspended', icon: 'suspend' },
  { href: '/admin/school-sis/users/roles', label: 'Roles', icon: 'roles' },
  { href: '/admin/school-sis/users/permissions', label: 'Permissions', icon: 'key' },
  { href: '/admin/school-sis/users/sessions', label: 'Sessions', icon: 'monitor' },
  { href: '/admin/school-sis/users/login-history', label: 'Login History', icon: 'history' },
  { href: '/admin/school-sis/users/audit', label: 'Audit', icon: 'audit' },
  { href: '/admin/school-sis/users/security', label: 'Security', icon: 'shield' },
];

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-sky-100 text-sky-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-orange-100 text-orange-800',
];

function avatarTone(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n += seed.charCodeAt(i);
  return AVATAR_TONES[n % AVATAR_TONES.length];
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function roleChipClass(name: string) {
  const n = name.toLowerCase();
  if (n.includes('student')) return 'bg-sky-50 text-sky-800 ring-sky-200';
  if (n.includes('teacher')) return 'bg-indigo-50 text-indigo-800 ring-indigo-200';
  if (n.includes('parent') || n.includes('guardian'))
    return 'bg-violet-50 text-violet-800 ring-violet-200';
  if (n.includes('admin') || n.includes('principal'))
    return 'bg-slate-100 text-slate-800 ring-slate-200';
  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

function isRecentlyOnline(iso: unknown) {
  if (!iso) return false;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) && Date.now() - t < 15 * 60 * 1000;
}

function pagerItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: Array<number | '…'> = [1];
  const start = Math.max(2, Math.min(current - 1, total - 4));
  const end = Math.min(total - 1, Math.max(start + 3, 5));
  if (start > 2) items.push('…');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

function TabIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? '#ffffff' : '#64748b';
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'active') {
    return (
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
      </span>
    );
  }
  const paths: Record<string, string> = {
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    invite: 'M4 4h16v16H4zM4 8l8 6 8-6',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z',
    suspend:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 8l5 5M22 8l-5 5',
    roles: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    key: 'M21 2l-2 2m-7.4 7.4a5 5 0 1 1-2 2L13 17h3v3h3v-3h2l-7.4-7.6',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    history:
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    audit:
      'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  };
  return (
    <svg {...common}>
      <path d={paths[name] ?? paths.users} />
    </svg>
  );
}

export function UsersDesk() {
  const path = usePathname();
  const qc = useQueryClient();
  const ready = useAuthQueryEnabled();
  const perms = useAuthStore((s) => s.session?.user.permissions);
  const manage = canManageSchoolUsers(perms);
  const page =
    LINKS.find((l) => (l.exact ? path === l.href : path.startsWith(l.href)))?.href ?? LINKS[0].href;
  const statusFromPath = page.endsWith('/active')
    ? 'active'
    : page.endsWith('/locked')
      ? 'locked'
      : page.endsWith('/suspended')
        ? 'suspended'
        : '';
  const usersListPage =
    page === '/admin/school-sis/users' ||
    page.endsWith('/active') ||
    page.endsWith('/locked') ||
    page.endsWith('/suspended');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [pageSize, setPageSize] = useState(USERS_PAGE_SIZE_DEFAULT);
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [moreFilters, setMoreFilters] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    name: string;
    username?: string | null;
    email?: string;
    password: string;
    defaultUsed?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [customReset, setCustomReset] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [invite, setInvite] = useState(false);
  const [roleEdit, setRoleEdit] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    ok?: string;
    okLabel?: string;
    run: () => Promise<unknown>;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    source: 'manual' as 'manual' | 'student' | 'staff',
    displayName: '',
    email: '',
    username: '',
    phone: '',
    roleSlugs: ['teacher'] as string[],
    invite: false,
    passwordMode: 'default' as 'default' | 'invite' | 'custom',
    password: '',
    staffId: '',
    studentId: '',
  });
  const [personQ, setPersonQ] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directoryProgress, setDirectoryProgress] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'teacher' });
  const [wizardStep, setWizardStep] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState('');
  const [testPerm, setTestPerm] = useState('students.view');

  const dash = useQuery({
    queryKey: ['school-iam-dash'],
    queryFn: fetchSchoolIamDashboard,
    enabled: ready,
  });
  const catalog = useQuery({
    queryKey: ['school-iam-cat'],
    queryFn: fetchSchoolIamCatalog,
    enabled: ready,
  });
  const roles = useQuery({
    queryKey: ['school-iam-roles'],
    queryFn: fetchSchoolIamRoles,
    enabled: ready,
  });
  const users = useQuery({
    queryKey: [
      'school-iam-users',
      search,
      status || statusFromPath,
      role,
      sectionId,
      listPage,
      pageSize,
    ],
    queryFn: () =>
      fetchSchoolIamUsers({
        search,
        status: status || statusFromPath,
        role,
        sectionId: sectionId || undefined,
        page: listPage,
        limit: pageSize,
      }),
    enabled: ready && usersListPage,
  });
  const classes = useQuery({
    queryKey: ['school-sis-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled: ready && usersListPage,
  });
  const invites = useQuery({
    queryKey: ['school-iam-invites'],
    queryFn: fetchSchoolIamInvites,
    enabled: ready && page.includes('invitation'),
  });
  const sessions = useQuery({
    queryKey: ['school-iam-sessions'],
    queryFn: fetchSchoolIamSessions,
    enabled: ready && page.includes('session'),
  });
  const logins = useQuery({
    queryKey: ['school-iam-logins'],
    queryFn: fetchSchoolIamLogins,
    enabled: ready && page.includes('login'),
  });
  const audits = useQuery({
    queryKey: ['school-iam-audit'],
    queryFn: fetchSchoolIamAudit,
    enabled: ready && page.includes('audit'),
  });
  const alerts = useQuery({
    queryKey: ['school-iam-alerts'],
    queryFn: fetchSchoolIamAlerts,
    enabled: ready && page.includes('security'),
  });
  const security = useQuery({
    queryKey: ['school-iam-sec'],
    queryFn: fetchSchoolIamSecurity,
    enabled: ready && page.includes('security'),
  });
  const detail = useQuery({
    queryKey: ['school-iam-user', drawerId],
    queryFn: () => fetchSchoolIamUser(drawerId!),
    enabled: !!drawerId,
  });
  const people = useQuery({
    queryKey: ['school-iam-people', personQ],
    queryFn: () => fetchSchoolIamLinkOptions(personQ),
    enabled: ready && wizard && personQ.trim().length >= 2,
  });
  const directory = useQuery({
    queryKey: ['school-iam-directory'],
    queryFn: fetchSchoolIamDirectoryPreview,
    enabled: ready && directoryOpen,
  });

  const dashPayload = (dash.data ?? {}) as {
    kpis?: Record<string, number>;
    data?: { kpis?: Record<string, number> };
  };
  const kpis = dashPayload.kpis ?? dashPayload.data?.kpis ?? {};
  const userRows = iamUserItems(users.data);
  const usersTotal =
    users.data && typeof users.data === 'object'
      ? Number((users.data as { total?: number }).total ?? userRows.length)
      : userRows.length;
  const usersPageCount = Math.max(1, Math.ceil(usersTotal / pageSize));
  const modules = ((
    catalog.data as {
      modules?: Array<{
        id: string;
        label: string;
        actions: Array<{ slug: string; label: string }>;
      }>;
    }
  )?.modules ?? []) as Array<{
    id: string;
    label: string;
    actions: Array<{ slug: string; label: string }>;
  }>;

  const run = async (fn: () => Promise<unknown>, ok = 'Saved') => {
    try {
      const res = await fn();
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ['school-iam'] });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['school-iam-users'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-roles'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-dash'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-user'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-invites'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-sessions'] }),
        qc.invalidateQueries({ queryKey: ['school-iam-directory'] }),
      ]);
      return res;
    } catch (e) {
      setNotice(apiErrorMessage(e));
      throw e;
    }
  };

  useEffect(() => {
    setListPage(1);
    setSelected([]);
  }, [search, status, role, sectionId, pageSize, statusFromPath]);

  const loginNamesSynced = useRef(false);
  useEffect(() => {
    if (!ready || !manage || !usersListPage || loginNamesSynced.current) return;
    loginNamesSynced.current = true;
    void syncSchoolIamLoginNames()
      .then((res) => {
        if (res.updated) {
          setNotice(
            `Login names updated for ${res.updated} accounts. Students can sign in with admission or roll number.`,
          );
        }
        return qc.invalidateQueries({ queryKey: ['school-iam-users'] });
      })
      .catch(() => {
        loginNamesSynced.current = false;
      });
  }, [ready, manage, usersListPage, qc]);

  const seed = useMutation({
    mutationFn: () => run(seedSchoolIamRoles, 'Default school roles seeded'),
  });

  const askReset = (u: {
    id: string;
    displayName?: unknown;
    email?: unknown;
    username?: unknown;
  }) => {
    const name = String(u.displayName || u.email || 'this user');
    setConfirm({
      title: `Reset password for ${name}?`,
      body: 'This signs them out of every session and sets a unique temporary password. Copy it once. There is no shared school password.',
      ok: 'Password reset',
      okLabel: 'Reset password',
      run: async () => {
        const r = await resetSchoolIamPassword(String(u.id));
        setRevealed({
          name,
          username: r.username ?? (u.username ? String(u.username) : null),
          email: r.email ?? (u.email ? String(u.email) : undefined),
          password: revealPassword(r),
          defaultUsed: r.defaultUsed !== false,
        });
        return r;
      },
    });
  };

  const openAddUser = () => {
    setWizardStep(0);
    setForm({
      source: 'manual',
      displayName: '',
      email: '',
      username: '',
      phone: '',
      roleSlugs: ['teacher'],
      invite: false,
      passwordMode: 'default',
      password: '',
      staffId: '',
      studentId: '',
    });
    setPersonQ('');
    setWizard(true);
  };

  const kpiCards = [
    {
      key: 'total',
      label: 'Total Users',
      sub: 'All registered users',
      href: '/admin/school-sis/users',
      value: kpis.total,
      wrap: 'bg-blue-50/80',
      iconWrap: 'bg-blue-100 text-blue-700',
      icon: 'users',
    },
    {
      key: 'active',
      label: 'Active',
      sub: 'Currently active',
      href: '/admin/school-sis/users/active',
      value: kpis.active,
      wrap: 'bg-emerald-50/80',
      iconWrap: 'bg-emerald-100 text-emerald-700',
      icon: 'active',
    },
    {
      key: 'invited',
      label: 'Pending Invites',
      sub: 'Awaiting activation',
      href: '/admin/school-sis/users/invitations',
      value: kpis.invited,
      wrap: 'bg-amber-50/80',
      iconWrap: 'bg-amber-100 text-amber-700',
      icon: 'invite',
    },
    {
      key: 'suspended',
      label: 'Suspended',
      sub: 'Temporarily blocked',
      href: '/admin/school-sis/users/suspended',
      value: kpis.suspended,
      wrap: 'bg-rose-50/80',
      iconWrap: 'bg-rose-100 text-rose-700',
      icon: 'suspend',
    },
    {
      key: 'locked',
      label: 'Locked',
      sub: 'Locked accounts',
      href: '/admin/school-sis/users/locked',
      value: kpis.locked,
      wrap: 'bg-violet-50/80',
      iconWrap: 'bg-violet-100 text-violet-700',
      icon: 'lock',
    },
    {
      key: 'sessions',
      label: 'Active Sessions',
      sub: 'Users online now',
      href: '/admin/school-sis/users/sessions',
      value: kpis.sessions,
      wrap: 'bg-cyan-50/80',
      iconWrap: 'bg-cyan-100 text-cyan-700',
      icon: 'monitor',
    },
    {
      key: 'mfaOn',
      label: 'MFA Enabled',
      sub: 'Two-factor auth',
      href: '/admin/school-sis/users/security',
      value: kpis.mfaOn,
      wrap: 'bg-teal-50/80',
      iconWrap: 'bg-teal-100 text-teal-700',
      icon: 'shield',
    },
    {
      key: 'failedLogins',
      label: 'Failed Logins (24h)',
      sub: 'Security events',
      href: '/admin/school-sis/users/security',
      value: kpis.failedLogins,
      wrap: 'bg-red-50/80',
      iconWrap: 'bg-red-100 text-red-700',
      icon: 'audit',
    },
  ];

  const badge = (st: string) => (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        st === 'active' && 'bg-emerald-50 text-emerald-800',
        st === 'invited' && 'bg-sky-50 text-sky-800',
        st === 'pending' && 'bg-sky-50 text-sky-800',
        st === 'suspended' && 'bg-amber-50 text-amber-800',
        st === 'locked' && 'bg-rose-50 text-rose-800',
        (st === 'disabled' || !st) && 'bg-slate-100 text-slate-600',
      )}
    >
      {st === 'active' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
      {st ? st.charAt(0).toUpperCase() + st.slice(1) : '—'}
    </span>
  );

  return (
    <div className="space-y-4 p-4 md:p-6" style={{ background: '#f4f7fb', minHeight: '100%' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a8a] text-white shadow-sm">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Users &amp; Access</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              School identity, roles, sessions and security — not a college portal. Students sign in
              with admission number (SLS/2026/0001) or roll number (SLS26-0001). Staff use employee
              code.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={() =>
              setNotice(
                'Students sign in with admission or roll number. Staff use employee code. There is no shared school password.',
              )
            }
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
              ?
            </span>
            Help
          </button>
          {manage ? (
            <button
              type="button"
              onClick={openAddUser}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#172e6f]"
            >
              + Add User
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {LINKS.map((l) => {
          const on =
            path === l.href || (l.href !== '/admin/school-sis/users' && path.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium',
                on ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <TabIcon name={l.icon} active={on} />
              {l.label}
            </Link>
          );
        })}
      </div>

      {notice ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {kpiCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={cn(
              'rounded-2xl border border-white/70 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
              card.wrap,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
              <span
                className={cn('flex h-8 w-8 items-center justify-center rounded-xl', card.iconWrap)}
              >
                <TabIcon name={card.icon} />
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {card.value ?? '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{card.sub}</p>
          </Link>
        ))}
      </div>

      {usersListPage ? (
        <Panel className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[16rem] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </span>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                placeholder="Search by name, email, username or mobile number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {['active', 'invited', 'suspended', 'locked', 'disabled'].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">All roles</option>
              {(roles.data ?? []).map((r) => (
                <option key={String(r.slug)} value={String(r.slug)}>
                  {String(r.name)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">All classes</option>
              {(classes.data?.sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.grade.name} {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium',
                moreFilters
                  ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
              onClick={() => setMoreFilters((v) => !v)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 5h18M6 12h12M10 19h4" />
              </svg>
              More Filters
            </button>
            {manage ? (
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const rows = userRows;
                  const header =
                    'Name,Email,Username,Admission,Roll,Class,Status,Roles,LastLogin,MFA';
                  const body = rows
                    .map((u) =>
                      [
                        u.displayName,
                        u.email,
                        u.username,
                        u.admissionNumber,
                        u.rollNumber,
                        u.classLabel,
                        u.accountStatus,
                        ((u.roles as Array<{ name: string }>) ?? []).map((r) => r.name).join('|'),
                        u.lastLoginAt ?? '',
                        u.mfaEnabled ? 'yes' : 'no',
                      ]
                        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                        .join(','),
                    )
                    .join('\n');
                  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'school-users.csv';
                  a.click();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
                </svg>
                Export CSV
              </button>
            ) : null}
            {manage && selected.length ? (
              <>
                <GhostButton
                  onClick={() => run(() => bulkSchoolIam(selected, 'activate'), 'Activated')}
                >
                  Activate
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => bulkSchoolIam(selected, 'suspend'), 'Suspended')}
                >
                  Suspend
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => bulkSchoolIam(selected, 'logout'), 'Sessions ended')}
                >
                  Logout
                </GhostButton>
                <GhostButton
                  onClick={() =>
                    setConfirm({
                      title: `Reset ${selected.length} passwords?`,
                      body: 'Selected accounts will be signed out. Unique temporary passwords are generated. There is no shared school password.',
                      ok: 'Passwords reset',
                      okLabel: 'Reset selected',
                      run: () => bulkSchoolIam(selected, 'reset-password'),
                    })
                  }
                >
                  Reset passwords
                </GhostButton>
              </>
            ) : null}
          </div>
          {moreFilters && manage ? (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
              <GhostButton
                onClick={() =>
                  void run(
                    () => syncSchoolIamLoginNames(),
                    'Login names set from admission / roll / employee code',
                  )
                }
              >
                Set login names
              </GhostButton>
              <GhostButton onClick={() => seed.mutate()}>Seed default roles</GhostButton>
              <GhostButton onClick={() => setInvite(true)}>Invite</GhostButton>
              <GhostButton onClick={() => setImportOpen(true)}>Import Excel</GhostButton>
              <GhostButton onClick={() => setDirectoryOpen(true)}>
                Add all students &amp; staff
              </GhostButton>
            </div>
          ) : null}
          <div className="overflow-auto">
            <table className="w-full min-w-[70rem] text-left text-sm">
              <thead className="sticky top-0 bg-[#f8fafc] text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3" />
                  <th className="p-3">User</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Admission / Roll</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3">MFA</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((u) => {
                  const id = String(u.id);
                  const rolesList = (u.roles as Array<{ name: string }>) ?? [];
                  const name = String(u.displayName || u.email || '?');
                  const initials = initialsOf(name);
                  const online = isRecentlyOnline(u.lastLoginAt);
                  return (
                    <tr key={id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked ? [...s, id] : s.filter((x) => x !== id),
                            )
                          }
                        />
                      </td>
                      <td className="p-3">
                        <button
                          className="flex items-center gap-3 text-left"
                          onClick={() => setDrawerId(id)}
                        >
                          <span
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              avatarTone(name),
                            )}
                          >
                            {initials}
                          </span>
                          <span>
                            <span className="block font-semibold uppercase tracking-wide text-slate-900">
                              {name}
                            </span>
                            <span className="block text-xs text-slate-500">{String(u.email)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {u.username ? String(u.username) : '—'}
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        {u.admissionNumber || u.rollNumber || u.employeeCode ? (
                          <span className="block">
                            {u.admissionNumber ? (
                              <span className="block font-mono">{String(u.admissionNumber)}</span>
                            ) : null}
                            {u.rollNumber ? (
                              <span className="block font-mono text-slate-500">
                                {String(u.rollNumber)}
                              </span>
                            ) : null}
                            {u.employeeCode && !u.admissionNumber ? (
                              <span className="font-mono">{String(u.employeeCode)}</span>
                            ) : null}
                            {u.classLabel ? (
                              <span className="mt-0.5 block text-[11px] text-slate-400">
                                {String(u.classLabel)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {rolesList.length
                            ? rolesList.map((r) => (
                                <span
                                  key={r.name}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                                    roleChipClass(r.name),
                                  )}
                                >
                                  {r.name.toLowerCase().includes('student') ? '🎓 ' : null}
                                  {r.name}
                                </span>
                              ))
                            : '—'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {badge(String(u.accountStatus))}
                          {u.mustResetPassword ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Must change
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        {u.lastLoginAt ? (
                          <span>
                            <span className="block">
                              {new Date(String(u.lastLoginAt)).toLocaleString()}
                            </span>
                            {online ? (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Online
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{u.mfaEnabled ? '✓' : '—'}</td>
                      <td className="p-3 text-right">
                        <div className="relative flex items-center justify-end gap-1">
                          {manage ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => askReset({ ...u, id })}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M21 2l-2 2m-7.4 7.4a5 5 0 1 1-2 2L13 17h3v3h3v-3h2l-7.4-7.6" />
                              </svg>
                              Reset Password
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            onClick={() => setRowMenuId((cur) => (cur === id ? null : id))}
                          >
                            ⋮
                          </button>
                          {rowMenuId === id ? (
                            <div className="absolute right-0 top-9 z-20 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 text-left text-sm shadow-lg">
                              <button
                                className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() => {
                                  setRowMenuId(null);
                                  setDrawerId(id);
                                }}
                              >
                                Open
                              </button>
                              {manage ? (
                                <>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                    onClick={() => {
                                      setRowMenuId(null);
                                      void run(
                                        () => setSchoolIamStatus(id, 'suspended'),
                                        'Suspended',
                                      );
                                    }}
                                  >
                                    Suspend
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                    onClick={() => {
                                      setRowMenuId(null);
                                      void run(() => logoutSchoolIamUser(id), 'Sessions ended');
                                    }}
                                  >
                                    End sessions
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.isError ? (
            <p className="p-6 text-sm text-rose-700">{apiErrorMessage(users.error)}</p>
          ) : users.isLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading users…</p>
          ) : !userRows.length ? (
            <p className="p-6 text-sm text-slate-500">No users match the current filters.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span>
                Showing {(listPage - 1) * pageSize + 1}–{Math.min(listPage * pageSize, usersTotal)}{' '}
                of {usersTotal} users
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                    disabled={listPage <= 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  >
                    «
                  </button>
                  {pagerItems(listPage, usersPageCount).map((item, i) =>
                    item === '…' ? (
                      <span key={`e${i}`} className="px-1">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setListPage(item)}
                        className={cn(
                          'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold',
                          item === listPage
                            ? 'bg-[#1e3a8a] text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                    disabled={listPage >= usersPageCount}
                    onClick={() => setListPage((p) => Math.min(usersPageCount, p + 1))}
                  >
                    »
                  </button>
                </div>
                <label className="inline-flex items-center gap-2">
                  Rows per page
                  <select
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
        </Panel>
      ) : null}

      {page.includes('roles') ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(roles.data ?? []).map((r) => (
            <Panel key={String(r.id)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{String(r.name)}</h3>
                  <p className="text-xs text-slate-500">{String(r.description || r.slug)}</p>
                </div>
                {r.isSystem ? <span className="text-xs text-slate-500">System</span> : null}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {String(r.userCount)} users · {((r.permissions as string[]) ?? []).length}{' '}
                permissions
              </p>
              {manage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton onClick={() => setRoleEdit(r)}>Permissions</GhostButton>
                  <GhostButton
                    onClick={() => run(() => cloneSchoolIamRole(String(r.id)), 'Cloned')}
                  >
                    Clone
                  </GhostButton>
                  {!r.isSystem ? (
                    <GhostButton
                      onClick={() =>
                        setConfirm({
                          title: 'Deactivate role',
                          body: 'Only unused roles can be removed.',
                          run: () => deleteSchoolIamRole(String(r.id)),
                        })
                      }
                    >
                      Deactivate
                    </GhostButton>
                  ) : null}
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      ) : null}

      {page.includes('permissions') ? (
        <Panel className="overflow-auto p-4">
          <p className="mb-3 text-sm text-slate-500">
            Fine-grained school permissions. Assign them on a role. `school-sis:manage` still grants
            everything.
          </p>
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="p-2">Module</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2 font-medium">{m.label}</td>
                  <td className="p-2">
                    {m.actions.map((a) => (
                      <code
                        key={a.slug}
                        className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                      >
                        {a.slug}
                      </code>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {page.includes('invitation') ? (
        <Panel className="p-4">
          {(invites.data ?? []).map((i) => (
            <div
              key={String(i.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
            >
              <span>
                {String(i.email)} · {String(i.status)}
              </span>
              {manage ? (
                <span className="flex gap-2">
                  <GhostButton
                    onClick={() =>
                      run(() => resendSchoolIamInvite(String(i.id)), 'Invitation resent')
                    }
                  >
                    Resend
                  </GhostButton>
                  <GhostButton
                    onClick={() =>
                      run(() => revokeSchoolIamInvite(String(i.id)), 'Invitation revoked')
                    }
                  >
                    Revoke
                  </GhostButton>
                </span>
              ) : null}
            </div>
          ))}
          {!invites.data?.length ? (
            <p className="text-sm text-slate-500">No pending invitations.</p>
          ) : null}
        </Panel>
      ) : null}

      {page.includes('session') ? (
        <Panel className="overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">IP</th>
                <th className="p-2 text-left">Device</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {(sessions.data ?? []).map((s) => (
                <tr key={String(s.id)} className="border-t">
                  <td className="p-2">
                    {String(
                      (s.user as { displayName?: string; email?: string })?.displayName ||
                        (s.user as { email?: string })?.email,
                    )}
                  </td>
                  <td className="p-2">{String(s.ipAddress || '—')}</td>
                  <td className="p-2 text-xs">{String(s.userAgent || '').slice(0, 80)}</td>
                  <td className="p-2 text-right">
                    {manage ? (
                      <GhostButton
                        onClick={() =>
                          run(() => killSchoolIamSession(String(s.id)), 'Session ended')
                        }
                      >
                        Logout
                      </GhostButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {page.includes('login') ? (
        <Panel className="p-4 text-sm">
          {(logins.data ?? []).map((e) => (
            <div key={String(e.id)} className="flex justify-between border-b py-2">
              <span>
                {String((e.user as { email?: string })?.email || e.identifier)} ·{' '}
                {String(e.outcome)}
              </span>
              <span className="text-slate-500">
                {new Date(String(e.createdAt)).toLocaleString()}
              </span>
            </div>
          ))}
        </Panel>
      ) : null}

      {page.includes('audit') ? (
        <Panel className="p-4 text-sm">
          {(audits.data ?? []).map((e) => (
            <div key={String(e.id)} className="border-b py-2">
              <div className="font-medium">{String(e.action)}</div>
              <div className="text-xs text-slate-500">
                {(e.user as { email?: string })?.email} ·{' '}
                {new Date(String(e.createdAt)).toLocaleString()}
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {page.includes('security') ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel className="p-4">
            <h3 className="mb-3 font-semibold">Password &amp; MFA policy</h3>
            <label className="mb-2 block text-sm">
              Minimum length
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={Number(security.data?.minPasswordLength ?? 8)}
                onBlur={(e) =>
                  run(() => saveSchoolIamSecurity({ minPasswordLength: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={Boolean(security.data?.mfaEnforced)}
                onChange={(e) =>
                  run(() => saveSchoolIamSecurity({ mfaEnforced: e.target.checked }))
                }
              />
              Require MFA for configured admin roles
            </label>
          </Panel>
          <Panel className="p-4">
            <h3 className="mb-3 font-semibold">Security alerts</h3>
            {(alerts.data ?? []).map((a) => (
              <div key={String(a.id)} className="border-b py-2 text-sm">
                <span className="mr-1 text-xs font-semibold">{String(a.kind)}</span>{' '}
                {String(a.message)}
              </div>
            ))}
          </Panel>
        </div>
      ) : null}

      {drawerId && detail.data ? (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l bg-white p-4 shadow-xl">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">
              {String(detail.data.displayName || detail.data.email)}
            </h2>
            <button onClick={() => setDrawerId(null)}>✕</button>
          </div>
          <p className="text-sm text-slate-500">{String(detail.data.email)}</p>
          {detail.data.username ? (
            <p className="font-mono text-xs text-slate-600">
              Username {String(detail.data.username)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {badge(String(detail.data.accountStatus))}
            {detail.data.mustResetPassword ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                Must change password
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Roles:{' '}
            {((detail.data.roles as Array<{ name: string }>) ?? []).map((r) => r.name).join(', ') ||
              '—'}
          </p>
          <p className="mt-1 text-xs">
            MFA {detail.data.mfaEnabled ? 'enabled' : 'off'} · Last login{' '}
            {detail.data.lastLoginAt
              ? new Date(String(detail.data.lastLoginAt)).toLocaleString()
              : 'never'}
          </p>
          <div className="mt-4 space-y-2">
            {manage ? (
              <>
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-3">
                  <p className="text-sm font-semibold text-slate-900">Forgot password</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Reset sets a temporary password, signs the user out, and requires a change on
                    next login. Share it only with that person.
                  </p>
                  <input
                    className="mt-2 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                    placeholder="Custom password (optional — otherwise a unique password is generated)"
                    value={customReset}
                    onChange={(e) => setCustomReset(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PrimaryButton
                      onClick={() =>
                        setConfirm({
                          title: 'Reset to school default?',
                          body: 'A unique temporary password will be generated. All sessions end. Copy it once.',
                          ok: 'Password reset',
                          okLabel: 'Use school default',
                          run: async () => {
                            const r = await resetSchoolIamPassword(drawerId);
                            setRevealed({
                              name: String(detail.data.displayName || detail.data.email),
                              username: r.username ?? String(detail.data.username ?? ''),
                              email: r.email ?? String(detail.data.email),
                              password: revealPassword(r),
                              defaultUsed: true,
                            });
                            setCustomReset('');
                            return r;
                          },
                        })
                      }
                    >
                      Generate unique password
                    </PrimaryButton>
                    <GhostButton
                      onClick={() =>
                        setConfirm({
                          title: 'Generate a temporary password?',
                          body: 'A one-time password will be created. Show it to the user once, then they must change it.',
                          ok: 'Password reset',
                          okLabel: 'Generate password',
                          run: async () => {
                            const r = await resetSchoolIamPassword(drawerId, { generate: true });
                            setRevealed({
                              name: String(detail.data.displayName || detail.data.email),
                              username: r.username ?? String(detail.data.username ?? ''),
                              email: r.email ?? String(detail.data.email),
                              password: revealPassword(r),
                              defaultUsed: false,
                            });
                            return r;
                          },
                        })
                      }
                    >
                      Generate password
                    </GhostButton>
                    {customReset.trim().length >= 8 ? (
                      <GhostButton
                        onClick={() =>
                          setConfirm({
                            title: 'Set this custom password?',
                            body: 'The user must change it after they sign in.',
                            ok: 'Password reset',
                            okLabel: 'Set custom password',
                            run: async () => {
                              const r = await resetSchoolIamPassword(drawerId, {
                                password: customReset.trim(),
                              });
                              setRevealed({
                                name: String(detail.data.displayName || detail.data.email),
                                username: r.username ?? String(detail.data.username ?? ''),
                                email: r.email ?? String(detail.data.email),
                                password: revealPassword(r),
                                defaultUsed: false,
                              });
                              setCustomReset('');
                              return r;
                            },
                          })
                        }
                      >
                        Set custom
                      </GhostButton>
                    ) : null}
                  </div>
                </div>
                <GhostButton
                  onClick={() => run(() => setSchoolIamStatus(drawerId, 'active'), 'Activated')}
                >
                  Activate
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => setSchoolIamStatus(drawerId, 'suspended'), 'Suspended')}
                >
                  Suspend
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => setSchoolIamStatus(drawerId, 'locked'), 'Locked')}
                >
                  Lock
                </GhostButton>
                <GhostButton
                  onClick={() => run(() => logoutSchoolIamUser(drawerId), 'Sessions revoked')}
                >
                  Logout all sessions
                </GhostButton>
                <div className="rounded border p-2">
                  <p className="text-xs font-medium">Assign roles</p>
                  <select
                    multiple
                    className="mt-1 h-24 w-full rounded border text-sm"
                    defaultValue={((detail.data.roles as Array<{ slug: string }>) ?? []).map(
                      (r) => r.slug,
                    )}
                    onBlur={(e) => {
                      const slugs = Array.from(e.target.selectedOptions).map((o) => o.value);
                      void run(() => assignSchoolIamRoles(drawerId, slugs), 'Roles updated');
                    }}
                  >
                    {(roles.data ?? []).map((r) => (
                      <option key={String(r.slug)} value={String(r.slug)}>
                        {String(r.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs font-medium">Permission test</p>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={testPerm}
                    onChange={(e) => setTestPerm(e.target.value)}
                  />
                  <GhostButton
                    onClick={async () => {
                      const r = await testSchoolIamAccess(drawerId, testPerm);
                      setNotice(JSON.stringify(r));
                    }}
                  >
                    Why can they access this?
                  </GhostButton>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs font-medium">Impersonate (Super Admin)</p>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    placeholder="Required reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <GhostButton
                    onClick={() =>
                      setConfirm({
                        title: 'Impersonate this user?',
                        body: 'This is audited. A banner will show you are impersonating.',
                        run: async () => {
                          const current = useAuthStore.getState().session;
                          if (current) storeAdminSessionBackup(current);
                          const tokens = await impersonateSchoolIamUser(drawerId, reason);
                          useAuthStore.getState().setSession(tokens as never);
                          window.location.href = '/admin';
                          return tokens;
                        },
                      })
                    }
                  >
                    Login as user
                  </GhostButton>
                </div>
              </>
            ) : null}
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Effective permissions</h3>
            <div className="mt-1 max-h-40 overflow-auto text-xs">
              {((detail.data.effectivePermissions as string[]) ?? []).map((p) => (
                <div key={p}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={wizard}
        onOpenChange={(open) => {
          setWizard(open);
          if (open) setWizardStep(0);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create portal user</DialogTitle>
            <DialogDescription>
              Link a student or staff record, or create a manual account. Default password is used
              unless you send an invite.
            </DialogDescription>
          </DialogHeader>
          <ol className="mb-4 grid grid-cols-6 gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">
            {['Person', 'Account', 'Role', 'Scope', 'Password', 'Confirm'].map((label, i) => (
              <li
                key={label}
                className={
                  i === wizardStep
                    ? 'rounded-full bg-[#2563eb] px-2 py-1 text-center text-white'
                    : i < wizardStep
                      ? 'rounded-full bg-sky-50 px-2 py-1 text-center text-sky-800'
                      : 'rounded-full bg-slate-100 px-2 py-1 text-center'
                }
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>
          {wizardStep === 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(['student', 'staff', 'manual'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize ${
                      form.source === src
                        ? 'border-[#2563eb] bg-sky-50 text-[#1e3a8a]'
                        : 'border-slate-200 bg-white'
                    }`}
                    onClick={() =>
                      setForm({
                        ...form,
                        source: src,
                        roleSlugs: [
                          src === 'student'
                            ? 'school-student'
                            : src === 'staff'
                              ? 'teacher'
                              : form.roleSlugs[0],
                        ],
                        studentId: src === 'student' ? form.studentId : '',
                        staffId: src === 'staff' ? form.staffId : '',
                      })
                    }
                  >
                    {src === 'manual'
                      ? 'Manual'
                      : src === 'student'
                        ? 'From student'
                        : 'From staff'}
                  </button>
                ))}
              </div>
              {form.source !== 'manual' ? (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    Search {form.source}
                    <input
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      placeholder={
                        form.source === 'student'
                          ? 'Name or admission number'
                          : 'Name, employee code or email'
                      }
                      value={personQ}
                      onChange={(e) => setPersonQ(e.target.value)}
                    />
                  </label>
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {form.source === 'student'
                      ? (people.data?.students ?? []).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                              form.studentId === s.id
                                ? 'border-[#2563eb] bg-sky-50'
                                : 'border-slate-100 bg-white'
                            }`}
                            onClick={() =>
                              setForm({
                                ...form,
                                studentId: s.id,
                                staffId: '',
                                displayName: s.fullName,
                                username: s.rollNumber || s.admissionNumber,
                                email: s.email || '',
                                phone: (s as { phone?: string }).phone || '',
                                roleSlugs: ['school-student'],
                              })
                            }
                          >
                            <span className="font-medium">{s.fullName}</span>
                            <span className="ml-2 text-slate-500">
                              {s.admissionNumber}
                              {s.rollNumber ? ` · ${s.rollNumber}` : ''}
                            </span>
                          </button>
                        ))
                      : (people.data?.staff ?? []).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                              form.staffId === s.id
                                ? 'border-[#2563eb] bg-sky-50'
                                : 'border-slate-100 bg-white'
                            }`}
                            onClick={() =>
                              setForm({
                                ...form,
                                staffId: s.id,
                                studentId: '',
                                displayName: s.fullName,
                                username: s.employeeCode,
                                email: s.email || '',
                                phone: (s as { phone?: string }).phone || '',
                                roleSlugs: ['teacher'],
                              })
                            }
                          >
                            <span className="font-medium">{s.fullName}</span>
                            <span className="ml-2 text-slate-500">{s.employeeCode}</span>
                          </button>
                        ))}
                  </div>
                </>
              ) : null}
              <label className="block text-sm font-medium text-slate-700">
                Full name
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mobile
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
            </div>
          ) : null}
          {wizardStep === 1 ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="Required for login"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Username
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="Admission no. or employee code"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </label>
            </div>
          ) : null}
          {wizardStep === 2 ? (
            <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
              {(roles.data ?? []).map((r) => {
                const slug = String(r.slug);
                const selected = form.roleSlugs[0] === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    className={`rounded-xl border p-3 text-left ${
                      selected ? 'border-[#2563eb] bg-sky-50' : 'border-slate-200 bg-white'
                    }`}
                    onClick={() => setForm({ ...form, roleSlugs: [slug] })}
                  >
                    <p className="text-sm font-semibold">{String(r.name)}</p>
                    <p className="text-xs text-slate-500">{slug}</p>
                  </button>
                );
              })}
            </div>
          ) : null}
          {wizardStep === 3 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {form.studentId
                ? 'This login will be linked to the selected student record. The student will only see their own data in the app.'
                : form.staffId
                  ? 'This login will be linked to the selected staff record. Class scope follows class-teacher assignments.'
                  : 'You can link a student or staff record later from the user drawer.'}
            </p>
          ) : null}
          {wizardStep === 4 ? (
            <div className="space-y-3">
              {[
                {
                  id: 'default' as const,
                  title: 'Unique generated password',
                  body: 'A one-time password is created. Students should use Activate Your Account in the app instead.',
                },
                {
                  id: 'invite' as const,
                  title: 'Send invitation',
                  body: 'User sets their own password from the invite link.',
                },
                {
                  id: 'custom' as const,
                  title: 'Custom temporary password',
                  body: 'Enter a password that meets school policy.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                    form.passwordMode === opt.id ? 'border-[#2563eb] bg-sky-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={form.passwordMode === opt.id}
                    onChange={() =>
                      setForm({ ...form, passwordMode: opt.id, invite: opt.id === 'invite' })
                    }
                  />
                  <span>
                    <span className="block text-sm font-semibold">{opt.title}</span>
                    <span className="text-xs text-slate-500">{opt.body}</span>
                  </span>
                </label>
              ))}
              {form.passwordMode === 'custom' ? (
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              ) : null}
            </div>
          ) : null}
          {wizardStep === 5 ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-lg font-semibold text-slate-900">{form.displayName || '—'}</p>
              <p>{form.email || 'Email missing'}</p>
              <p>Username: {form.username || '—'}</p>
              <p>Role: {form.roleSlugs[0]}</p>
              <p>
                {form.passwordMode === 'invite'
                  ? 'An invitation will be issued.'
                  : `Password: ${form.passwordMode === 'default' ? 'unique generated (shown once)' : form.password} (must change on first login)`}
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-3 border-t border-slate-200 pt-4 sm:justify-end">
            <GhostButton
              type="button"
              onClick={() => (wizardStep === 0 ? setWizard(false) : setWizardStep((s) => s - 1))}
            >
              {wizardStep === 0 ? 'Cancel' : 'Back'}
            </GhostButton>
            {wizardStep < 5 ? (
              <PrimaryButton
                type="button"
                className="min-w-[7rem] bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  if (wizardStep === 0 && !form.displayName.trim()) {
                    setNotice('Enter a full name.');
                    return;
                  }
                  if (wizardStep === 1 && !form.email.includes('@')) {
                    setNotice('Enter a valid email.');
                    return;
                  }
                  setWizardStep((s) => s + 1);
                }}
              >
                Next
              </PrimaryButton>
            ) : (
              <PrimaryButton
                type="button"
                className="min-w-[8rem] bg-slate-900 text-white hover:bg-slate-800"
                onClick={async () => {
                  const payload = {
                    displayName: form.displayName,
                    email: form.email,
                    username: form.username || undefined,
                    phone: form.phone || undefined,
                    roleSlugs: form.roleSlugs,
                    invite: form.passwordMode === 'invite',
                    mustResetPassword: form.passwordMode !== 'invite',
                    password:
                      form.passwordMode === 'invite'
                        ? undefined
                        : form.passwordMode === 'default'
                          ? undefined
                          : form.password,
                    staffId: form.staffId || undefined,
                    studentId: form.studentId || undefined,
                    accountStatus: form.passwordMode === 'invite' ? 'invited' : 'active',
                  };
                  const res = (await run(() => createSchoolIamUser(payload), 'User created')) as {
                    inviteToken?: string;
                    plainPassword?: string;
                  };
                  setWizard(false);
                  if (res?.inviteToken)
                    setNotice(`Invitation token (share securely): ${res.inviteToken}`);
                  else
                    setNotice(
                      `Account created. Password: ${payload.password ?? res?.plainPassword ?? 'generated'}. Must be changed on first login.`,
                    );
                }}
              >
                Create user
              </PrimaryButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={directoryOpen} onOpenChange={setDirectoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add all students and staff</DialogTitle>
            <DialogDescription>
              Creates portal logins for every active student and staff member who does not already
              have one.
            </DialogDescription>
          </DialogHeader>
          {directory.isLoading ? <p className="text-sm text-slate-500">Counting records…</p> : null}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Students</p>
              <p className="text-xl font-semibold">
                {directory.data?.studentsMissing ?? '—'} / {directory.data?.studentsTotal ?? '—'}
              </p>
              <p className="text-xs text-slate-500">without a login</p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Staff</p>
              <p className="text-xl font-semibold">
                {directory.data?.staffMissing ?? '—'} / {directory.data?.staffTotal ?? '—'}
              </p>
              <p className="text-xs text-slate-500">without a login</p>
            </div>
          </div>
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
            New student logins are <strong>not given a shared password</strong>. Students activate
            the app with OTP or a one-time school activation code from Account Security.
          </p>
          <DialogFooter className="gap-3 border-t border-slate-200 pt-4 sm:justify-end">
            <GhostButton type="button" onClick={() => setDirectoryOpen(false)}>
              Cancel
            </GhostButton>
            <PrimaryButton
              type="button"
              className="min-w-[11rem] bg-slate-900 text-white hover:bg-slate-800"
              onClick={() =>
                setConfirm({
                  title: 'Create portal accounts for everyone?',
                  body: `This will create logins for ${directory.data?.studentsMissing ?? 0} students and ${directory.data?.staffMissing ?? 0} staff. Students must activate in the school app. No shared default password is created.`,
                  ok: 'Accounts ready. Students use Activate Your Account in the app.',
                  okLabel: 'Yes, create accounts',
                  run: async () => {
                    const totals = {
                      created: 0,
                      linked: 0,
                      skipped: 0,
                      failed: 0,
                      defaultPassword: null as string | null,
                    };
                    for (;;) {
                      const batch = await provisionSchoolIamDirectory({
                        confirm: true,
                        includeStudents: true,
                        includeStaff: true,
                        limit: 40,
                      });
                      totals.created += batch.created;
                      totals.linked += batch.linked;
                      totals.skipped += batch.skipped;
                      totals.failed += batch.failed.length;
                      totals.defaultPassword = batch.defaultPassword;
                      setDirectoryProgress(
                        `Created ${totals.created}, linked ${totals.linked}. ${batch.remaining} remaining…`,
                      );
                      if (batch.done) break;
                      if (batch.created + batch.linked + batch.skipped === 0) break;
                    }
                    setDirectoryOpen(false);
                    await qc.invalidateQueries({ queryKey: ['school-iam'] });
                    await qc.invalidateQueries({ queryKey: ['school-iam-directory'] });
                    await qc.invalidateQueries({ queryKey: ['school-iam-users'] });
                    return totals;
                  },
                })
              }
            >
              Next: create accounts
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
            <DialogDescription>
              Paste CSV with header: Full Name, Username, Email, Mobile, Employee ID, User Type,
              Role, Department, Status
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="h-40 w-full rounded border p-2 font-mono text-xs"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importPreview ? (
            <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
              {JSON.stringify(importPreview, null, 2)}
            </pre>
          ) : null}
          <DialogFooter>
            <GhostButton
              onClick={() => {
                const header =
                  'Full Name,Username,Email,Mobile,Employee ID,User Type,Role,Department,Status';
                const blob = new Blob([`${header}\n`], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'school-users-template.csv';
                a.click();
              }}
            >
              Template
            </GhostButton>
            <GhostButton
              onClick={async () => {
                const lines = importText.trim().split(/\r?\n/).filter(Boolean);
                const header =
                  lines
                    .shift()
                    ?.split(',')
                    .map((h) => h.trim().toLowerCase()) ?? [];
                const rows = lines.map((line) => {
                  const cols = line.split(',').map((c) => c.trim());
                  const rec: Record<string, string> = {};
                  header.forEach((h, i) => {
                    rec[h.replace(/\s+/g, '')] = cols[i] ?? '';
                  });
                  return {
                    fullName: rec['fullname'] || rec['name'] || '',
                    username: rec['username'] || '',
                    email: rec['email'] || '',
                    mobile: rec['mobile'] || '',
                    role: rec['role'] || '',
                    status: rec['status'] || 'active',
                  };
                });
                const res = await importSchoolIamUsers(rows, false);
                setImportPreview(res as Record<string, unknown>);
              }}
            >
              Validate
            </GhostButton>
            <PrimaryButton
              onClick={async () => {
                const lines = importText.trim().split(/\r?\n/).filter(Boolean);
                const header =
                  lines
                    .shift()
                    ?.split(',')
                    .map((h) => h.trim().toLowerCase()) ?? [];
                const rows = lines.map((line) => {
                  const cols = line.split(',').map((c) => c.trim());
                  const rec: Record<string, string> = {};
                  header.forEach((h, i) => {
                    rec[h.replace(/\s+/g, '')] = cols[i] ?? '';
                  });
                  return {
                    fullName: rec['fullname'] || rec['name'] || '',
                    username: rec['username'] || '',
                    email: rec['email'] || '',
                    mobile: rec['mobile'] || '',
                    role: rec['role'] || '',
                    status: rec['status'] || 'active',
                  };
                });
                const res = (await importSchoolIamUsers(rows, true)) as {
                  ok?: boolean;
                  errors?: unknown[];
                };
                setImportPreview(res as Record<string, unknown>);
                if (res.ok) {
                  setImportOpen(false);
                  setNotice('Import completed');
                  await qc.invalidateQueries({ queryKey: ['school-iam-users'] });
                }
              }}
            >
              Confirm import
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
          </DialogHeader>
          <input
            className="rounded border px-2 py-1"
            placeholder="Name"
            value={inviteForm.name}
            onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
          />
          <input
            className="rounded border px-2 py-1"
            placeholder="Email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
          />
          <select
            className="rounded border px-2 py-1"
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
          >
            {(roles.data ?? []).map((r) => (
              <option key={String(r.slug)} value={String(r.slug)}>
                {String(r.name)}
              </option>
            ))}
          </select>
          <DialogFooter>
            <PrimaryButton
              onClick={async () => {
                const res = (await run(
                  () => inviteSchoolIamUser(inviteForm),
                  'Invitation created',
                )) as { inviteToken?: string };
                setInvite(false);
                if (res?.inviteToken) setNotice(`Invitation token: ${res.inviteToken}`);
              }}
            >
              Send invite
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleEdit} onOpenChange={() => setRoleEdit(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Role permissions — {String(roleEdit?.name ?? '')}</DialogTitle>
          </DialogHeader>
          <RoleMatrix
            modules={modules}
            selected={(roleEdit?.permissions as string[]) ?? []}
            onChange={(permissions) => setRoleEdit({ ...roleEdit, permissions })}
          />
          <DialogFooter>
            <PrimaryButton
              onClick={() =>
                run(
                  () =>
                    saveSchoolIamRole({
                      id: roleEdit?.id,
                      name: roleEdit?.name,
                      description: roleEdit?.description,
                      permissions: roleEdit?.permissions,
                    }),
                  'Role saved',
                ).then(() => setRoleEdit(null))
              }
            >
              Save
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revealed}
        onOpenChange={(open) => {
          if (!open) {
            setRevealed(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share this only with {revealed?.name}. It will not be shown again after you close this
              window. They must change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border bg-slate-50 p-3 text-sm">
            {revealed?.username ? (
              <p>
                <span className="text-slate-500">Username</span>{' '}
                <span className="font-mono">{revealed.username}</span>
              </p>
            ) : null}
            {revealed?.email ? (
              <p>
                <span className="text-slate-500">Email</span> {revealed.email}
              </p>
            ) : null}
            <p>
              <span className="text-slate-500">Password</span>{' '}
              <span className="font-mono text-base font-semibold">{revealed?.password}</span>
            </p>
            {revealed?.defaultUsed ? (
              <p className="text-xs text-slate-500">This is the school default portal password.</p>
            ) : null}
          </div>
          <DialogFooter>
            <GhostButton
              type="button"
              onClick={async () => {
                if (!revealed?.password) return;
                await navigator.clipboard.writeText(revealed.password);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy password'}
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                setRevealed(null);
                setCopied(false);
              }}
            >
              Done
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={() => (!directoryBusy ? setConfirm(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          {directoryProgress ? (
            <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
              {directoryProgress}
            </p>
          ) : null}
          <DialogFooter className="gap-3 border-t border-slate-200 pt-4 sm:justify-end">
            <GhostButton type="button" disabled={directoryBusy} onClick={() => setConfirm(null)}>
              Cancel
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={directoryBusy}
              className="min-w-[12rem] bg-slate-900 text-white hover:bg-slate-800"
              onClick={async () => {
                if (!confirm) return;
                setDirectoryBusy(true);
                setDirectoryProgress('Starting…');
                try {
                  const res = (await confirm.run()) as {
                    created?: number;
                    linked?: number;
                    failed?: number | unknown[];
                    defaultPassword?: string;
                  };
                  setNotice(
                    typeof res?.created === 'number'
                      ? `Created ${res.created}, linked ${res.linked ?? 0}. Students activate in the app. Failed: ${typeof res.failed === 'number' ? res.failed : Array.isArray(res.failed) ? res.failed.length : 0}.`
                      : (confirm.ok ?? 'Saved'),
                  );
                  await qc.invalidateQueries({ queryKey: ['school-iam'] });
                  await qc.invalidateQueries({ queryKey: ['school-iam-users'] });
                  await qc.invalidateQueries({ queryKey: ['school-iam-user'] });
                } catch (e) {
                  setNotice(apiErrorMessage(e));
                } finally {
                  setDirectoryBusy(false);
                  setDirectoryProgress(null);
                  setConfirm(null);
                }
              }}
            >
              {directoryBusy ? 'Working…' : (confirm?.okLabel ?? 'Confirm')}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleMatrix({
  modules,
  selected,
  onChange,
}: {
  modules: Array<{ id: string; label: string; actions: Array<{ slug: string; label: string }> }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const set = useMemo(() => new Set(selected), [selected]);
  const toggle = (slug: string) => {
    const next = new Set(set);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange([...next]);
  };
  return (
    <div className="space-y-3 text-sm">
      {modules.map((m) => (
        <div key={m.id}>
          <div className="mb-1 flex justify-between font-medium">
            {m.label}
            <button
              className="text-xs text-blue-700"
              onClick={() => {
                const slugs = m.actions.map((a) => a.slug);
                const allOn = slugs.every((s) => set.has(s));
                const next = new Set(set);
                slugs.forEach((s) => (allOn ? next.delete(s) : next.add(s)));
                onChange([...next]);
              }}
            >
              Toggle module
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {m.actions.map((a) => (
              <label key={a.slug} className="flex items-center gap-1 rounded border px-2 py-1">
                <input type="checkbox" checked={set.has(a.slug)} onChange={() => toggle(a.slug)} />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
