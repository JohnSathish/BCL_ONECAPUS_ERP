'use client';

import { useMemo, useState } from 'react';
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
  testSchoolIamAccess,
} from '@/services/school-iam';
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
import { WaCard } from '../whatsapp/whatsapp-ui';
import { storeAdminSessionBackup } from '@/components/administration-module/impersonation-banner';

const LINKS = [
  { href: '/admin/school-sis/users', label: 'All Users', exact: true },
  { href: '/admin/school-sis/users/active', label: 'Active' },
  { href: '/admin/school-sis/users/invitations', label: 'Invitations' },
  { href: '/admin/school-sis/users/locked', label: 'Locked' },
  { href: '/admin/school-sis/users/suspended', label: 'Suspended' },
  { href: '/admin/school-sis/users/roles', label: 'Roles' },
  { href: '/admin/school-sis/users/permissions', label: 'Permissions' },
  { href: '/admin/school-sis/users/sessions', label: 'Sessions' },
  { href: '/admin/school-sis/users/login-history', label: 'Login History' },
  { href: '/admin/school-sis/users/audit', label: 'Audit' },
  { href: '/admin/school-sis/users/security', label: 'Security' },
];

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
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [invite, setInvite] = useState(false);
  const [roleEdit, setRoleEdit] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    ok?: string;
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
    password: 'StLuke@2026',
    staffId: '',
    studentId: '',
  });
  const [personQ, setPersonQ] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
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
    queryKey: ['school-iam-users', search, status || statusFromPath, role],
    queryFn: () =>
      fetchSchoolIamUsers({ search, status: status || statusFromPath, role, limit: 50 }),
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

  const kpis = (dash.data as { kpis?: Record<string, number> } | undefined)?.kpis ?? {};
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

  const seed = useMutation({
    mutationFn: () => run(seedSchoolIamRoles, 'Default school roles seeded'),
  });

  const badge = (st: string) => (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
        st === 'active' && 'bg-emerald-50 text-emerald-800 ring-emerald-200',
        st === 'invited' && 'bg-sky-50 text-sky-800 ring-sky-200',
        st === 'pending' && 'bg-sky-50 text-sky-800 ring-sky-200',
        st === 'suspended' && 'bg-amber-50 text-amber-800 ring-amber-200',
        st === 'locked' && 'bg-rose-50 text-rose-800 ring-rose-200',
        (st === 'disabled' || !st) && 'bg-slate-100 text-slate-600 ring-slate-200',
      )}
    >
      {st}
    </span>
  );

  return (
    <div className="space-y-4 p-4 md:p-6" style={{ background: '#f4f7fb', minHeight: '100%' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users &amp; Access</h1>
          <p className="text-sm text-slate-500">
            School identity, roles, sessions and security — not a college portal.
          </p>
        </div>
        {manage ? (
          <div className="flex gap-2">
            <GhostButton onClick={() => seed.mutate()}>Seed default roles</GhostButton>
            <GhostButton onClick={() => setInvite(true)}>Invite</GhostButton>
            <GhostButton onClick={() => setImportOpen(true)}>Import Excel</GhostButton>
            <GhostButton onClick={() => setDirectoryOpen(true)}>
              Add all students &amp; staff
            </GhostButton>
            <PrimaryButton
              onClick={() => {
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
                  password: 'StLuke@2026',
                  staffId: '',
                  studentId: '',
                });
                setPersonQ('');
                setWizard(true);
              }}
            >
              + Add user
            </PrimaryButton>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              path === l.href || (l.href !== '/admin/school-sis/users' && path.startsWith(l.href))
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {notice ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{notice}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          ['Total', kpis.total],
          ['Active', kpis.active],
          ['Pending invites', kpis.invited],
          ['Suspended', kpis.suspended],
          ['Locked', kpis.locked],
          ['Sessions', kpis.sessions],
          ['MFA on', kpis.mfaOn],
          ['Failed logins (24h)', kpis.failedLogins],
        ].map(([label, value]) => (
          <WaCard key={String(label)} className="p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-slate-900">{value ?? '—'}</p>
          </WaCard>
        ))}
      </div>

      {usersListPage ? (
        <WaCard className="overflow-hidden p-0">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
            <input
              className="h-9 rounded-md border px-3 text-sm"
              placeholder="Search name, email, username, mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {['active', 'invited', 'suspended', 'locked', 'disabled'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border px-2 text-sm"
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
            {manage ? (
              <GhostButton
                onClick={() => {
                  const rows = users.data?.items ?? [];
                  const header = 'Name,Email,Username,Status,Roles,LastLogin,MFA';
                  const body = rows
                    .map((u) =>
                      [
                        u.displayName,
                        u.email,
                        u.username,
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
                Export CSV
              </GhostButton>
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
              </>
            ) : null}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-2" />
                <th className="p-2">User</th>
                <th className="p-2">Role</th>
                <th className="p-2">Status</th>
                <th className="p-2">Last login</th>
                <th className="p-2">MFA</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {(users.data?.items ?? []).map((u) => {
                const id = String(u.id);
                const rolesList = (u.roles as Array<{ name: string }>) ?? [];
                return (
                  <tr key={id} className="border-t border-slate-100">
                    <td className="p-2">
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
                    <td className="p-2">
                      <button className="text-left" onClick={() => setDrawerId(id)}>
                        <div className="font-medium">{String(u.displayName || u.email)}</div>
                        <div className="text-xs text-slate-500">{String(u.email)}</div>
                      </button>
                    </td>
                    <td className="p-2">{rolesList.map((r) => r.name).join(', ') || '—'}</td>
                    <td className="p-2">{badge(String(u.accountStatus))}</td>
                    <td className="p-2 text-xs">
                      {u.lastLoginAt ? new Date(String(u.lastLoginAt)).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-2">{u.mfaEnabled ? '✓' : '—'}</td>
                    <td className="p-2 text-right">
                      <GhostButton onClick={() => setDrawerId(id)}>Open</GhostButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!users.data?.items?.length ? (
            <p className="p-6 text-sm text-slate-500">No users match the current filters.</p>
          ) : null}
        </WaCard>
      ) : null}

      {page.includes('roles') ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(roles.data ?? []).map((r) => (
            <WaCard key={String(r.id)} className="p-4">
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
            </WaCard>
          ))}
        </div>
      ) : null}

      {page.includes('permissions') ? (
        <WaCard className="overflow-auto p-4">
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
        </WaCard>
      ) : null}

      {page.includes('invitation') ? (
        <WaCard className="p-4">
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
        </WaCard>
      ) : null}

      {page.includes('session') ? (
        <WaCard className="overflow-auto p-0">
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
        </WaCard>
      ) : null}

      {page.includes('login') ? (
        <WaCard className="p-4 text-sm">
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
        </WaCard>
      ) : null}

      {page.includes('audit') ? (
        <WaCard className="p-4 text-sm">
          {(audits.data ?? []).map((e) => (
            <div key={String(e.id)} className="border-b py-2">
              <div className="font-medium">{String(e.action)}</div>
              <div className="text-xs text-slate-500">
                {(e.user as { email?: string })?.email} ·{' '}
                {new Date(String(e.createdAt)).toLocaleString()}
              </div>
            </div>
          ))}
        </WaCard>
      ) : null}

      {page.includes('security') ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <WaCard className="p-4">
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
          </WaCard>
          <WaCard className="p-4">
            <h3 className="mb-3 font-semibold">Security alerts</h3>
            {(alerts.data ?? []).map((a) => (
              <div key={String(a.id)} className="border-b py-2 text-sm">
                <span className="mr-1 text-xs font-semibold">{String(a.kind)}</span>{' '}
                {String(a.message)}
              </div>
            ))}
          </WaCard>
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
          <div className="mt-2">{badge(String(detail.data.accountStatus))}</div>
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
                <GhostButton
                  onClick={async () => {
                    const r = (await run(
                      () => resetSchoolIamPassword(drawerId),
                      'Password reset',
                    )) as { generatedPassword?: string };
                    if (r?.generatedPassword)
                      setNotice(`Temporary password: ${r.generatedPassword}`);
                  }}
                >
                  Reset password
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
                                username: s.admissionNumber,
                                email: s.email || '',
                                phone: (s as { phone?: string }).phone || '',
                                roleSlugs: ['school-student'],
                              })
                            }
                          >
                            <span className="font-medium">{s.fullName}</span>
                            <span className="ml-2 text-slate-500">{s.admissionNumber}</span>
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
                  title: 'School default password',
                  body: 'StLuke@2026 — user must change it on first login.',
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
                  : `Password: ${form.passwordMode === 'default' ? 'StLuke@2026' : form.password} (must change on first login)`}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <GhostButton
              onClick={() => (wizardStep === 0 ? setWizard(false) : setWizardStep((s) => s - 1))}
            >
              {wizardStep === 0 ? 'Cancel' : 'Back'}
            </GhostButton>
            {wizardStep < 5 ? (
              <PrimaryButton
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
                          ? 'StLuke@2026'
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
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Default password for every new account:{' '}
            <strong>{directory.data?.defaultPassword ?? 'StLuke@2026'}</strong>. They must change it
            on first login.
          </p>
          <DialogFooter>
            <GhostButton onClick={() => setDirectoryOpen(false)}>Cancel</GhostButton>
            <PrimaryButton
              onClick={() =>
                setConfirm({
                  title: 'Create portal accounts for everyone?',
                  body: `This will create logins for ${directory.data?.studentsMissing ?? 0} students and ${directory.data?.staffMissing ?? 0} staff using password ${directory.data?.defaultPassword ?? 'StLuke@2026'}. Existing accounts are skipped or linked.`,
                  ok: `Accounts ready. Default password: ${directory.data?.defaultPassword ?? 'StLuke@2026'} (change on first login).`,
                  run: async () => {
                    const res = await provisionSchoolIamDirectory({
                      confirm: true,
                      includeStudents: true,
                      includeStaff: true,
                    });
                    setDirectoryOpen(false);
                    return res;
                  },
                })
              }
            >
              Create all accounts
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

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <GhostButton onClick={() => setConfirm(null)}>Cancel</GhostButton>
            <PrimaryButton
              onClick={async () => {
                if (confirm) {
                  const res = (await run(confirm.run, confirm.ok ?? 'Saved')) as {
                    created?: number;
                    linked?: number;
                    failed?: unknown[];
                    defaultPassword?: string;
                  };
                  if (typeof res?.created === 'number') {
                    setNotice(
                      `Created ${res.created}, linked ${res.linked ?? 0}. Default password: ${res.defaultPassword ?? 'StLuke@2026'}. Failed: ${Array.isArray(res.failed) ? res.failed.length : 0}.`,
                    );
                  }
                }
                setConfirm(null);
              }}
            >
              Confirm
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
