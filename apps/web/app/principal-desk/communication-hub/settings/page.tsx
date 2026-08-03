'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { fetchNotificationPreferences, saveNotificationPreference } from '@/services/communication';
import {
  disconnectPrincipalMailbox,
  fetchPrincipalCommsAudit,
  fetchPrincipalCommsOAuthStatus,
  fetchPrincipalMailboxAccounts,
  startPrincipalMailboxOAuth,
  syncPrincipalMailbox,
} from '@/services/principal-comms';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDateTime } from '@/utils/format-date';

function MailNotifyToggle() {
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });
  const push = (
    prefs.data as
      | Array<{ channel: string; enabled: boolean; settings?: Record<string, unknown> }>
      | undefined
  )?.find((p) => p.channel === 'PUSH');
  const enabled = push?.settings?.principalMail !== false;

  const mut = useMutation({
    mutationFn: async (next: boolean) => {
      await saveNotificationPreference('PUSH', push?.enabled !== false, {
        ...(push?.settings ?? {}),
        principalMail: next,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={enabled}
        disabled={mut.isPending || prefs.isLoading}
        onChange={(e) => mut.mutate(e.target.checked)}
      />
      Notify me when new mail is synced (bell + push)
    </label>
  );
}

export default function PrincipalCommsSettingsPage() {
  const { session } = useAuth();
  const canAccess = (session?.user?.permissions ?? []).includes('principal-comms:access');
  const search = useSearchParams();
  const qc = useQueryClient();
  const [label, setLabel] = useState<'PERSONAL' | 'PRINCIPAL_OFFICE'>('PERSONAL');
  const [message, setMessage] = useState(
    search.get('connected') === '1' ? 'Google mailbox connected. Run Sync from Inbox.' : '',
  );
  const [error, setError] = useState('');

  const oauthStatus = useQuery({
    queryKey: ['principal-comms', 'oauth-status'],
    queryFn: fetchPrincipalCommsOAuthStatus,
    enabled: canAccess,
  });
  const accounts = useQuery({
    queryKey: ['principal-comms', 'accounts'],
    queryFn: fetchPrincipalMailboxAccounts,
    enabled: canAccess,
  });
  const audit = useQuery({
    queryKey: ['principal-comms', 'audit'],
    queryFn: fetchPrincipalCommsAudit,
    enabled: canAccess,
  });

  const connectMut = useMutation({
    mutationFn: () => startPrincipalMailboxOAuth(label),
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnectPrincipalMailbox(id),
    onSuccess: async () => {
      setMessage('Mailbox disconnected.');
      await qc.invalidateQueries({ queryKey: ['principal-comms'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const syncMut = useMutation({
    mutationFn: (accountId: string) => syncPrincipalMailbox({ accountId, full: true }),
    onSuccess: async (res) => {
      setMessage(`Synced ${res.imported} messages (${res.newMessages} new).`);
      await qc.invalidateQueries({ queryKey: ['principal-comms'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (!canAccess) {
    return (
      <PrincipalDeskShell title="Communication Hub Settings">
        <p className="text-sm text-muted-foreground">Principal-only settings.</p>
      </PrincipalDeskShell>
    );
  }

  return (
    <PrincipalDeskShell
      title="Communication Hub Settings"
      subtitle="Connect Google Workspace mailbox and review audit activity"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect your personal Google account or the Principal Office shared mailbox. Tokens are
          encrypted server-side and never exposed to other roles.
        </p>

        {message ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Google Workspace connection</h2>
          <p className="text-xs text-muted-foreground">
            OAuth configured:{' '}
            {oauthStatus.data?.configured ? 'Yes' : 'No — set GOOGLE_COMMS_* env vars on API'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={label === 'PERSONAL' ? 'default' : 'outline'}
              onClick={() => setLabel('PERSONAL')}
            >
              Personal mailbox
            </Button>
            <Button
              type="button"
              size="sm"
              variant={label === 'PRINCIPAL_OFFICE' ? 'default' : 'outline'}
              onClick={() => setLabel('PRINCIPAL_OFFICE')}
            >
              Principal Office
            </Button>
          </div>
          <Button
            type="button"
            disabled={!oauthStatus.data?.configured || connectMut.isPending}
            onClick={() => {
              setError('');
              connectMut.mutate();
            }}
          >
            Connect Google
          </Button>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Connected accounts</h2>
          {(accounts.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">None connected.</p>
          ) : (
            <ul className="space-y-2">
              {(accounts.data ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.googleEmail}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.accountLabel} · {a.status}
                      {a.lastSyncedAt
                        ? ` · last sync ${formatDisplayDateTime(a.lastSyncedAt)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => syncMut.mutate(a.id)}
                      disabled={syncMut.isPending}
                    >
                      Full sync
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => disconnectMut.mutate(a.id)}
                      disabled={disconnectMut.isPending}
                    >
                      Disconnect
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">New-mail notifications</h2>
          <p className="text-xs text-muted-foreground">
            Controls preference key <code>principalMail</code> on the PUSH channel (default: on).
          </p>
          <MailNotifyToggle />
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Audit trail</h2>
          <div className="max-h-64 overflow-y-auto text-xs">
            {(audit.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No actions logged yet.</p>
            ) : (
              <ul className="space-y-1">
                {(audit.data ?? []).map((row) => (
                  <li key={row.id} className="border-b border-border/50 py-1.5">
                    <span className="font-medium">{row.action}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatDisplayDateTime(row.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PrincipalDeskShell>
  );
}
