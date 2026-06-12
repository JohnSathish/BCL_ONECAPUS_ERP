'use client';

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';

type Props = {
  photoPath?: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  pending?: boolean;
};

function photoVersionKey(path?: string | null): string | undefined {
  if (!path) return undefined;
  const stamped = path.match(/photo-(\d+)\./);
  if (stamped?.[1]) return stamped[1];
  return path;
}

export function StudentPhotoUpload({ photoPath, disabled, onSelect, pending }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseUrl = photoPath?.startsWith('blob:') ? photoPath : resolveUploadAssetUrl(photoPath);
  const resolvedPhoto =
    baseUrl && photoPath && !photoPath.startsWith('blob:')
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${photoVersionKey(photoPath)}`
      : baseUrl;

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {resolvedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvedPhoto} alt="Student" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">No photo</span>
        )}
      </div>
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
          {pending ? 'Uploading…' : 'Upload photo'}
        </Button>
      </div>
    </div>
  );
}
