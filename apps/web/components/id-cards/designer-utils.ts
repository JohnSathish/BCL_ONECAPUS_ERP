import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { CR80_SAFE_MARGIN_MM } from './cr80-designer-constants';
import type { IdCardElement, IdCardLayoutV1 } from '@/types/id-card-template';

export type CardAlignment =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'
  | 'center';

export function cloneLayout(layout: IdCardLayoutV1): IdCardLayoutV1 {
  return structuredClone(layout);
}

export function alignElementToCard(
  element: Pick<IdCardElement, 'x' | 'y' | 'width' | 'height'>,
  alignment: CardAlignment,
  useSafeMargin = true,
): Partial<Pick<IdCardElement, 'x' | 'y'>> {
  const inset = useSafeMargin ? CR80_SAFE_MARGIN_MM : 0;
  const maxX = CR80_WIDTH_MM - element.width - inset;
  const maxY = CR80_HEIGHT_MM - element.height - inset;

  switch (alignment) {
    case 'left':
      return { x: inset };
    case 'right':
      return { x: Math.max(inset, maxX) };
    case 'center-h':
      return { x: Math.max(inset, (CR80_WIDTH_MM - element.width) / 2) };
    case 'top':
      return { y: inset };
    case 'bottom':
      return { y: Math.max(inset, maxY) };
    case 'center-v':
      return { y: Math.max(inset, (CR80_HEIGHT_MM - element.height) / 2) };
    case 'center':
      return {
        x: Math.max(inset, (CR80_WIDTH_MM - element.width) / 2),
        y: Math.max(inset, (CR80_HEIGHT_MM - element.height) / 2),
      };
    default:
      return {};
  }
}

export function nudgeElement(
  element: Pick<IdCardElement, 'x' | 'y' | 'width' | 'height'>,
  direction: 'up' | 'down' | 'left' | 'right',
  stepMm: number,
): Partial<Pick<IdCardElement, 'x' | 'y'>> {
  switch (direction) {
    case 'up':
      return { y: Math.max(0, element.y - stepMm) };
    case 'down':
      return { y: Math.min(CR80_HEIGHT_MM - element.height, element.y + stepMm) };
    case 'left':
      return { x: Math.max(0, element.x - stepMm) };
    case 'right':
      return { x: Math.min(CR80_WIDTH_MM - element.width, element.x + stepMm) };
    default:
      return {};
  }
}

/** Reorder layers shown top-to-bottom (highest z-index first). */
export function reorderLayerElements(
  elements: IdCardElement[],
  fromIndex: number,
  toIndex: number,
): IdCardElement[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return elements;
  const sorted = [...elements].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  const [moved] = sorted.splice(fromIndex, 1);
  if (!moved) return elements;
  sorted.splice(toIndex, 0, moved);
  const count = sorted.length;
  return sorted.map((el, index) => ({ ...el, zIndex: count - index }));
}

export function reassignZIndex(elements: IdCardElement[]): IdCardElement[] {
  return [...elements]
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((el, index) => ({ ...el, zIndex: index + 1 }));
}

export const STYLE_PRESET_OPTIONS = [
  { id: 'pursuit-excellence', label: 'Pursuit of Excellence (DBC Student)' },
  { id: 'pursuit-staff', label: 'Pursuit Staff Navy & Gold (DBC)' },
  { id: 'gradient', label: 'Vibrant gradient' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'academic', label: 'Academic maroon' },
  { id: 'rfid', label: 'RFID tech' },
  { id: 'minimal', label: 'Minimal flat' },
  { id: 'gold', label: 'Gold premium' },
  { id: 'compact', label: 'Compact' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'elite', label: 'Elite dual-tone' },
] as const;

export const PREVIEW_DATA_OPTIONS = [
  { id: 'student', label: 'Student sample' },
  { id: 'staff', label: 'Staff sample' },
  { id: 'minimal', label: 'Minimal placeholders' },
] as const;

export type PreviewDataId = (typeof PREVIEW_DATA_OPTIONS)[number]['id'];
