'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadWebsiteDocument, uploadWebsiteMedia } from '@/services/website-cms';
import type { WebsitePopup, WebsitePopupButton, WebsitePopupImage } from '@/types/website-cms';
import { PopupPreviewOverlay } from './popup-preview-overlay';
import { normalizePopupImageJson } from './popup-utils';

export const POPUP_TYPE_OPTIONS = [
  { value: 'HTML', label: 'HTML / Rich text' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'BANNER', label: 'Banner strip' },
] as const;

export const SHOW_TRIGGER_OPTIONS = [
  { value: 'IMMEDIATE', label: 'Immediately' },
  { value: 'DELAY_5', label: 'After 5 seconds' },
  { value: 'DELAY_10', label: 'After 10 seconds' },
  { value: 'SCROLL_PERCENT', label: 'After scroll %' },
  { value: 'EXIT_INTENT', label: 'On exit intent' },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: 'EVERY_VISIT', label: 'Every visit' },
  { value: 'ONCE_PER_DAY', label: 'Once per day' },
  { value: 'ONCE_PER_WEEK', label: 'Once per week' },
  { value: 'ONCE_PER_BROWSER', label: 'Once per browser' },
  { value: 'NEVER_SHOW_AGAIN', label: 'Never show again (after close)' },
] as const;

export const CLOSE_BEHAVIOR_OPTIONS = [
  { value: 'X', label: 'X button' },
  { value: 'CLOSE_BUTTON', label: 'Close button' },
  { value: 'ESC', label: 'ESC key' },
  { value: 'CLICK_OUTSIDE', label: 'Click outside' },
  { value: 'AUTO_CLOSE_5', label: 'Auto close (5s)' },
  { value: 'AUTO_CLOSE_10', label: 'Auto close (10s)' },
  { value: 'AUTO_CLOSE_15', label: 'Auto close (15s)' },
  { value: 'AUTO_CLOSE_30', label: 'Auto close (30s)' },
] as const;

export const POSITION_OPTIONS = [
  { value: 'CENTER', label: 'Center' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'TOP_LEFT', label: 'Top left' },
  { value: 'TOP_RIGHT', label: 'Top right' },
  { value: 'BOTTOM_LEFT', label: 'Bottom left' },
  { value: 'BOTTOM_RIGHT', label: 'Bottom right' },
] as const;

export const ANIMATION_OPTIONS = [
  { value: 'FADE', label: 'Fade' },
  { value: 'SLIDE_UP', label: 'Slide up' },
  { value: 'SLIDE_DOWN', label: 'Slide down' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'NONE', label: 'None' },
] as const;

export type PopupEditorValue = {
  title: string;
  popupType: string;
  contentHtml: string;
  imageJson: WebsitePopupImage | null;
  videoUrl: string;
  videoType: string;
  buttonJson: WebsitePopupButton[];
  status: 'ACTIVE' | 'INACTIVE';
  displayOrder: number;
  showTrigger: string;
  showDelay: number;
  scrollPercent: number | null;
  frequency: string;
  closeBehavior: string[];
  position: string;
  animation: string;
  overlayJson: Record<string, unknown>;
  sizeJson: Record<string, unknown>;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export const emptyPopupEditorValue = (): PopupEditorValue => ({
  title: '',
  popupType: 'HTML',
  contentHtml: '',
  imageJson: null,
  videoUrl: '',
  videoType: 'YOUTUBE',
  buttonJson: [],
  status: 'INACTIVE',
  displayOrder: 0,
  showTrigger: 'IMMEDIATE',
  showDelay: 0,
  scrollPercent: 50,
  frequency: 'EVERY_VISIT',
  closeBehavior: ['X', 'ESC', 'CLICK_OUTSIDE'],
  position: 'CENTER',
  animation: 'FADE',
  overlayJson: { enabled: true, opacity: 0.65, color: '#061f3d' },
  sizeJson: { maxWidth: 760, padding: 16 },
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
});

export function popupToEditorValue(row?: WebsitePopup | null): PopupEditorValue {
  if (!row) return emptyPopupEditorValue();
  return {
    title: row.title,
    popupType: row.popupType,
    contentHtml: row.contentHtml || '',
    imageJson: normalizePopupImageJson(row.imageJson),
    videoUrl: row.videoUrl || '',
    videoType: row.videoType || 'YOUTUBE',
    buttonJson: Array.isArray(row.buttonJson) ? row.buttonJson : [],
    status: row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    displayOrder: row.displayOrder ?? 0,
    showTrigger: row.showTrigger || 'IMMEDIATE',
    showDelay: row.showDelay ?? 0,
    scrollPercent: row.scrollPercent ?? 50,
    frequency: row.frequency || 'EVERY_VISIT',
    closeBehavior: Array.isArray(row.closeBehavior) ? row.closeBehavior : ['X', 'ESC'],
    position: row.position || 'CENTER',
    animation: row.animation || 'FADE',
    overlayJson: row.overlayJson || { enabled: true, opacity: 0.65 },
    sizeJson: row.sizeJson || { maxWidth: 560 },
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    startTime: row.startTime || '',
    endTime: row.endTime || '',
  };
}

type Props = {
  value: PopupEditorValue;
  onChange: (value: PopupEditorValue) => void;
  onCancel: () => void;
  onSave: () => void;
  onPreview: () => void;
  saving?: boolean;
  previewPopup?: WebsitePopup | null;
  onClosePreview?: () => void;
};

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PopupEditor({
  value,
  onChange,
  onCancel,
  onSave,
  onPreview,
  saving,
  previewPopup,
  onClosePreview,
}: Props) {
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const patch = (partial: Partial<PopupEditorValue>) => onChange({ ...value, ...partial });

  const previewModel = useMemo(() => {
    if (!previewPopup) return null;
    return previewPopup;
  }, [previewPopup]);

  const uploadImage = async (file: File) => {
    setUploading('image');
    try {
      const asset = await uploadWebsiteMedia(file, file.name.replace(/\.[^.]+$/, ''));
      patch({
        imageJson: {
          url: asset.publicUrl,
          alt: asset.altText || file.name.replace(/\.[^.]+$/, ''),
        },
      });
    } finally {
      setUploading(null);
    }
  };

  const uploadVideo = async (file: File) => {
    setUploading('video');
    try {
      const asset = await uploadWebsiteDocument(file, file.name);
      patch({ videoUrl: asset.publicUrl, videoType: 'MP4' });
    } finally {
      setUploading(null);
    }
  };

  const updateButton = (index: number, partial: Partial<WebsitePopupButton>) => {
    const next = [...value.buttonJson];
    next[index] = { ...next[index], ...partial };
    patch({ buttonJson: next });
  };

  const toggleCloseBehavior = (behavior: string) => {
    const set = new Set(value.closeBehavior);
    if (set.has(behavior)) set.delete(behavior);
    else set.add(behavior);
    patch({ closeBehavior: [...set] });
  };

  return (
    <>
      <CompactCard>
        <CompactCardHeader
          title={value.title ? `Edit: ${value.title}` : 'New popup'}
          description="Configure content, schedule, and display rules for the home page."
        />
        <CompactCardBody className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Title</span>
              <Input value={value.title} onChange={(e) => patch({ title: e.target.value })} />
            </label>
            <SelectField
              label="Popup type"
              value={value.popupType}
              onChange={(popupType) => patch({ popupType })}
              options={POPUP_TYPE_OPTIONS}
            />
            <SelectField
              label="Status"
              value={value.status}
              onChange={(status) => patch({ status: status as 'ACTIVE' | 'INACTIVE' })}
              options={[
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'ACTIVE', label: 'Active' },
              ]}
            />
          </div>

          {(value.popupType === 'HTML' ||
            value.popupType === 'ANNOUNCEMENT' ||
            value.popupType === 'BANNER') && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Content</span>
              <RichTextEditor
                value={value.contentHtml}
                onChange={(contentHtml) => patch({ contentHtml })}
                onUploadImage={async (file) => {
                  const asset = await uploadWebsiteMedia(file, file.name.replace(/\.[^.]+$/, ''));
                  return asset.publicUrl;
                }}
              />
            </div>
          )}

          {value.popupType === 'IMAGE' && (
            <div className="grid gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
                {uploading === 'image' ? (
                  <span className="text-xs text-muted-foreground">Uploading…</span>
                ) : null}
              </div>
              <Input
                placeholder="Image URL"
                value={value.imageJson?.url || ''}
                onChange={(e) =>
                  patch({
                    imageJson: {
                      ...(value.imageJson || { url: '', alt: '' }),
                      url: e.target.value,
                    },
                  })
                }
              />
              <Input
                placeholder="Alt text"
                value={value.imageJson?.alt || ''}
                onChange={(e) =>
                  patch({
                    imageJson: {
                      ...(value.imageJson || { url: '' }),
                      alt: e.target.value,
                    },
                  })
                }
              />
              <Input
                placeholder="Caption (optional)"
                value={value.imageJson?.caption || ''}
                onChange={(e) =>
                  patch({
                    imageJson: {
                      ...(value.imageJson || { url: '' }),
                      caption: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}

          {value.popupType === 'VIDEO' && (
            <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2">
              <SelectField
                label="Video source"
                value={value.videoType}
                onChange={(videoType) => patch({ videoType })}
                options={[
                  { value: 'YOUTUBE', label: 'YouTube URL' },
                  { value: 'VIMEO', label: 'Vimeo URL' },
                  { value: 'MP4', label: 'MP4 upload' },
                ]}
              />
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="font-medium">Video URL</span>
                <Input
                  value={value.videoUrl}
                  onChange={(e) => patch({ videoUrl: e.target.value })}
                  placeholder={
                    value.videoType === 'MP4' ? 'Upload MP4 below or paste hosted URL' : 'https://…'
                  }
                />
              </label>
              {value.videoType === 'MP4' ? (
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-medium">Upload MP4</span>
                  <Input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadVideo(file);
                    }}
                  />
                  {uploading === 'video' ? (
                    <span className="text-xs text-muted-foreground">Uploading…</span>
                  ) : null}
                </label>
              ) : null}
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Buttons</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    buttonJson: [
                      ...value.buttonJson,
                      { label: 'Learn more', href: '/', variant: 'primary' },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add button
              </Button>
            </div>
            {value.buttonJson.map((button, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-4"
              >
                <Input
                  placeholder="Label"
                  value={button.label}
                  onChange={(e) => updateButton(index, { label: e.target.value })}
                />
                <Input
                  placeholder="Link URL"
                  value={button.href}
                  onChange={(e) => updateButton(index, { href: e.target.value })}
                  className="md:col-span-2"
                />
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={button.variant || 'primary'}
                    onChange={(e) =>
                      updateButton(index, {
                        variant: e.target.value as WebsitePopupButton['variant'],
                      })
                    }
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      patch({ buttonJson: value.buttonJson.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Show trigger"
              value={value.showTrigger}
              onChange={(showTrigger) => patch({ showTrigger })}
              options={SHOW_TRIGGER_OPTIONS}
            />
            <SelectField
              label="Frequency"
              value={value.frequency}
              onChange={(frequency) => patch({ frequency })}
              options={FREQUENCY_OPTIONS}
            />
            {value.showTrigger === 'SCROLL_PERCENT' ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Scroll %</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={value.scrollPercent ?? 50}
                  onChange={(e) => patch({ scrollPercent: Number(e.target.value) || 0 })}
                />
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Custom delay (seconds)</span>
              <Input
                type="number"
                min={0}
                value={value.showDelay}
                onChange={(e) => patch({ showDelay: Number(e.target.value) || 0 })}
              />
            </label>
            <SelectField
              label="Position"
              value={value.position}
              onChange={(position) => patch({ position })}
              options={POSITION_OPTIONS}
            />
            <SelectField
              label="Animation"
              value={value.animation}
              onChange={(animation) => patch({ animation })}
              options={ANIMATION_OPTIONS}
            />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Display order</span>
              <Input
                type="number"
                value={value.displayOrder}
                onChange={(e) => patch({ displayOrder: Number(e.target.value) || 0 })}
              />
            </label>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Close behavior</span>
            <div className="flex flex-wrap gap-2">
              {CLOSE_BEHAVIOR_OPTIONS.map((option) => {
                const active = value.closeBehavior.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                    onClick={() => toggleCloseBehavior(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Start date</span>
              <Input
                type="date"
                value={value.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">End date</span>
              <Input
                type="date"
                value={value.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Start time (HH:mm)</span>
              <Input
                placeholder="09:00"
                value={value.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">End time (HH:mm)</span>
              <Input
                placeholder="18:00"
                value={value.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save popup'}
            </Button>
            <Button type="button" variant="outline" onClick={onPreview}>
              Preview
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CompactCardBody>
      </CompactCard>

      {previewModel && onClosePreview ? (
        <PopupPreviewOverlay popup={previewModel} onClose={onClosePreview} forceShow />
      ) : null}
    </>
  );
}
