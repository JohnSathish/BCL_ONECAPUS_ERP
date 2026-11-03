'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchErpUser, fetchErpUserLoginHistory } from '@/services/erp-users';
import { formatDisplayDateTime } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import { ErpUserStatusPill } from './erp-user-status-pill';

const ACTION_LABELS: Record<string, string> = {
  'erp_user.created': 'ERP user created',
  'erp_user.updated': 'Details updated',
  'erp_user.role_changed': 'Role changed',
  'erp_user.permissions_changed': 'Permissions changed',
  'erp_user.erp_access_enabled': 'ERP access turned on',
  'erp_user.erp_access_disabled': 'ERP access turned off',
  'erp_user.activated': 'Account activated',
  'erp_user.deactivated': 'Account deactivated',
  'erp_user.locked': 'Account locked',
  'erp_user.unlocked': 'Account unlocked',
  'erp_user.password_reset': 'Password reset',
  'user.password_reset': 'Password changed by admin',
  'erp_user.force_password_change': 'Password change required',
  'erp_user.sessions_revoked': 'Sessions signed out',
  'erp_user.login_failed': 'Sign-in failed',
  'auth.login': 'Signed in',
};

const LOGIN_REASONS: Record<string, string> = {
  bad_password: 'Wrong password',
  unknown_user: 'Unknown user',
  erp_access_blocked: 'ERP access blocked',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
}

export function ErpUserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'logins' | 'activity'>('overview');
  const [historyPage, setHistoryPage] = useState(1);
  const detailQ = useQuery({
    queryKey: ['admin', 'erp-users', 'detail', userId],
    queryFn: () => fetchErpUser(userId!),
    enabled: Boolean(userId),
  });
  const historyQ = useQuery({
    queryKey: ['admin', 'erp-users', 'login-history', userId, historyPage],
    queryFn: () => fetchErpUserLoginHistory(userId!, historyPage),
    enabled: Boolean(userId) && tab === 'logins',
  });

  if (!userId) return null;
  const user = detailQ.data;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{user?.name ?? 'ERP user'}</h2>
            {user ? (
              <p className="text-xs text-slate-500">
                {user.accountCode} · {user.username ?? 'no username'}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(
            [
              ['overview', 'Overview'],
              ['logins', 'Login History'],
              ['activity', 'Activity'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 font-medium',
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {detailQ.isLoading || !user ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : tab === 'overview' ? (
          <div className="space-y-4">
            <div className="divide-y rounded-xl border border-slate-200 px-4">
              <Row label="Status" value={<ErpUserStatusPill row={user} />} />
              <Row
                label="ERP dashboard access"
                value={user.erpAccessEnabled ? 'Allowed' : 'Turned off'}
              />
              <Row label="Role" value={user.role?.name} />
              <Row label="Official email" value={user.email} />
              <Row label="Mobile" value={user.mobile} />
              <Row label="Employee ID" value={user.employeeId} />
              <Row label="Department" value={user.department?.name} />
              <Row label="Designation" value={user.designation} />
              <Row
                label="Password change required"
                value={user.mustChangePassword ? 'Yes' : 'No'}
              />
              <Row
                label="Last login"
                value={user.lastLoginAt ? formatDisplayDateTime(user.lastLoginAt) : 'Never'}
              />
              <Row
                label="Created"
                value={`${formatDisplayDateTime(user.createdAt)}${user.createdBy ? ` by ${user.createdBy}` : ''}`}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Additional permissions</h3>
              {user.extraPermissions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.extraPermissions.map((slug) => (
                    <span
                      key={slug}
                      className="rounded-full bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-700"
                    >
                      {slug}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">None. Access comes from the role only.</p>
              )}
              {user.deniedPermissionCount ? (
                <p className="mt-2 text-xs text-amber-700">
                  {user.deniedPermissionCount} permission(s) are blocked for this user in User
                  Permissions.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Active sessions ({user.liveSessions.length})
              </h3>
              {user.liveSessions.length ? (
                <ul className="space-y-2">
                  {user.liveSessions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                      <p className="font-medium text-slate-800">
                        Since {formatDisplayDateTime(s.createdAt)} · {s.ipAddress ?? 'unknown IP'}
                      </p>
                      <p className="truncate text-slate-500">{s.userAgent ?? 'Unknown device'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Not signed in anywhere.</p>
              )}
            </div>
          </div>
        ) : tab === 'logins' ? (
          <div className="space-y-2">
            {historyQ.isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (historyQ.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No sign-in attempts recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {historyQ.data!.items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {formatDisplayDateTime(e.createdAt)}
                      </p>
                      <p className="truncate text-slate-500">
                        {e.ipAddress ?? 'unknown IP'} · {e.userAgent ?? 'unknown device'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 font-medium',
                        e.outcome === 'success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700',
                      )}
                    >
                      {e.outcome === 'success'
                        ? 'Success'
                        : (LOGIN_REASONS[e.reason ?? ''] ?? 'Failed')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(historyQ.data?.totalPages ?? 1) > 1 ? (
              <div className="flex items-center justify-between pt-2 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {historyPage} of {historyQ.data?.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage >= (historyQ.data?.totalPages ?? 1)}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {user.activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              user.activity.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <p className="font-medium text-slate-800">
                    {ACTION_LABELS[a.action] ?? a.action}
                  </p>
                  <p className="text-slate-500">
                    {formatDisplayDateTime(a.createdAt)}
                    {a.actor ? ` · by ${a.actor}` : ''}
                  </p>
                </li>
              ))
            )}
            <p className="pt-1 text-xs text-slate-500">
              The full trail is in Administration → Audit Logs.
            </p>
          </ul>
        )}
      </motion.aside>
    </>
  );
}
