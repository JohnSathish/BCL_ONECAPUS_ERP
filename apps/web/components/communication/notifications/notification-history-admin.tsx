'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  clearNotificationHistory,
  fetchCommunicationCampaigns,
  fetchNotificationHistorySummary,
  revokeCommunicationCampaign,
} from '@/services/communication';
import { apiErrorMessage } from '@/utils/api-error';

const AUDIENCES = [
  { id: 'STUDENTS', label: 'Students', hint: 'Clears the list students see in the app' },
  { id: 'STAFF', label: 'Staff', hint: 'Clears faculty and staff in-app lists' },
  {
    id: 'ALL',
    label: 'Everyone',
    hint: 'Clears every in-app notification, including the office inbox',
  },
] as const;

type AudienceId = (typeof AUDIENCES)[number]['id'];

export function confirmRevokeCampaign(name: string) {
  return window.confirm(
    `Revoke "${name}"?\n\nThis deletes that message from student and staff notification lists in the app. A banner already sitting on a phone lock screen can stay until that person dismisses it.`,
  );
}

export function NotificationHistoryAdmin({
  showRecentCampaigns = false,
}: {
  showRecentCampaigns?: boolean;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [audience, setAudience] = useState<AudienceId>('STUDENTS');
  const [lookup, setLookup] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['communication', 'notification-history-summary'],
    queryFn: fetchNotificationHistorySummary,
    enabled,
  });

  const campaigns = useQuery({
    queryKey: ['communication', 'campaigns'],
    queryFn: () => fetchCommunicationCampaigns(),
    enabled: enabled && showRecentCampaigns,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['communication'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const clear = useMutation({
    mutationFn: clearNotificationHistory,
    onSuccess: (result) => {
      setError(null);
      setNote(
        result.removed === 0
          ? 'No notifications were stored for that audience.'
          : `Deleted ${result.removed.toLocaleString('en-IN')} notification${result.removed === 1 ? '' : 's'} from the app history.`,
      );
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not clear notification history')),
  });

  const revoke = useMutation({
    mutationFn: revokeCommunicationCampaign,
    onSuccess: (result) => {
      setError(null);
      setNote(
        `Revoked. Removed ${result.removedNotifications.toLocaleString('en-IN')} notification${result.removedNotifications === 1 ? '' : 's'} from app lists.`,
      );
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not revoke this campaign')),
  });

  const counts = summary.data;
  const selectedCount =
    audience === 'STUDENTS' ? counts?.students : audience === 'STAFF' ? counts?.staff : counts?.all;
  const recent = (campaigns.data ?? [])
    .filter((row) => ['SENT', 'SENDING', 'FAILED', 'REVOKED'].includes(row.status))
    .slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-rose-700">Clear notification history</h2>
        <p className="mt-1 text-sm text-slate-500">
          Deletes messages already stored in the app, including older notices and sign-in alerts.
          People see a shorter list the next time they open Notifications.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AUDIENCES.map((option) => {
            const count = counts
              ? option.id === 'STUDENTS'
                ? counts.students
                : option.id === 'STAFF'
                  ? counts.staff
                  : counts.all
              : null;
            return (
              <Button
                key={option.id}
                size="sm"
                variant={audience === option.id ? 'default' : 'outline'}
                onClick={() => setAudience(option.id)}
              >
                {option.label}
                {count == null ? '' : ` (${count.toLocaleString('en-IN')})`}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {AUDIENCES.find((option) => option.id === audience)?.hint}
        </p>
        <Button
          className="mt-3"
          variant="destructive"
          disabled={clear.isPending || selectedCount === 0}
          onClick={() => {
            const label = AUDIENCES.find((option) => option.id === audience)?.label ?? audience;
            const countText =
              selectedCount == null ? 'the stored' : selectedCount.toLocaleString('en-IN');
            const ok = window.confirm(
              `Delete ${countText} ${label.toLowerCase()} notification${selectedCount === 1 ? '' : 's'} from the app history? This cannot be undone.`,
            );
            if (!ok) return;
            clear.mutate(audience);
          }}
        >
          {clear.isPending ? 'Clearing…' : 'Clear history'}
        </Button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-amber-700">Revoke a sent campaign</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use this when one notice was sent by mistake. It removes that campaign from every
          recipient&apos;s notification list and stops a send that is still going out.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            placeholder="Paste campaign ID"
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={revoke.isPending || !lookup.trim()}
            onClick={() => {
              const id = lookup.trim();
              if (!confirmRevokeCampaign(id)) return;
              revoke.mutate(id);
            }}
          >
            Revoke
          </Button>
        </div>
        <p className="mt-2 text-xs text-sky-700">
          Only a sent or in-progress campaign can be revoked. This cannot be undone.
        </p>
      </section>

      {showRecentCampaigns ? (
        <section className="rounded-2xl border border-border/80 bg-card p-4 lg:col-span-2">
          <h2 className="text-base font-semibold">Revoke a sent campaign</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this when one notice was sent by mistake. It removes that campaign from every
            recipient&apos;s notification list and stops a send that is still going out.
          </p>
          <ul className="mt-3 space-y-2">
            {recent.map((campaign) => (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.status}
                    {campaign._count?.notifications != null
                      ? ` · ${campaign._count.notifications.toLocaleString('en-IN')} in app lists`
                      : ''}
                  </p>
                </div>
                {campaign.status === 'REVOKED' ? (
                  <span className="text-xs font-medium text-muted-foreground">Revoked</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (!confirmRevokeCampaign(campaign.name)) return;
                      revoke.mutate(campaign.id);
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
            {!recent.length && !campaigns.isLoading ? (
              <li className="text-sm text-muted-foreground">No sent campaigns yet.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {note ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 lg:col-span-2">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:col-span-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
