'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchoolWebHomepage,
  fetchSchoolWebSite,
  patchSchoolWebHomepage,
  patchSchoolWebSite,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

type Highlight = { n: string; title: string; text: string };

const emptyHighlights: Highlight[] = [
  { n: '01', title: '', text: '' },
  { n: '02', title: '', text: '' },
  { n: '03', title: '', text: '' },
  { n: '04', title: '', text: '' },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebAboutPrincipalCms() {
  const qc = useQueryClient();
  const site = useQuery({ queryKey: ['school-web-site'], queryFn: fetchSchoolWebSite });
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [about, setAbout] = useState({
    enabled: true,
    kicker: '',
    title: '',
    body: '',
    ctaLabel: '',
    ctaHref: '',
    videoLabel: '',
    videoHref: '',
    bandLine: '',
    highlights: emptyHighlights,
  });
  const [identity, setIdentity] = useState({
    establishedYear: '',
    establishedLabel: '',
    establishedCaption: '',
    scriptureQuote: '',
    scriptureAttribution: '',
    name: '',
    title: '',
    school: '',
    photoUrl: '',
    photoAlt: '',
    photoPosition: '',
    signatureUrl: '',
    kicker: '',
    heading: '',
    greeting: '',
    excerpt: '',
    ctaLabel: '',
    ctaHref: '',
    quote: '',
    quoteAttribution: '',
  });

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'about');
    if (!section) return;
    const payload = asRecord(section.payload);
    const cta = asRecord(payload.cta);
    const video = asRecord(payload.videoCta);
    const highlights = Array.isArray(payload.highlights)
      ? (payload.highlights as Array<Record<string, unknown>>).map((item, i) => ({
          n: String(item.n || String(i + 1).padStart(2, '0')),
          title: String(item.title || ''),
          text: String(item.text || ''),
        }))
      : emptyHighlights;
    setAbout({
      enabled: section.enabled,
      kicker: String(payload.kicker || ''),
      title: String(payload.title || ''),
      body: Array.isArray(payload.body) ? payload.body.map(String).join('\n\n') : '',
      ctaLabel: String(cta.label || ''),
      ctaHref: String(cta.href || ''),
      videoLabel: String(video.label || ''),
      videoHref: String(video.href || ''),
      bandLine: String(payload.bandLine || ''),
      highlights: highlights.length
        ? [...highlights, ...emptyHighlights].slice(0, 4)
        : emptyHighlights,
    });
  }, [home.data]);

  useEffect(() => {
    if (!site.data) return;
    const extras = asRecord(site.data.extrasJson);
    const principal = asRecord(extras.principal);
    setIdentity({
      establishedYear: String(extras.establishedYear || ''),
      establishedLabel: String(extras.establishedLabel || ''),
      establishedCaption: String(extras.establishedCaption || ''),
      scriptureQuote: String(extras.scriptureQuote || ''),
      scriptureAttribution: String(extras.scriptureAttribution || ''),
      name: String(principal.name || ''),
      title: String(principal.title || ''),
      school: String(principal.school || ''),
      photoUrl: String(principal.photoUrl || ''),
      photoAlt: String(principal.photoAlt || ''),
      photoPosition: String(principal.photoPosition || ''),
      signatureUrl: String(principal.signatureUrl || ''),
      kicker: String(principal.kicker || ''),
      heading: String(principal.heading || ''),
      greeting: String(principal.greeting || ''),
      excerpt: String(principal.excerpt || ''),
      ctaLabel: String(principal.ctaLabel || ''),
      ctaHref: String(principal.ctaHref || ''),
      quote: String(principal.quote || ''),
      quoteAttribution: String(principal.quoteAttribution || ''),
    });
  }, [site.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!site.data) throw new Error('Site not loaded');
      const extras = asRecord(site.data.extrasJson);
      await patchSchoolWebHomepage('about', {
        enabled: about.enabled,
        payload: {
          kicker: about.kicker,
          title: about.title,
          body: about.body
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
          cta: { label: about.ctaLabel, href: about.ctaHref },
          videoCta: about.videoHref
            ? { label: about.videoLabel, href: about.videoHref }
            : undefined,
          bandLine: about.bandLine,
          highlights: about.highlights.filter((h) => h.title.trim()),
        },
      });
      await patchSchoolWebSite({
        extrasJson: {
          ...extras,
          establishedYear: identity.establishedYear,
          establishedLabel: identity.establishedLabel,
          establishedCaption: identity.establishedCaption,
          scriptureQuote: identity.scriptureQuote,
          scriptureAttribution: identity.scriptureAttribution,
          principal: {
            name: identity.name,
            title: identity.title,
            school: identity.school,
            photoUrl: identity.photoUrl,
            photoAlt: identity.photoAlt,
            photoPosition: identity.photoPosition,
            signatureUrl: identity.signatureUrl || undefined,
            kicker: identity.kicker,
            heading: identity.heading,
            greeting: identity.greeting,
            excerpt: identity.excerpt,
            ctaLabel: identity.ctaLabel,
            ctaHref: identity.ctaHref,
            quote: identity.quote || undefined,
            quoteAttribution: identity.quoteAttribution || undefined,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-site'] });
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    multiline = false,
  ) => (
    <label className="text-xs font-semibold text-slate-500">
      {label}
      {multiline ? (
        <textarea
          className="mt-1 h-24 w-full rounded-lg border p-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );

  return (
    <form
      className="space-y-4 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-[#1a365d]">About school + Principal message</h2>
        <p className="text-xs text-slate-500">
          These fields drive the homepage section. The full principal letter stays on the Principal
          page. Leave signature and video blank unless the office has official files. Do not invent
          quotations.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={about.enabled}
          onChange={(e) => setAbout((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Show this section on the homepage
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {field('About eyebrow', about.kicker, (v) => setAbout((f) => ({ ...f, kicker: v })))}
        {field('About heading', about.title, (v) => setAbout((f) => ({ ...f, title: v })))}
      </div>
      {field(
        'About description (blank line between paragraphs)',
        about.body,
        (v) => setAbout((f) => ({ ...f, body: v })),
        true,
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {field('About CTA label', about.ctaLabel, (v) => setAbout((f) => ({ ...f, ctaLabel: v })))}
        {field('About CTA URL', about.ctaHref, (v) => setAbout((f) => ({ ...f, ctaHref: v })))}
        {field('Optional video/story label', about.videoLabel, (v) =>
          setAbout((f) => ({ ...f, videoLabel: v })),
        )}
        {field('Optional video/story URL', about.videoHref, (v) =>
          setAbout((f) => ({ ...f, videoHref: v })),
        )}
        {field('Band line (optional)', about.bandLine, (v) =>
          setAbout((f) => ({ ...f, bandLine: v })),
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500">
          Highlights (leave a title blank to hide that card)
        </p>
        <div className="grid gap-2">
          {about.highlights.map((item, i) => (
            <div key={item.n || i} className="grid gap-2 md:grid-cols-3">
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                value={item.n}
                onChange={(e) =>
                  setAbout((f) => ({
                    ...f,
                    highlights: f.highlights.map((h, idx) =>
                      idx === i ? { ...h, n: e.target.value } : h,
                    ),
                  }))
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Title"
                value={item.title}
                onChange={(e) =>
                  setAbout((f) => ({
                    ...f,
                    highlights: f.highlights.map((h, idx) =>
                      idx === i ? { ...h, title: e.target.value } : h,
                    ),
                  }))
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Subtitle"
                value={item.text}
                onChange={(e) =>
                  setAbout((f) => ({
                    ...f,
                    highlights: f.highlights.map((h, idx) =>
                      idx === i ? { ...h, text: e.target.value } : h,
                    ),
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {field('Established label', identity.establishedLabel, (v) =>
          setIdentity((f) => ({ ...f, establishedLabel: v })),
        )}
        {field('Established year', identity.establishedYear, (v) =>
          setIdentity((f) => ({ ...f, establishedYear: v })),
        )}
        {field('Established caption', identity.establishedCaption, (v) =>
          setIdentity((f) => ({ ...f, establishedCaption: v })),
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {field('School scripture / quote', identity.scriptureQuote, (v) =>
          setIdentity((f) => ({ ...f, scriptureQuote: v })),
        )}
        {field('Quote attribution', identity.scriptureAttribution, (v) =>
          setIdentity((f) => ({ ...f, scriptureAttribution: v })),
        )}
        {field('Optional principal quote override', identity.quote, (v) =>
          setIdentity((f) => ({ ...f, quote: v })),
        )}
        {field('Principal quote attribution', identity.quoteAttribution, (v) =>
          setIdentity((f) => ({ ...f, quoteAttribution: v })),
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {field('Principal name', identity.name, (v) => setIdentity((f) => ({ ...f, name: v })))}
        {field('Designation', identity.title, (v) => setIdentity((f) => ({ ...f, title: v })))}
        {field('School line', identity.school, (v) => setIdentity((f) => ({ ...f, school: v })))}
        {field('Photo URL', identity.photoUrl, (v) => setIdentity((f) => ({ ...f, photoUrl: v })))}
        {field('Photo alt text', identity.photoAlt, (v) =>
          setIdentity((f) => ({ ...f, photoAlt: v })),
        )}
        {field('Photo crop (object-position)', identity.photoPosition, (v) =>
          setIdentity((f) => ({ ...f, photoPosition: v })),
        )}
        {field('Signature image URL (optional)', identity.signatureUrl, (v) =>
          setIdentity((f) => ({ ...f, signatureUrl: v })),
        )}
        {field('Principal eyebrow', identity.kicker, (v) =>
          setIdentity((f) => ({ ...f, kicker: v })),
        )}
        {field('Principal heading', identity.heading, (v) =>
          setIdentity((f) => ({ ...f, heading: v })),
        )}
        {field('Message CTA label', identity.ctaLabel, (v) =>
          setIdentity((f) => ({ ...f, ctaLabel: v })),
        )}
        {field('Message CTA URL', identity.ctaHref, (v) =>
          setIdentity((f) => ({ ...f, ctaHref: v })),
        )}
      </div>
      {field('Greeting', identity.greeting, (v) => setIdentity((f) => ({ ...f, greeting: v })))}
      {field(
        'Homepage preview excerpt',
        identity.excerpt,
        (v) => setIdentity((f) => ({ ...f, excerpt: v })),
        true,
      )}
      <button
        type="submit"
        className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
        disabled={save.isPending}
      >
        {save.isPending ? 'Saving…' : 'Save About & Principal section'}
      </button>
    </form>
  );
}
