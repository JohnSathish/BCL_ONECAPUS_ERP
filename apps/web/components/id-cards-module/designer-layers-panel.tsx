'use client';

import { Eye, EyeOff, GripVertical, Image, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getElementLayerLabel } from '@/components/id-cards/id-card-element-catalog';
import {
  BACKGROUND_SELECTION_BACK,
  BACKGROUND_SELECTION_FRONT,
  backgroundForSide,
  isBackgroundSelection,
} from '@/components/id-cards/id-card-background-utils';
import type { IdCardElement, IdCardLayoutV1 } from '@/types/id-card-template';

type Props = {
  layers: IdCardElement[];
  layersSide: 'front' | 'back';
  layout: IdCardLayoutV1;
  selectedElementId: string | null;
  lockedIds: Set<string>;
  layerDragIndex: number | null;
  onLayerDragIndex: (index: number | null) => void;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function DesignerLayersPanel({
  layers,
  layersSide,
  layout,
  selectedElementId,
  lockedIds,
  layerDragIndex,
  onLayerDragIndex,
  onSelect,
  onReorder,
}: Props) {
  const background = backgroundForSide(layout, layersSide);

  return (
    <ul className="space-y-1">
      {layers.map((el, index) => {
        const hidden = el.style?.visible === false;
        const locked = lockedIds.has(el.id) || el.locked === true;
        return (
          <li
            key={`${layersSide}-${el.id}-${index}`}
            draggable
            onDragStart={() => onLayerDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (layerDragIndex != null && layerDragIndex !== index) {
                onReorder(layerDragIndex, index);
              }
              onLayerDragIndex(null);
            }}
          >
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-1 rounded px-1 py-1',
                selectedElementId === el.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                hidden && 'opacity-50',
              )}
              onClick={() => onSelect(el.id)}
            >
              <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left">{getElementLayerLabel(el)}</span>
              {locked ? <Lock className="h-2.5 w-2.5 shrink-0" /> : null}
              {hidden ? (
                <EyeOff className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <Eye className="h-2.5 w-2.5 shrink-0 opacity-30" />
              )}
              <span className="text-[10px] text-muted-foreground">z{el.zIndex ?? 0}</span>
            </button>
          </li>
        );
      })}
      {background ? (
        <li key={`${layersSide}-background`} className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-1 rounded px-1 py-1',
              isBackgroundSelection(selectedElementId) &&
                ((layersSide === 'front' && selectedElementId === BACKGROUND_SELECTION_FRONT) ||
                  (layersSide === 'back' && selectedElementId === BACKGROUND_SELECTION_BACK))
                ? 'bg-violet-500/10 text-violet-700'
                : 'hover:bg-muted',
            )}
            onClick={() =>
              onSelect(
                layersSide === 'front' ? BACKGROUND_SELECTION_FRONT : BACKGROUND_SELECTION_BACK,
              )
            }
          >
            <Image className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">Background Image</span>
            {background.locked ? <Lock className="h-2.5 w-2.5 shrink-0" /> : null}
            <span className="text-[10px] text-muted-foreground">z0</span>
          </button>
        </li>
      ) : null}
    </ul>
  );
}
