'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchWebsiteHomepageContent,
  revalidateWebsite,
  updateWebsiteHomepageContent,
  uploadWebsiteMedia,
} from '@/services/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  label: string;
  href?: string;
};

type LifeAtCampus = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: GalleryItem[];
};

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
          className="min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function asLifeAtCampus(value: unknown): LifeAtCampus {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const items = Array.isArray(source.items)
    ? source.items
        .map((row, index) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
          const item = row as Record<string, unknown>;
          const src = typeof item.src === 'string' ? item.src : '';
          if (!src && typeof item.label !== 'string') return null;
          return {
            id: typeof item.id === 'string' && item.id.trim() ? item.id : `campus-${index + 1}`,
            src,
            alt: typeof item.alt === 'string' ? item.alt : '',
            label: typeof item.label === 'string' ? item.label : '',
            href: typeof item.href === 'string' ? item.href : '',
          } satisfies GalleryItem;
        })
        .filter((item): item is GalleryItem => Boolean(item))
    : [];
  return {
    eyebrow: typeof source.eyebrow === 'string' ? source.eyebrow : 'Life at Don Bosco',
    title: typeof source.title === 'string' ? source.title : 'A campus full of possibility',
    subtitle:
      typeof source.subtitle === 'string'
        ? source.subtitle
        : 'Every corner holds a story of learning, friendship and discovery.',
    items,
  };
}

export function LifeAtCampusEditor({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['website', 'homepage-content'],
    queryFn: fetchWebsiteHomepageContent,
  });
  const [draft, setDraft] = useState<LifeAtCampus | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!query.data) return;
    setDraft((current) => current ?? asLifeAtCampus(query.data.lifeAtCampus));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (payload: LifeAtCampus) =>
      updateWebsiteHomepageContent({
        lifeAtCampus: {
          ...payload,
          items: payload.items.map((item) => ({
            id: item.id || `campus-${Date.now()}`,
            src: item.src.trim(),
            alt: item.alt.trim() || item.label.trim() || 'Campus life',
            label: item.label.trim() || 'Campus',
            ...(item.href?.trim() ? { href: item.href.trim() } : {}),
          })),
        },
      }),
    onSuccess: (data) => {
      setDraft(asLifeAtCampus(data.lifeAtCampus));
      onMessage('Life at Campus gallery saved. Public homepage updates without a deploy.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-content'] });
      void revalidateWebsite(['/']).catch(() => undefined);
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save Life at Campus gallery')),
  });

  if (!draft) {
    if (query.isLoading) {
      return <p className="text-sm text-muted-foreground">Loading Life at Campus gallery…</p>;
    }
    if (query.error) {
      return (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {apiErrorMessage(query.error, 'Gallery content could not be loaded')}
        </p>
      );
    }
    return null;
  }

  const patch = (key: keyof Omit<LifeAtCampus, 'items'>, value: string) =>
    setDraft({ ...draft, [key]: value });

  const updateItem = (index: number, patchItem: Partial<GalleryItem>) => {
    const items = draft.items.map((row, i) => (i === index ? { ...row, ...patchItem } : row));
    setDraft({ ...draft, items });
  };

  const uploadForItem = async (index: number, file: File | undefined) => {
    if (!file) return;
    const item = draft.items[index];
    if (!item) return;
    setUploadingId(item.id);
    try {
      const asset = await uploadWebsiteMedia(file, item.alt || item.label || 'Campus life');
      const url = asset.publicUrl || '';
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      updateItem(index, {
        src: url,
        alt: item.alt || asset.altText || item.label || 'Campus life',
      });
      onMessage(`Uploaded image for ${item.label || 'gallery tile'}. Click Save to publish.`);
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Image upload failed'));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Edit the homepage “Life at Don Bosco” mosaic. Upload images or paste Media Library URLs,
          then save.
        </p>
        <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending ? 'Saving…' : 'Save Life at Campus'}
        </Button>
      </div>

      <CompactCard>
        <CompactCardHeader
          title="Section headings"
          description="Eyebrow, title and supporting line above the image mosaic."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Field label="Eyebrow" value={draft.eyebrow} onChange={(v) => patch('eyebrow', v)} />
          <Field label="Title" value={draft.title} onChange={(v) => patch('title', v)} />
          <div className="md:col-span-2">
            <Field
              label="Subtitle"
              value={draft.subtitle}
              onChange={(v) => patch('subtitle', v)}
              multiline
            />
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="Gallery tiles"
          description="Typical layout uses about 7 images (NCC, NSS, Sports, Cultural Events, Labs, Library, Hostel). Add or remove as needed."
        />
        <CompactCardBody className="space-y-3">
          {draft.items.map((item, index) => (
            <div
              key={item.id || `item-${index}`}
              className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[120px_1fr]"
            >
              <div className="overflow-hidden rounded-md border border-border bg-muted/40">
                {item.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.alt || item.label}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label="Label"
                  value={item.label}
                  onChange={(v) => updateItem(index, { label: v })}
                />
                <Field
                  label="Alt text"
                  value={item.alt}
                  onChange={(v) => updateItem(index, { alt: v })}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Image URL / path"
                    value={item.src}
                    onChange={(v) => updateItem(index, { src: v })}
                  />
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      fileRefs.current[item.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void uploadForItem(index, file);
                      event.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingId === item.id}
                    onClick={() => fileRefs.current[item.id]?.click()}
                  >
                    {uploadingId === item.id ? 'Uploading…' : 'Upload image'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        items: draft.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    id: `campus-${Date.now()}`,
                    src: '',
                    alt: '',
                    label: '',
                  },
                ],
              })
            }
          >
            Add image tile
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
