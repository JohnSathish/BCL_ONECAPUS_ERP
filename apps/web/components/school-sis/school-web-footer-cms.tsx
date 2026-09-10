'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchoolWebSite,
  fetchSchoolWebVisitorStats,
  patchSchoolWebSite,
} from '@/services/school-web';
import {
  DEFAULT_SCHOOL_FOOTER_SETTINGS,
  schoolFooterSettings,
} from '@/lib/school-web/footer-settings';
import { apiErrorMessage } from '@/utils/api-error';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebFooterCms() {
  const qc = useQueryClient();
  const site = useQuery({ queryKey: ['school-web-site'], queryFn: fetchSchoolWebSite });
  const stats = useQuery({
    queryKey: ['school-web-visitors'],
    queryFn: fetchSchoolWebVisitorStats,
  });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_SCHOOL_FOOTER_SETTINGS);

  useEffect(() => {
    if (site.data) setForm(schoolFooterSettings(site.data.extrasJson));
  }, [site.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebSite({
        extrasJson: {
          ...(site.data?.extrasJson ?? {}),
          footer: {
            ...asRecord(site.data?.extrasJson?.footer),
            visitorCounterEnabled: form.visitorCounterEnabled,
            visitorCounterLabel:
              form.visitorCounterLabel.trim() || DEFAULT_SCHOOL_FOOTER_SETTINGS.visitorCounterLabel,
            visitorTimeoutMinutes: form.visitorTimeoutMinutes,
            visitorAnalyticsEnabled: form.visitorAnalyticsEnabled,
            visitorRetentionDays: form.visitorRetentionDays,
            showDeveloperCredit: form.showDeveloperCredit,
            developerCreditText:
              form.developerCreditText.trim() || DEFAULT_SCHOOL_FOOTER_SETTINGS.developerCreditText,
            developerUrl: form.developerUrl.trim() || DEFAULT_SCHOOL_FOOTER_SETTINGS.developerUrl,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-site'] });
      qc.invalidateQueries({ queryKey: ['school-web-visitors'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const data = stats.data;

  return (
    <div className="space-y-4">
      <form
        className="grid max-w-3xl gap-3 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <h2 className="text-sm font-semibold text-[#1a365d]">Footer settings</h2>
          <p className="text-xs text-slate-500">
            Visitor counts use a hashed browser session. Refreshing or moving between pages does not
            create extra visitors.
          </p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.visitorCounterEnabled}
            onChange={(e) => setForm({ ...form, visitorCounterEnabled: e.target.checked })}
          />
          Enable visitor counter
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Visitor counter label
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.visitorCounterLabel}
            onChange={(e) => setForm({ ...form, visitorCounterLabel: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Active visitor timeout (minutes, 5–30)
          <input
            type="number"
            min={5}
            max={30}
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.visitorTimeoutMinutes}
            onChange={(e) => setForm({ ...form, visitorTimeoutMinutes: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.visitorAnalyticsEnabled}
            onChange={(e) => setForm({ ...form, visitorAnalyticsEnabled: e.target.checked })}
          />
          Enable visitor analytics
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Analytics data retention (days)
          <input
            type="number"
            min={30}
            max={1825}
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.visitorRetentionDays}
            onChange={(e) => setForm({ ...form, visitorRetentionDays: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showDeveloperCredit}
            onChange={(e) => setForm({ ...form, showDeveloperCredit: e.target.checked })}
          />
          Show developer credit
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Developer credit text
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.developerCreditText}
            onChange={(e) => setForm({ ...form, developerCreditText: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Developer website URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.developerUrl}
            onChange={(e) => setForm({ ...form, developerUrl: e.target.value })}
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save footer settings'}
        </button>
      </form>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">Visitor analytics</h2>
        <p className="text-xs text-slate-500">
          Currently online is live sessions. Visits are sessions. Unique visitors are distinct
          hashed browsers. Page views increase when the path changes, not when the same page is
          refreshed.
        </p>
        {data ? (
          <>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {[
                ['Currently online', data.currentlyOnline],
                ['Visits today', data.visitorsToday],
                ['Unique visitors today', data.uniqueVisitorsToday],
                ['Page views today', data.pageViewsToday],
                ['Visits this week', data.visitorsThisWeek],
                ['Visits this month', data.visitorsThisMonth],
                ['Total visitors', data.totalVisitors],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            {data.mostVisitedPages.length ? (
              <table className="mt-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2">Most visited pages (30 days)</th>
                    <th>Page views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mostVisitedPages.map((row) => (
                    <tr key={row.path} className="border-b">
                      <td className="py-2 font-mono">{row.path}</td>
                      <td>{row.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Trends appear after public visitors send heartbeats.
              </p>
            )}
            {data.trend.length ? (
              <table className="mt-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2">Day</th>
                    <th>Visits</th>
                    <th>Unique</th>
                    <th>Page views</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trend.map((row) => (
                    <tr key={row.day} className="border-b">
                      <td className="py-2">{row.day}</td>
                      <td>{row.visits}</td>
                      <td>{row.uniqueVisitors}</td>
                      <td>{row.pageViews}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading visitor stats…</p>
        )}
      </section>
    </div>
  );
}
