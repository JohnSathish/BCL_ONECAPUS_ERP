'use client';

import { Image, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { IdCardBackgroundUploader } from '@/components/id-cards/id-card-background-uploader';
import { backgroundForSide } from '@/components/id-cards/id-card-background-utils';
import {
  catalogItemsForHolder,
  groupCatalogByCategory,
  PALETTE_ELEMENT_MIME,
  serializePalettePayload,
  type IdCardCatalogItem,
  type PaletteDragPayload,
} from '@/components/id-cards/id-card-element-catalog';
import { PALETTE_MIME } from '@/components/id-cards/cr80-card-renderer';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { BackgroundUploadResult } from '@/components/id-cards/id-card-background-uploader';

type Props = {
  holderType?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  layout: IdCardLayoutV1;
  activeCardSide: 'front' | 'back';
  templateId?: string;
  onBackgroundUploaded: (result: BackgroundUploadResult) => void;
  onAddItem: (item: IdCardCatalogItem) => void;
};

function payloadForItem(item: IdCardCatalogItem): PaletteDragPayload {
  if (item.kind === 'shape') {
    return { kind: 'shape', shapeKind: item.shapeKind ?? 'rectangle' };
  }
  if (item.kind === 'text') {
    return { kind: 'text', variant: item.id === 'heading-text' ? 'heading' : 'body' };
  }
  return { kind: 'field', fieldKey: item.fieldKey ?? 'name' };
}

export function DesignerElementsPanel({
  holderType,
  search,
  onSearchChange,
  layout,
  activeCardSide,
  templateId,
  onBackgroundUploaded,
  onAddItem,
}: Props) {
  const items = catalogItemsForHolder(holderType, search);
  const groups = groupCatalogByCategory(items);

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
        <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
          <Image className="h-3.5 w-3.5" /> Background Image
        </p>
        <IdCardBackgroundUploader
          side={activeCardSide}
          templateId={templateId}
          existingUrl={backgroundForSide(layout, activeCardSide)?.imageUrl}
          onUploaded={onBackgroundUploaded}
          compact
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {activeCardSide === 'front' ? 'Front' : 'Back'} side · layer 0 (bottom)
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Search elements…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  className="flex w-full cursor-grab items-center rounded-md border border-border px-2 py-1.5 text-left active:cursor-grabbing hover:bg-muted"
                  onClick={() => onAddItem(item)}
                  onDragStart={(e) => {
                    const payload = payloadForItem(item);
                    const json = serializePalettePayload(payload);
                    e.dataTransfer.setData(PALETTE_ELEMENT_MIME, json);
                    e.dataTransfer.setData(PALETTE_MIME, item.fieldKey ?? json);
                    e.dataTransfer.setData('text/plain', item.fieldKey ?? json);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  + {item.defaultLabel}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">No matching elements.</p>
        ) : null}
        <p className="pt-1 text-[10px] text-muted-foreground">
          Drag onto the card or click to add.
        </p>
      </div>
    </div>
  );
}
