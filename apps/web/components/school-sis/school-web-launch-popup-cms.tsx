'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchoolWebHomepage,
  patchSchoolWebHomepage,
  uploadSchoolWebHeroImages,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';
import {
  defaultLaunchPopupPayload,
  parseLaunchPopup,
  SCHOOL_LAUNCH_ANIMATIONS,
  SCHOOL_LAUNCH_CTA_STYLES,
  SCHOOL_LAUNCH_FREQUENCIES,
  type SchoolLaunchPopupConfig,
} from '@/lib/school-web/launch-popup';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SchoolWebLaunchPopupCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolLaunchPopupConfig>(() => ({
    enabled: true,
    ...defaultLaunchPopupPayload(),
  }));

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'launchPopup');
    setForm(parseLaunchPopup(section));
  }, [home.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebHomepage('launchPopup', {
        enabled: form.enabled,
        sortOrder: 5,
        payload: {
          kicker: form.kicker,
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || undefined,
          description: form.description.trim(),
          footerLine: form.footerLine.trim(),
          locationLine: form.locationLine.trim(),
          launchingLabel: form.launchingLabel.trim(),
          logoUrl: form.logoUrl.trim(),
          imageUrl: form.imageUrl.trim(),
          imageAlt: form.imageAlt.trim(),
          launchAt: form.launchAt || undefined,
          showAfterLaunch: form.showAfterLaunch,
          ctaLabel: form.ctaLabel.trim(),
          ctaHref: form.ctaHref.trim() || '/',
          ctaStyle: form.ctaStyle,
          ctaNewTab: form.ctaNewTab,
          frequency: form.frequency,
          animation: form.animation,
          closeButton: form.closeButton,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const set = <K extends keyof SchoolLaunchPopupConfig>(
    key: K,
    value: SchoolLaunchPopupConfig[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.enabled && form.title.trim().length < 2) {
          setError('Add a title before turning the popup on.');
          return;
        }
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1a365d]">Website launch popup</h2>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Pre-launch announcement over the public site. The pages stay available behind it. After
            a launch date passes, the popup hides unless you choose to keep it on.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          Enable coming soon popup
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Eyebrow
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.kicker}
            onChange={(e) => set('kicker', e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Launching label
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.launchingLabel}
            onChange={(e) => set('launchingLabel', e.target.value)}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Title
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Subtitle (optional)
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={form.subtitle}
          onChange={(e) => set('subtitle', e.target.value)}
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Description
        <textarea
          className="mt-1 h-28 w-full rounded-lg border px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          School name line
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.footerLine}
            onChange={(e) => set('footerLine', e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Location line
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.locationLine}
            onChange={(e) => set('locationLine', e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Logo URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.logoUrl}
            onChange={(e) => set('logoUrl', e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Campus image URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.imageUrl}
            onChange={(e) => set('imageUrl', e.target.value)}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Replace campus image
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = '';
            if (!file) return;
            try {
              const uploaded = await uploadSchoolWebHeroImages([file]);
              if (uploaded.urls[0]) set('imageUrl', uploaded.urls[0]);
            } catch (err) {
              setError(apiErrorMessage(err));
            }
          }}
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Image alt text
        <input
          className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
          value={form.imageAlt}
          onChange={(e) => set('imageAlt', e.target.value)}
        />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Launch date (optional)
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            type="datetime-local"
            value={toLocalInput(form.launchAt)}
            onChange={(e) =>
              set('launchAt', e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={form.showAfterLaunch}
            onChange={(e) => set('showAfterLaunch', e.target.checked)}
          />
          Keep showing after the launch date
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Button text
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.ctaLabel}
            onChange={(e) => set('ctaLabel', e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Button URL
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.ctaHref}
            onChange={(e) => set('ctaHref', e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-500">
          Button style
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.ctaStyle}
            onChange={(e) => set('ctaStyle', e.target.value as SchoolLaunchPopupConfig['ctaStyle'])}
          >
            {SCHOOL_LAUNCH_CTA_STYLES.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          How often
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.frequency}
            onChange={(e) =>
              set('frequency', e.target.value as SchoolLaunchPopupConfig['frequency'])
            }
          >
            {SCHOOL_LAUNCH_FREQUENCIES.map((item) => (
              <option key={item} value={item}>
                {item === 'session'
                  ? 'Once per session'
                  : item === 'visit'
                    ? 'Every visit'
                    : item === 'day'
                      ? 'Once per day'
                      : 'Only once'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Animation
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={form.animation}
            onChange={(e) =>
              set('animation', e.target.value as SchoolLaunchPopupConfig['animation'])
            }
          >
            {SCHOOL_LAUNCH_ANIMATIONS.map((item) => (
              <option key={item} value={item}>
                {item === 'fade-scale' ? 'Fade and scale' : 'Fade and slide up'}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 pb-1 text-xs font-semibold text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.ctaNewTab}
              onChange={(e) => set('ctaNewTab', e.target.checked)}
            />
            Open button in a new tab
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.closeButton}
              onChange={(e) => set('closeButton', e.target.checked)}
            />
            Show close button
          </label>
        </div>
      </div>
      <button
        type="submit"
        className="mt-4 h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
      >
        {save.isPending ? 'Saving…' : 'Save launch popup'}
      </button>
    </form>
  );
}
