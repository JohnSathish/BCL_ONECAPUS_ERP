import 'server-only';
import { fetchCms, isRecord } from '@/lib/cms-client';
import type { PublicPopup } from '@/lib/popup-rules';

function mapPopup(row: Record<string, unknown>): PublicPopup | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null;
  return {
    id: row.id,
    title: row.title,
    popupType: typeof row.popupType === 'string' ? row.popupType : 'HTML',
    contentHtml: typeof row.contentHtml === 'string' ? row.contentHtml : '',
    contentJson: isRecord(row.contentJson) ? row.contentJson : {},
    imageJson:
      isRecord(row.imageJson) &&
      (typeof row.imageJson.url === 'string' ||
        typeof row.imageJson.publicUrl === 'string' ||
        typeof row.imageJson.imageUrl === 'string')
        ? {
            url:
              (typeof row.imageJson.url === 'string' && row.imageJson.url) ||
              (typeof row.imageJson.publicUrl === 'string' && row.imageJson.publicUrl) ||
              (typeof row.imageJson.imageUrl === 'string' && row.imageJson.imageUrl) ||
              '',
            alt: typeof row.imageJson.alt === 'string' ? row.imageJson.alt : undefined,
            caption: typeof row.imageJson.caption === 'string' ? row.imageJson.caption : undefined,
          }
        : null,
    videoUrl: typeof row.videoUrl === 'string' ? row.videoUrl : null,
    videoType: typeof row.videoType === 'string' ? row.videoType : null,
    buttonJson: Array.isArray(row.buttonJson)
      ? row.buttonJson.filter(isRecord).map((button) => ({
          label: typeof button.label === 'string' ? button.label : 'Open',
          href: typeof button.href === 'string' ? button.href : '#',
          variant: typeof button.variant === 'string' ? button.variant : undefined,
          openInNewTab: button.openInNewTab === true,
        }))
      : [],
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : 0,
    showTrigger: typeof row.showTrigger === 'string' ? row.showTrigger : 'IMMEDIATE',
    showDelay: typeof row.showDelay === 'number' ? row.showDelay : 0,
    scrollPercent: typeof row.scrollPercent === 'number' ? row.scrollPercent : null,
    frequency: typeof row.frequency === 'string' ? row.frequency : 'EVERY_VISIT',
    closeBehavior: Array.isArray(row.closeBehavior)
      ? row.closeBehavior.filter((item): item is string => typeof item === 'string')
      : [],
    autoCloseSeconds: typeof row.autoCloseSeconds === 'number' ? row.autoCloseSeconds : null,
    position: typeof row.position === 'string' ? row.position : 'CENTER',
    animation: typeof row.animation === 'string' ? row.animation : 'FADE',
    overlayJson: isRecord(row.overlayJson) ? row.overlayJson : {},
    sizeJson: isRecord(row.sizeJson) ? row.sizeJson : {},
  };
}

export async function getActiveHomePopups(): Promise<PublicPopup[]> {
  const payload = await fetchCms('popups', { page: 'home' }, 120);
  if (!Array.isArray(payload)) return [];
  const mapped = payload.filter(isRecord).map(mapPopup).filter(Boolean) as PublicPopup[];
  return mapped.sort((a, b) => a.displayOrder - b.displayOrder);
}
