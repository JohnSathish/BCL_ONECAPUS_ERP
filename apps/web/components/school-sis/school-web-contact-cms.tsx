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

export function SchoolWebContactCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: true,
    kicker: '',
    title: '',
    intro: '',
    officeHours: '',
    welcomeQuote: '',
    mapQuery: '',
    mapsUrl: '',
    mapLat: '',
    mapLng: '',
    locationLabel: '',
    directionsLabel: '',
    applyLabel: '',
    applyHref: '',
    contactLabel: '',
    contactHref: '',
    campusPhotoUrl: '',
    campusPhotoAlt: '',
    campusTitle: '',
    campusCaption: '',
    campusHref: '',
  });

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'contact');
    if (!section) return;
    const payload = asRecord(section.payload);
    setForm({
      enabled: section.enabled,
      kicker: String(payload.kicker || ''),
      title: String(payload.title || ''),
      intro: String(payload.intro || payload.body || ''),
      officeHours: String(payload.officeHours || ''),
      welcomeQuote: String(payload.welcomeQuote || ''),
      mapQuery: String(payload.mapQuery || ''),
      mapsUrl: String(payload.mapsUrl || ''),
      mapLat: String(payload.mapLat || ''),
      mapLng: String(payload.mapLng || ''),
      locationLabel: String(payload.locationLabel || ''),
      directionsLabel: String(payload.directionsLabel || ''),
      applyLabel: String(payload.applyLabel || ''),
      applyHref: String(payload.applyHref || ''),
      contactLabel: String(payload.contactLabel || ''),
      contactHref: String(payload.contactHref || ''),
      campusPhotoUrl: String(payload.campusPhotoUrl || ''),
      campusPhotoAlt: String(payload.campusPhotoAlt || ''),
      campusTitle: String(payload.campusTitle || ''),
      campusCaption: String(payload.campusCaption || ''),
      campusHref: String(payload.campusHref || ''),
    });
  }, [home.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebHomepage('contact', {
        enabled: form.enabled,
        payload: {
          kicker: form.kicker,
          title: form.title,
          intro: form.intro,
          officeHours: form.officeHours || undefined,
          welcomeQuote: form.welcomeQuote || undefined,
          mapQuery: form.mapQuery,
          mapsUrl: form.mapsUrl || undefined,
          mapLat: form.mapLat || undefined,
          mapLng: form.mapLng || undefined,
          locationLabel: form.locationLabel,
          directionsLabel: form.directionsLabel,
          applyLabel: form.applyLabel,
          applyHref: form.applyHref,
          contactLabel: form.contactLabel,
          contactHref: form.contactHref,
          campusPhotoUrl: form.campusPhotoUrl || undefined,
          campusPhotoAlt: form.campusPhotoAlt || undefined,
          campusTitle: form.campusTitle || undefined,
          campusCaption: form.campusCaption || undefined,
          campusHref: form.campusHref || undefined,
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
        <h2 className="text-sm font-semibold text-[#1a365d]">Contact & location</h2>
        <p className="text-xs text-slate-500">
          Phone and email come from Site & SEO. Leave them blank until the office confirms them. Do
          not add a campus photo unless it is a real school photograph (not the crest).
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
        {field('Eyebrow', 'kicker')}
        {field('Heading', 'title')}
        {field('Office hours (optional)', 'officeHours')}
        {field('Welcome quote (optional)', 'welcomeQuote')}
        {field('Map search', 'mapQuery')}
        {field('Google Maps URL', 'mapsUrl')}
        {field('Latitude', 'mapLat')}
        {field('Longitude', 'mapLng')}
        {field('Location tab', 'locationLabel')}
        {field('Directions tab', 'directionsLabel')}
        {field('Apply label', 'applyLabel')}
        {field('Apply URL', 'applyHref')}
        {field('Contact label', 'contactLabel')}
        {field('Contact URL', 'contactHref')}
        {field('Campus photo URL (optional)', 'campusPhotoUrl')}
        {field('Campus photo alt', 'campusPhotoAlt')}
        {field('Campus title', 'campusTitle')}
        {field('Campus caption', 'campusCaption')}
        {field('Campus link', 'campusHref')}
      </div>
      {field('Description', 'intro', true)}
      <button
        type="submit"
        className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
        disabled={save.isPending}
      >
        {save.isPending ? 'Saving…' : 'Save contact section'}
      </button>
    </form>
  );
}
