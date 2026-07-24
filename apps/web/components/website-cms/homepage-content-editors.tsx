'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchWebsiteHomepageContent,
  revalidateWebsite,
  updateWebsiteHomepageContent,
} from '@/services/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type HomepageContent = Record<string, unknown>;

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function HomepageContentEditors({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['website', 'homepage-content'],
    queryFn: fetchWebsiteHomepageContent,
  });
  const [draft, setDraft] = useState<HomepageContent | null>(null);

  useEffect(() => {
    if (!query.data) return;
    // Only hydrate from the server when we have no local draft yet — never
    // clobber in-progress principal/other edits when another tab invalidates the query.
    setDraft((current) => current ?? (query.data as HomepageContent));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (payload: HomepageContent) => updateWebsiteHomepageContent(payload),
    onSuccess: (data) => {
      setDraft(data as HomepageContent);
      onMessage('Homepage content saved. Public site reads this without a deploy.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-content'] });
      void revalidateWebsite(['/']).catch(() => {
        /* webhook optional in local dev */
      });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save homepage content')),
  });

  if (!draft) {
    if (query.isLoading)
      return <p className="text-sm text-muted-foreground">Loading homepage content…</p>;
    if (query.error) {
      return (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {apiErrorMessage(query.error, 'Homepage content could not be loaded')}
        </p>
      );
    }
    return null;
  }

  const principal = (draft.principal ?? {}) as Record<string, string>;
  const about = (draft.aboutCollege ?? {}) as Record<string, string>;
  const vision = (draft.visionMission ?? {}) as Record<string, string>;
  const hero = (draft.hero ?? {}) as Record<string, string>;
  const why = (draft.whyChooseUs ?? {}) as Record<string, string>;
  const coat = (draft.coatOfArms ?? {}) as Record<string, string>;
  const research = (draft.researchLinks ?? {}) as Record<string, unknown>;
  const researchItems = Array.isArray(research.links)
    ? (research.links as Array<{ label: string; href: string; description?: string }>)
    : [];
  const sisters = (draft.sisterInstitutions ?? {}) as Record<string, unknown>;
  const sisterItems = Array.isArray(sisters.items)
    ? (sisters.items as Array<{ id: string; name: string; logoUrl: string; href: string }>)
    : [];
  const stats = Array.isArray(draft.statistics)
    ? (draft.statistics as Array<{ value: string; label: string }>)
    : [];

  const patchPrincipal = (key: string, value: string) =>
    setDraft({ ...draft, principal: { ...principal, [key]: value } });
  const patchAbout = (key: string, value: string) =>
    setDraft({ ...draft, aboutCollege: { ...about, [key]: value } });
  const patchVision = (key: string, value: string) =>
    setDraft({ ...draft, visionMission: { ...vision, [key]: value } });
  const patchHero = (key: string, value: string) =>
    setDraft({ ...draft, hero: { ...hero, [key]: value } });
  const patchWhy = (key: string, value: string) =>
    setDraft({ ...draft, whyChooseUs: { ...why, [key]: value } });
  const patchCoat = (key: string, value: string) =>
    setDraft({ ...draft, coatOfArms: { ...coat, [key]: value } });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending ? 'Saving…' : 'Save homepage content'}
        </Button>
      </div>

      <CompactCard>
        <CompactCardHeader
          title="Principal's Message"
          description="Photo, name, excerpt, and Read more URL (defaults to /about/principal)."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field
            label="Name"
            value={principal.name ?? ''}
            onChange={(v) => patchPrincipal('name', v)}
          />
          <Field
            label="Role"
            value={principal.role ?? ''}
            onChange={(v) => patchPrincipal('role', v)}
          />
          <Field
            label="Tenure"
            value={principal.tenure ?? ''}
            onChange={(v) => patchPrincipal('tenure', v)}
          />
          <Field
            label="Read more URL"
            value={principal.messageHref ?? '/about/principal'}
            onChange={(v) => patchPrincipal('messageHref', v)}
          />
          <Field
            label="Portrait path"
            value={principal.portraitSrc ?? ''}
            onChange={(v) => patchPrincipal('portraitSrc', v)}
          />
          <Field
            label="Portrait alt"
            value={principal.portraitAlt ?? ''}
            onChange={(v) => patchPrincipal('portraitAlt', v)}
          />
          <div className="md:col-span-2">
            <Field
              label="Homepage message"
              value={principal.message ?? ''}
              onChange={(v) => patchPrincipal('message', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader title="About College" description="Heritage block above Principal." />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field label="Title" value={about.title ?? ''} onChange={(v) => patchAbout('title', v)} />
          <Field
            label="Subtitle"
            value={about.subtitle ?? ''}
            onChange={(v) => patchAbout('subtitle', v)}
          />
          <Field
            label="Read more URL"
            value={about.readMoreHref ?? ''}
            onChange={(v) => patchAbout('readMoreHref', v)}
          />
          <Field
            label="Portrait path"
            value={about.portraitSrc ?? ''}
            onChange={(v) => patchAbout('portraitSrc', v)}
          />
          <div className="md:col-span-2">
            <Field
              label="Description"
              value={about.description ?? ''}
              onChange={(v) => patchAbout('description', v)}
              multiline
            />
          </div>
          <div className="md:col-span-2">
            <Field
              label="Quote"
              value={about.quote ?? ''}
              onChange={(v) => patchAbout('quote', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Vision & Mission"
          description="Homepage identity strip and /about/vision-mission source."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field
            label="Title"
            value={vision.title ?? ''}
            onChange={(v) => patchVision('title', v)}
          />
          <Field
            label="Eyebrow"
            value={vision.eyebrow ?? ''}
            onChange={(v) => patchVision('eyebrow', v)}
          />
          <Field
            label="Vision title"
            value={vision.visionTitle ?? ''}
            onChange={(v) => patchVision('visionTitle', v)}
          />
          <Field
            label="Mission title"
            value={vision.missionTitle ?? ''}
            onChange={(v) => patchVision('missionTitle', v)}
          />
          <div className="md:col-span-2">
            <Field
              label="Vision"
              value={vision.visionBody ?? ''}
              onChange={(v) => patchVision('visionBody', v)}
              multiline
            />
          </div>
          <div className="md:col-span-2">
            <Field
              label="Mission"
              value={vision.missionBody ?? ''}
              onChange={(v) => patchVision('missionBody', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Hero text & CTAs"
          description="Slide images stay in Hero Slider; this controls titles and buttons."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field
            label="Eyebrow"
            value={hero.eyebrow ?? ''}
            onChange={(v) => patchHero('eyebrow', v)}
          />
          <Field label="Title" value={hero.title ?? ''} onChange={(v) => patchHero('title', v)} />
          <div className="md:col-span-2">
            <Field
              label="Subtitle"
              value={hero.subtitle ?? ''}
              onChange={(v) => patchHero('subtitle', v)}
              multiline
            />
          </div>
          <Field
            label="Primary CTA label"
            value={hero.primaryCtaLabel ?? ''}
            onChange={(v) => patchHero('primaryCtaLabel', v)}
          />
          <Field
            label="Primary CTA URL"
            value={hero.primaryCtaHref ?? ''}
            onChange={(v) => patchHero('primaryCtaHref', v)}
          />
          <Field
            label="Secondary CTA label"
            value={hero.secondaryCtaLabel ?? ''}
            onChange={(v) => patchHero('secondaryCtaLabel', v)}
          />
          <Field
            label="Secondary CTA URL"
            value={hero.secondaryCtaHref ?? ''}
            onChange={(v) => patchHero('secondaryCtaHref', v)}
          />
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Statistics"
          description="Enable the Statistics section in the builder to show these on the homepage."
        />
        <CompactCardBody className="space-y-2">
          {stats.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <Input
                value={row.value}
                aria-label={`Stat ${index + 1} value`}
                onChange={(event) => {
                  const next = stats.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item,
                  );
                  setDraft({ ...draft, statistics: next });
                }}
              />
              <Input
                value={row.label}
                aria-label={`Stat ${index + 1} label`}
                onChange={(event) => {
                  const next = stats.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item,
                  );
                  setDraft({ ...draft, statistics: next });
                }}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft({ ...draft, statistics: [...stats, { value: '', label: '' }] })}
          >
            Add statistic
          </Button>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Why Choose Us"
          description="Section titles; feature cards can be refined in JSON settings later."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field
            label="Eyebrow"
            value={why.eyebrow ?? ''}
            onChange={(v) => patchWhy('eyebrow', v)}
          />
          <Field label="Title" value={why.title ?? ''} onChange={(v) => patchWhy('title', v)} />
          <div className="md:col-span-2">
            <Field
              label="Subtitle"
              value={why.subtitle ?? ''}
              onChange={(v) => patchWhy('subtitle', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader title="Coat of Arms" />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field label="Title" value={coat.title ?? ''} onChange={(v) => patchCoat('title', v)} />
          <Field
            label="Image path"
            value={coat.imageSrc ?? ''}
            onChange={(v) => patchCoat('imageSrc', v)}
          />
          <div className="md:col-span-2">
            <Field
              label="Body"
              value={coat.body ?? ''}
              onChange={(v) => patchCoat('body', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Research & important links"
          description="First three links appear as featured research cards. Remaining links show under Important links (add ERP Login and other shortcuts here)."
        />
        <CompactCardBody className="grid gap-3">
          <Field
            label="Title"
            value={typeof research.title === 'string' ? research.title : ''}
            onChange={(v) => setDraft({ ...draft, researchLinks: { ...research, title: v } })}
          />
          <Field
            label="Subtitle"
            value={typeof research.subtitle === 'string' ? research.subtitle : ''}
            onChange={(v) => setDraft({ ...draft, researchLinks: { ...research, subtitle: v } })}
            multiline
          />
          <div className="space-y-3">
            {researchItems.map((item, index) => (
              <div
                key={`research-link-${index}`}
                className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2"
              >
                <Field
                  label="Label"
                  value={item.label ?? ''}
                  onChange={(v) => {
                    const links = researchItems.map((row, i) =>
                      i === index ? { ...row, label: v } : row,
                    );
                    setDraft({ ...draft, researchLinks: { ...research, links } });
                  }}
                />
                <Field
                  label="URL"
                  value={item.href ?? ''}
                  onChange={(v) => {
                    const links = researchItems.map((row, i) =>
                      i === index ? { ...row, href: v } : row,
                    );
                    setDraft({ ...draft, researchLinks: { ...research, links } });
                  }}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Description / CTA"
                    value={item.description ?? ''}
                    onChange={(v) => {
                      const links = researchItems.map((row, i) =>
                        i === index ? { ...row, description: v } : row,
                      );
                      setDraft({ ...draft, researchLinks: { ...research, links } });
                    }}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const links = researchItems.filter((_, i) => i !== index);
                      setDraft({ ...draft, researchLinks: { ...research, links } });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const links = [...researchItems, { label: '', href: '', description: '' }];
                setDraft({ ...draft, researchLinks: { ...research, links } });
              }}
            >
              Add link
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Our Sister Institutions"
          description="Homepage logos with destination URLs. Paste a Media Library URL or public image path for each logo."
        />
        <CompactCardBody className="grid gap-3">
          <Field
            label="Title"
            value={typeof sisters.title === 'string' ? sisters.title : ''}
            onChange={(v) => setDraft({ ...draft, sisterInstitutions: { ...sisters, title: v } })}
          />
          <Field
            label="Subtitle"
            value={typeof sisters.subtitle === 'string' ? sisters.subtitle : ''}
            onChange={(v) =>
              setDraft({ ...draft, sisterInstitutions: { ...sisters, subtitle: v } })
            }
            multiline
          />
          <div className="space-y-3">
            {sisterItems.map((item, index) => (
              <div
                key={item.id || `sister-${index}`}
                className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2"
              >
                <Field
                  label="Name"
                  value={item.name ?? ''}
                  onChange={(v) => {
                    const items = sisterItems.map((row, i) =>
                      i === index ? { ...row, name: v } : row,
                    );
                    setDraft({ ...draft, sisterInstitutions: { ...sisters, items } });
                  }}
                />
                <Field
                  label="Website URL"
                  value={item.href ?? ''}
                  onChange={(v) => {
                    const items = sisterItems.map((row, i) =>
                      i === index ? { ...row, href: v } : row,
                    );
                    setDraft({ ...draft, sisterInstitutions: { ...sisters, items } });
                  }}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Logo URL / path"
                    value={item.logoUrl ?? ''}
                    onChange={(v) => {
                      const items = sisterItems.map((row, i) =>
                        i === index ? { ...row, logoUrl: v } : row,
                      );
                      setDraft({ ...draft, sisterInstitutions: { ...sisters, items } });
                    }}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const items = sisterItems.filter((_, i) => i !== index);
                      setDraft({ ...draft, sisterInstitutions: { ...sisters, items } });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const items = [
                  ...sisterItems,
                  {
                    id: `sister-${Date.now()}`,
                    name: '',
                    logoUrl: '',
                    href: '',
                  },
                ];
                setDraft({ ...draft, sisterInstitutions: { ...sisters, items } });
              }}
            >
              Add logo
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Life at Campus gallery"
          description="Homepage mosaic images (NCC, NSS, Sports, etc.) are edited on the dedicated Life at Campus page."
        />
        <CompactCardBody>
          <Button asChild variant="outline" size="sm">
            <a href="/admin/website/gallery">Open Life at Campus editor</a>
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
