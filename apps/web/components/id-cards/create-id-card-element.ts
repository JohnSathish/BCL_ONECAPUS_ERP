import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from '@/components/id-cards/cr80-constants';
import {
  defaultContentForTextVariant,
  type IdCardCatalogItem,
  type PaletteDragPayload,
} from '@/components/id-cards/id-card-element-catalog';
import type { IdCardElement, IdCardLayoutV1, IdCardShapeKind } from '@/types/id-card-template';

function newElementId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

function placeOnCard(
  layout: IdCardLayoutV1,
  side: 'front' | 'back',
  width: number,
  height: number,
  at?: { x: number; y: number },
): { x: number; y: number; zIndex: number } {
  const existing = side === 'front' ? layout.front : layout.back;
  const fallbackY =
    existing.length > 0 ? Math.min(75, Math.max(...existing.map((e) => e.y + e.height)) + 2) : 10;
  const x = at ? Math.max(0, Math.min(CR80_WIDTH_MM - width, at.x - width / 2)) : 4;
  const y = at ? Math.max(0, Math.min(CR80_HEIGHT_MM - height, at.y - height / 2)) : fallbackY;
  return { x, y, zIndex: existing.length + 1 };
}

export function createFieldElement(
  fieldKey: string,
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
  at?: { x: number; y: number },
): IdCardElement {
  const width = fieldKey === 'holderAddress' ? 48 : fieldKey === 'photo' ? 30 : 46;
  const height =
    fieldKey === 'holderAddress' ? 9 : fieldKey === 'photo' ? 28 : fieldKey === 'qr' ? 14 : 8;
  const pos = placeOnCard(layout, side, width, height, at);
  return {
    id: newElementId(fieldKey),
    type: 'field',
    fieldKey,
    x: pos.x,
    y: pos.y,
    width,
    height,
    zIndex: pos.zIndex,
    style: { visible: true, align: 'center' },
  };
}

export function createTextElement(
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
  opts?: { at?: { x: number; y: number }; variant?: 'heading' | 'body' },
): IdCardElement {
  const heading = opts?.variant === 'heading';
  const width = heading ? 40 : 36;
  const height = heading ? 8 : 6;
  const pos = placeOnCard(layout, side, width, height, opts?.at);
  return {
    id: newElementId('text'),
    type: 'text',
    content: defaultContentForTextVariant(opts?.variant),
    label: heading ? 'Heading' : 'Static Text',
    x: pos.x,
    y: pos.y,
    width,
    height,
    zIndex: pos.zIndex,
    style: {
      visible: true,
      align: 'center',
      fontSize: heading ? 10 : 7,
      fontWeight: heading ? 'bold' : 'medium',
      color: '#0f172a',
    },
  };
}

export function createShapeElement(
  shapeKind: IdCardShapeKind,
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
  at?: { x: number; y: number },
): IdCardElement {
  const width =
    shapeKind === 'line' || shapeKind === 'divider' ? 40 : shapeKind === 'circle' ? 16 : 24;
  const height =
    shapeKind === 'line' || shapeKind === 'divider' ? 0.6 : shapeKind === 'circle' ? 16 : 12;
  const pos = placeOnCard(layout, side, width, height, at);
  return {
    id: newElementId(`shape-${shapeKind}`),
    type: 'shape',
    shapeKind,
    x: pos.x,
    y: pos.y,
    width,
    height,
    zIndex: pos.zIndex,
    style: {
      visible: true,
      backgroundColor: shapeKind === 'line' || shapeKind === 'divider' ? '#0f172a' : '#e2e8f0',
      borderRadiusMm: shapeKind === 'rectangle' ? 1 : 0,
      opacity: 1,
    },
  };
}

export function createElementFromPayload(
  payload: PaletteDragPayload,
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
  at?: { x: number; y: number },
): IdCardElement {
  if (payload.kind === 'text')
    return createTextElement(side, layout, { at, variant: payload.variant });
  if (payload.kind === 'shape') return createShapeElement(payload.shapeKind, side, layout, at);
  return createFieldElement(payload.fieldKey, side, layout, at);
}

export function createElementFromCatalogItem(
  item: IdCardCatalogItem,
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
  at?: { x: number; y: number },
): IdCardElement {
  if (item.kind === 'text') {
    return createTextElement(side, layout, {
      at,
      variant: item.id === 'heading-text' ? 'heading' : 'body',
    });
  }
  if (item.kind === 'shape') {
    return createShapeElement(item.shapeKind ?? 'rectangle', side, layout, at);
  }
  return createFieldElement(item.fieldKey ?? 'name', side, layout, at);
}
