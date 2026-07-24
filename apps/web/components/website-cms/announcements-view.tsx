'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pin, Trash2, Upload } from 'lucide-react';
import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createWebsiteAnnouncement,
  deleteWebsiteAnnouncement,
  fetchWebsiteAnnouncements,
  revalidateWebsite,
  updateWebsiteAnnouncement,
  uploadWebsiteDocument,
  uploadWebsiteMedia,
} from '@/services/website-cms';
import type { WebsiteAnnouncement } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

function refreshPublicAnnouncements() {
  void revalidateWebsite(['/', '/announcements']).catch(() => undefined);
}

type Props = {
  onMessage: (message: string) => void;
};

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AnnouncementsView({ onMessage }: Props) {
  const queryClient = useQueryClient();
  const rows = useQuery({
    queryKey: ['website', 'announcements'],
    queryFn: fetchWebsiteAnnouncements,
  });
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [showOnTicker, setShowOnTicker] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'image' | 'pdf' | null>(null);

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setBodyHtml('');
    setFeaturedImageUrl('');
    setFeaturedImageAlt('');
    setAttachmentUrl('');
    setAttachmentName('');
    setLinkUrl('');
    setExpireAt('');
    setIsPinned(false);
    setShowOnTicker(true);
    setEditingId(null);
  };

  const loadForEdit = (row: WebsiteAnnouncement) => {
    setEditingId(row.id);
    setTitle(row.title);
    setSummary(row.summary || '');
    setBodyHtml(row.bodyHtml || '');
    setFeaturedImageUrl(row.featuredImageUrl || '');
    setFeaturedImageAlt(row.featuredImageAlt || '');
    setAttachmentUrl(row.attachmentUrl || '');
    setAttachmentName(row.attachmentName || '');
    setLinkUrl(row.linkUrl || '');
    setExpireAt(toLocalInput(row.expireAt));
    setIsPinned(row.isPinned);
    setShowOnTicker(row.showOnTicker);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (/src=["']data:image\//i.test(bodyHtml)) {
        throw new Error(
          'The content still has a pasted image. Use the image button (or paste again after this update) so the picture uploads to Media first, then save.',
        );
      }
      if (bodyHtml.length > 400_000) {
        throw new Error(
          'Announcement body is too large. Prefer the image toolbar upload over pasting large pictures.',
        );
      }
      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        bodyHtml,
        featuredImageUrl: featuredImageUrl || null,
        featuredImageAlt: featuredImageAlt || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        linkUrl: linkUrl.trim() || null,
        expireAt: expireAt ? new Date(expireAt).toISOString() : null,
        isPinned,
        showOnTicker,
        showOnHomepage: true,
        isVisible: true,
        ...(editingId ? {} : { status: 'DRAFT' as const }),
      };
      if (editingId) {
        return updateWebsiteAnnouncement(editingId, payload);
      }
      return createWebsiteAnnouncement(payload);
    },
    onSuccess: () => {
      onMessage(editingId ? 'Announcement updated.' : 'Announcement created as draft.');
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['website', 'announcements'] });
      refreshPublicAnnouncements();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save announcement')),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WebsiteAnnouncement> }) =>
      updateWebsiteAnnouncement(id, payload),
    onSuccess: () => {
      onMessage('Announcement updated.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'announcements'] });
      refreshPublicAnnouncements();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update announcement')),
  });

  const remove = useMutation({
    mutationFn: deleteWebsiteAnnouncement,
    onSuccess: () => {
      onMessage('Announcement moved to trash.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'announcements'] });
      refreshPublicAnnouncements();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not trash announcement')),
  });

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    setUploading('image');
    try {
      const media = await uploadWebsiteMedia(file, featuredImageAlt || title || 'Announcement');
      setFeaturedImageUrl(media.publicUrl);
      if (!featuredImageAlt) setFeaturedImageAlt(media.altText || title || file.name);
      onMessage('Featured image uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload image'));
    } finally {
      setUploading(null);
    }
  };

  const onUploadPdf = async (file: File | null) => {
    if (!file) return;
    setUploading('pdf');
    try {
      const media = await uploadWebsiteDocument(file, file.name);
      setAttachmentUrl(media.publicUrl);
      setAttachmentName(media.fileName || file.name);
      onMessage('PDF attachment uploaded.');
    } catch (error) {
      onMessage(apiErrorMessage(error, 'Could not upload PDF'));
    } finally {
      setUploading(null);
    }
  };

  if (!rows.data) {
    return (
      <p className="text-sm text-muted-foreground">
        {rows.isLoading ? 'Loading announcements…' : 'Could not load announcements.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title={editingId ? 'Edit announcement' : 'Add announcement'}
          description="Campus announcements with optional link URL, featured image, PDF, expiry, and pin-to-top."
        />
        <CompactCardBody className="grid gap-3 md:grid-cols-2">
          <Input
            className="md:col-span-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
          />
          <Input
            className="md:col-span-2"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short summary (ticker / card)"
          />
          <div className="md:col-span-2">
            <RichTextEditor
              key={editingId ?? 'new-announcement'}
              value={bodyHtml}
              onChange={setBodyHtml}
              onUploadImage={async (file) => {
                try {
                  const media = await uploadWebsiteMedia(
                    file,
                    title.trim() || file.name || 'Announcement image',
                  );
                  onMessage('Image inserted into content.');
                  return media.publicUrl;
                } catch (error) {
                  onMessage(apiErrorMessage(error, 'Could not upload image'));
                  throw error;
                }
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use the image button (or paste/drop) so photos upload to Media. Do not paste huge
              screenshots as raw data — that blocks saving.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Featured image</p>
            <Input
              type="file"
              accept="image/*"
              disabled={uploading === 'image'}
              onChange={(e) => void onUploadImage(e.target.files?.[0] ?? null)}
            />
            <Input
              value={featuredImageAlt}
              onChange={(e) => setFeaturedImageAlt(e.target.value)}
              placeholder="Image alt text"
            />
            {featuredImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featuredImageUrl}
                alt={featuredImageAlt || title}
                className="mt-1 h-28 w-full rounded-md object-cover"
              />
            ) : null}
            {featuredImageUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFeaturedImageUrl('');
                  setFeaturedImageAlt('');
                }}
              >
                Remove image
              </Button>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">PDF attachment</p>
            <Input
              type="file"
              accept="application/pdf,.pdf"
              disabled={uploading === 'pdf'}
              onChange={(e) => void onUploadPdf(e.target.files?.[0] ?? null)}
            />
            {attachmentUrl ? (
              <p className="text-sm text-muted-foreground">
                <a className="underline" href={attachmentUrl} target="_blank" rel="noreferrer">
                  {attachmentName || 'Download PDF'}
                </a>
              </p>
            ) : null}
            {attachmentUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAttachmentUrl('');
                  setAttachmentName('');
                }}
              >
                Remove PDF
              </Button>
            ) : null}
          </div>

          <label className="md:col-span-2 text-sm">
            Link URL (optional)
            <Input
              className="mt-1"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/page or /news/my-post"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              When set, clicking this announcement on the ticker or listing opens this URL instead
              of the announcement detail page.
            </span>
          </label>

          <label className="text-sm">
            Expiry date (optional)
            <Input
              className="mt-1"
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
            />
          </label>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnTicker}
                onChange={(e) => setShowOnTicker(e.target.checked)}
              />
              Show on homepage ticker
            </label>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button
              disabled={!title.trim() || save.isPending || Boolean(uploading)}
              onClick={() => save.mutate()}
            >
              <Upload className="mr-1 h-4 w-4" />
              {editingId ? 'Save changes' : 'Create draft'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader
          title="All announcements"
          description="Publish, pin, or trash. Sorted with pinned items first."
        />
        <CompactCardBody className="space-y-2">
          {rows.data.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-md border border-border p-3 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                {row.featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.featuredImageUrl}
                    alt={row.featuredImageAlt || row.title}
                    className="h-16 w-20 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {row.isPinned ? <Pin className="mr-1 inline h-3.5 w-3.5" /> : null}
                    {row.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.status}
                    {row.showOnTicker ? ' · Ticker' : ''}
                    {row.expireAt ? ` · Expires ${new Date(row.expireAt).toLocaleString()}` : ''}
                    {row.publishAt ? ` · ${new Date(row.publishAt).toLocaleDateString()}` : ''}
                  </p>
                  {row.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.isPinned ? <Badge variant="secondary">Pinned</Badge> : null}
                    {row.linkUrl ? <Badge variant="outline">Link</Badge> : null}
                    {row.attachmentUrl ? <Badge variant="outline">PDF</Badge> : null}
                    {row.featuredImageUrl ? <Badge variant="outline">Image</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => loadForEdit(row)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: row.id,
                      payload: { status: row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' },
                    })
                  }
                >
                  {row.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ id: row.id, payload: { isPinned: !row.isPinned } })
                  }
                >
                  {row.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: row.id,
                      payload: { showOnTicker: !row.showOnTicker },
                    })
                  }
                >
                  {row.showOnTicker ? 'Hide ticker' : 'Show ticker'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!rows.data.length ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
