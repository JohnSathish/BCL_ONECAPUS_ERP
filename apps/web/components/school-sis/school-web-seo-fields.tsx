import { checklist } from '@/lib/school-web/seo';

export type SchoolSeoForm = {
  title: string;
  description: string;
  canonicalPath: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaType: string;
  breadcrumbTitle: string;
  heroEnabled: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroDecorative: string;
  heroOverlay: string;
  heroImagePosition: string;
  heroAlignment: 'left' | 'center';
  heroShowBreadcrumbs: boolean;
};

export const EMPTY_SEO_FORM: SchoolSeoForm = {
  title: '',
  description: '',
  canonicalPath: '',
  focusKeyword: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  robotsIndex: true,
  robotsFollow: true,
  schemaType: 'WebPage',
  breadcrumbTitle: '',
  heroEnabled: true,
  heroEyebrow: '',
  heroTitle: '',
  heroSubtitle: '',
  heroImage: '',
  heroDecorative: '',
  heroOverlay: '',
  heroImagePosition: '',
  heroAlignment: 'left',
  heroShowBreadcrumbs: true,
};

export function seoFormFromJson(value: unknown): SchoolSeoForm {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const hero =
    row.hero && typeof row.hero === 'object' && !Array.isArray(row.hero)
      ? (row.hero as Record<string, unknown>)
      : {};
  return {
    title: String(row.title || ''),
    description: String(row.description || ''),
    canonicalPath: String(row.canonicalPath || ''),
    focusKeyword: String(row.focusKeyword || ''),
    ogTitle: String(row.ogTitle || ''),
    ogDescription: String(row.ogDescription || ''),
    ogImage: String(row.ogImage || ''),
    twitterTitle: String(row.twitterTitle || ''),
    twitterDescription: String(row.twitterDescription || ''),
    twitterImage: String(row.twitterImage || ''),
    robotsIndex: row.robotsIndex !== false,
    robotsFollow: row.robotsFollow !== false,
    schemaType: String(row.schemaType || 'WebPage'),
    breadcrumbTitle: String(row.breadcrumbTitle || ''),
    heroEnabled: hero.enabled !== false && hero.enabled !== 'false',
    heroEyebrow: String(hero.eyebrow || ''),
    heroTitle: String(hero.title || ''),
    heroSubtitle: String(hero.subtitle || ''),
    heroImage: String(hero.backgroundImage || hero.image || ''),
    heroDecorative: String(hero.decorativeText || ''),
    heroOverlay: hero.overlay == null || hero.overlay === '' ? '' : String(hero.overlay),
    heroImagePosition: String(hero.imagePosition || ''),
    heroAlignment: hero.alignment === 'center' ? 'center' : 'left',
    heroShowBreadcrumbs: hero.showBreadcrumbs !== false && hero.showBreadcrumbs !== 'false',
  };
}

export function seoJsonFromForm(form: SchoolSeoForm) {
  const overlay = Number(form.heroOverlay);
  return {
    title: form.title.trim() || undefined,
    description: form.description.trim() || undefined,
    canonicalPath: form.canonicalPath.trim() || undefined,
    focusKeyword: form.focusKeyword.trim() || undefined,
    ogTitle: form.ogTitle.trim() || undefined,
    ogDescription: form.ogDescription.trim() || undefined,
    ogImage: form.ogImage.trim() || undefined,
    twitterTitle: form.twitterTitle.trim() || undefined,
    twitterDescription: form.twitterDescription.trim() || undefined,
    twitterImage: form.twitterImage.trim() || undefined,
    robotsIndex: form.robotsIndex,
    robotsFollow: form.robotsFollow,
    schemaType: form.schemaType.trim() || undefined,
    breadcrumbTitle: form.breadcrumbTitle.trim() || undefined,
    hero: {
      enabled: form.heroEnabled,
      eyebrow: form.heroEyebrow.trim() || undefined,
      title: form.heroTitle.trim() || undefined,
      subtitle: form.heroSubtitle.trim() || undefined,
      backgroundImage: form.heroImage.trim() || undefined,
      decorativeText: form.heroDecorative.trim() || undefined,
      overlay: Number.isFinite(overlay) && form.heroOverlay.trim() ? overlay : undefined,
      imagePosition: form.heroImagePosition.trim() || undefined,
      alignment: form.heroAlignment,
      showBreadcrumbs: form.heroShowBreadcrumbs,
    },
  };
}

export function SchoolSeoFields({
  value,
  onChange,
}: {
  value: SchoolSeoForm;
  onChange: (next: SchoolSeoForm) => void;
}) {
  const field = (label: string, key: keyof SchoolSeoForm, multiline = false) => (
    <label className="text-xs font-semibold text-slate-500">
      {label}
      {multiline ? (
        <textarea
          className="mt-1 h-20 w-full rounded-lg border p-2 text-sm"
          value={String(value[key] ?? '')}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      ) : (
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={String(value[key] ?? '')}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      )}
    </label>
  );
  const items = checklist({
    title: value.title,
    description: value.description,
    h1: value.breadcrumbTitle || value.title,
    canonical: value.canonicalPath,
    image: value.ogImage,
    imageAlt: value.ogImage ? 'set' : '',
    path: value.canonicalPath,
    hasInternalLinks: true,
  });
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
      <p className="md:col-span-2 text-sm font-semibold text-[#1a365d]">SEO</p>
      <ul className="md:col-span-2 grid gap-1 text-xs sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={item.ok && !item.warn ? 'text-emerald-700' : 'text-amber-700'}
          >
            {item.ok ? '✓' : '⚠'} {item.label}
            {item.warn ? ` — ${item.warn}` : null}
          </li>
        ))}
      </ul>
      {field('SEO title', 'title')}
      {field('Focus keyword / search topic', 'focusKeyword')}
      {field('Canonical path (e.g. /about)', 'canonicalPath')}
      {field('Breadcrumb title', 'breadcrumbTitle')}
      {field('Schema type', 'schemaType')}
      {field('OG title', 'ogTitle')}
      {field('OG image URL', 'ogImage')}
      {field('Twitter title', 'twitterTitle')}
      {field('Twitter image URL', 'twitterImage')}
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={value.robotsIndex}
          onChange={(e) => onChange({ ...value, robotsIndex: e.target.checked })}
        />
        Allow Google to index this page
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={value.robotsFollow}
          onChange={(e) => onChange({ ...value, robotsFollow: e.target.checked })}
        />
        Allow following links
      </label>
      <div className="md:col-span-2">{field('Meta description', 'description', true)}</div>
      <div className="md:col-span-2">{field('OG description', 'ogDescription', true)}</div>
      <div className="md:col-span-2">
        {field('Twitter description', 'twitterDescription', true)}
      </div>
      <p className="md:col-span-2 text-xs text-slate-500">
        Empty social fields fall back to the SEO title, description and logo. This is a content
        checklist, not a Google ranking score.
      </p>
      <p className="md:col-span-2 mt-2 text-sm font-semibold text-[#1a365d]">Inner page header</p>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={value.heroEnabled}
          onChange={(e) => onChange({ ...value, heroEnabled: e.target.checked })}
        />
        Show photo header on this page
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={value.heroShowBreadcrumbs}
          onChange={(e) => onChange({ ...value, heroShowBreadcrumbs: e.target.checked })}
        />
        Show breadcrumbs under the header
      </label>
      {field('Header eyebrow', 'heroEyebrow')}
      {field('Header title override', 'heroTitle')}
      {field('Header subtitle', 'heroSubtitle')}
      {field('Header image URL', 'heroImage')}
      {field('Image position (e.g. center, 70% 40%)', 'heroImagePosition')}
      {field('Overlay strength 0.25–0.85', 'heroOverlay')}
      {field('Decorative text (right side)', 'heroDecorative')}
      <label className="text-xs font-semibold text-slate-500">
        Header text alignment
        <select
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={value.heroAlignment}
          onChange={(e) =>
            onChange({ ...value, heroAlignment: e.target.value === 'center' ? 'center' : 'left' })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>
      </label>
    </div>
  );
}
