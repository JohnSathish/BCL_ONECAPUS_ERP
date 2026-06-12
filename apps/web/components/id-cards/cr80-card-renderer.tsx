'use client';

import type { IdCardElement } from '@/types/id-card-template';
import type { IdCardFieldKey, IdCardLayoutV1 } from '@/types/id-card-template';
import type { IdCardModel } from '@/types/id-card';
import { cn } from '@/utils/cn';
import { Rnd } from 'react-rnd';
import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from './cr80-constants';
import { mmToScreenPx, screenPxToMm, snapMm, CR80_GRID_MM } from './cr80-designer-constants';
import { renderIdCardField } from './id-card-field-registry';
import { normalizeIdCardLayout } from './layout-legacy-migrate';
import { backgroundForSide } from './id-card-background-utils';
import { IdCardBackgroundLayerView } from './id-card-background-layer';
import { idCardFieldOverflow } from './id-card-field-overflow';
import type { IdCardBackgroundLayer } from '@/types/id-card-template';

type Props = {
  model: IdCardModel;
  layout?: IdCardLayoutV1 | null;
  side: 'front' | 'back';
  className?: string;
  printMode?: boolean;
  holderType?: string;
  designMode?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onElementChange?: (
    id: string,
    patch: Partial<Pick<IdCardElement, 'x' | 'y' | 'width' | 'height'>>,
  ) => void;
  zoom?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  showSafeMargin?: boolean;
  showPrintArea?: boolean;
  lockedElementIds?: Set<string>;
  signatureUrl?: string | null;
  backgroundSelected?: boolean;
  onSelectBackground?: () => void;
  onBackgroundChange?: (
    patch: Partial<Pick<IdCardBackgroundLayer, 'x' | 'y' | 'width' | 'height'>>,
  ) => void;
};

const cardStyle = {
  width: `${CR80_WIDTH_MM}mm`,
  height: `${CR80_HEIGHT_MM}mm`,
  maxWidth: `${CR80_WIDTH_MM}mm`,
  maxHeight: `${CR80_HEIGHT_MM}mm`,
};

export function Cr80CardRenderer({
  model,
  layout,
  side,
  className,
  printMode,
  holderType,
  designMode,
  selectedElementId,
  onSelectElement,
  onElementChange,
  zoom = 1,
  snapToGrid = false,
  showGrid = false,
  showSafeMargin = false,
  showPrintArea = false,
  lockedElementIds,
  signatureUrl,
  backgroundSelected,
  onSelectBackground,
  onBackgroundChange,
}: Props) {
  const primary = model.institution.primaryColor;
  const accent = model.institution.accentColor;
  const resolved = normalizeIdCardLayout(
    layout ?? undefined,
    holderType ?? (model.cardType === 'staff' ? 'STAFF' : 'STUDENT'),
  );
  const elements = side === 'front' ? resolved.front : resolved.back;
  const background = backgroundForSide(resolved, side);
  const stylePreset = resolved.meta?.stylePreset;
  const designZoom = designMode ? zoom : 1;

  const renderElement = (element: IdCardElement) => {
    if (element.type !== 'field' || !element.fieldKey || element.style?.visible === false)
      return null;
    const content = renderIdCardField(element.fieldKey as IdCardFieldKey, model, accent, primary, {
      stylePreset,
      photoShape: element.style?.photoShape,
      signatureUrl,
      side,
    });
    if (!content) return null;

    const selected = selectedElementId === element.id;
    const locked = lockedElementIds?.has(element.id);

    const overflow = idCardFieldOverflow(element.fieldKey);

    const box = (
      <div
        className={cn(
          'h-full w-full',
          overflow === 'hidden' ? 'overflow-hidden' : 'overflow-visible',
          designMode && !locked && 'cursor-move',
          designMode && selected && 'ring-2 ring-primary ring-offset-1',
          designMode && !selected && 'hover:ring-1 hover:ring-primary/30',
        )}
        style={{
          textAlign: element.style?.align ?? 'center',
          fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : undefined,
          fontWeight: element.style?.fontWeight,
          color: element.style?.color,
          backgroundColor: element.style?.backgroundColor,
          opacity: element.style?.opacity,
          border:
            element.style?.borderWidthMm && element.style?.borderColor
              ? `${element.style.borderWidthMm}mm solid ${element.style.borderColor}`
              : undefined,
        }}
        onClick={
          designMode
            ? (e) => {
                e.stopPropagation();
                onSelectElement?.(element.id);
              }
            : undefined
        }
      >
        {content}
      </div>
    );

    if (!designMode || !onElementChange) {
      return (
        <div
          key={element.id}
          className={
            overflow === 'hidden' ? 'absolute overflow-hidden' : 'absolute overflow-visible'
          }
          style={{
            left: `${element.x}mm`,
            top: `${element.y}mm`,
            width: `${element.width}mm`,
            height: `${element.height}mm`,
            zIndex: element.zIndex ?? 1,
          }}
        >
          {box}
        </div>
      );
    }

    return (
      <Rnd
        key={element.id}
        size={{
          width: mmToScreenPx(element.width, designZoom),
          height: mmToScreenPx(element.height, designZoom),
        }}
        position={{
          x: mmToScreenPx(element.x, designZoom),
          y: mmToScreenPx(element.y, designZoom),
        }}
        bounds="parent"
        disableDragging={locked}
        enableResizing={!locked}
        onDragStop={(_e, d) => {
          onElementChange(element.id, {
            x: snapMm(screenPxToMm(d.x, designZoom), CR80_GRID_MM, snapToGrid),
            y: snapMm(screenPxToMm(d.y, designZoom), CR80_GRID_MM, snapToGrid),
          });
          onSelectElement?.(element.id);
        }}
        onResizeStop={(_e, _dir, ref, _delta, position) => {
          onElementChange(element.id, {
            x: snapMm(screenPxToMm(position.x, designZoom), CR80_GRID_MM, snapToGrid),
            y: snapMm(screenPxToMm(position.y, designZoom), CR80_GRID_MM, snapToGrid),
            width: snapMm(screenPxToMm(ref.offsetWidth, designZoom), CR80_GRID_MM, snapToGrid),
            height: snapMm(screenPxToMm(ref.offsetHeight, designZoom), CR80_GRID_MM, snapToGrid),
          });
          onSelectElement?.(element.id);
        }}
        style={{ zIndex: 10 + (element.zIndex ?? 0) }}
      >
        {box}
      </Rnd>
    );
  };

  return (
    <div
      className={cn(
        'cr80-id-card-face relative box-border overflow-hidden bg-white font-sans text-slate-900',
        side === 'front' ? 'cr80-id-card-front' : 'cr80-id-card-back',
        printMode &&
          'cr80-id-card-print shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-black/5',
        className,
      )}
      style={{
        ...cardStyle,
        ...(designMode
          ? {
              width: mmToScreenPx(CR80_WIDTH_MM, designZoom),
              height: mmToScreenPx(CR80_HEIGHT_MM, designZoom),
              maxWidth: mmToScreenPx(CR80_WIDTH_MM, designZoom),
              maxHeight: mmToScreenPx(CR80_HEIGHT_MM, designZoom),
            }
          : {}),
        ['--id-primary' as string]: primary,
        ['--id-accent' as string]: accent,
      }}
      onClick={designMode ? () => onSelectElement?.(null) : undefined}
    >
      {showPrintArea && designMode ? (
        <div
          className="pointer-events-none absolute inset-0 border-2 border-red-400/60"
          title="Print area"
        />
      ) : null}
      {showSafeMargin && designMode ? (
        <div
          className="pointer-events-none absolute border border-dashed border-amber-400/70"
          style={{ inset: `${3 * designZoom * (96 / 25.4)}px` }}
          title="Safe margin (3mm)"
        />
      ) : null}
      {showGrid && designMode ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)',
            backgroundSize: `${mmToScreenPx(CR80_GRID_MM, designZoom)}px ${mmToScreenPx(CR80_GRID_MM, designZoom)}px`,
          }}
        />
      ) : null}
      {background ? (
        <IdCardBackgroundLayerView
          layer={background}
          designMode={designMode}
          designZoom={designZoom}
          selected={backgroundSelected}
          snapToGrid={snapToGrid}
          onSelect={onSelectBackground}
          onChange={onBackgroundChange}
        />
      ) : null}
      {[...elements]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((element) => renderElement(element))}
    </div>
  );
}

export function Cr80CardFront(props: Omit<Props, 'side'>) {
  return <Cr80CardRenderer {...props} side="front" />;
}

export function Cr80CardBack(props: Omit<Props, 'side'>) {
  return <Cr80CardRenderer {...props} side="back" />;
}
