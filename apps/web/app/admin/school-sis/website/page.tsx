'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { SchoolWebLaunchPopupCms } from '@/components/school-sis/school-web-launch-popup-cms';
import { SchoolWebHeroCms } from '@/components/school-sis/school-web-hero-cms';
import { SchoolWebFlashNewsCms } from '@/components/school-sis/school-web-flash-news-cms';
import { SchoolWebAboutPrincipalCms } from '@/components/school-sis/school-web-about-cms';
import { SchoolWebExploreCms } from '@/components/school-sis/school-web-explore-cms';
import { SchoolWebNewsEventsCms } from '@/components/school-sis/school-web-news-events-cms';
import { SchoolWebContactCms } from '@/components/school-sis/school-web-contact-cms';
import { SchoolWebSeoCms } from '@/components/school-sis/school-web-seo-cms';
import { SchoolWebFooterCms } from '@/components/school-sis/school-web-footer-cms';
import {
  SchoolWebCmsErrorBoundary,
  schoolWebPublicSiteUrl,
} from '@/components/school-sis/school-web-cms-error-boundary';
import {
  EMPTY_SEO_FORM,
  SchoolSeoFields,
  seoFormFromJson,
  seoJsonFromForm,
} from '@/components/school-sis/school-web-seo-fields';
import { apiErrorMessage } from '@/utils/api-error';
import {
  parseSchoolWebCmsView,
  SchoolWebCmsShell,
} from '@/components/school-sis/school-web-cms-shell';
import {
  CmsCard,
  CmsField,
  CmsInput,
  CmsPageHeader,
  CmsSaveBar,
  CmsTextarea,
} from '@/components/school-sis/school-web-cms-ui';

const HOME_MANAGED_KEYS = [
  'hero',
  'flashNews',
  'launchPopup',
  'about',
  'explore',
  'notices',
  'contact',
];

const HOME_SECTION_LABELS: Record<string, string> = {
  campus: 'Campus band',
  pillars: 'Stats strip',
  gallery: 'Gallery teaser',
};

export default function SchoolWebCmsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const params = useSearchParams();
  const view = parseSchoolWebCmsView(params.get('view'), '/admin/school-sis/website');
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
  const emptySiteForm = {
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
  };
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [siteBaseline, setSiteBaseline] = useState(emptySiteForm);
  const [siteSaved, setSiteSaved] = useState(false);
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
    const next = {
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
    };
    setSiteForm(next);
    setSiteBaseline(next);
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
    onSuccess: () => {
      setSiteBaseline(siteForm);
      setSiteSaved(true);
      qc.invalidateQueries({ queryKey: ['school-web-site'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const siteDirty = JSON.stringify(siteForm) !== JSON.stringify(siteBaseline);

  const viewMeta: Record<string, { title: string; crumb: string }> = {
    dashboard: { title: 'Dashboard', crumb: 'Overview' },
    home: { title: 'Homepage', crumb: 'Homepage' },
    pages: { title: 'Pages', crumb: 'Pages' },
    notices: { title: 'News & Notices', crumb: 'News & Notices' },
    events: { title: 'Events', crumb: 'Events' },
    launch: { title: 'Launch popup', crumb: 'Launch popup' },
    admissions: { title: 'Admissions', crumb: 'Admissions' },
    inbox: { title: 'Enquiries', crumb: 'Enquiries' },
    seo: { title: 'SEO', crumb: 'SEO' },
    footer: { title: 'Footer', crumb: 'Footer' },
    site: { title: 'Site settings', crumb: 'Site settings' },
  };
  const meta = viewMeta[view] ?? viewMeta.dashboard!;

  return (
    <SchoolWebCmsShell title={meta.title} crumbs={[{ label: meta.crumb }]}>
      {error && view !== 'launch' ? <p className="sls-cms-error">{error}</p> : null}

      {view === 'dashboard' ? (
        <>
          <CmsPageHeader
            title="Website overview"
            description="Manage the public St. Luke’s website from one place. Choose a section in the sidebar."
          />
          <div className="sls-cms-stats">
            <div className="sls-cms-stat">
              <b>{pages.data?.length ?? '—'}</b>
              <span>Published pages</span>
            </div>
            <div className="sls-cms-stat">
              <b>{notices.data?.length ?? '—'}</b>
              <span>Notices</span>
            </div>
            <div className="sls-cms-stat">
              <b>{events.data?.length ?? '—'}</b>
              <span>Events</span>
            </div>
            <div className="sls-cms-stat">
              <b>{inbox.data?.length ?? '—'}</b>
              <span>Enquiries</span>
            </div>
          </div>
          <div className="sls-cms-stack" style={{ marginTop: 16 }}>
            <CmsCard
              title="Website status"
              description="The public site is live. Use Popups if you still want the coming-soon overlay."
            >
              <p>
                Open the live site:{' '}
                <a href={schoolWebPublicSiteUrl()} target="_blank" rel="noreferrer">
                  {schoolWebPublicSiteUrl()}
                </a>
              </p>
            </CmsCard>
          </div>
        </>
      ) : null}

      {view === 'admissions' ? (
        <>
          <CmsPageHeader
            title="Admissions"
            description="Point families to the apply page on the public website, or open the school admissions office."
          />
          <CmsCard title="Public apply page">
            <p>
              Website apply link: <strong>{siteForm.applyCtaUrl || '/apply'}</strong>
            </p>
            <p className="sls-cms-help">
              Change this in Site settings. Applications are also managed under School ERP →
              Application.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Link className="sls-cms-btn gold" href="/admin/school-sis/admissions">
                Open admissions office
              </Link>
              <Link className="sls-cms-btn ghost" href="/admin/school-sis/website?view=site">
                Edit apply link
              </Link>
            </div>
          </CmsCard>
        </>
      ) : null}

      {view === 'site' ? (
        <>
          <CmsPageHeader
            title="School identity"
            description="Name, address and contact details used in the header, footer, contact page and Google search."
          />
          <div className="sls-cms-grid has-preview">
            <div className="sls-cms-stack">
              <CmsCard
                title="School name & address"
                description="This is what families see first in the website header and footer."
              >
                <div className="sls-cms-fields">
                  <CmsField label="Display name" span2>
                    <CmsInput
                      value={siteForm.displayName}
                      onChange={(e) => setSiteForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                  </CmsField>
                  <CmsField
                    label="Address"
                    span2
                    hint="Example: Walbakgre, P.O. Dakopgre, Tura – 794101"
                  >
                    <CmsTextarea
                      value={siteForm.addressLine}
                      onChange={(e) => setSiteForm((f) => ({ ...f, addressLine: e.target.value }))}
                    />
                  </CmsField>
                </div>
              </CmsCard>
              <CmsCard
                title="Contact"
                description="Leave phone blank until the office confirms the public number."
              >
                <div className="sls-cms-fields cols-2">
                  <CmsField label="Email">
                    <CmsInput
                      type="email"
                      value={siteForm.email}
                      onChange={(e) => setSiteForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="admin@stlukestura.in"
                    />
                  </CmsField>
                  <CmsField label="Phone" hint="Optional until confirmed">
                    <CmsInput
                      value={siteForm.phone}
                      onChange={(e) => setSiteForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Not published yet"
                    />
                  </CmsField>
                  <CmsField label="Office hours">
                    <CmsInput
                      value={siteForm.officeHours}
                      onChange={(e) => setSiteForm((f) => ({ ...f, officeHours: e.target.value }))}
                      placeholder="9:00 a.m. to 2:30 p.m."
                    />
                  </CmsField>
                  <CmsField label="Apply page URL" hint="Usually /apply">
                    <CmsInput
                      value={siteForm.applyCtaUrl}
                      onChange={(e) => setSiteForm((f) => ({ ...f, applyCtaUrl: e.target.value }))}
                    />
                  </CmsField>
                </div>
              </CmsCard>
              <CmsCard
                title="Search listing"
                description="Title and description shown in Google and browser tabs."
              >
                <div className="sls-cms-fields">
                  <CmsField label="SEO title" span2>
                    <CmsInput
                      value={siteForm.seoTitle}
                      onChange={(e) => setSiteForm((f) => ({ ...f, seoTitle: e.target.value }))}
                    />
                  </CmsField>
                  <CmsField label="SEO description" span2>
                    <CmsTextarea
                      value={siteForm.seoDescription}
                      onChange={(e) =>
                        setSiteForm((f) => ({ ...f, seoDescription: e.target.value }))
                      }
                    />
                  </CmsField>
                </div>
              </CmsCard>
              <CmsCard title="Footer copy">
                <div className="sls-cms-fields">
                  <CmsField label="Footer introduction" span2>
                    <CmsTextarea
                      value={siteForm.footerBlurb}
                      onChange={(e) => setSiteForm((f) => ({ ...f, footerBlurb: e.target.value }))}
                    />
                  </CmsField>
                  <CmsField label="Newsletter text" span2>
                    <CmsTextarea
                      value={siteForm.newsletterIntro}
                      onChange={(e) =>
                        setSiteForm((f) => ({ ...f, newsletterIntro: e.target.value }))
                      }
                    />
                  </CmsField>
                </div>
              </CmsCard>
              <CmsCard
                title="Social links"
                description="Leave empty if the school has no public page yet."
              >
                <div className="sls-cms-fields cols-2">
                  {(['facebook', 'instagram', 'youtube'] as const).map((key) => (
                    <CmsField key={key} label={`${key[0]!.toUpperCase()}${key.slice(1)} URL`}>
                      <CmsInput
                        value={siteForm[key]}
                        onChange={(e) => setSiteForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder="https://"
                      />
                    </CmsField>
                  ))}
                </div>
              </CmsCard>
            </div>
            <aside className="sls-cms-preview" aria-label="Identity preview">
              <header>
                <strong>How this appears</strong>
              </header>
              <div className="sls-cms-identity-preview">
                <p className="kicker">St. Luke’s Secondary School</p>
                <h4>{siteForm.displayName || 'School name'}</h4>
                <p>{siteForm.addressLine || 'Address will show here'}</p>
                <p>
                  {siteForm.email || 'Email not set'}
                  {siteForm.phone ? ` · ${siteForm.phone}` : ''}
                </p>
                <p className="meta">{siteForm.officeHours || 'Office hours not published'}</p>
                <span className="cta">Apply {siteForm.applyCtaUrl || '/apply'}</span>
              </div>
            </aside>
          </div>
          <CmsSaveBar
            dirty={siteDirty}
            saving={saveSite.isPending}
            saved={siteSaved}
            error={saveSite.isError ? error : null}
            onCancel={() => {
              setSiteForm(siteBaseline);
              setError(null);
            }}
            onSave={() => saveSite.mutate()}
          />
        </>
      ) : null}

      {view === 'home' ? (
        <div className="sls-cms-stack">
          <CmsPageHeader
            title="Homepage"
            description="Edit the slider, flash news, about band, explore cards, notices and contact block."
          />
          {home.isLoading ? (
            <p className="rounded-2xl border bg-white px-4 py-8 text-center text-sm text-slate-500">
              Loading homepage sections…
            </p>
          ) : null}
          {home.isError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load homepage content. {apiErrorMessage(home.error)}
            </p>
          ) : null}
          <SchoolWebCmsErrorBoundary label="Homepage slider">
            <SchoolWebHeroCms />
          </SchoolWebCmsErrorBoundary>
          <SchoolWebCmsErrorBoundary label="Flash news">
            <SchoolWebFlashNewsCms />
          </SchoolWebCmsErrorBoundary>
          <SchoolWebCmsErrorBoundary label="About & Principal">
            <SchoolWebAboutPrincipalCms />
          </SchoolWebCmsErrorBoundary>
          <SchoolWebCmsErrorBoundary label="Explore cards">
            <SchoolWebExploreCms />
          </SchoolWebCmsErrorBoundary>
          <SchoolWebCmsErrorBoundary label="News & events">
            <SchoolWebNewsEventsCms />
          </SchoolWebCmsErrorBoundary>
          <SchoolWebCmsErrorBoundary label="Contact">
            <SchoolWebContactCms />
          </SchoolWebCmsErrorBoundary>
          {(home.data ?? [])
            .filter((section) => !HOME_MANAGED_KEYS.includes(section.key))
            .map((section) => (
              <form
                key={section.key}
                className="rounded-2xl border bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  let payload: Record<string, unknown> = {};
                  try {
                    const parsed = JSON.parse(String(fd.get('payload') || '{}'));
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                      throw new Error('Section JSON must be an object');
                    }
                    payload = parsed as Record<string, unknown>;
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Invalid JSON');
                    return;
                  }
                  setError(null);
                  patchSchoolWebHomepage(section.key, { payload, enabled: true })
                    .then(() => qc.invalidateQueries({ queryKey: ['school-web-home'] }))
                    .catch((err) => setError(apiErrorMessage(err)));
                }}
              >
                <p className="text-sm font-semibold text-[#1a365d]">
                  {HOME_SECTION_LABELS[section.key] || section.key}
                </p>
                <textarea
                  name="payload"
                  className="mt-2 h-40 w-full rounded-lg border p-2 font-mono text-xs"
                  defaultValue={JSON.stringify(section.payload ?? {}, null, 2)}
                />
                <button type="submit" className="mt-2 rounded-xl border px-3 py-1.5 text-sm">
                  Save section
                </button>
              </form>
            ))}
        </div>
      ) : null}

      {view === 'launch' ? (
        <SchoolWebCmsErrorBoundary label="Launch popup">
          <SchoolWebLaunchPopupCms />
        </SchoolWebCmsErrorBoundary>
      ) : null}

      {view === 'pages' ? (
        <div className="sls-cms-stack">
          <CmsPageHeader
            title="Pages"
            description="Edit public information pages such as About, History and Admissions."
          />
          <div className="sls-cms-grid has-preview">
            <CmsCard title="Edit page" description="Separate paragraphs with a blank line.">
              <form
                className="sls-cms-fields"
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
                      blocks: pageForm.body
                        .split('\n\n')
                        .map((text) => ({ type: 'paragraph', text })),
                    },
                  })
                    .then(() => qc.invalidateQueries({ queryKey: ['school-web-pages'] }))
                    .catch((err) => setError(apiErrorMessage(err)));
                }}
              >
                <CmsField label="Slug">
                  <CmsInput
                    value={pageForm.slug}
                    onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Title">
                  <CmsInput
                    value={pageForm.title}
                    onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Body" span2>
                  <CmsTextarea
                    value={pageForm.body}
                    onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })}
                  />
                </CmsField>
                <div className="span-2">
                  <SchoolSeoFields
                    value={pageForm.seo}
                    onChange={(seo) => setPageForm({ ...pageForm, seo })}
                  />
                </div>
                <button type="submit" className="sls-cms-btn gold">
                  Publish page
                </button>
              </form>
            </CmsCard>
            <CmsCard title="Published pages">
              <ul className="sls-cms-list">
                {(pages.data ?? []).map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
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
                      <strong>{p.title}</strong>
                      <span>
                        {p.slug} · {p.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CmsCard>
          </div>
        </div>
      ) : null}

      {view === 'notices' ? (
        <div className="sls-cms-stack">
          <CmsPageHeader
            title="News & notices"
            description="Circulars and news items shown on the public website."
          />
          <div className="sls-cms-grid has-preview">
            <CmsCard title="Write a notice">
              <form
                className="sls-cms-fields cols-2"
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
                  })
                    .then(() => qc.invalidateQueries({ queryKey: ['school-web-notices'] }))
                    .catch((err) => setError(apiErrorMessage(err)));
                }}
              >
                <CmsField label="Slug">
                  <CmsInput
                    value={noticeForm.slug}
                    onChange={(e) => setNoticeForm({ ...noticeForm, slug: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Category">
                  <CmsInput
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                    placeholder="GENERAL, ACADEMIC, EVENT"
                  />
                </CmsField>
                <CmsField label="Title" span2>
                  <CmsInput
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Body" span2>
                  <CmsTextarea
                    value={noticeForm.body}
                    onChange={(e) => setNoticeForm({ ...noticeForm, body: e.target.value })}
                  />
                </CmsField>
                <label className="sls-cms-toggle span-2">
                  <input
                    type="checkbox"
                    checked={noticeForm.featured}
                    onChange={(e) => setNoticeForm({ ...noticeForm, featured: e.target.checked })}
                  />
                  Featured on homepage
                </label>
                <div className="span-2">
                  <SchoolSeoFields
                    value={noticeForm.seo}
                    onChange={(seo) => setNoticeForm({ ...noticeForm, seo })}
                  />
                </div>
                <button type="submit" className="sls-cms-btn gold">
                  Publish notice
                </button>
              </form>
            </CmsCard>
            <CmsCard title="Recent notices">
              <ul className="sls-cms-list">
                {(notices.data ?? []).map((n) => (
                  <li key={n.slug}>
                    <strong>{n.title}</strong>
                    <span>{n.status}</span>
                  </li>
                ))}
              </ul>
            </CmsCard>
          </div>
        </div>
      ) : null}

      {view === 'events' ? (
        <div className="sls-cms-stack">
          <CmsPageHeader
            title="Events"
            description="School calendar items for the public website."
          />
          <div className="sls-cms-grid has-preview">
            <CmsCard title="Add or edit an event">
              <form
                className="sls-cms-fields cols-2"
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
                  })
                    .then(() => qc.invalidateQueries({ queryKey: ['school-web-events'] }))
                    .catch((err) => setError(apiErrorMessage(err)));
                }}
              >
                <CmsField label="Slug">
                  <CmsInput
                    value={eventForm.slug}
                    onChange={(e) => setEventForm({ ...eventForm, slug: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Venue">
                  <CmsInput
                    value={eventForm.venue}
                    onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Title" span2>
                  <CmsInput
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Summary" span2>
                  <CmsTextarea
                    value={eventForm.summary ?? ''}
                    onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Starts">
                  <CmsInput
                    type="datetime-local"
                    value={eventForm.startsAt}
                    onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                  />
                </CmsField>
                <CmsField label="Ends">
                  <CmsInput
                    type="datetime-local"
                    value={eventForm.endsAt ?? ''}
                    onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
                  />
                </CmsField>
                <div className="span-2">
                  <SchoolSeoFields
                    value={eventForm.seo}
                    onChange={(seo) => setEventForm({ ...eventForm, seo })}
                  />
                </div>
                <button type="submit" className="sls-cms-btn gold">
                  Publish event
                </button>
              </form>
            </CmsCard>
            <CmsCard title="Upcoming & published">
              <ul className="sls-cms-list">
                {(events.data ?? []).map((n) => (
                  <li key={n.slug}>
                    <strong>{n.title}</strong>
                    <span>{n.status}</span>
                  </li>
                ))}
              </ul>
            </CmsCard>
          </div>
        </div>
      ) : null}

      {view === 'seo' ? (
        <SchoolWebCmsErrorBoundary label="SEO audit">
          <SchoolWebSeoCms />
        </SchoolWebCmsErrorBoundary>
      ) : null}
      {view === 'footer' ? (
        <SchoolWebCmsErrorBoundary label="Footer">
          <SchoolWebFooterCms />
        </SchoolWebCmsErrorBoundary>
      ) : null}

      {view === 'inbox' ? (
        <>
          <CmsPageHeader
            title="Enquiries"
            description="Messages sent from the public website contact form."
          />
          <CmsCard title="Inbox">
            <ul className="sls-cms-list">
              {(inbox.data ?? []).map((row) => (
                <li key={row.id}>
                  <strong>{row.name}</strong>
                  <span>{row.email || 'no email'}</span>
                  <p>{row.message}</p>
                </li>
              ))}
              {!inbox.data?.length ? <li className="sls-cms-help">No enquiries yet.</li> : null}
            </ul>
          </CmsCard>
        </>
      ) : null}
    </SchoolWebCmsShell>
  );
}
