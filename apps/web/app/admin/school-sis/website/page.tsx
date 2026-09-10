'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolWebEnquiries,
  fetchSchoolWebEventsOffice,
  fetchSchoolWebHomepage,
  fetchSchoolWebNoticesOffice,
  fetchSchoolWebPages,
  fetchSchoolWebSite,
  patchSchoolWebHomepage,
  patchSchoolWebSite,
  upsertSchoolWebEvent,
  upsertSchoolWebNotice,
  upsertSchoolWebPage,
} from '@/services/school-web';
import { SchoolWebFlashNewsCms } from '@/components/school-sis/school-web-flash-news-cms';
import { SchoolWebAboutPrincipalCms } from '@/components/school-sis/school-web-about-cms';
import { SchoolWebExploreCms } from '@/components/school-sis/school-web-explore-cms';
import { SchoolWebNewsEventsCms } from '@/components/school-sis/school-web-news-events-cms';
import { SchoolWebContactCms } from '@/components/school-sis/school-web-contact-cms';
import { SchoolWebSeoCms } from '@/components/school-sis/school-web-seo-cms';
import { SchoolWebFooterCms } from '@/components/school-sis/school-web-footer-cms';
import {
  EMPTY_SEO_FORM,
  SchoolSeoFields,
  seoFormFromJson,
  seoJsonFromForm,
} from '@/components/school-sis/school-web-seo-fields';
import { apiErrorMessage } from '@/utils/api-error';

export default function SchoolWebCmsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<
    'site' | 'home' | 'pages' | 'notices' | 'events' | 'inbox' | 'seo' | 'footer'
  >('site');
  const [error, setError] = useState<string | null>(null);
  const site = useQuery({ queryKey: ['school-web-site'], queryFn: fetchSchoolWebSite, enabled });
  const home = useQuery({
    queryKey: ['school-web-home'],
    queryFn: fetchSchoolWebHomepage,
    enabled,
  });
  const pages = useQuery({ queryKey: ['school-web-pages'], queryFn: fetchSchoolWebPages, enabled });
  const notices = useQuery({
    queryKey: ['school-web-notices'],
    queryFn: fetchSchoolWebNoticesOffice,
    enabled,
  });
  const events = useQuery({
    queryKey: ['school-web-events'],
    queryFn: fetchSchoolWebEventsOffice,
    enabled,
  });
  const inbox = useQuery({
    queryKey: ['school-web-inbox'],
    queryFn: fetchSchoolWebEnquiries,
    enabled,
  });
  const [siteForm, setSiteForm] = useState({
    displayName: '',
    addressLine: '',
    seoTitle: '',
    seoDescription: '',
    applyCtaUrl: '',
    phone: '',
    email: '',
    footerBlurb: '',
    newsletterIntro: '',
    officeHours: '',
    facebook: '',
    instagram: '',
    youtube: '',
  });
  const [pageForm, setPageForm] = useState({
    slug: '',
    title: '',
    body: '',
    status: 'PUBLISHED',
    seo: EMPTY_SEO_FORM,
  });
  const [noticeForm, setNoticeForm] = useState({
    slug: '',
    title: '',
    body: '',
    category: 'GENERAL',
    status: 'PUBLISHED',
    featured: false,
    seo: EMPTY_SEO_FORM,
  });
  const [eventForm, setEventForm] = useState({
    slug: '',
    title: '',
    startsAt: '',
    endsAt: '',
    venue: '',
    summary: '',
    status: 'PUBLISHED',
    seo: EMPTY_SEO_FORM,
  });

  useEffect(() => {
    if (!site.data) return;
    const extra = site.data.extrasJson ?? {};
    const social =
      extra.socialLinks && typeof extra.socialLinks === 'object'
        ? (extra.socialLinks as Record<string, unknown>)
        : {};
    setSiteForm({
      displayName: site.data.displayName,
      addressLine: site.data.addressLine,
      seoTitle: site.data.seoTitle ?? '',
      seoDescription: site.data.seoDescription ?? '',
      applyCtaUrl: site.data.applyCtaUrl ?? '',
      phone: site.data.phone ?? '',
      email: site.data.email ?? '',
      footerBlurb: String(extra.footerBlurb || ''),
      newsletterIntro: String(extra.newsletterIntro || ''),
      officeHours: String(extra.officeHours || ''),
      facebook: String(social.facebook || ''),
      instagram: String(social.instagram || ''),
      youtube: String(social.youtube || ''),
    });
  }, [site.data]);

  const saveSite = useMutation({
    mutationFn: () =>
      patchSchoolWebSite({
        displayName: siteForm.displayName,
        addressLine: siteForm.addressLine,
        seoTitle: siteForm.seoTitle,
        seoDescription: siteForm.seoDescription,
        applyCtaUrl: siteForm.applyCtaUrl,
        phone: siteForm.phone.trim() || undefined,
        email: siteForm.email.trim() || undefined,
        extrasJson: {
          ...(site.data?.extrasJson ?? {}),
          footerBlurb: siteForm.footerBlurb.trim(),
          newsletterIntro: siteForm.newsletterIntro.trim(),
          officeHours: siteForm.officeHours.trim() || undefined,
          socialLinks: {
            facebook: siteForm.facebook.trim() || undefined,
            instagram: siteForm.instagram.trim() || undefined,
            youtube: siteForm.youtube.trim() || undefined,
          },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-web-site'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const tabs = [
    ['site', 'Site & SEO'],
    ['home', 'Homepage'],
    ['pages', 'Pages'],
    ['notices', 'News / Notices'],
    ['events', 'Events'],
    ['inbox', 'Enquiries'],
    ['seo', 'SEO'],
    ['footer', 'Footer'],
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1a365d]">Website CMS</h1>
        <p className="text-sm text-slate-500">
          Public site: <code>http://school.localhost:3000</code> or <code>/school-site</code> on the
          office host. Content is stored in the school website CMS, not the college website module.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${tab === id ? 'bg-[#163a6b] text-white' : 'border bg-white'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {tab === 'site' ? (
        <form
          className="grid max-w-xl gap-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveSite.mutate();
          }}
        >
          {(
            [
              'displayName',
              'addressLine',
              'phone',
              'email',
              'seoTitle',
              'seoDescription',
              'applyCtaUrl',
            ] as const
          ).map((key) => (
            <label key={key} className="text-xs font-semibold text-slate-500">
              {
                {
                  displayName: 'Display name',
                  addressLine: 'Address',
                  phone: 'Phone (optional — leave blank until confirmed)',
                  email: 'Email (optional — leave blank until confirmed)',
                  seoTitle: 'SEO title',
                  seoDescription: 'SEO description',
                  applyCtaUrl: 'Apply URL',
                }[key]
              }
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={siteForm[key]}
                onChange={(e) => setSiteForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="text-xs font-semibold text-slate-500">
            Footer introduction
            <textarea
              className="mt-1 h-20 w-full rounded-lg border p-2 text-sm"
              value={siteForm.footerBlurb}
              onChange={(e) => setSiteForm((f) => ({ ...f, footerBlurb: e.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Newsletter text
            <textarea
              className="mt-1 h-16 w-full rounded-lg border p-2 text-sm"
              value={siteForm.newsletterIntro}
              onChange={(e) => setSiteForm((f) => ({ ...f, newsletterIntro: e.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Office hours (optional)
            <input
              className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              value={siteForm.officeHours}
              onChange={(e) => setSiteForm((f) => ({ ...f, officeHours: e.target.value }))}
            />
          </label>
          {(['facebook', 'instagram', 'youtube'] as const).map((key) => (
            <label key={key} className="text-xs font-semibold text-slate-500">
              {key} URL (optional)
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={siteForm[key]}
                onChange={(e) => setSiteForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="https://"
              />
            </label>
          ))}
          <button
            type="submit"
            className="h-10 rounded-xl bg-[#2563eb] text-sm font-semibold text-white"
          >
            Save site
          </button>
        </form>
      ) : null}

      {tab === 'home' ? (
        <div className="space-y-3">
          <SchoolWebHeroCms />
          <SchoolWebFlashNewsCms />
          <SchoolWebAboutPrincipalCms />
          <SchoolWebExploreCms />
          <SchoolWebNewsEventsCms />
          <SchoolWebContactCms />
          {(home.data ?? [])
            .filter(
              (section) =>
                !['hero', 'flashNews', 'about', 'explore', 'notices', 'contact'].includes(
                  section.key,
                ),
            )
            .map((section) => (
              <form
                key={section.key}
                className="rounded-2xl border bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const payload = JSON.parse(String(fd.get('payload') || '{}'));
                  patchSchoolWebHomepage(section.key, { payload, enabled: true }).then(() =>
                    qc.invalidateQueries({ queryKey: ['school-web-home'] }),
                  );
                }}
              >
                <p className="text-sm font-semibold text-[#1a365d]">{section.key}</p>
                <textarea
                  name="payload"
                  className="mt-2 h-40 w-full rounded-lg border p-2 font-mono text-xs"
                  defaultValue={JSON.stringify(section.payload, null, 2)}
                />
                <button type="submit" className="mt-2 rounded-xl border px-3 py-1.5 text-sm">
                  Save section
                </button>
              </form>
            ))}
        </div>
      ) : null}

      {tab === 'pages' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            className="rounded-2xl border bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              upsertSchoolWebPage({
                slug: pageForm.slug,
                title: pageForm.title,
                status: pageForm.status,
                seoTitle: pageForm.seo.title || undefined,
                seoDescription: pageForm.seo.description || undefined,
                seoJson: seoJsonFromForm(pageForm.seo),
                blockDocument: {
                  version: 1,
                  blocks: pageForm.body.split('\n\n').map((text) => ({ type: 'paragraph', text })),
                },
              }).then(() => qc.invalidateQueries({ queryKey: ['school-web-pages'] }));
            }}
          >
            <h2 className="text-sm font-semibold">Edit page</h2>
            <input
              className="mt-2 h-10 w-full rounded border px-3 text-sm"
              placeholder="slug"
              value={pageForm.slug}
              onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
            />
            <input
              className="mt-2 h-10 w-full rounded border px-3 text-sm"
              placeholder="title"
              value={pageForm.title}
              onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
            />
            <textarea
              className="mt-2 h-40 w-full rounded border p-2 text-sm"
              placeholder="Paragraphs separated by a blank line"
              value={pageForm.body}
              onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })}
            />
            <div className="mt-3">
              <SchoolSeoFields
                value={pageForm.seo}
                onChange={(seo) => setPageForm({ ...pageForm, seo })}
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-xl bg-[#2563eb] px-3 py-2 text-sm text-white"
            >
              Publish page
            </button>
          </form>
          <ul className="rounded-2xl border bg-white p-4 text-sm">
            {(pages.data ?? []).map((p) => (
              <li key={p.slug} className="border-b py-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() =>
                    setPageForm({
                      slug: p.slug,
                      title: p.title,
                      body: (p.blockDocument?.blocks ?? [])
                        .map((b) => b.text || '')
                        .filter(Boolean)
                        .join('\n\n'),
                      status: p.status,
                      seo: seoFormFromJson(p.seoJson),
                    })
                  }
                >
                  <strong>{p.title}</strong> · {p.slug} · {p.status}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'notices' ? (
        <form
          className="max-w-xl rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            upsertSchoolWebNotice({
              slug: noticeForm.slug,
              title: noticeForm.title,
              body: noticeForm.body,
              category: noticeForm.category,
              status: noticeForm.status,
              featured: noticeForm.featured,
              seoJson: seoJsonFromForm(noticeForm.seo),
            }).then(() => qc.invalidateQueries({ queryKey: ['school-web-notices'] }));
          }}
        >
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="slug"
            value={noticeForm.slug}
            onChange={(e) => setNoticeForm({ ...noticeForm, slug: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="title"
            value={noticeForm.title}
            onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="category (GENERAL, ACADEMIC, EVENT)"
            value={noticeForm.category}
            onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
          />
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noticeForm.featured}
              onChange={(e) => setNoticeForm({ ...noticeForm, featured: e.target.checked })}
            />
            Featured on homepage
          </label>
          <textarea
            className="mb-2 h-28 w-full rounded border p-2 text-sm"
            placeholder="body"
            value={noticeForm.body}
            onChange={(e) => setNoticeForm({ ...noticeForm, body: e.target.value })}
          />
          <SchoolSeoFields
            value={noticeForm.seo}
            onChange={(seo) => setNoticeForm({ ...noticeForm, seo })}
          />
          <button type="submit" className="rounded-xl bg-[#2563eb] px-3 py-2 text-sm text-white">
            Publish notice
          </button>
          <ul className="mt-4 text-sm">
            {(notices.data ?? []).map((n) => (
              <li key={n.slug}>
                {n.title} · {n.status}
              </li>
            ))}
          </ul>
        </form>
      ) : null}

      {tab === 'events' ? (
        <form
          className="max-w-xl rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            upsertSchoolWebEvent({
              slug: eventForm.slug,
              title: eventForm.title,
              summary: eventForm.summary,
              startsAt: eventForm.startsAt,
              endsAt: eventForm.endsAt || undefined,
              venue: eventForm.venue,
              status: eventForm.status,
              seoJson: seoJsonFromForm(eventForm.seo),
            }).then(() => qc.invalidateQueries({ queryKey: ['school-web-events'] }));
          }}
        >
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="slug"
            value={eventForm.slug}
            onChange={(e) => setEventForm({ ...eventForm, slug: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="title"
            value={eventForm.title}
            onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
          />
          <textarea
            className="mb-2 h-20 w-full rounded border p-2 text-sm"
            placeholder="summary"
            value={eventForm.summary ?? ''}
            onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            type="datetime-local"
            value={eventForm.startsAt}
            onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            type="datetime-local"
            value={eventForm.endsAt ?? ''}
            onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
          />
          <input
            className="mb-2 h-10 w-full rounded border px-3 text-sm"
            placeholder="venue"
            value={eventForm.venue}
            onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
          />
          <SchoolSeoFields
            value={eventForm.seo}
            onChange={(seo) => setEventForm({ ...eventForm, seo })}
          />
          <button type="submit" className="rounded-xl bg-[#2563eb] px-3 py-2 text-sm text-white">
            Publish event
          </button>
          <ul className="mt-4 text-sm">
            {(events.data ?? []).map((n) => (
              <li key={n.slug}>
                {n.title} · {n.status}
              </li>
            ))}
          </ul>
        </form>
      ) : null}

      {tab === 'seo' ? <SchoolWebSeoCms /> : null}
      {tab === 'footer' ? <SchoolWebFooterCms /> : null}

      {tab === 'inbox' ? (
        <ul className="rounded-2xl border bg-white p-4 text-sm">
          {(inbox.data ?? []).map((row) => (
            <li key={row.id} className="border-b py-3">
              <strong>{row.name}</strong> · {row.email || 'no email'}
              <p className="text-slate-600">{row.message}</p>
            </li>
          ))}
          {!inbox.data?.length ? <p className="text-slate-400">No enquiries yet.</p> : null}
        </ul>
      ) : null}
    </div>
  );
}
