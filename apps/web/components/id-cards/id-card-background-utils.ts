import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type {
  IdCardBackgroundFit,
  IdCardBackgroundLayer,
  IdCardLayoutV1,
} from '@/types/id-card-template';

export const BACKGROUND_SELECTION_FRONT = '__background_front__';
export const BACKGROUND_SELECTION_BACK = '__background_back__';

export function isBackgroundSelection(
  id: string | null | undefined,
): id is typeof BACKGROUND_SELECTION_FRONT | typeof BACKGROUND_SELECTION_BACK {
  return id === BACKGROUND_SELECTION_FRONT || id === BACKGROUND_SELECTION_BACK;
}

export function backgroundForSide(
  layout: IdCardLayoutV1,
  side: 'front' | 'back',
): IdCardBackgroundLayer | null | undefined {
  return side === 'front' ? layout.frontBackground : layout.backBackground;
}

export function defaultBackgroundLayer(upload: {
  imageUrl: string;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
}): IdCardBackgroundLayer {
  return {
    imageUrl: upload.imageUrl,
    x: 0,
    y: 0,
    width: CR80_WIDTH_MM,
    height: CR80_HEIGHT_MM,
    opacity: 1,
    fit: 'cover',
    locked: true,
    naturalWidth: upload.naturalWidth ?? null,
    naturalHeight: upload.naturalHeight ?? null,
  };
}

export function layoutForBackgroundTemplate(holderType: string): IdCardLayoutV1 {
  void holderType;
  return {
    version: 1,
    meta: { creationMethod: 'background-upload', stylePreset: 'minimal' },
    frontBackground: null,
    backBackground: null,
    front: [],
    back: [],
  };
}

export function cssObjectFit(fit: IdCardBackgroundFit | undefined): string {
  switch (fit ?? 'cover') {
    case 'stretch':
      return 'fill';
    case 'contain':
      return 'contain';
    case 'cover':
      return 'cover';
    case 'original':
      return 'none';
    default:
      return 'cover';
  }
}

export function backgroundImageUrl(layer: IdCardBackgroundLayer): string | undefined {
  return resolveUploadAssetUrl(layer.imageUrl);
}

export function backgroundPrintHtml(layer: IdCardBackgroundLayer): string {
  const url = backgroundImageUrl(layer);
  if (!url) return '';
  const opacity = layer.opacity ?? 1;
  const fit = cssObjectFit(layer.fit);
  const imgStyle =
    layer.fit === 'original' && layer.naturalWidth && layer.naturalHeight
      ? `width:${(layer.naturalWidth / 300) * 25.4}mm;height:${(layer.naturalHeight / 300) * 25.4}mm;object-fit:none;max-width:none;max-height:none;`
      : `width:100%;height:100%;object-fit:${fit};`;

  return `<div style="position:absolute;left:${layer.x}mm;top:${layer.y}mm;width:${layer.width}mm;height:${layer.height}mm;opacity:${opacity};z-index:0;overflow:hidden;pointer-events:none;">
    <img src="${url}" alt="" style="${imgStyle}image-rendering:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />
  </div>`;
}

export const BACKGROUND_FIT_OPTIONS: { id: IdCardBackgroundFit; label: string }[] = [
  { id: 'cover', label: 'Cover' },
  { id: 'contain', label: 'Contain' },
  { id: 'stretch', label: 'Stretch' },
  { id: 'original', label: 'Original size' },
];

export const BACKGROUND_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
export const BACKGROUND_MAX_MB = 10;

export function validateBackgroundFile(file: File): string | null {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return 'Use PNG, JPG, JPEG, or WEBP.';
  }
  if (file.size > BACKGROUND_MAX_MB * 1024 * 1024) {
    return `Maximum file size is ${BACKGROUND_MAX_MB} MB.`;
  }
  return null;
}
