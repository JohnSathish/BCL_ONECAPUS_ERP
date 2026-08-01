'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
import {
  snapToAlignmentGuides,
  type AlignmentGuideLine,
  type GuideBox,
} from './id-card-alignment-guides';
import {
  PALETTE_ELEMENT_MIME,
  getFieldDisplayName,
  parsePalettePayload,
} from './id-card-element-catalog';
import {
  applyBindingToPlainText,
  cssTextTransform,
  elementChromeStyle,
  elementFieldChromeStyle,
  photoBorderRadius,
} from './id-card-element-style';

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
  /** Palette drop at cursor (mm coords relative to card). Accepts field key or JSON payload. */
  onPaletteDrop?: (payload: string, xMm: number, yMm: number) => void;
};

const cardStyle = {
  width: `${CR80_WIDTH_MM}mm`,
  height: `${CR80_HEIGHT_MM}mm`,
  maxWidth: `${CR80_WIDTH_MM}mm`,
  maxHeight: `${CR80_HEIGHT_MM}mm`,
};

const PALETTE_MIME = 'application/x-id-card-field';

function ShapePreview({ element }: { element: IdCardElement }) {
  const kind = element.shapeKind ?? 'rectangle';
  const fill =
    element.style?.backgroundColor ??
    (kind === 'line' || kind === 'divider' ? '#0f172a' : '#e2e8f0');
  const stroke = element.style?.borderColor;
  const strokeW = element.style?.borderWidthMm ?? 0;
  const opacity = element.style?.opacity ?? 1;
  const radius = element.style?.borderRadiusMm ?? 0;

  if (kind === 'line' || kind === 'divider') {
    return (
      <div className="flex h-full w-full items-center" style={{ opacity }}>
        <div
          className="w-full"
          style={{
            height: `${Math.max(0.2, element.height)}mm`,
            background: fill,
            borderRadius: `${radius}mm`,
          }}
        />
      </div>
    );
  }

  if (kind === 'circle') {
    return (
      <div
        className="h-full w-full"
        style={{
          borderRadius: '50%',
          background: fill,
          opacity,
          border: strokeW && stroke ? `${strokeW}mm solid ${stroke}` : undefined,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <div
      className="h-full w-full"
      style={{
        borderRadius: `${radius}mm`,
        background: fill,
        opacity,
        border: strokeW && stroke ? `${strokeW}mm solid ${stroke}` : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
}

function StaticTextPreview({ element }: { element: IdCardElement }) {
  const raw = element.content ?? element.label ?? 'Text';
  const text = applyBindingToPlainText(raw, element.binding);
  return (
    <div
      className="h-full w-full overflow-hidden break-words"
      style={elementChromeStyle(element.style)}
    >
      {element.binding?.showLabel && element.label ? (
        <div className="mb-0.5 text-[0.7em] opacity-70">{element.label}</div>
      ) : null}
      <div
        style={{
          textTransform: cssTextTransform(
            element.binding?.textTransform,
          ) as CSSProperties['textTransform'],
        }}
      >
        {text}
      </div>
    </div>
  );
}

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
  onPaletteDrop,
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
  const [guides, setGuides] = useState<AlignmentGuideLine[]>([]);

  const siblingBoxes = useMemo(() => {
    return elements
      .filter((el) => el.style?.visible !== false)
      .map((el): GuideBox & { id: string } => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      }));
  }, [elements]);

  const renderElementContent = (element: IdCardElement): ReactNode => {
    if (element.type === 'shape') {
      return <ShapePreview element={element} />;
    }
    if (element.type === 'text') {
      return <StaticTextPreview element={element} />;
    }
    if (!element.fieldKey) return null;
    const content = renderIdCardField(element.fieldKey as IdCardFieldKey, model, accent, primary, {
      stylePreset,
      photoShape: element.style?.photoShape,
      signatureUrl,
      side,
      fontSize: element.style?.fontSize,
      showLabel: element.binding?.showLabel,
    });
    if (!content) return null;
    // Capition labels only when showLabel is explicitly true (value-only overlays omit them).
    const showLabel = element.binding?.showLabel === true;
    const label = getFieldDisplayName(element.fieldKey, element.label);
    const prefix = element.binding?.prefix;
    const suffix = element.binding?.suffix;
    return (
      <>
        {showLabel ? <div className="mb-0.5 text-[0.7em] opacity-70">{label}</div> : null}
        {prefix || suffix ? (
          <div className="flex h-[calc(100%-0.5em)] min-h-0 w-full items-center justify-center gap-0.5 overflow-hidden">
            {prefix ? <span className="shrink-0 text-[0.85em] opacity-80">{prefix}</span> : null}
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{content}</div>
            {suffix ? <span className="shrink-0 text-[0.85em] opacity-80">{suffix}</span> : null}
          </div>
        ) : (
          content
        )}
      </>
    );
  };

  const renderElement = (element: IdCardElement) => {
    if (element.style?.visible === false) return null;
    if (element.type === 'field' && !element.fieldKey) return null;

    const content = renderElementContent(element);
    if (!content) return null;

    const selected = selectedElementId === element.id;
    const locked = lockedElementIds?.has(element.id) || element.locked === true;
    const overflow = element.type === 'field' ? idCardFieldOverflow(element.fieldKey) : 'hidden';

    const chrome: CSSProperties =
      element.type === 'shape'
        ? { opacity: 1 }
        : {
            ...(element.type === 'field'
              ? elementFieldChromeStyle(element.style)
              : elementChromeStyle(element.style)),
            // photo shape border-radius override on container when photo
            ...(element.fieldKey === 'photo'
              ? { borderRadius: photoBorderRadius(element.style?.photoShape), overflow: 'hidden' }
              : {}),
            textTransform: cssTextTransform(
              element.binding?.textTransform,
            ) as CSSProperties['textTransform'],
          };

    const box = (
      <div
        className={cn(
          'h-full w-full',
          overflow === 'hidden' ? 'overflow-hidden' : 'overflow-visible',
          designMode && !locked && 'cursor-move',
          designMode && selected && 'ring-2 ring-primary ring-offset-1',
          designMode && !selected && 'hover:ring-1 hover:ring-primary/30',
        )}
        style={chrome}
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
        onDrag={(_e, d) => {
          const rawX = screenPxToMm(d.x, designZoom);
          const rawY = screenPxToMm(d.y, designZoom);
          const siblings = siblingBoxes.filter((s) => s.id !== element.id);
          const snapped = snapToAlignmentGuides(
            { x: rawX, y: rawY, width: element.width, height: element.height },
            siblings,
          );
          setGuides(snapped.guides);
        }}
        onDragStop={(_e, d) => {
          const rawX = screenPxToMm(d.x, designZoom);
          const rawY = screenPxToMm(d.y, designZoom);
          const siblings = siblingBoxes.filter((s) => s.id !== element.id);
          const aligned = snapToAlignmentGuides(
            { x: rawX, y: rawY, width: element.width, height: element.height },
            siblings,
          );
          setGuides([]);
          onElementChange(element.id, {
            x: snapMm(aligned.x, CR80_GRID_MM, snapToGrid),
            y: snapMm(aligned.y, CR80_GRID_MM, snapToGrid),
          });
          onSelectElement?.(element.id);
        }}
        onResizeStop={(_e, _dir, ref, _delta, position) => {
          setGuides([]);
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

  const handlePaletteDragOver = (e: React.DragEvent) => {
    if (!designMode || !onPaletteDrop) return;
    if (
      e.dataTransfer.types.includes(PALETTE_MIME) ||
      e.dataTransfer.types.includes(PALETTE_ELEMENT_MIME) ||
      e.dataTransfer.types.includes('text/plain')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handlePaletteDrop = (e: React.DragEvent) => {
    if (!designMode || !onPaletteDrop) return;
    const raw =
      e.dataTransfer.getData(PALETTE_ELEMENT_MIME) ||
      e.dataTransfer.getData(PALETTE_MIME) ||
      e.dataTransfer.getData('text/plain');
    if (!raw || !parsePalettePayload(raw)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const xMm = screenPxToMm(e.clientX - rect.left, designZoom);
    const yMm = screenPxToMm(e.clientY - rect.top, designZoom);
    onPaletteDrop(raw, xMm, yMm);
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
      onDragOver={handlePaletteDragOver}
      onDrop={handlePaletteDrop}
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
      {designMode && guides.length > 0
        ? guides.map((g) =>
            g.orientation === 'v' ? (
              <div
                key={`v-${g.position}`}
                className="pointer-events-none absolute top-0 z-[100] w-px bg-sky-500"
                style={{
                  left: mmToScreenPx(g.position, designZoom),
                  height: mmToScreenPx(CR80_HEIGHT_MM, designZoom),
                }}
              />
            ) : (
              <div
                key={`h-${g.position}`}
                className="pointer-events-none absolute left-0 z-[100] h-px bg-sky-500"
                style={{
                  top: mmToScreenPx(g.position, designZoom),
                  width: mmToScreenPx(CR80_WIDTH_MM, designZoom),
                }}
              />
            ),
          )
        : null}
    </div>
  );
}

export function Cr80CardFront(props: Omit<Props, 'side'>) {
  return <Cr80CardRenderer {...props} side="front" />;
}

export function Cr80CardBack(props: Omit<Props, 'side'>) {
  return <Cr80CardRenderer {...props} side="back" />;
}

export { PALETTE_MIME };
