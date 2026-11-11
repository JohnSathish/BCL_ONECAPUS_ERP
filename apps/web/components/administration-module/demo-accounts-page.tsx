'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import {
  createDemoAccount,
  fetchDemoAccounts,
  fetchDemoDevices,
  fetchDemoNotifications,
  resetDemoPassword,
  sendDemoNotification,
  setDemoActive,
  type DemoAccount,
  type DemoKind,
} from '@/services/demo-accounts';

export function DemoAccountsPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('Demo notification');
  const [body, setBody] = useState('This is a test from the college ERP.');
  const [kind, setKind] = useState<DemoKind>('STUDENT');
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');

  const accounts = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: fetchDemoAccounts,
  });
  const devices = useQuery({
    queryKey: ['demo-devices', selected],
    queryFn: () => fetchDemoDevices(selected!),
    enabled: Boolean(selected),
  });
  const history = useQuery({
    queryKey: ['demo-notifications', selected],
    queryFn: () => fetchDemoNotifications(selected!),
    enabled: Boolean(selected),
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['demo-accounts'] });
    if (selected) {
      await qc.invalidateQueries({ queryKey: ['demo-devices', selected] });
      await qc.invalidateQueries({ queryKey: ['demo-notifications', selected] });
    }
  };

  const reset = useMutation({
    mutationFn: (userId: string) => resetDemoPassword(userId),
    onSuccess: async (result) => {
      setNotice(`New password: ${result.password}`);
      await refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not reset the password.')),
  });
  const active = useMutation({
    mutationFn: (account: DemoAccount) => setDemoActive(account.userId, !account.active),
    onSuccess: refresh,
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not change the account status.')),
  });
  const send = useMutation({
    mutationFn: () => sendDemoNotification(selected!, title, body),
    onSuccess: async (result) => {
      setNotice(
        `${result.pushStatus}. ${result.pushDetail ?? ''} In-app copy: ${result.inApp ? 'saved' : 'not saved'}.`,
      );
      await refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not send the test notification.')),
  });
  const create = useMutation({
    mutationFn: () =>
      createDemoAccount({
        kind,
        loginId: loginId.trim() || undefined,
        displayName: displayName.trim() || undefined,
      }),
    onSuccess: async (result) => {
      setNotice(`${result.loginId} password: ${result.password}`);
      setLoginId('');
      setDisplayName('');
      await refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not create the demo account.')),
  });

  const rows = accounts.data?.accounts ?? [];
  const current = rows.find((row) => row.userId === selected) ?? null;

  return (
    <DashboardShell role="admin" title="Demo Accounts">
      <AdminPageHeader
        title="Demo Accounts"
        subtitle="Sign-in accounts for mobile testing. They are excluded from classes, attendance, examinations, fees, and college statistics."
      />
      {accounts.data?.created.length ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">New demo passwords. Copy them now.</p>
          <ul className="mt-2 space-y-1">
            {accounts.data.created.map((row) => (
              <li key={row.loginId}>
                {row.kind === 'STUDENT' ? 'Student' : 'Staff'} {row.loginId}: {row.password}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-medium">Sign in with these accounts</p>
          <ul className="mt-2 space-y-1">
            <li>Student DEMO-STUDENT · DemoStudent@2026</li>
            <li>Staff DEMO-STAFF · DemoStaff@2026</li>
          </ul>
        </div>
      )}
      {notice ? (
        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Accounts</h2>
          {accounts.isError ? (
            <p className="mt-3 text-sm text-red-700">
              {apiErrorMessage(accounts.error, 'Demo accounts could not be loaded.')}
            </p>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Login</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="py-2">{row.displayName}</td>
                    <td>{row.loginId}</td>
                    <td>{row.kind === 'STUDENT' ? 'Student' : 'Staff'}</td>
                    <td>{row.active ? 'Active' : 'Inactive'}</td>
                    <td className="space-x-2 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(row.userId)}>
                        Open
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reset.mutate(row.userId)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => active.mutate(row)}>
                        {row.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows.length && !accounts.isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No demo accounts yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <form
            className="mt-4 grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <select
              className="h-10 rounded-md border px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as DemoKind)}
            >
              <option value="STUDENT">Demo student</option>
              <option value="STAFF">Demo staff</option>
            </select>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            <Input
              value={loginId}
              onChange={(event) => setLoginId(event.target.value.toUpperCase())}
              placeholder="DEMO-LOGIN"
            />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">
              {current ? current.displayName : 'Select an account'}
            </h2>
            {current ? (
              <p className="mt-1 text-sm text-slate-500">
                Sign in on the mobile app with {current.loginId}. The account has no class,
                semester, admission, or employment record.
              </p>
            ) : null}
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (selected) send.mutate();
              }}
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
              />
              <textarea
                className="min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Message"
              />
              <Button type="submit" disabled={!selected || send.isPending}>
                {send.isPending ? 'Sending…' : 'Send test notification'}
              </Button>
            </form>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-900">Registered devices</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {(devices.data ?? []).map((device) => (
                <li key={device.id}>
                  {device.platform} {device.deviceModel ?? ''} ·{' '}
                  {device.appVersion ?? 'unknown version'} ·{' '}
                  {device.hasPushToken ? 'push token saved' : 'no push token'}
                </li>
              ))}
              {selected && devices.data && !devices.data.length ? (
                <li>No device has signed in yet.</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-900">Notification tests</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {(history.data ?? []).map((row) => (
                <li key={row.id}>
                  <span className="font-medium text-slate-800">{row.title}</span> · {row.pushStatus}
                  {row.readAt ? ' · read' : ' · unread'}
                  {row.pushDetail ? ` · ${row.pushDetail}` : ''}
                </li>
              ))}
              {selected && history.data && !history.data.length ? (
                <li>No tests sent yet.</li>
              ) : null}
            </ul>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
