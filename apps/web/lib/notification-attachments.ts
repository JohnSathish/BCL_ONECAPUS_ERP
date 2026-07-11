import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { UserNotification } from '@/types/communication';

export type NotificationAttachment = {
  type: 'image' | 'pdf' | 'file';
  url: string;
  name?: string;
};

export function getNotificationAttachments(
  notification: Pick<UserNotification, 'metadata'>,
): NotificationAttachment[] {
  const meta = (notification.metadata ?? {}) as Record<string, unknown>;
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
      const typeRaw = typeof raw.type === 'string' ? raw.type.toLowerCase() : '';
      const name = typeof raw.name === 'string' ? raw.name : undefined;
      const type: NotificationAttachment['type'] =
        typeRaw === 'image' || typeRaw === 'pdf' ? typeRaw : 'file';
      push(type, url, name);
    }
  }

  push('image', typeof meta.imageUrl === 'string' ? meta.imageUrl : null, 'Image');
  push('pdf', typeof meta.pdfUrl === 'string' ? meta.pdfUrl : null, 'PDF attachment');

  return out;
}
