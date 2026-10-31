'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  fetchOpacAdminSettings,
  fetchOpacUsage,
  saveOpacAdminSettings,
  type OpacSettings,
} from '@/services/opac';

const toggles: Array<[keyof OpacSettings, string]> = [
  ['enabled', 'OPAC enabled'],
  ['publicSearch', 'Public catalogue search'],
  ['studentLogin', 'Student login'],
  ['staffLogin', 'Staff login'],
  ['reservation', 'Online reservation'],
  ['renewal', 'Online renewal'],
  ['showFines', 'Show fines to the member'],
  ['digital', 'Public digital library'],
];

export function OpacAdminPanel() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['opac', 'admin'], queryFn: fetchOpacAdminSettings });
  const usage = useQuery({ queryKey: ['opac', 'usage'], queryFn: fetchOpacUsage });
  const [draft, setDraft] = useState<OpacSettings | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => saveOpacAdminSettings(draft as OpacSettings),
    onSuccess: async (saved) => {
      setDraft(saved);
      setNotice('OPAC settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['opac'] });
    },
    onError: () => setNotice('The settings could not be saved.'),
  });

  if (!draft) return <p className="text-sm text-slate-500">Loading OPAC settings…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        These switches control the public catalogue. Loan days, fine amounts, and copy issue rules
        stay in Library Settings and on each physical copy. Due and overdue reminders continue to
        use the existing library notification jobs.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {toggles.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {label}
            <input
              type="checkbox"
              checked={Boolean(draft[key])}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Maximum active reservations
          <input
            type="number"
            min={1}
            max={10}
            value={draft.maxReservations}
            onChange={(event) =>
              setDraft({ ...draft, maxReservations: Number(event.target.value) })
            }
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2"
          />
        </label>
        <label className="text-sm">
          Reservation expiry, days
          <input
            type="number"
            min={1}
            max={30}
            value={draft.reservationDays}
            onChange={(event) =>
              setDraft({ ...draft, reservationDays: Number(event.target.value) })
            }
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2"
          />
        </label>
        <label className="text-sm">
          Public phone
          <input
            value={draft.contactPhone}
            onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2"
          />
        </label>
        <label className="text-sm">
          Public email
          <input
            value={draft.contactEmail}
            onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2"
          />
        </label>
      </div>
      <label className="block text-sm">
        Hours, one line as Label | 8:00 AM – 5:00 PM
        <textarea
          value={draft.hours.map((row) => `${row.label} | ${row.hours}`).join('\n')}
          onChange={(event) =>
            setDraft({
              ...draft,
              hours: event.target.value
                .split('\n')
                .map((line) => line.split('|').map((part) => part.trim()))
                .filter((parts) => parts[0] && parts[1])
                .map(([label, hours]) => ({ label, hours })),
            })
          }
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-2 py-2"
        />
      </label>
      <label className="block text-sm">
        Notices, one per line
        <textarea
          value={draft.announcements.map((row) => row.text).join('\n')}
          onChange={(event) =>
            setDraft({
              ...draft,
              announcements: event.target.value
                .split('\n')
                .map((text) => text.trim())
                .filter(Boolean)
                .map((text) => ({ text })),
            })
          }
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-2 py-2"
        />
      </label>
      <button
        type="button"
        className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Save OPAC settings
      </button>
      {notice ? <p className="text-sm text-slate-700">{notice}</p> : null}
      <section>
        <h2 className="font-semibold">OPAC use in the last 30 days</h2>
        {usage.data ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Searches {usage.data.counts.SEARCH ?? 0} · Title views {usage.data.counts.VIEW ?? 0} ·
              Logins {usage.data.counts.LOGIN ?? 0} · Reservations {usage.data.counts.RESERVE ?? 0}{' '}
              · Renewals {usage.data.counts.RENEW ?? 0}
            </p>
            {usage.data.searches.length ? (
              <ul>
                {usage.data.searches.map((row) => (
                  <li key={row.query}>
                    {row.query} · {row.count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">No searches have been recorded yet.</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Usage counts appear after the catalogue is used.
          </p>
        )}
      </section>
    </div>
  );
}
