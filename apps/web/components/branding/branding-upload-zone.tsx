'use client';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon';

type Props = {
  label: string;
  hint?: string;
  previewUrl?: string;
  disabled?: boolean;
  isUploading?: boolean;
  recommendedSize?: string;
  onUpload?: (file: File) => void;
  onClearPreview?: () => void;
  compact?: boolean;
  comingSoon?: boolean;
};

export function BrandingUploadZone({
  label,
  hint,
  previewUrl,
  disabled,
  isUploading,
  recommendedSize,
  onUpload,
  onClearPreview,
  compact,
  comingSoon,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && onUpload) onUpload(file);
    },
    [onUpload],
  );

  if (comingSoon) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 opacity-60">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">Coming in Phase 2</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload ${label}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
          compact ? 'min-h-[140px] p-4' : 'min-h-[180px] p-6',
          dragOver && 'border-primary bg-primary/5',
          !dragOver && 'border-border/70 bg-muted/15 hover:border-primary/40 hover:bg-muted/25',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || isUploading}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : previewUrl ? (
          <div className={cn('relative', compact ? 'h-16 w-16' : 'h-24 w-24')}>
            <Image
              src={previewUrl}
              alt={`${label} preview`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drag & drop or click to upload</p>
          </>
        )}

        <p className="mt-2 text-center text-xs text-muted-foreground">
          PNG, JPG, SVG, WEBP — max 2MB
          {recommendedSize ? ` · ${recommendedSize}` : ''}
        </p>
      </div>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {previewUrl && !isUploading ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Replace
          </Button>
          {onClearPreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onClearPreview();
              }}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Remove preview
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BrandingBrowserTabMock({
  faviconUrl,
  title,
}: {
  faviconUrl?: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Browser tab preview</p>
      <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 shadow-sm">
        {faviconUrl ? (
          <BrandingLogoImage src={faviconUrl} size={16} className="shrink-0" />
        ) : (
          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-xs text-foreground">
          {title || 'Institution Portal'} — BCL OneCampus ERP
        </span>
      </div>
    </div>
  );
}
