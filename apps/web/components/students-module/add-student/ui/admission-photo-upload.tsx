'use client';

import { ImagePlus, Loader2 } from 'lucide-react';
import { useState } from 'react';

import {
  readImageFileAsDraftPhoto,
  revokePhotoPreviewUrl,
} from '@/components/students-module/add-student/utils/photo-utils';
import { cn } from '@/utils/cn';

type Props = {
  photoPreviewUrl: string;
  onPhotoChange: (dataUrl: string) => void;
  disabled?: boolean;
};

export function AdmissionPhotoUpload({ photoPreviewUrl, onPhotoChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await readImageFileAsDraftPhoto(file);
      onPhotoChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the selected photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[150px] shrink-0 flex-col items-center gap-2 self-stretch lg:w-[148px]">
      <label
        className={cn(
          'group relative flex min-h-[150px] w-[148px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 text-center transition-all',
          'hover:border-primary/50 hover:bg-primary/5',
          (disabled || busy) && 'pointer-events-none opacity-70',
          dragOver && 'border-primary bg-primary/10',
          photoPreviewUrl && 'border-solid border-border/50 bg-background',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {photoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreviewUrl}
            alt="Student photo preview"
            className="h-full w-full object-cover"
          />
        ) : busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <ImagePlus className="mb-2 h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="text-xs font-semibold text-foreground">Upload Photo</span>
            <span className="mt-0.5 px-3 text-[10px] leading-snug text-muted-foreground">
              Drag & drop or click
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground">PNG / JPG</span>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {photoPreviewUrl ? (
        <button
          type="button"
          className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => {
            revokePhotoPreviewUrl(photoPreviewUrl);
            onPhotoChange('');
          }}
        >
          Remove photo
        </button>
      ) : null}
      {error ? (
        <p className="max-w-[148px] text-center text-[10px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
