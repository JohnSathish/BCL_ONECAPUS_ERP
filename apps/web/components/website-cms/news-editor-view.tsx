'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Eye, Pin, Star, Trash2, Upload, RotateCcw } from 'lucide-react';
import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createWebsiteContentEntry,
  createWebsiteContentType,
  fetchWebsiteContentEntries,
  fetchWebsiteContentEntriesTrash,
  fetchWebsiteContentTypes,
  previewWebsiteContentEntry,
  restoreWebsiteContentEntry,
  revalidateWebsite,
  trashWebsiteContentEntry,
  updateWebsiteContentEntry,
  uploadWebsiteDocument,
  uploadWebsiteMedia,
} from '@/services/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type GalleryItem = { src: string; alt: string; caption: string };
type AttachmentItem = { url: string; name: string; mime: string };

type EntryRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  data: Record<string, unknown>;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  updatedAt: string;
};

type Props = { onMessage: (message: string) => void };

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function asGallery(value: unknown): GalleryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const src = typeof row.src === 'string' ? row.src : '';
      if (!src) return null;
      return {
        src,
        alt: typeof row.alt === 'string' ? row.alt : '',
        caption: typeof row.caption === 'string' ? row.caption : '',
      };
    })
    .filter((item): item is GalleryItem => Boolean(item));
}

function asAttachments(value: unknown): AttachmentItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const url = typeof row.url === 'string' ? row.url : '';
      if (!url) return null;
      return {
        url,
        name: typeof row.name === 'string' ? row.name : 'Attachment',
        mime: typeof row.mime === 'string' ? row.mime : '',
      };
    })
    .filter((item): item is AttachmentItem => Boolean(item));
}

function asTags(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join(', ');
  }
  return typeof value === 'string' ? value : '';
}

function asRelated(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function refreshPublicNews(slug?: string) {
  const paths = ['/', '/news', '/sitemap.xml'];
  if (slug) paths.push(`/news/${slug}`);
  void revalidateWebsite(paths).catch(() => undefined);
}

export function NewsEditorView({ onMessage }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showTrash, setShowTrash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'image' | 'gallery' | 'og' | 'file' | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('News & Events');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [relatedSlugs, setRelatedSlugs] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [publishedAt, setPublishedAt] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [viewCount, setViewCount] = useState(0);

  const types = useQuery({
    queryKey: ['website', 'content-types'],
    queryFn: fetchWebsiteContentTypes,
  });
  const newsType = useMemo(() => types.data?.find((row) => row.slug === 'news'), [types.data]);

  const ensureType = useMutation({
    mutationFn: () =>
      createWebsiteContentType({
        name: 'News',
        slug: 'news',
        description: 'College news and campus stories',
        fields: [
          { key: 'summary', label: 'Summary', type: 'text', required: true },
          { key: 'body', label: 'Body', type: 'richText', required: true },
          { key: 'image', label: 'Featured image', type: 'image', required: false },
          { key: 'gallery', label: 'Gallery', type: 'json', required: false },
          { key: 'category', label: 'Category', type: 'text', required: false },
          { key: 'author', label: 'Author', type: 'text', required: false },
          { key: 'tags', label: 'Tags', type: 'json', required: false },
          { key: 'seoTitle', label: 'SEO title', type: 'text', required: false },
          { key: 'seoDescription', label: 'SEO description', type: 'text', required: false },
          { key: 'seoKeywords', label: 'SEO keywords', type: 'text', required: false },
          { key: 'ogImage', label: 'OG image', type: 'image', required: false },
          { key: 'featured', label: 'Featured', type: 'boolean', required: false },
          { key: 'sticky', label: 'Sticky', type: 'boolean', required: false },
          { key: 'attachments', label: 'Attachments', type: 'json', required: false },
          { key: 'relatedSlugs', label: 'Related', type: 'json', required: false },
          { key: 'viewCount', label: 'Views', type: 'number', required: false },
        ],
        entryCount: 0,
      }),
    onSuccess: () => {
      onMessage('News content type ready.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-types'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not create news type')),
  });

  const entries = useQuery({
    queryKey: ['website', 'content-entries', newsType?.id, showTrash ? 'trash' : 'live'],
    queryFn: () =>
      showTrash
        ? fetchWebsiteContentEntriesTrash(newsType!.id)
        : fetchWebsiteContentEntries(newsType!.id),
    enabled: Boolean(newsType?.id),
  });

  const rows = (entries.data ?? []) as EntryRow[];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!q) return true;
      const data = row.data ?? {};
      const hay =
        `${row.title} ${row.slug} ${row.status} ${String(data.summary ?? '')} ${String(data.category ?? '')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  const relatedOptions = useMemo(
    () =>
      rows
        .filter((row) => row.status === 'PUBLISHED' && row.id !== editingId)
        .map((row) => ({ slug: row.slug, title: row.title })),
    [rows, editingId],
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setSummary('');
    setBody('');
    setCategory('News & Events');
    setAuthor('');
    setTags('');
    setImage('');
    setImageAlt('');
    setOgImage('');
    setGallery([]);
    setAttachments([]);
    setRelatedSlugs([]);
    setFeatured(false);
    setSticky(false);
    setStatus('DRAFT');
    setPublishedAt('');
    setScheduledAt('');
    setSeoTitle('');
    setSeoDescription('');
    setSeoKeywords('');
    setViewCount(0);
    setSeoOpen(false);
  };

  const loadForEdit = (row: EntryRow) => {
    const data = row.data ?? {};
    setEditingId(row.id);
    setTitle(row.title);
    setSlug(row.slug);
    setSummary(typeof data.summary === 'string' ? data.summary : '');
    setBody(typeof data.body === 'string' ? data.body : '');
    setCategory(typeof data.category === 'string' ? data.category : 'News & Events');
    setAuthor(typeof data.author === 'string' ? data.author : '');
    setTags(asTags(data.tags));
    setImage(typeof data.image === 'string' ? data.image : '');
    setImageAlt(typeof data.imageAlt === 'string' ? data.imageAlt : row.title);
    setOgImage(typeof data.ogImage === 'string' ? data.ogImage : '');
    setGallery(asGallery(data.gallery));
    setAttachments(asAttachments(data.attachments));
    setRelatedSlugs(asRelated(data.relatedSlugs));
    setFeatured(data.featured === true);
    setSticky(data.sticky === true);
    setStatus(row.status || 'DRAFT');
    setPublishedAt(toLocalInput(row.publishedAt));
    setScheduledAt(toLocalInput(row.scheduledAt));
    setSeoTitle(typeof data.seoTitle === 'string' ? data.seoTitle : '');
    setSeoDescription(typeof data.seoDescription === 'string' ? data.seoDescription : '');
    setSeoKeywords(typeof data.seoKeywords === 'string' ? data.seoKeywords : '');
    setViewCount(typeof data.viewCount === 'number' ? data.viewCount : 0);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildData = () => ({
    summary: summary.trim(),
    body,
    image: image || null,
    imageThumb: image || null,
    ogImage: ogImage || image || null,
    gallery,
    category: category.trim() || 'News & Events',
    author: author.trim() || null,
    tags: tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    seoTitle: seoTitle.trim() || null,
    seoDescription: seoDescription.trim() || null,
    seoKeywords: seoKeywords.trim() || null,
    featured,
    sticky,
    attachments,
    relatedSlugs,
    viewCount,
  });

  const save = useMutation({
    mutationFn: async (nextStatus?: string) => {
      if (!newsType?.id) throw new Error('News content type missing');
      if (!title.trim()) throw new Error('Title is required');
      if (/src=["']data:image\//i.test(body)) {
        throw new Error(
          'Remove pasted inline images and upload them with the editor image button first.',
        );
      }
      const resolvedStatus = nextStatus || status;
      const payload = {
        title: title.trim(),
        slug: slugify(slug || title),
        status: resolvedStatus,
        data: buildData(),
        scheduledAt:
          resolvedStatus === 'SCHEDULED' && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        publishedAt:
          resolvedStatus === 'PUBLISHED' && publishedAt
            ? new Date(publishedAt).toISOString()
            : resolvedStatus === 'PUBLISHED'
              ? new Date().toISOString()
              : null,
      };
      if (editingId) return updateWebsiteContentEntry(editingId, payload);
      return createWebsiteContentEntry(newsType.id, payload);
    },
    onSuccess: (_row, nextStatus) => {
      const label = nextStatus || status;
      onMessage(editingId ? `News updated (${label}).` : `News created (${label}).`);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-types'] });
      refreshPublicNews(slug || undefined);
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save news')),
  });

  const trash = useMutation({
    mutationFn: trashWebsiteContentEntry,
    onSuccess: () => {
      onMessage('News moved to trash.');
      if (editingId) resetForm();
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-entries'] });
      refreshPublicNews();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not trash news')),
  });

  const restore = useMutation({
    mutationFn: restoreWebsiteContentEntry,
    onSuccess: () => {
      onMessage('News restored as draft.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'content-entries'] });
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not restore news')),
  });

  const preview = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error('Save a draft first, then open Preview.');
      }
      await updateWebsiteContentEntry(editingId, {
        title: title.trim(),
        slug: slugify(slug || title),
        status,
        data: buildData(),
        scheduledAt:
          status === 'SCHEDULED' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        publishedAt:
          status === 'PUBLISHED' && publishedAt
            ? new Date(publishedAt).toISOString()
            : status === 'PUBLISHED'
              ? new Date().toISOString()
              : null,
      });
      return previewWebsiteContentEntry(editingId);
    },
    onSuccess: (result) => {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(result.html);
        win.document.close();
      } else {
        onMessage('Allow pop-ups to open the news preview.');
      }
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not preview news')),
  });

  const uploadFeatured = async (file: File | null) => {
    if (!file) return;
    setUploading('image');
    try {
      const media = await uploadWebsiteMedia(file, imageAlt || title || 'News image');
      setImage(media.publicUrl);
      if (!imageAlt) setImageAlt(media.altText || title || file.name);
      onMessage('Featured image uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload featured image'));
    } finally {
      setUploading(null);
    }
  };

  const uploadOg = async (file: File | null) => {
    if (!file) return;
    setUploading('og');
    try {
      const media = await uploadWebsiteMedia(file, seoTitle || title || 'OG image');
      setOgImage(media.publicUrl);
      onMessage('Open Graph image uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload OG image'));
    } finally {
      setUploading(null);
    }
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading('gallery');
    try {
      const next = [...gallery];
      for (const file of Array.from(files)) {
        const media = await uploadWebsiteMedia(file, title || file.name);
        next.push({
          src: media.publicUrl,
          alt: media.altText || file.name,
          caption: '',
        });
      }
      setGallery(next);
      onMessage('Gallery images uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload gallery images'));
    } finally {
      setUploading(null);
    }
  };

  const uploadAttachment = async (file: File | null) => {
    if (!file) return;
    setUploading('file');
    try {
      const media = await uploadWebsiteDocument(file, file.name);
      setAttachments((prev) => [
        ...prev,
        {
          url: media.publicUrl,
          name: media.fileName || file.name,
          mime: media.mimeType || file.type || '',
        },
      ]);
      onMessage('Attachment uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload attachment'));
    } finally {
      setUploading(null);
    }
  };

  if (!types.data) {
    return <p className="text-sm text-muted-foreground">Loading news module…</p>;
  }

  if (!newsType) {
    return (
      <CompactCard>
        <CompactCardHeader title="News" description="Create the News content type to begin." />
        <CompactCardBody>
          <Button disabled={ensureType.isPending} onClick={() => ensureType.mutate()}>
            Create News type
          </Button>
        </CompactCardBody>
      </CompactCard>
    );
  }

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title={editingId ? 'Edit news article' : 'Add news article'}
          description="WordPress-style editor: rich body, media, SEO, schedule, featured/sticky, and trash."
        />
        <CompactCardBody className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3 min-w-0">
            <Input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!editingId) setSlug(slugify(event.target.value));
              }}
              placeholder="News title"
            />
            <Input
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              placeholder="url-slug"
            />
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Short summary / excerpt"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="rounded-md border border-border">
              <RichTextEditor
                value={body}
                onChange={setBody}
                onUploadImage={async (file) => {
                  const media = await uploadWebsiteMedia(file, title || file.name);
                  return media.publicUrl;
                }}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Gallery</p>
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading === 'gallery' ? 'Uploading…' : 'Add images'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void uploadGallery(event.target.files)}
                  />
                </label>
              </div>
              {gallery.map((item, index) => (
                <div
                  key={`${item.src}-${index}`}
                  className="grid gap-2 rounded-md bg-muted/40 p-2 md:grid-cols-[96px_1fr_auto]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt || ''}
                    className="h-20 w-full rounded object-cover"
                  />
                  <div className="space-y-1">
                    <Input
                      value={item.alt}
                      onChange={(event) =>
                        setGallery((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, alt: event.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Alt text"
                    />
                    <Input
                      value={item.caption}
                      onChange={(event) =>
                        setGallery((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, caption: event.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Caption"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setGallery((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {!gallery.length ? (
                <p className="text-xs text-muted-foreground">No gallery images yet.</p>
              ) : null}
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Attachments</p>
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading === 'file' ? 'Uploading…' : 'Add PDF/DOCX'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(event) => void uploadAttachment(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {attachments.map((item) => (
                <div
                  key={item.url}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate underline"
                  >
                    {item.name}
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((row) => row.url !== item.url))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Publish</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <label className="block text-xs text-muted-foreground">
                Publish date
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Schedule for
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(event) => setFeatured(event.target.checked)}
                />
                <Star className="h-3.5 w-3.5" /> Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sticky}
                  onChange={(event) => setSticky(event.target.checked)}
                />
                <Pin className="h-3.5 w-3.5" /> Sticky
              </label>
              <p className="text-xs text-muted-foreground">Views: {viewCount}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate('DRAFT')}
                >
                  Save draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => save.mutate('IN_REVIEW')}
                >
                  Submit review
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending || !scheduledAt}
                  onClick={() => {
                    setStatus('SCHEDULED');
                    save.mutate('SCHEDULED');
                  }}
                >
                  Schedule
                </Button>
                <Button
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => {
                    setStatus('PUBLISHED');
                    save.mutate('PUBLISHED');
                  }}
                >
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={preview.isPending || save.isPending}
                  onClick={() => preview.mutate()}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
              </div>
              {editingId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={trash.isPending}
                  onClick={() => trash.mutate(editingId)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Move to trash
                </Button>
              ) : null}
              {editingId ? (
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Taxonomy</p>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Category"
              />
              <Input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Author"
              />
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Tags (comma separated)"
              />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Featured image</p>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={imageAlt || title}
                  className="h-32 w-full rounded object-cover"
                />
              ) : null}
              <Input
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
                placeholder="Image alt text"
              />
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                <Upload className="h-3.5 w-3.5" />
                {uploading === 'image' ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void uploadFeatured(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <button
                type="button"
                className="text-sm font-medium"
                onClick={() => setSeoOpen((open) => !open)}
              >
                SEO settings {seoOpen ? '▾' : '▸'}
              </button>
              {seoOpen ? (
                <div className="space-y-2">
                  <Input
                    value={seoTitle}
                    onChange={(event) => setSeoTitle(event.target.value)}
                    placeholder="Meta title"
                  />
                  <textarea
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                    placeholder="Meta description"
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Input
                    value={seoKeywords}
                    onChange={(event) => setSeoKeywords(event.target.value)}
                    placeholder="Keywords"
                  />
                  {ogImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ogImage} alt="" className="h-24 w-full rounded object-cover" />
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading === 'og' ? 'Uploading…' : 'OG image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void uploadOg(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Related news</p>
              <div className="max-h-40 space-y-1 overflow-auto">
                {relatedOptions.map((item) => {
                  const checked = relatedSlugs.includes(item.slug);
                  return (
                    <label key={item.slug} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setRelatedSlugs((prev) =>
                            event.target.checked
                              ? [...prev, item.slug]
                              : prev.filter((slugValue) => slugValue !== item.slug),
                          );
                        }}
                      />
                      <span>{item.title}</span>
                    </label>
                  );
                })}
                {!relatedOptions.length ? (
                  <p className="text-xs text-muted-foreground">No other published articles yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title={showTrash ? 'Trash' : 'Entries'}
          description={
            showTrash
              ? `${filtered.length} trashed`
              : `Showing ${filtered.length} of ${rows.length}`
          }
        />
        <CompactCardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, slug, summary…"
              className="max-w-sm"
            />
            {!showTrash ? (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={showTrash ? 'default' : 'outline'}
              onClick={() => {
                setShowTrash((value) => !value);
                setStatusFilter('ALL');
              }}
            >
              {showTrash ? 'Back to entries' : 'View trash'}
            </Button>
          </div>

          {filtered.map((row) => {
            const data = row.data ?? {};
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">/{row.slug}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.featured === true ? <Badge variant="secondary">Featured</Badge> : null}
                    {data.sticky === true ? <Badge variant="secondary">Sticky</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{row.status}</Badge>
                  {showTrash ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(row.id)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => loadForEdit(row)}>
                        Edit
                      </Button>
                      {row.status !== 'PUBLISHED' ? (
                        <Button
                          size="sm"
                          disabled={save.isPending}
                          onClick={() =>
                            updateWebsiteContentEntry(row.id, {
                              status: 'PUBLISHED',
                              publishedAt: new Date().toISOString(),
                            }).then(() => {
                              onMessage('News published.');
                              void queryClient.invalidateQueries({
                                queryKey: ['website', 'content-entries'],
                              });
                              refreshPublicNews(row.slug);
                            })
                          }
                        >
                          Publish
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateWebsiteContentEntry(row.id, { status: 'DRAFT' }).then(() => {
                              onMessage('News unpublished to draft.');
                              void queryClient.invalidateQueries({
                                queryKey: ['website', 'content-entries'],
                              });
                              refreshPublicNews(row.slug);
                            })
                          }
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={trash.isPending}
                        onClick={() => trash.mutate(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {!filtered.length ? (
            <p className="text-sm text-muted-foreground">
              {rows.length ? 'No entries match your filters.' : 'No news entries yet.'}
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
