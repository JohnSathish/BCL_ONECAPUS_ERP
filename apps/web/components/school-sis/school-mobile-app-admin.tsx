'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolMobileBroadcasts,
  fetchSchoolMobilePrayers,
  fetchSchoolMobileSettings,
  patchSchoolMobileSettings,
  saveSchoolMobilePrayer,
  sendSchoolMobileBroadcast,
  type SchoolMobilePrayer,
  type SchoolMobileSettings,
} from '@/services/school-mobile';
import { apiErrorMessage } from '@/utils/api-error';

const TABS = [
  { id: 'versions', label: 'Versions & store' },
  { id: 'prayer', label: 'Morning prayer' },
  { id: 'push', label: 'Push notifications' },
] as const;

export function SchoolMobileAppAdmin() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const params = useSearchParams();
  const tab = TABS.some((row) => row.id === params.get('tab'))
    ? (params.get('tab') as (typeof TABS)[number]['id'])
    : 'versions';
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SchoolMobileSettings>>({});
  const [prayerDraft, setPrayerDraft] = useState<SchoolMobilePrayer | null>(null);
  const [push, setPush] = useState({
    title: '',
    body: '',
    audience: 'all',
    deepLink: '',
  });

  const settings = useQuery({
    queryKey: ['school-mobile-settings'],
    queryFn: fetchSchoolMobileSettings,
    enabled,
  });
  const prayers = useQuery({
    queryKey: ['school-mobile-prayers'],
    queryFn: fetchSchoolMobilePrayers,
    enabled,
  });
  const broadcasts = useQuery({
    queryKey: ['school-mobile-broadcasts'],
    queryFn: fetchSchoolMobileBroadcasts,
    enabled,
  });

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  useEffect(() => {
    if (prayers.data?.length && !prayerDraft) setPrayerDraft(prayers.data[0]);
  }, [prayers.data, prayerDraft]);

  const saveSettings = useMutation({
    mutationFn: () => patchSchoolMobileSettings(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-mobile-settings'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const savePrayer = useMutation({
    mutationFn: () =>
      saveSchoolMobilePrayer({
        weekday: prayerDraft!.weekday,
        title: prayerDraft!.title,
        body: prayerDraft!.body,
        enabled: prayerDraft!.enabled,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-mobile-prayers'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const sendPush = useMutation({
    mutationFn: () =>
      sendSchoolMobileBroadcast({
        title: push.title,
        body: push.body,
        audience: push.audience,
        deepLink: push.deepLink || undefined,
        type: push.deepLink?.startsWith('/notices') ? 'notice' : 'announcement',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-mobile-broadcasts'] });
      setPush({ title: '', body: '', audience: 'all', deepLink: '' });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const field = (key: keyof SchoolMobileSettings, label: string, textarea = false) => (
    <label key={key} className="text-xs font-semibold text-slate-500">
      {label}
      {textarea ? (
        <textarea
          className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
          value={String(form[key] ?? '')}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={String(form[key] ?? '')}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </label>
  );

  const tabBar = useMemo(
    () => (
      <div className="flex gap-2">
        {TABS.map((row) => (
          <a
            key={row.id}
            href={`/admin/school-sis/mobile-app${row.id === 'versions' ? '' : `?tab=${row.id}`}`}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === row.id ? 'bg-[#1a237e] text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.label}
          </a>
        ))}
      </div>
    ),
    [tab],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1a237e]">St. Luke’s School app</h1>
        <p className="text-sm text-slate-500">
          Control Android/iOS versions, weekday morning prayers, and push notifications for the
          dedicated school app.
        </p>
      </div>
      {tabBar}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {tab === 'versions' ? (
        <form
          className="grid max-w-3xl gap-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings.mutate();
          }}
        >
          {field('androidLatestVersion', 'Latest Android version')}
          {field('iosLatestVersion', 'Latest iOS version')}
          {field('minVersion', 'Minimum supported version')}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.forceUpdate)}
              onChange={(e) => setForm({ ...form, forceUpdate: e.target.checked })}
            />
            Force update (or when below minimum)
          </label>
          {field('androidStoreUrl', 'Play Store URL')}
          {field('iosStoreUrl', 'App Store URL')}
          {field('releaseNotes', 'Release notes', true)}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.maintenanceMode)}
              onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
            />
            Maintenance mode
          </label>
          {field('maintenanceMessage', 'Maintenance message', true)}
          <button
            type="submit"
            className="h-10 rounded-xl bg-[#1a237e] px-4 text-sm font-semibold text-white"
            disabled={saveSettings.isPending}
          >
            {saveSettings.isPending ? 'Saving…' : 'Save app versions'}
          </button>
        </form>
      ) : null}

      {tab === 'prayer' && prayerDraft ? (
        <form
          className="grid max-w-3xl gap-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            savePrayer.mutate();
          }}
        >
          <div className="flex flex-wrap gap-2">
            {(prayers.data ?? []).map((row) => (
              <button
                key={row.weekday}
                type="button"
                className={`rounded-full px-3 py-1 text-sm ${
                  prayerDraft.weekday === row.weekday ? 'bg-[#1a237e] text-white' : 'bg-slate-100'
                }`}
                onClick={() => setPrayerDraft(row)}
              >
                {row.weekdayLabel ?? row.weekday}
              </button>
            ))}
          </div>
          <input
            className="h-10 rounded-lg border px-3 text-sm"
            value={prayerDraft.title}
            onChange={(e) => setPrayerDraft({ ...prayerDraft, title: e.target.value })}
          />
          <textarea
            className="min-h-40 rounded-lg border px-3 py-2 text-sm"
            value={prayerDraft.body}
            onChange={(e) => setPrayerDraft({ ...prayerDraft, body: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prayerDraft.enabled}
              onChange={(e) => setPrayerDraft({ ...prayerDraft, enabled: e.target.checked })}
            />
            Show this day’s prayer
          </label>
          <button
            type="submit"
            className="h-10 rounded-xl bg-[#1a237e] px-4 text-sm font-semibold text-white"
            disabled={savePrayer.isPending}
          >
            {savePrayer.isPending ? 'Saving…' : 'Save prayer'}
          </button>
        </form>
      ) : null}

      {tab === 'push' ? (
        <div className="grid max-w-3xl gap-4">
          <form
            className="grid gap-3 rounded-2xl border bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendPush.mutate();
            }}
          >
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Title"
              value={push.title}
              onChange={(e) => setPush({ ...push, title: e.target.value })}
            />
            <textarea
              className="min-h-28 rounded-lg border px-3 py-2 text-sm"
              placeholder="Message"
              value={push.body}
              onChange={(e) => setPush({ ...push, body: e.target.value })}
            />
            <select
              className="h-10 rounded-lg border px-3 text-sm"
              value={push.audience}
              onChange={(e) => setPush({ ...push, audience: e.target.value })}
            >
              <option value="all">Everyone with the app</option>
              <option value="students">Students</option>
              <option value="parents">Parents</option>
              <option value="teachers">Teachers</option>
              <option value="admins">Administrators</option>
            </select>
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Deep link (optional) e.g. /notices/admissions"
              value={push.deepLink}
              onChange={(e) => setPush({ ...push, deepLink: e.target.value })}
            />
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#1a237e] px-4 text-sm font-semibold text-white"
              disabled={sendPush.isPending}
            >
              {sendPush.isPending ? 'Sending…' : 'Send notification'}
            </button>
          </form>
          <div className="rounded-2xl border bg-white p-4 text-sm">
            <h2 className="font-semibold text-[#1a237e]">Recent broadcasts</h2>
            {(broadcasts.data ?? []).length === 0 ? (
              <p className="mt-2 text-slate-500">No broadcasts yet.</p>
            ) : (
              <ul className="mt-2 divide-y">
                {(broadcasts.data ?? []).map((row) => (
                  <li key={row.id} className="py-2">
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      {row.audience} · {row.status} · delivered {row.successCount} · failed{' '}
                      {row.failureCount}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
