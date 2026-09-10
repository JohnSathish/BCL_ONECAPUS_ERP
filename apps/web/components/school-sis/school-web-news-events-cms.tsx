'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSchoolWebHomepage, patchSchoolWebHomepage } from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebNewsEventsCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: true,
    kicker: '',
    title: '',
    intro: '',
    noticesCta: '',
    noticesHref: '/notices',
    noticeLimit: '3',
    eventsKicker: '',
    eventsTitle: '',
    eventsIntro: '',
    eventsEmpty: '',
    eventsCta: '',
    eventsHref: '/events',
    eventLimit: '3',
    panelImageUrl: '',
    panelImageAlt: '',
  });

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'notices');
    if (!section) return;
    const payload = asRecord(section.payload);
    setForm({
      enabled: section.enabled,
      kicker: String(payload.kicker || ''),
      title: String(payload.title || ''),
      intro: String(payload.intro || ''),
      noticesCta: String(payload.noticesCta || asRecord(payload.cta).label || ''),
      noticesHref: String(payload.noticesHref || asRecord(payload.cta).href || '/notices'),
      noticeLimit: String(payload.noticeLimit || 3),
      eventsKicker: String(payload.eventsKicker || ''),
      eventsTitle: String(payload.eventsTitle || ''),
      eventsIntro: String(payload.eventsIntro || ''),
      eventsEmpty: String(payload.eventsEmpty || ''),
      eventsCta: String(payload.eventsCta || ''),
      eventsHref: String(payload.eventsHref || '/events'),
      eventLimit: String(payload.eventLimit || 3),
      panelImageUrl: String(payload.panelImageUrl || ''),
      panelImageAlt: String(payload.panelImageAlt || ''),
    });
  }, [home.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebHomepage('notices', {
        enabled: form.enabled,
        payload: {
          kicker: form.kicker,
          title: form.title,
          intro: form.intro,
          noticesCta: form.noticesCta,
          noticesHref: form.noticesHref,
          noticeLimit: Number(form.noticeLimit || 3),
          eventsKicker: form.eventsKicker,
          eventsTitle: form.eventsTitle,
          eventsIntro: form.eventsIntro,
          eventsEmpty: form.eventsEmpty,
          eventsCta: form.eventsCta,
          eventsHref: form.eventsHref,
          eventLimit: Number(form.eventLimit || 3),
          panelImageUrl: form.panelImageUrl || undefined,
          panelImageAlt: form.panelImageAlt || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const field = (label: string, key: keyof typeof form, multiline = false) => (
    <label className="text-xs font-semibold text-slate-500">
      {label}
      {multiline ? (
        <textarea
          className="mt-1 h-20 w-full rounded-lg border p-2 text-sm"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      ) : (
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </label>
  );

  return (
    <form
      className="space-y-3 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-[#1a365d]">News, notices & events</h2>
        <p className="text-xs text-slate-500">
          Homepage copy only. Notices and events themselves are published on the News / Notices and
          Events tabs. Do not add a panel photo unless the school has supplied one.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Show this section
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {field('Notices eyebrow', 'kicker')}
        {field('Notices heading', 'title')}
        {field('Notices CTA', 'noticesCta')}
        {field('Notices archive URL', 'noticesHref')}
        {field('Notices to show', 'noticeLimit')}
        {field('Events eyebrow', 'eventsKicker')}
        {field('Events heading', 'eventsTitle')}
        {field('Events CTA', 'eventsCta')}
        {field('Events archive URL', 'eventsHref')}
        {field('Events to show', 'eventLimit')}
        {field('Optional panel image URL', 'panelImageUrl')}
        {field('Panel image alt', 'panelImageAlt')}
      </div>
      {field('Notices description', 'intro', true)}
      {field('Events description', 'eventsIntro', true)}
      {field('Events empty state', 'eventsEmpty', true)}
      <button
        type="submit"
        className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
        disabled={save.isPending}
      >
        {save.isPending ? 'Saving…' : 'Save news & events section'}
      </button>
    </form>
  );
}
