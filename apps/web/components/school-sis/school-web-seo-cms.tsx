'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchoolWebSeoAudit,
  fetchSchoolWebSite,
  patchSchoolWebSite,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebSeoCms() {
  const qc = useQueryClient();
  const site = useQuery({ queryKey: ['school-web-site'], queryFn: fetchSchoolWebSite });
  const audit = useQuery({ queryKey: ['school-web-seo-audit'], queryFn: fetchSchoolWebSeoAudit });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    seoTitle: '',
    seoDescription: '',
    publicBaseUrl: 'https://stlukestura.in',
    country: 'India',
    googleSiteVerification: '',
    googleMapsUrl: '',
    defaultOgImage: '/school-sis/st-lukes-logo.png',
    latitude: '',
    longitude: '',
    logoUrl: '/school-sis/st-lukes-logo.png',
    innerHeroImage: '/school-sis/campus-hero.jpg',
    innerHeroDecorative: 'Education for a Better Tomorrow',
    innerHeroOverlay: '0.58',
    innerHeroEnabled: true,
  });

  useEffect(() => {
    if (!site.data) return;
    const extras = site.data.extrasJson ?? {};
    const seo = asRecord(extras.seo);
    const innerHero = asRecord(extras.innerHero);
    setForm({
      seoTitle: site.data.seoTitle ?? '',
      seoDescription: site.data.seoDescription ?? '',
      publicBaseUrl: String(seo.publicBaseUrl || 'https://stlukestura.in'),
      country: String(seo.country || 'India'),
      googleSiteVerification: String(seo.googleSiteVerification || ''),
      googleMapsUrl: String(seo.googleMapsUrl || ''),
      defaultOgImage: String(
        seo.defaultOgImage || extras.logoUrl || '/school-sis/st-lukes-logo.png',
      ),
      latitude: String(seo.latitude || ''),
      longitude: String(seo.longitude || ''),
      logoUrl: String(extras.logoUrl || '/school-sis/st-lukes-logo.png'),
      innerHeroImage: String(
        innerHero.backgroundImage || extras.campusImage || '/school-sis/campus-hero.jpg',
      ),
      innerHeroDecorative: String(innerHero.decorativeText || 'Education for a Better Tomorrow'),
      innerHeroOverlay: String(innerHero.overlay ?? '0.58'),
      innerHeroEnabled: innerHero.enabled !== false && innerHero.enabled !== 'false',
    });
  }, [site.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebSite({
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        extrasJson: {
          ...(site.data?.extrasJson ?? {}),
          logoUrl: form.logoUrl.trim(),
          innerHero: {
            enabled: form.innerHeroEnabled,
            backgroundImage: form.innerHeroImage.trim() || '/school-sis/campus-hero.jpg',
            decorativeText: form.innerHeroDecorative.trim() || undefined,
            overlay: Number(form.innerHeroOverlay) || 0.58,
          },
          seo: {
            ...asRecord(site.data?.extrasJson?.seo),
            publicBaseUrl: form.publicBaseUrl.trim(),
            country: form.country.trim(),
            googleSiteVerification: form.googleSiteVerification.trim() || undefined,
            googleMapsUrl: form.googleMapsUrl.trim() || undefined,
            defaultOgImage: form.defaultOgImage.trim() || undefined,
            latitude: form.latitude.trim() || undefined,
            longitude: form.longitude.trim() || undefined,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-site'] });
      qc.invalidateQueries({ queryKey: ['school-web-seo-audit'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const data = audit.data;
  const check = (ok: boolean, label: string, hint?: string) => (
    <li className={ok ? 'text-emerald-700' : 'text-amber-700'}>
      {ok ? '✓' : '⚠'} {label}
      {hint && !ok ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </li>
  );

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
          <h2 className="text-sm font-semibold text-[#1a365d]">SEO · Global settings</h2>
          <p className="text-xs text-slate-500">
            School name, address, phone and email are edited on Site & SEO so NAP stays consistent.
            Leave phone, email, maps coordinates and Search Console verification blank until the
            school confirms them. This does not guarantee Google rankings.
          </p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <label className="text-xs font-semibold text-slate-500">
          Homepage title
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.seoTitle}
            onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Homepage meta description
          <textarea
            className="mt-1 h-24 w-full rounded-lg border p-2 text-sm"
            value={form.seoDescription}
            onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Public website URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.publicBaseUrl}
            onChange={(e) => setForm({ ...form, publicBaseUrl: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Country
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Logo URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          />
        </label>
        <p className="md:col-span-2 text-sm font-semibold text-[#1a365d]">Inner page headers</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.innerHeroEnabled}
            onChange={(e) => setForm({ ...form, innerHeroEnabled: e.target.checked })}
          />
          Show photo headers on interior pages
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Default header image
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.innerHeroImage}
            onChange={(e) => setForm({ ...form, innerHeroImage: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Decorative header text
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.innerHeroDecorative}
            onChange={(e) => setForm({ ...form, innerHeroDecorative: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Overlay strength (0.25–0.85)
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.innerHeroOverlay}
            onChange={(e) => setForm({ ...form, innerHeroOverlay: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Default social / OG image
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.defaultOgImage}
            onChange={(e) => setForm({ ...form, defaultOgImage: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Google Maps / Business Profile URL (optional)
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.googleMapsUrl}
            onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })}
            placeholder="https://maps.google.com/..."
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            Latitude (optional)
            <input
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Longitude (optional)
            <input
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            />
          </label>
        </div>
        <label className="text-xs font-semibold text-slate-500">
          Google Search Console verification meta content (optional)
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.googleSiteVerification}
            onChange={(e) => setForm({ ...form, googleSiteVerification: e.target.value })}
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save global SEO'}
        </button>
      </form>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">SEO dashboard</h2>
        <p className="text-xs text-slate-500">
          Practical checklist for published website content. Not a ranking score.
        </p>
        {data ? (
          <>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Published</dt>
                <dd className="text-lg font-semibold">{data.published}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Indexable</dt>
                <dd className="text-lg font-semibold">{data.indexed}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Noindex</dt>
                <dd className="text-lg font-semibold">{data.noindex}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Missing titles</dt>
                <dd className="text-lg font-semibold">{data.missingTitles}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Missing descriptions</dt>
                <dd className="text-lg font-semibold">{data.missingDescriptions}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1 text-sm">
              {(data.audit ?? []).map((row) => (
                <li
                  key={row.id}
                  className={
                    row.status === 'pass'
                      ? 'text-emerald-700'
                      : row.status === 'error'
                        ? 'text-red-700'
                        : 'text-amber-700'
                  }
                >
                  {row.status === 'pass' ? 'PASS' : row.status === 'error' ? 'ERROR' : 'WARNING'} ·{' '}
                  {row.label}
                  {row.hint ? (
                    <span className="block text-xs text-slate-500">{row.hint}</span>
                  ) : null}
                </li>
              ))}
              {check(data.homeTitle, 'Homepage title')}
              {check(data.homeDescription, 'Homepage description')}
              {check(true, `Sitemap ${data.sitemapPath}`)}
              {check(true, `Robots ${data.robotsPath}`)}
              {check(
                data.googleVerification,
                'Search Console verification',
                'Add the verification token after domain ownership is confirmed.',
              )}
              {check(Boolean(data.publicBaseUrl), 'Public website URL')}
            </ul>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2">Path</th>
                    <th>Status</th>
                    <th>Index</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={`${row.kind}-${row.path}`} className="border-b">
                      <td className="py-2 font-mono">{row.path}</td>
                      <td>{row.status}</td>
                      <td>{row.indexable ? 'index' : 'noindex'}</td>
                      <td>{row.warnings.join(' ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading checklist…</p>
        )}
      </section>
    </div>
  );
}
