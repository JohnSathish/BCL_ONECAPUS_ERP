'use client';

import {
  Building2,
  Circle,
  GraduationCap,
  Phone,
  Image,
  Minus,
  QrCode,
  Search,
  Shield,
  Square,
  Type,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
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

const CATEGORY_ICON: Record<string, LucideIcon> = {
  text: Type,
  shapes: Square,
  images: Image,
  student: UserRound,
  academic: GraduationCap,
  contact: Phone,
  parent: UserRound,
  institution: Building2,
  staff: UserRound,
  system: Shield,
};

function iconForItem(item: IdCardCatalogItem): LucideIcon {
  if (item.fieldKey === 'qr' || item.fieldKey === 'barcode') return QrCode;
  if (item.shapeKind === 'circle') return Circle;
  if (item.shapeKind === 'line' || item.shapeKind === 'divider') return Minus;
  return CATEGORY_ICON[item.category] ?? Square;
}

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
            <div className="grid grid-cols-1 gap-1">
              {group.items.map((item) => {
                const Icon = iconForItem(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    className="flex w-full cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm active:cursor-grabbing hover:border-blue-300 hover:bg-blue-50"
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
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{item.defaultLabel}</span>
                  </button>
                );
              })}
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
