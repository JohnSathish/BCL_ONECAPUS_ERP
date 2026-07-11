import { resolveUploadAssetUrl } from '@/utils/upload-asset-url';
import type { UserNotification } from '@/types/notifications';

export type NotificationAttachment = {
  type: 'image' | 'pdf' | 'file';
  url: string;
  name?: string;
};

function inferType(typeRaw: string, url: string): NotificationAttachment['type'] {
  const t = typeRaw.toLowerCase();
  if (t === 'image' || t === 'pdf') return t;
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(lower)) return 'image';
  if (/\.pdf(\?|$)/i.test(lower)) return 'pdf';
  return 'file';
}

/** Collect image / PDF / generic file attachments from notification metadata + push data. */
export function getNotificationAttachments(
  source: Pick<UserNotification, 'metadata'> | { metadata?: Record<string, unknown> | null },
): NotificationAttachment[] {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  const out: NotificationAttachment[] = [];
  const seen = new Set<string>();

  const push = (type: NotificationAttachment['type'], raw?: string | null, name?: string) => {
    const url = resolveUploadAssetUrl(raw ?? undefined);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ type, url, name });
  };

  if (Array.isArray(meta.attachments)) {
    for (const raw of meta.attachments as Array<Record<string, unknown>>) {
      const url = typeof raw.url === 'string' ? raw.url : null;
      const name = typeof raw.name === 'string' ? raw.name : undefined;
      const typeRaw = typeof raw.type === 'string' ? raw.type : '';
      if (!url) continue;
      push(inferType(typeRaw, url), url, name);
    }
  }

  push('image', typeof meta.imageUrl === 'string' ? meta.imageUrl : null, 'Image');
  push('pdf', typeof meta.pdfUrl === 'string' ? meta.pdfUrl : null, 'PDF attachment');
  push(
    'file',
    typeof meta.fileUrl === 'string' ? meta.fileUrl : null,
    typeof meta.fileName === 'string' ? meta.fileName : 'File attachment',
  );

  return out;
}

export function attachmentUrlsFromMeta(item: Pick<UserNotification, 'metadata'>) {
  const all = getNotificationAttachments(item);
  return {
    imageUrl: all.find((a) => a.type === 'image')?.url,
    pdfUrl: all.find((a) => a.type === 'pdf')?.url,
    files: all.filter((a) => a.type === 'file'),
    all,
  };
}
