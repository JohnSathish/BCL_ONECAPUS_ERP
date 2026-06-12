'use client';

import { Rnd } from 'react-rnd';

import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { IdCardBackgroundLayer } from '@/types/id-card-template';
import { cn } from '@/utils/cn';
import { cssObjectFit } from './id-card-background-utils';
import { mmToScreenPx, screenPxToMm, snapMm, CR80_GRID_MM } from './cr80-designer-constants';

type Props = {
  layer: IdCardBackgroundLayer;
  designMode?: boolean;
  designZoom?: number;
  selected?: boolean;
  snapToGrid?: boolean;
  onSelect?: () => void;
  onChange?: (patch: Partial<Pick<IdCardBackgroundLayer, 'x' | 'y' | 'width' | 'height'>>) => void;
};

function BackgroundImageContent({ layer }: { layer: IdCardBackgroundLayer }) {
  const url = resolveUploadAssetUrl(layer.imageUrl);
  const fit = cssObjectFit(layer.fit);
  const opacity = layer.opacity ?? 1;

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-[8px] text-muted-foreground">
        Background
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-full w-full"
      style={{
        objectFit: fit as React.CSSProperties['objectFit'],
        opacity,
        ...(layer.fit === 'original' && layer.naturalWidth && layer.naturalHeight
          ? {
              width: `${(layer.naturalWidth / 300) * 25.4}mm`,
              height: `${(layer.naturalHeight / 300) * 25.4}mm`,
              objectFit: 'none' as const,
              maxWidth: 'none',
              maxHeight: 'none',
            }
          : {}),
      }}
      draggable={false}
    />
  );
}

export function IdCardBackgroundLayerView({
  layer,
  designMode,
  designZoom = 1,
  selected,
  snapToGrid = false,
  onSelect,
  onChange,
}: Props) {
  const locked = layer.locked ?? false;
  const box = (
    <div
      className={cn(
        'h-full w-full overflow-hidden',
        designMode && !locked && 'cursor-move',
        designMode && selected && 'ring-2 ring-violet-500 ring-offset-1',
        designMode && !selected && 'hover:ring-1 hover:ring-violet-400/40',
      )}
      onClick={
        designMode
          ? (e) => {
              e.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
    >
      <BackgroundImageContent layer={layer} />
    </div>
  );

  if (!designMode || !onChange) {
    return (
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{
          left: `${layer.x}mm`,
          top: `${layer.y}mm`,
          width: `${layer.width}mm`,
          height: `${layer.height}mm`,
          zIndex: 0,
        }}
      >
        {box}
      </div>
    );
  }

  if (locked) {
    return (
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${layer.x}mm`,
          top: `${layer.y}mm`,
          width: `${layer.width}mm`,
          height: `${layer.height}mm`,
          zIndex: 0,
        }}
      >
        {box}
      </div>
    );
  }

  return (
    <Rnd
      size={{
        width: mmToScreenPx(layer.width, designZoom),
        height: mmToScreenPx(layer.height, designZoom),
      }}
      position={{
        x: mmToScreenPx(layer.x, designZoom),
        y: mmToScreenPx(layer.y, designZoom),
      }}
      bounds="parent"
      disableDragging={locked}
      enableResizing={!locked}
      onDragStop={(_e, d) => {
        onChange({
          x: snapMm(screenPxToMm(d.x, designZoom), CR80_GRID_MM, snapToGrid),
          y: snapMm(screenPxToMm(d.y, designZoom), CR80_GRID_MM, snapToGrid),
        });
        onSelect?.();
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onChange({
          x: snapMm(screenPxToMm(position.x, designZoom), CR80_GRID_MM, snapToGrid),
          y: snapMm(screenPxToMm(position.y, designZoom), CR80_GRID_MM, snapToGrid),
          width: snapMm(screenPxToMm(ref.offsetWidth, designZoom), CR80_GRID_MM, snapToGrid),
          height: snapMm(screenPxToMm(ref.offsetHeight, designZoom), CR80_GRID_MM, snapToGrid),
        });
        onSelect?.();
      }}
      style={{ zIndex: 0 }}
    >
      {box}
    </Rnd>
  );
}
