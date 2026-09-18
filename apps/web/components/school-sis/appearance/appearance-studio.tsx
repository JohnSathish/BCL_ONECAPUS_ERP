'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accessibility,
  AppWindow,
  Eye,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  Smartphone,
  Sparkles,
  SwatchBook,
  Type,
  Upload,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  APPEARANCE_THEME_PRESETS,
  accessibilityScore,
  contrastRatio,
  mergeAppearanceConfig,
  paletteFrom,
  wcagLabel,
  type AppearanceConfig,
} from '@/lib/school-sis/appearance';
import { appearanceCssVars } from '@/lib/school-sis/appearance-tokens';
import {
  applyAppearanceTheme,
  deleteAppearanceTheme,
  exportAppearanceTheme,
  fetchAppearanceThemes,
  fetchAppearanceVersions,
  fetchSchoolAppearance,
  importAppearanceTheme,
  publishSchoolAppearance,
  resetSchoolAppearance,
  restoreAppearanceVersion,
  saveAppearanceTheme,
  saveSchoolAppearanceDraft,
  uploadAppearanceLogo,
  type SchoolAppearanceDto,
} from '@/services/school-appearance';
import { AppearanceLivePreview } from './appearance-preview';
import { cn } from '@/utils/cn';

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/admin/school-sis/appearance',
    icon: Sparkles,
    blurb: 'Studio home and publish flow.',
  },
  {
    id: 'logo',
    label: 'Logo & Identity',
    href: '/admin/school-sis/appearance/logo',
    icon: Upload,
    blurb: 'Logos, favicon and application identity.',
  },
  {
    id: 'theme',
    label: 'Theme',
    href: '/admin/school-sis/appearance/theme',
    icon: SwatchBook,
    blurb: 'Choose the overall visual design system.',
  },
  {
    id: 'colours',
    label: 'Brand Colours',
    href: '/admin/school-sis/appearance/colours',
    icon: Palette,
    blurb: 'Primary, secondary and accent colours.',
  },
  {
    id: 'login',
    label: 'Login Screen',
    href: '/admin/school-sis/appearance/login',
    icon: Monitor,
    blurb: 'Design the sign-in experience.',
  },
  {
    id: 'sidebar',
    label: 'Sidebar & Navigation',
    href: '/admin/school-sis/appearance/sidebar',
    icon: PanelLeft,
    blurb: 'Navigation chrome and behaviour.',
  },
  {
    id: 'typography',
    label: 'Typography',
    href: '/admin/school-sis/appearance/typography',
    icon: Type,
    blurb: 'Fonts and type scale.',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin/school-sis/appearance/dashboard',
    icon: LayoutDashboard,
    blurb: 'Dashboard layout and widgets.',
  },
  {
    id: 'components',
    label: 'Components',
    href: '/admin/school-sis/appearance/components',
    icon: LayoutTemplate,
    blurb: 'Buttons, cards, inputs and tables.',
  },
  {
    id: 'dark',
    label: 'Dark Mode',
    href: '/admin/school-sis/appearance/dark',
    icon: Moon,
    blurb: 'Dark interface tokens.',
  },
  {
    id: 'mobile',
    label: 'Mobile Appearance',
    href: '/admin/school-sis/appearance/mobile',
    icon: Smartphone,
    blurb: 'Phone and tablet chrome.',
  },
  {
    id: 'preview',
    label: 'Preview',
    href: '/admin/school-sis/appearance/preview',
    icon: Eye,
    blurb: 'Live desktop, tablet, mobile and login.',
  },
  {
    id: 'a11y',
    label: 'Accessibility',
    href: '/admin/school-sis/appearance/accessibility',
    icon: Accessibility,
    blurb: 'Contrast, motion and focus.',
  },
  {
    id: 'history',
    label: 'History',
    href: '/admin/school-sis/appearance/history',
    icon: History,
    blurb: 'Published versions and restore.',
  },
] as const;

function sectionFromPath(path: string) {
  const last = path.replace(/\/$/, '').split('/').pop() || 'overview';
  if (last === 'appearance') return 'overview';
  if (last === 'accessibility') return 'a11y';
  return last;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none ring-[var(--school-erp-accent)] focus:ring-2',
        props.className,
      )}
    />
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm"
    >
      <span>{label}</span>
      <span
        className={cn(
          'h-5 w-9 rounded-full p-0.5',
          checked ? 'bg-[var(--school-erp-primary)]' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white transition',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border"
        />
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

export function AppearanceStudio() {
  const path = usePathname() || '';
  const router = useRouter();
  const section = sectionFromPath(path);
  const qc = useQueryClient();
  const perms = useAuthStore((s) => s.session?.user.permissions);
  const manage = canManageSchoolSis(perms);
  const q = useQuery({ queryKey: ['school-appearance'], queryFn: fetchSchoolAppearance });
  const versions = useQuery({
    queryKey: ['school-appearance-versions'],
    queryFn: fetchAppearanceVersions,
  });
  const themes = useQuery({
    queryKey: ['school-appearance-themes'],
    queryFn: fetchAppearanceThemes,
  });
  const [draft, setDraft] = useState<AppearanceConfig | null>(null);
  const [meta, setMeta] = useState<Partial<SchoolAppearanceDto>>({});
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile' | 'login'>('desktop');
  const [dirty, setDirty] = useState(0);
  const [themeName, setThemeName] = useState("St. Luke's Corporate Theme");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setDraft(mergeAppearanceConfig(q.data.config));
    setMeta(q.data);
  }, [q.data]);

  const patch = (fn: (c: AppearanceConfig) => AppearanceConfig) => {
    setDraft((cur) => (cur ? fn(cur) : cur));
    setDirty((n) => n + 1);
  };

  const payload = useMemo(() => {
    if (!draft) return {};
    return {
      theme: meta.theme,
      mode: meta.mode,
      primaryColor: draft.colors.primary,
      secondaryColor: draft.colors.secondary,
      accentColor: draft.colors.accent,
      fontFamily: draft.typography.fontFamily,
      sidebarStyle: draft.sidebar.style,
      sidebarWidth: draft.sidebar.width,
      sidebarPosition: draft.sidebar.position,
      loginLayout: draft.login.layout,
      loginBackground: draft.login.background,
      loginOverlay: draft.login.overlay,
      customCss: meta.customCss,
      config: draft,
      contrastOverride: draft.colors.contrastOverride,
    };
  }, [draft, meta]);

  const save = useMutation({
    mutationFn: () => saveSchoolAppearanceDraft(payload),
    onSuccess: (row) => {
      qc.setQueryData(['school-appearance'], row);
      setDirty(0);
      setMsg('Draft saved');
    },
  });
  const publish = useMutation({
    mutationFn: async () => {
      await saveSchoolAppearanceDraft(payload);
      return publishSchoolAppearance();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-appearance'] });
      void qc.invalidateQueries({ queryKey: ['school-appearance-published'] });
      void qc.invalidateQueries({ queryKey: ['school-appearance-versions'] });
      setDirty(0);
      setMsg('Published');
    },
  });
  const reset = useMutation({
    mutationFn: resetSchoolAppearance,
    onSuccess: (row) => {
      qc.setQueryData(['school-appearance'], row);
      setMsg('Reset to St. Luke’s default');
    },
  });

  if (!draft) {
    return <div className="p-8 text-sm text-slate-500">Loading Appearance Studio…</div>;
  }

  const score = accessibilityScore(draft);
  const textC = contrastRatio(draft.colors.text, draft.colors.background);
  const btnC = contrastRatio('#FFFFFF', draft.colors.primary);
  const mutedC = contrastRatio(draft.colors.muted, draft.colors.background);

  const onUpload = async (slot: string, file?: File) => {
    if (!file) return;
    const row = await uploadAppearanceLogo(slot, file);
    qc.setQueryData(['school-appearance'], row);
    setMsg('Logo uploaded');
  };

  return (
    <div
      className="px-4 py-6 lg:px-8"
      style={appearanceCssVars(draft, { sidebarWidth: draft.sidebar.width })}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-accent)]">
            Settings · Appearance
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Appearance Studio
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Customize how your institution&apos;s ERP looks and feels across Web, Mobile and Login
            screens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/school-sis/appearance/preview')}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            Live Preview
          </button>
          {manage ? (
            <button
              type="button"
              onClick={() => reset.mutate()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              Reset to Default
            </button>
          ) : null}
        </div>
      </div>

      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
                  section === s.id
                    ? 'border-transparent bg-[var(--school-erp-primary)] text-white'
                    : 'border-slate-200 bg-white/80 text-slate-600',
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {section === 'overview' ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { t: 'Theme', d: meta.theme ?? 'royal', s: 'Active' },
                  { t: 'Colours', d: draft.colors.primary, s: `${dirty} local edits` },
                  { t: 'Preview', d: 'Live', s: meta.status ?? 'DRAFT' },
                ].map((c) => (
                  <div
                    key={c.t}
                    className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {c.t}
                    </p>
                    <p className="mt-2 text-lg font-semibold capitalize">{c.d}</p>
                    <p className="text-xs text-slate-500">{c.s}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {SECTIONS.filter((s) => s.id !== 'overview').map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link
                      key={s.id}
                      href={s.href}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Icon className="mt-0.5 h-5 w-5 text-[var(--school-erp-primary)]" />
                      <span>
                        <span className="block font-semibold text-slate-900">{s.label}</span>
                        <span className="text-sm text-slate-500">{s.blurb}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {section === 'logo' ? (
            <div className="space-y-5 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Logo & Identity</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['logo', 'Main Logo', meta.logoUrl],
                  ['darkLogo', 'Dark Mode Logo', meta.darkLogoUrl],
                  ['mobileLogo', 'Mobile Logo', meta.mobileLogoUrl],
                  ['favicon', 'Favicon', meta.faviconUrl],
                  ['loginLogo', 'Login Logo', draft.identity.loginLogoUrl],
                ].map(([slot, label, url]) => (
                  <div key={slot} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold">{label}</p>
                    <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-slate-50">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(url)}
                          alt=""
                          className="max-h-24 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Preview</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="mt-3 text-xs"
                      disabled={!manage}
                      onChange={(e) => void onUpload(String(slot), e.target.files?.[0])}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      PNG, JPG, SVG, WebP · 512×512 recommended
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Institution Name">
                  <TextInput
                    value={draft.identity.institutionName}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        identity: { ...c.identity, institutionName: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field label="Short Name">
                  <TextInput
                    value={draft.identity.shortName}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        identity: { ...c.identity, shortName: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field label="Application Name">
                  <TextInput
                    value={draft.identity.applicationName}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        identity: { ...c.identity, applicationName: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field label="Browser Title">
                  <TextInput
                    value={draft.identity.browserTitle}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        identity: { ...c.identity, browserTitle: e.target.value },
                      }))
                    }
                  />
                </Field>
                <Field label="Tagline">
                  <TextInput
                    value={draft.identity.tagline}
                    onChange={(e) =>
                      patch((c) => ({ ...c, identity: { ...c.identity, tagline: e.target.value } }))
                    }
                  />
                </Field>
                <Field label="Footer Copyright">
                  <TextInput
                    value={draft.identity.footerCopyright}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        identity: { ...c.identity, footerCopyright: e.target.value },
                      }))
                    }
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {section === 'theme' ? (
            <div className="rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Theme Studio</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {APPEARANCE_THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setMeta((m) => ({ ...m, theme: t.id }));
                      patch((c) => ({
                        ...c,
                        colors: {
                          ...c.colors,
                          primary: t.primary,
                          secondary: t.secondary,
                          accent: t.accent,
                        },
                      }));
                    }}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition hover:-translate-y-0.5',
                      meta.theme === t.id
                        ? 'border-[var(--school-erp-primary)] ring-2 ring-[var(--school-erp-accent)]'
                        : 'border-slate-200',
                    )}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide">{t.name}</p>
                    <div
                      className="mt-2 h-2 rounded-full"
                      style={{ background: `linear-gradient(90deg,${t.primary},${t.accent})` }}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-1">
                      <div
                        className="rounded-lg bg-slate-50 p-2 text-center text-xs font-bold"
                        style={{ color: t.primary }}
                      >
                        24
                      </div>
                      <div
                        className="rounded-lg bg-slate-50 p-2 text-center text-xs font-bold"
                        style={{ color: t.accent }}
                      >
                        86
                      </div>
                    </div>
                    {meta.theme === t.id ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-600">✓ Active</p>
                    ) : null}
                  </button>
                ))}
              </div>
              {manage ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <TextInput
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    className="max-w-sm"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-[var(--school-erp-primary)] px-4 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      void saveAppearanceTheme(themeName, 'Official institutional appearance').then(
                        () => qc.invalidateQueries({ queryKey: ['school-appearance-themes'] }),
                      )
                    }
                  >
                    Save as Theme
                  </button>
                </div>
              ) : null}
              <div className="mt-4 space-y-2">
                {(themes.data ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>{t.name}</strong>
                      <span className="ml-2 text-slate-400">{t.description}</span>
                    </span>
                    {manage ? (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          className="text-[var(--school-erp-primary)]"
                          onClick={() =>
                            void applyAppearanceTheme(t.id).then((row) =>
                              qc.setQueryData(['school-appearance'], row),
                            )
                          }
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="text-rose-600"
                          onClick={() =>
                            void deleteAppearanceTheme(t.id).then(() =>
                              qc.invalidateQueries({ queryKey: ['school-appearance-themes'] }),
                            )
                          }
                        >
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {section === 'colours' ? (
            <div className="space-y-4 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Brand Colours</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <ColorField
                  label="Primary"
                  value={draft.colors.primary}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, primary: v } }))}
                />
                <ColorField
                  label="Secondary"
                  value={draft.colors.secondary}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, secondary: v } }))}
                />
                <ColorField
                  label="Accent"
                  value={draft.colors.accent}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, accent: v } }))}
                />
                <ColorField
                  label="Success"
                  value={draft.colors.success}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, success: v } }))}
                />
                <ColorField
                  label="Warning"
                  value={draft.colors.warning}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, warning: v } }))}
                />
                <ColorField
                  label="Danger"
                  value={draft.colors.danger}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, danger: v } }))}
                />
                <ColorField
                  label="Background"
                  value={draft.colors.background}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, background: v } }))}
                />
                <ColorField
                  label="Surface"
                  value={draft.colors.surface}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, surface: v } }))}
                />
                <ColorField
                  label="Text"
                  value={draft.colors.text}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, text: v } }))}
                />
                <ColorField
                  label="Muted text"
                  value={draft.colors.muted}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, muted: v } }))}
                />
                <ColorField
                  label="Border"
                  value={draft.colors.border}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, border: v } }))}
                />
                <ColorField
                  label="Info"
                  value={draft.colors.info}
                  onChange={(v) => patch((c) => ({ ...c, colors: { ...c.colors, info: v } }))}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Primary palette</p>
                <div className="mt-2 flex overflow-hidden rounded-xl">
                  {paletteFrom(draft.colors.primary).map((p) => (
                    <div
                      key={p.step}
                      className="h-10 flex-1"
                      style={{ background: p.hex }}
                      title={`${p.step}`}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3 text-sm">
                <p>
                  Text contrast {wcagLabel(textC)} ({textC.toFixed(2)})
                </p>
                <p>
                  Button contrast {wcagLabel(btnC)} ({btnC.toFixed(2)})
                </p>
                <p>
                  Muted text {wcagLabel(mutedC)} ({mutedC.toFixed(2)})
                </p>
              </div>
              <Toggle
                label="Override unreadable combinations"
                checked={draft.colors.contrastOverride}
                onChange={(v) =>
                  patch((c) => ({ ...c, colors: { ...c.colors, contrastOverride: v } }))
                }
              />
            </div>
          ) : null}

          {section === 'login' ? (
            <div className="space-y-4 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Login Screen Designer</h2>
              <div className="flex flex-wrap gap-2">
                {(['centered', 'split', 'full', 'minimal', 'glass'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => patch((c) => ({ ...c, login: { ...c.login, layout: l } }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      draft.login.layout === l
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : 'border-slate-200',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Welcome text">
                  <TextInput
                    value={draft.login.welcome}
                    onChange={(e) =>
                      patch((c) => ({ ...c, login: { ...c.login, welcome: e.target.value } }))
                    }
                  />
                </Field>
                <Field label="Subtitle">
                  <TextInput
                    value={draft.login.subtitle}
                    onChange={(e) =>
                      patch((c) => ({ ...c, login: { ...c.login, subtitle: e.target.value } }))
                    }
                  />
                </Field>
                <Field label="Login button">
                  <TextInput
                    value={draft.login.buttonLabel}
                    onChange={(e) =>
                      patch((c) => ({ ...c, login: { ...c.login, buttonLabel: e.target.value } }))
                    }
                  />
                </Field>
                <Field label="Forgot password">
                  <TextInput
                    value={draft.login.forgotLabel}
                    onChange={(e) =>
                      patch((c) => ({ ...c, login: { ...c.login, forgotLabel: e.target.value } }))
                    }
                  />
                </Field>
                <Field label="Overlay opacity">
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={draft.login.overlay}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        login: { ...c.login, overlay: Number(e.target.value) },
                      }))
                    }
                    className="w-full"
                  />
                </Field>
                <Field label="Card radius">
                  <input
                    type="range"
                    min={8}
                    max={32}
                    value={draft.login.cardRadius}
                    onChange={(e) =>
                      patch((c) => ({
                        ...c,
                        login: { ...c.login, cardRadius: Number(e.target.value) },
                      }))
                    }
                    className="w-full"
                  />
                </Field>
              </div>
              <AppearanceLivePreview config={draft} mode="login" />
            </div>
          ) : null}

          {section === 'sidebar' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Sidebar configuration</h2>
              <div className="flex flex-wrap gap-2">
                {(['classic', 'compact', 'floating', 'glass', 'minimal'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patch((c) => ({ ...c, sidebar: { ...c.sidebar, style: s } }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      draft.sidebar.style === s
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : 'border-slate-200',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Field label={`Width ${draft.sidebar.width}px`}>
                <input
                  type="range"
                  min={200}
                  max={360}
                  value={draft.sidebar.width}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      sidebar: { ...c.sidebar, width: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </Field>
              <Toggle
                label="Left position"
                checked={draft.sidebar.position === 'left'}
                onChange={(v) =>
                  patch((c) => ({
                    ...c,
                    sidebar: { ...c.sidebar, position: v ? 'left' : 'right' },
                  }))
                }
              />
              <Toggle
                label="Collapsible"
                checked={draft.sidebar.collapsible}
                onChange={(v) =>
                  patch((c) => ({ ...c, sidebar: { ...c.sidebar, collapsible: v } }))
                }
              />
              <Toggle
                label="Show labels"
                checked={draft.sidebar.showLabels}
                onChange={(v) => patch((c) => ({ ...c, sidebar: { ...c.sidebar, showLabels: v } }))}
              />
              <Toggle
                label="Show icons"
                checked={draft.sidebar.showIcons}
                onChange={(v) => patch((c) => ({ ...c, sidebar: { ...c.sidebar, showIcons: v } }))}
              />
              <Toggle
                label="Section dividers"
                checked={draft.sidebar.showDividers}
                onChange={(v) =>
                  patch((c) => ({ ...c, sidebar: { ...c.sidebar, showDividers: v } }))
                }
              />
              <Toggle
                label="Sticky sidebar"
                checked={draft.sidebar.sticky}
                onChange={(v) => patch((c) => ({ ...c, sidebar: { ...c.sidebar, sticky: v } }))}
              />
            </div>
          ) : null}

          {section === 'typography' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Typography</h2>
              <div className="flex flex-wrap gap-2">
                {['Inter', 'Poppins', 'Roboto', 'Nunito', 'Manrope', 'DM Sans', 'system-ui'].map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        patch((c) => ({ ...c, typography: { ...c.typography, fontFamily: f } }))
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold',
                        draft.typography.fontFamily === f
                          ? 'bg-[var(--school-erp-primary)] text-white'
                          : 'border-slate-200',
                      )}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
              <div
                className="rounded-2xl bg-slate-50 p-5"
                style={{ fontFamily: draft.typography.fontFamily }}
              >
                <p style={{ fontSize: draft.typography.pageHeading }} className="font-semibold">
                  Dashboard
                </p>
                <p
                  style={{ fontSize: draft.typography.sectionHeading }}
                  className="font-semibold text-slate-700"
                >
                  Student Management
                </p>
                <p style={{ fontSize: draft.typography.body }} className="text-slate-500">
                  Manage your students and academic information.
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-full px-4 py-2 text-white"
                  style={{ background: draft.colors.primary, fontSize: draft.typography.button }}
                >
                  View Students
                </button>
              </div>
            </div>
          ) : null}

          {section === 'dashboard' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Dashboard appearance</h2>
              <div className="flex flex-wrap gap-2">
                {(['grid', 'executive', 'minimal', 'analytics', 'academic'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() =>
                      patch((c) => ({ ...c, dashboard: { ...c.dashboard, layout: l } }))
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      draft.dashboard.layout === l
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : 'border-slate-200',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {(
                [
                  'welcome',
                  'stats',
                  'quickActions',
                  'activity',
                  'announcements',
                  'calendar',
                  'notifications',
                  'attendance',
                  'fees',
                  'performance',
                ] as const
              ).map((k) => (
                <Toggle
                  key={k}
                  label={k.replace(/[A-Z]/g, (m) => ` ${m}`)}
                  checked={Boolean(draft.dashboard[k])}
                  onChange={(v) => patch((c) => ({ ...c, dashboard: { ...c.dashboard, [k]: v } }))}
                />
              ))}
            </div>
          ) : null}

          {section === 'components' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Component styling</h2>
              <Field label={`Button radius ${draft.components.buttonRadius}`}>
                <input
                  type="range"
                  min={6}
                  max={24}
                  value={draft.components.buttonRadius}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      components: { ...c.components, buttonRadius: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </Field>
              <Toggle
                label="Button shadow"
                checked={draft.components.buttonShadow}
                onChange={(v) =>
                  patch((c) => ({ ...c, components: { ...c.components, buttonShadow: v } }))
                }
              />
              <Toggle
                label="Button gradient"
                checked={draft.components.buttonGradient}
                onChange={(v) =>
                  patch((c) => ({ ...c, components: { ...c.components, buttonGradient: v } }))
                }
              />
              <Toggle
                label="Card border"
                checked={draft.components.cardBorder}
                onChange={(v) =>
                  patch((c) => ({ ...c, components: { ...c.components, cardBorder: v } }))
                }
              />
              <Toggle
                label="Zebra table rows"
                checked={draft.components.tableZebra}
                onChange={(v) =>
                  patch((c) => ({ ...c, components: { ...c.components, tableZebra: v } }))
                }
              />
              <div className="flex gap-2">
                {(['rounded', 'pill', 'square'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() =>
                      patch((c) => ({ ...c, components: { ...c.components, badgeShape: b } }))
                    }
                    className={cn(
                      'border px-3 py-1 text-xs capitalize',
                      draft.components.badgeShape === b
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : '',
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {section === 'dark' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Dark Mode</h2>
              <div className="flex gap-2">
                {['light', 'dark', 'system'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMeta((x) => ({ ...x, mode: m }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      meta.mode === m
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : 'border-slate-200',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <ColorField
                label="Dark background"
                value={draft.dark.background}
                onChange={(v) => patch((c) => ({ ...c, dark: { ...c.dark, background: v } }))}
              />
              <ColorField
                label="Surface"
                value={draft.dark.surface}
                onChange={(v) => patch((c) => ({ ...c, dark: { ...c.dark, surface: v } }))}
              />
              <ColorField
                label="Text"
                value={draft.dark.text}
                onChange={(v) => patch((c) => ({ ...c, dark: { ...c.dark, text: v } }))}
              />
              <div
                className="rounded-2xl p-4 text-sm"
                style={{ background: draft.dark.background, color: draft.dark.text }}
              >
                Dark preview · {draft.identity.shortName}
              </div>
            </div>
          ) : null}

          {section === 'mobile' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Mobile appearance</h2>
              <Toggle
                label="Bottom navigation"
                checked={draft.mobile.bottomNav}
                onChange={(v) => patch((c) => ({ ...c, mobile: { ...c.mobile, bottomNav: v } }))}
              />
              <Toggle
                label="Stack cards"
                checked={draft.mobile.cardStack}
                onChange={(v) => patch((c) => ({ ...c, mobile: { ...c.mobile, cardStack: v } }))}
              />
              <Field label={`Font scale ${draft.mobile.fontScale}%`}>
                <input
                  type="range"
                  min={90}
                  max={120}
                  value={draft.mobile.fontScale}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      mobile: { ...c.mobile, fontScale: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </Field>
              <AppearanceLivePreview config={draft} mode="mobile" device="mobile" />
            </div>
          ) : null}

          {section === 'preview' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <div className="flex gap-2">
                {(['desktop', 'tablet', 'mobile', 'login'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      device === d
                        ? 'bg-[var(--school-erp-primary)] text-white'
                        : 'border-slate-200',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <AppearanceLivePreview config={draft} mode={device} />
            </div>
          ) : null}

          {section === 'a11y' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Accessibility</h2>
              <p className="text-sm text-slate-500">Score {score}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-emerald-500" style={{ width: `${score}%` }} />
              </div>
              <Toggle
                label="High contrast"
                checked={draft.a11y.highContrast}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, highContrast: v } }))}
              />
              <Toggle
                label="Reduced motion"
                checked={draft.a11y.reducedMotion}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, reducedMotion: v } }))}
              />
              <Toggle
                label="Larger text"
                checked={draft.a11y.largerText}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, largerText: v } }))}
              />
              <Toggle
                label="Focus indicators"
                checked={draft.a11y.focusIndicators}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, focusIndicators: v } }))}
              />
              <Toggle
                label="Keyboard navigation"
                checked={draft.a11y.keyboardNav}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, keyboardNav: v } }))}
              />
              <Toggle
                label="Colour-blind friendly palette"
                checked={draft.a11y.colorBlind}
                onChange={(v) => patch((c) => ({ ...c, a11y: { ...c.a11y, colorBlind: v } }))}
              />
              {meta.canCss ? (
                <Field label="Advanced CSS (super admin)">
                  <textarea
                    value={meta.customCss ?? ''}
                    onChange={(e) => setMeta((m) => ({ ...m, customCss: e.target.value }))}
                    className="h-40 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs"
                  />
                </Field>
              ) : (
                <p className="text-xs text-slate-400">Advanced CSS is limited to super admins.</p>
              )}
            </div>
          ) : null}

          {section === 'history' ? (
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold">Appearance history</h2>
              {(versions.data ?? []).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <strong>v{v.version}</strong> {v.label}
                    <span className="ml-2 text-slate-400">
                      {new Date(v.createdAt).toLocaleString('en-IN')}
                    </span>
                  </span>
                  {manage ? (
                    <button
                      type="button"
                      className="text-[var(--school-erp-primary)]"
                      onClick={() => {
                        if (confirm('Restore this published appearance as a new draft?')) {
                          void restoreAppearanceVersion(v.id).then((row) =>
                            qc.setQueryData(['school-appearance'], row),
                          );
                        }
                      }}
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  onClick={() =>
                    void exportAppearanceTheme().then((json) => {
                      const blob = new Blob([JSON.stringify(json, null, 2)], {
                        type: 'application/json',
                      });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = 'appearance-theme.json';
                      a.click();
                    })
                  }
                >
                  Export JSON
                </button>
                <label className="rounded-full border px-3 py-1 text-xs font-semibold">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void file
                        .text()
                        .then((t) =>
                          importAppearanceTheme(JSON.parse(t) as Record<string, unknown>),
                        )
                        .then((row) => {
                          if (row) qc.setQueryData(['school-appearance'], row);
                        });
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="xl:sticky xl:top-4 h-fit space-y-3 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Live preview</p>
            <AppWindow className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex flex-wrap gap-1">
            {(['desktop', 'tablet', 'mobile', 'login'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                  device === d ? 'bg-[var(--school-erp-primary)] text-white' : 'bg-slate-100',
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <AppearanceLivePreview config={draft} mode={device} />
          <p className="text-[11px] text-slate-400">
            Last published:{' '}
            {meta.publishedAt ? new Date(meta.publishedAt).toLocaleString('en-IN') : 'Never'}
          </p>
          <p className="text-[11px] text-slate-400">Draft changes: {dirty} local modifications</p>
          {manage ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => save.mutate()}
                className="rounded-full border border-slate-200 py-2 text-sm font-semibold"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => publish.mutate()}
                className="rounded-full bg-[var(--school-erp-primary)] py-2 text-sm font-semibold text-white"
              >
                Publish Changes
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Institution branding is locked. You can still preview.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
