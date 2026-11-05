'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { resolveUploadAvatarUrl } from '@/lib/branding-asset';

type Props = {
  photoPath?: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  pending?: boolean;
  buttonLabel?: string;
  size?: 'md' | 'lg';
  hideButton?: boolean;
};

export function StudentPhotoUpload({
  photoPath,
  disabled,
  onSelect,
  pending,
  buttonLabel = 'Upload photo',
  size = 'md',
  hideButton = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedPhoto = photoPath?.startsWith('blob:')
    ? photoPath
    : resolveUploadAvatarUrl(photoPath);

  return (
    <div className="flex items-center gap-3">
      <div
        className={
          size === 'lg'
            ? 'flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm'
            : 'flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted'
        }
      >
        {resolvedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvedPhoto} alt="Student" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">No photo</span>
        )}
      </div>
      {hideButton ? null : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled || pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelect(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? 'Uploading…' : buttonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
