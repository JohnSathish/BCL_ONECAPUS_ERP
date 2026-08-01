'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IdCardBackgroundUploader,
  type BackgroundUploadResult,
} from '@/components/id-cards/id-card-background-uploader';
import { BACKGROUND_FIT_OPTIONS } from '@/components/id-cards/id-card-background-utils';
import {
  FIELD_DEFAULT_LABELS,
  getFieldDisplayName,
} from '@/components/id-cards/id-card-element-catalog';
import type {
  IdCardBackgroundLayer,
  IdCardElement,
  IdCardElementBinding,
  IdCardElementStyle,
  IdCardPhotoShape,
  IdCardShadow,
  IdCardTextTransform,
} from '@/types/id-card-template';

const FONT_FAMILIES = [
  { id: '', label: 'Default (system)' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { id: 'Georgia, serif', label: 'Georgia' },
  { id: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { id: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { id: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { id: 'Courier New, Courier, monospace', label: 'Courier New' },
];

const IMAGE_FIELD_KEYS = new Set([
  'photo',
  'logo',
  'watermark',
  'principalSignature',
  'qr',
  'barcode',
]);

type Props = {
  selectedElement: IdCardElement | null;
  selectedBackground: IdCardBackgroundLayer | null;
  backgroundSideSelected: 'front' | 'back' | null;
  templateId?: string;
  onUpdateElement: (patch: Partial<IdCardElement>) => void;
  onUpdateBackground: (side: 'front' | 'back', patch: Partial<IdCardBackgroundLayer>) => void;
  onBackgroundUploaded: (side: 'front' | 'back', result: BackgroundUploadResult) => void;
  onRemoveBackground: (side: 'front' | 'back') => void;
};

function updateStyle(
  el: IdCardElement,
  patch: Partial<IdCardElementStyle>,
): Partial<IdCardElement> {
  return { style: { ...el.style, ...patch } };
}

function updateBinding(
  el: IdCardElement,
  patch: Partial<IdCardElementBinding>,
): Partial<IdCardElement> {
  return { binding: { ...el.binding, ...patch } };
}

export function DesignerPropertiesPanel({
  selectedElement,
  selectedBackground,
  backgroundSideSelected,
  templateId,
  onUpdateElement,
  onUpdateBackground,
  onBackgroundUploaded,
  onRemoveBackground,
}: Props) {
  if (selectedBackground && backgroundSideSelected) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-muted-foreground">
          Background Image ({backgroundSideSelected === 'front' ? 'Front' : 'Back'})
        </p>
        <IdCardBackgroundUploader
          side={backgroundSideSelected}
          templateId={templateId}
          existingUrl={selectedBackground.imageUrl}
          onUploaded={(result) => onBackgroundUploaded(backgroundSideSelected, result)}
          compact
        />
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((prop) => (
            <div key={prop}>
              <Label className="text-[10px] uppercase">{prop} (mm)</Label>
              <Input
                type="number"
                step="0.5"
                className="h-8"
                value={selectedBackground[prop]}
                disabled={selectedBackground.locked}
                onChange={(e) =>
                  onUpdateBackground(backgroundSideSelected, {
                    [prop]: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          ))}
        </div>
        <div>
          <Label className="text-[10px] uppercase">Fit</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={selectedBackground.fit ?? 'cover'}
            onChange={(e) =>
              onUpdateBackground(backgroundSideSelected, {
                fit: e.target.value as IdCardBackgroundLayer['fit'],
              })
            }
          >
            {BACKGROUND_FIT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="h-8"
            value={selectedBackground.opacity ?? 1}
            onChange={(e) =>
              onUpdateBackground(backgroundSideSelected, { opacity: Number(e.target.value) })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={selectedBackground.locked ?? false}
            onChange={(e) =>
              onUpdateBackground(backgroundSideSelected, { locked: e.target.checked })
            }
          />
          Lock background
        </label>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={() => onRemoveBackground(backgroundSideSelected)}
        >
          Remove Background
        </Button>
      </div>
    );
  }

  if (!selectedElement) {
    return <p className="mt-2 text-muted-foreground">Select an element to edit properties.</p>;
  }

  const el = selectedElement;
  const isShape = el.type === 'shape';
  const isText = el.type === 'text';
  const isField = el.type === 'field';
  const isImageField = isField && IMAGE_FIELD_KEYS.has(el.fieldKey ?? '');
  const isPhoto = el.fieldKey === 'photo';
  const isQrOrBarcode = el.fieldKey === 'qr' || el.fieldKey === 'barcode';

  return (
    <div className="mt-2 space-y-3">
      <div>
        <p className="font-medium">
          {isShape
            ? (el.shapeKind ?? 'shape')
            : isText
              ? 'Static Text'
              : getFieldDisplayName(el.fieldKey, el.label)}
        </p>
        <p className="text-[10px] uppercase text-muted-foreground">{el.type}</p>
      </div>

      {(isField || isText) && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Label & binding
          </p>
          {isField ? (
            <>
              <div>
                <Label className="text-[10px] uppercase">Display label</Label>
                <Input
                  className="h-8"
                  value={el.label ?? FIELD_DEFAULT_LABELS[el.fieldKey ?? ''] ?? ''}
                  placeholder={FIELD_DEFAULT_LABELS[el.fieldKey ?? ''] ?? 'Label'}
                  onChange={(e) => onUpdateElement({ label: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Field ID (read-only)</Label>
                <Input className="h-8 bg-muted" value={el.fieldKey ?? ''} readOnly />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Database field</Label>
                <Input className="h-8 bg-muted" value={el.fieldKey ?? ''} readOnly />
              </div>
            </>
          ) : null}
          {isText ? (
            <div>
              <Label className="text-[10px] uppercase">Text content</Label>
              <textarea
                className="min-h-[64px] w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                value={el.content ?? ''}
                onChange={(e) => onUpdateElement({ content: e.target.value })}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Prefix</Label>
              <Input
                className="h-8"
                value={el.binding?.prefix ?? ''}
                onChange={(e) => onUpdateElement(updateBinding(el, { prefix: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Suffix</Label>
              <Input
                className="h-8"
                value={el.binding?.suffix ?? ''}
                onChange={(e) => onUpdateElement(updateBinding(el, { suffix: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Text transform</Label>
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2"
              value={el.binding?.textTransform ?? 'none'}
              onChange={(e) =>
                onUpdateElement(
                  updateBinding(el, {
                    textTransform: e.target.value as IdCardTextTransform,
                  }),
                )
              }
            >
              <option value="none">None</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="titlecase">Title Case</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Character limit</Label>
            <Input
              type="number"
              min={0}
              className="h-8"
              value={el.binding?.characterLimit ?? ''}
              placeholder="Unlimited"
              onChange={(e) =>
                onUpdateElement(
                  updateBinding(el, {
                    characterLimit: e.target.value ? Number(e.target.value) : undefined,
                  }),
                )
              }
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={el.binding?.showLabel === true}
              onChange={(e) => onUpdateElement(updateBinding(el, { showLabel: e.target.checked }))}
            />
            Show display label on card
          </label>
        </div>
      )}

      {isQrOrBarcode ? (
        <div className="rounded-md border border-border p-2 text-[10px] text-muted-foreground">
          {el.fieldKey === 'qr'
            ? 'QR encodes the issued card verification payload (from ID Card settings prefix + issue).'
            : 'Barcode uses CODE128 from registration / employee ID (Id Card settings).'}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((prop) => (
          <div key={prop}>
            <Label className="text-[10px] uppercase">{prop} (mm)</Label>
            <Input
              type="number"
              step="0.5"
              className="h-8"
              value={el[prop]}
              onChange={(e) => onUpdateElement({ [prop]: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>

      {isShape ? (
        <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Shape</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Fill</Label>
              <Input
                type="color"
                className="h-8 p-1"
                value={el.style?.backgroundColor ?? '#e2e8f0'}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { backgroundColor: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Stroke</Label>
              <Input
                type="color"
                className="h-8 p-1"
                value={el.style?.borderColor ?? '#0f172a'}
                onChange={(e) => onUpdateElement(updateStyle(el, { borderColor: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Stroke (mm)</Label>
              <Input
                type="number"
                step="0.1"
                className="h-8"
                value={el.style?.borderWidthMm ?? 0}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { borderWidthMm: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Corner radius</Label>
              <Input
                type="number"
                step="0.1"
                className="h-8"
                value={el.style?.borderRadiusMm ?? 0}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { borderRadiusMm: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {(isText || (isField && !isImageField)) && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Typography</p>
          <div>
            <Label className="text-[10px] uppercase">Font family</Label>
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2"
              value={el.style?.fontFamily ?? ''}
              onChange={(e) =>
                onUpdateElement(updateStyle(el, { fontFamily: e.target.value || undefined }))
              }
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.id || 'default'} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Font size (pt)</Label>
              <Input
                type="number"
                className="h-8"
                value={el.style?.fontSize ?? 6}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { fontSize: Number(e.target.value) || 6 }))
                }
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Font weight</Label>
              <select
                className="h-8 w-full rounded-md border border-border bg-background px-2"
                value={el.style?.fontWeight ?? 'bold'}
                onChange={(e) =>
                  onUpdateElement(
                    updateStyle(el, {
                      fontWeight: e.target.value as NonNullable<IdCardElementStyle['fontWeight']>,
                    }),
                  )
                }
              >
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
                <option value="extrabold">Extra bold</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={el.style?.fontStyle === 'italic'}
                onChange={(e) =>
                  onUpdateElement(
                    updateStyle(el, { fontStyle: e.target.checked ? 'italic' : 'normal' }),
                  )
                }
              />
              Italic
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={el.style?.textDecoration === 'underline'}
                onChange={(e) =>
                  onUpdateElement(
                    updateStyle(el, {
                      textDecoration: e.target.checked ? 'underline' : 'none',
                    }),
                  )
                }
              />
              Underline
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase">Letter spacing</Label>
              <Input
                type="number"
                step="0.1"
                className="h-8"
                value={el.style?.letterSpacing ?? 0}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { letterSpacing: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Line height</Label>
              <Input
                type="number"
                step="0.05"
                className="h-8"
                value={el.style?.lineHeight ?? 1.2}
                onChange={(e) =>
                  onUpdateElement(updateStyle(el, { lineHeight: Number(e.target.value) || 1.2 }))
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Alignment</Label>
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2"
              value={el.style?.align ?? 'center'}
              onChange={(e) =>
                onUpdateElement(
                  updateStyle(el, { align: e.target.value as 'left' | 'center' | 'right' }),
                )
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )}

      {isPhoto ? (
        <div>
          <Label className="text-[10px] uppercase">Photo shape</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={el.style?.photoShape ?? 'square'}
            onChange={(e) =>
              onUpdateElement(updateStyle(el, { photoShape: e.target.value as IdCardPhotoShape }))
            }
          >
            <option value="square">Square</option>
            <option value="rounded">Rounded rectangle</option>
            <option value="circle">Circle</option>
          </select>
        </div>
      ) : null}

      {isImageField ? (
        <div>
          <Label className="text-[10px] uppercase">Object fit</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={el.style?.objectFit ?? 'cover'}
            onChange={(e) =>
              onUpdateElement(
                updateStyle(el, {
                  objectFit: e.target.value as NonNullable<IdCardElementStyle['objectFit']>,
                }),
              )
            }
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase">Text / fill colour</Label>
          <Input
            type="color"
            className="h-8 p-1"
            value={el.style?.color ?? '#0f172a'}
            onChange={(e) => onUpdateElement(updateStyle(el, { color: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Background</Label>
          <Input
            type="color"
            className="h-8 p-1"
            value={el.style?.backgroundColor ?? '#ffffff'}
            onChange={(e) => onUpdateElement(updateStyle(el, { backgroundColor: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="h-8"
            value={el.style?.opacity ?? 1}
            onChange={(e) => onUpdateElement(updateStyle(el, { opacity: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Padding (mm)</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8"
            value={el.style?.paddingMm ?? 0}
            onChange={(e) =>
              onUpdateElement(updateStyle(el, { paddingMm: Number(e.target.value) || 0 }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase">Border colour</Label>
          <Input
            type="color"
            className="h-8 p-1"
            value={el.style?.borderColor ?? '#0f172a'}
            onChange={(e) => onUpdateElement(updateStyle(el, { borderColor: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Border (mm)</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8"
            value={el.style?.borderWidthMm ?? 0}
            onChange={(e) =>
              onUpdateElement(updateStyle(el, { borderWidthMm: Number(e.target.value) || 0 }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase">Border radius</Label>
          <Input
            type="number"
            step="0.1"
            className="h-8"
            value={el.style?.borderRadiusMm ?? 0}
            onChange={(e) =>
              onUpdateElement(updateStyle(el, { borderRadiusMm: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Shadow</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={el.style?.shadow ?? 'none'}
            onChange={(e) =>
              onUpdateElement(updateStyle(el, { shadow: e.target.value as IdCardShadow }))
            }
          >
            <option value="none">None</option>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
          </select>
        </div>
      </div>

      <div>
        <Label className="text-[10px] uppercase">Rotation (°)</Label>
        <Input
          type="number"
          step="1"
          className="h-8"
          value={el.style?.rotationDeg ?? 0}
          onChange={(e) =>
            onUpdateElement(updateStyle(el, { rotationDeg: Number(e.target.value) || 0 }))
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={el.style?.visible !== false}
            onChange={(e) => onUpdateElement(updateStyle(el, { visible: e.target.checked }))}
          />
          Visible
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={el.locked === true}
            onChange={(e) => onUpdateElement({ locked: e.target.checked })}
          />
          Lock
        </label>
      </div>
    </div>
  );
}
