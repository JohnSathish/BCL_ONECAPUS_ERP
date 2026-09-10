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
import {
  CmsCard,
  CmsField,
  CmsInput,
  CmsMedia,
  CmsPageHeader,
  CmsSaveBar,
  CmsSelect,
  CmsTextarea,
  CmsToggle,
} from './school-web-cms-ui';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function snapshot(form: SchoolLaunchPopupConfig) {
  return JSON.stringify(form);
}

export function SchoolWebLaunchPopupCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [advanced, setAdvanced] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [form, setForm] = useState<SchoolLaunchPopupConfig>(() => ({
    enabled: true,
    ...defaultLaunchPopupPayload(),
  }));

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'launchPopup');
    const next = parseLaunchPopup(section);
    setForm(next);
    setBaseline(snapshot(next));
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
      setSavedAt(true);
      setBaseline(snapshot(form));
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const set = <K extends keyof SchoolLaunchPopupConfig>(
    key: K,
    value: SchoolLaunchPopupConfig[K],
  ) => {
    setSavedAt(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const dirty = snapshot(form) !== baseline;
  const ctaClass =
    form.ctaStyle === 'navy'
      ? 'cta is-navy'
      : form.ctaStyle === 'outline'
        ? 'cta is-outline'
        : 'cta';

  return (
    <>
      <CmsPageHeader
        title="Launch popup"
        description="Configure the announcement shown to visitors before the official website launch. The site remains available behind it."
        actions={
          <span className={`sls-cms-dot${form.enabled ? '' : ' is-off'}`}>
            <i />
            {form.enabled ? 'Active' : 'Hidden'}
          </span>
        }
      />
      <div className="sls-cms-status">
        <div>
          <strong>Website launch popup</strong>
          <p className="sls-cms-help" style={{ margin: '0.35rem 0 0' }}>
            {form.enabled
              ? 'Visitors will see this popup when they open the public website.'
              : 'The popup is off. Visitors go straight to the website.'}
          </p>
        </div>
        <CmsToggle
          checked={form.enabled}
          onChange={(value) => set('enabled', value)}
          label="Show coming soon popup"
        />
      </div>
      <div className="sls-cms-grid has-preview">
        <div className="sls-cms-stack">
          <CmsCard title="Popup content" description="The message visitors will see first.">
            <div className="sls-cms-fields cols-2">
              <CmsField label="Eyebrow">
                <CmsInput value={form.kicker} onChange={(e) => set('kicker', e.target.value)} />
              </CmsField>
              <CmsField label="Launching label">
                <CmsInput
                  value={form.launchingLabel}
                  onChange={(e) => set('launchingLabel', e.target.value)}
                />
              </CmsField>
              <CmsField label="Main title" span2>
                <CmsInput value={form.title} onChange={(e) => set('title', e.target.value)} />
              </CmsField>
              <CmsField label="Subtitle" span2>
                <CmsInput
                  value={form.subtitle}
                  onChange={(e) => set('subtitle', e.target.value)}
                  placeholder="Optional"
                />
              </CmsField>
              <CmsField label="Description" span2>
                <CmsTextarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </CmsField>
              <CmsField label="School name">
                <CmsInput
                  value={form.footerLine}
                  onChange={(e) => set('footerLine', e.target.value)}
                />
              </CmsField>
              <CmsField label="Location">
                <CmsInput
                  value={form.locationLine}
                  onChange={(e) => set('locationLine', e.target.value)}
                />
              </CmsField>
            </div>
          </CmsCard>
          <CmsCard
            title="Branding & images"
            description="Logo and campus photograph shown on the popup."
          >
            <div className="sls-cms-fields cols-2">
              <CmsField label="Campus image">
                <CmsMedia
                  src={form.imageUrl}
                  alt={form.imageAlt}
                  onFile={async (file) => {
                    try {
                      const uploaded = await uploadSchoolWebHeroImages([file]);
                      if (uploaded.urls[0]) set('imageUrl', uploaded.urls[0]);
                    } catch (err) {
                      setError(apiErrorMessage(err));
                    }
                  }}
                />
              </CmsField>
              <CmsField label="School crest">
                <CmsMedia
                  src={form.logoUrl}
                  alt=""
                  hint="Replace crest"
                  onFile={async (file) => {
                    try {
                      const uploaded = await uploadSchoolWebHeroImages([file]);
                      if (uploaded.urls[0]) set('logoUrl', uploaded.urls[0]);
                    } catch (err) {
                      setError(apiErrorMessage(err));
                    }
                  }}
                />
              </CmsField>
              <CmsField
                label="Image description"
                span2
                hint="Read aloud for visitors who cannot see the photo."
              >
                <CmsInput value={form.imageAlt} onChange={(e) => set('imageAlt', e.target.value)} />
              </CmsField>
            </div>
          </CmsCard>
          <CmsCard title="Call to action" description="The button on the popup.">
            <div className="sls-cms-fields cols-2">
              <CmsField label="Button text">
                <CmsInput value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} />
              </CmsField>
              <CmsField
                label="Button destination"
                hint="Use / for the homepage, or a page such as /about."
              >
                <CmsInput value={form.ctaHref} onChange={(e) => set('ctaHref', e.target.value)} />
              </CmsField>
              <CmsField label="Button style">
                <CmsSelect
                  value={form.ctaStyle}
                  onChange={(e) =>
                    set('ctaStyle', e.target.value as SchoolLaunchPopupConfig['ctaStyle'])
                  }
                >
                  {SCHOOL_LAUNCH_CTA_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style === 'gold'
                        ? 'Gold (recommended)'
                        : style === 'navy'
                          ? 'Navy'
                          : 'Outline'}
                    </option>
                  ))}
                </CmsSelect>
              </CmsField>
              <CmsField label="Open in a new tab">
                <CmsToggle
                  checked={form.ctaNewTab}
                  onChange={(value) => set('ctaNewTab', value)}
                  label={form.ctaNewTab ? 'Yes' : 'No'}
                />
              </CmsField>
            </div>
          </CmsCard>
          <CmsCard
            title="Launch schedule"
            description="The popup can hide itself after a date you set."
          >
            <div className="sls-cms-fields cols-2">
              <CmsField
                label="Launch date"
                hint="Leave blank to keep showing until you turn the popup off."
              >
                <CmsInput
                  type="datetime-local"
                  value={toLocalInput(form.launchAt)}
                  onChange={(e) =>
                    set('launchAt', e.target.value ? new Date(e.target.value).toISOString() : null)
                  }
                />
              </CmsField>
              <CmsField label="After that date">
                <CmsToggle
                  checked={form.showAfterLaunch}
                  onChange={(value) => set('showAfterLaunch', value)}
                  label={form.showAfterLaunch ? 'Keep showing' : 'Stop automatically'}
                />
              </CmsField>
            </div>
          </CmsCard>
          <CmsCard
            title="When should it appear?"
            description="How often returning visitors see the popup."
          >
            <div className="sls-cms-fields cols-2">
              <CmsField label="How often">
                <CmsSelect
                  value={form.frequency}
                  onChange={(e) =>
                    set('frequency', e.target.value as SchoolLaunchPopupConfig['frequency'])
                  }
                >
                  {SCHOOL_LAUNCH_FREQUENCIES.map((item) => (
                    <option key={item} value={item}>
                      {item === 'session'
                        ? 'Once per browser session'
                        : item === 'visit'
                          ? 'Every visit'
                          : item === 'day'
                            ? 'Once per day'
                            : 'Only once'}
                    </option>
                  ))}
                </CmsSelect>
              </CmsField>
              <CmsField label="Animation">
                <CmsSelect
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
                </CmsSelect>
              </CmsField>
              <CmsField label="Close button">
                <CmsToggle
                  checked={form.closeButton}
                  onChange={(value) => set('closeButton', value)}
                  label={form.closeButton ? 'Show close' : 'No close button'}
                />
              </CmsField>
              <CmsField
                label="Where it appears"
                hint="This popup is shown on the public website homepage and inner pages."
              >
                <CmsInput value="Whole public website" readOnly />
              </CmsField>
            </div>
          </CmsCard>
          <details
            className="sls-cms-card sls-cms-advanced"
            open={advanced}
            onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}
          >
            <summary>Advanced settings</summary>
            <p className="sls-cms-help">Only needed if you must paste an image address by hand.</p>
            <div className="sls-cms-fields">
              <CmsField label="Campus image address">
                <CmsInput value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
              </CmsField>
              <CmsField label="Crest address">
                <CmsInput value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} />
              </CmsField>
            </div>
          </details>
        </div>
        <aside className="sls-cms-preview">
          <header>
            <strong>Live preview</strong>
            <div className="sls-cms-devices">
              {(['desktop', 'tablet', 'mobile'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={device === item ? 'is-on' : ''}
                  onClick={() => setDevice(item)}
                >
                  {item[0]!.toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </header>
          <div className={`sls-cms-device is-${device}`}>
            <div className="sls-cms-popup">
              {form.imageUrl ? <img className="hero" src={form.imageUrl} alt="" /> : null}
              <div className="copy">
                {form.logoUrl ? <img className="crest" src={form.logoUrl} alt="" /> : null}
                <p className="kicker">{form.kicker}</p>
                <h4>{form.title || 'Title'}</h4>
                {form.subtitle ? <p className="body">{form.subtitle}</p> : null}
                <p className="body">{form.description}</p>
                <p className="meta">{form.launchingLabel}</p>
                {form.ctaLabel ? <span className={ctaClass}>{form.ctaLabel} →</span> : null}
                <p className="meta">{form.footerLine}</p>
                <p className="meta">{form.locationLine}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <CmsSaveBar
        dirty={dirty}
        saving={save.isPending}
        saved={savedAt}
        error={error}
        onCancel={() => {
          const section = home.data?.find((s) => s.key === 'launchPopup');
          const next = parseLaunchPopup(section);
          setForm(next);
          setError(null);
        }}
        onSave={() => {
          if (form.enabled && form.title.trim().length < 2) {
            setError('Add a title before turning the popup on.');
            return;
          }
          save.mutate();
        }}
      />
    </>
  );
}
