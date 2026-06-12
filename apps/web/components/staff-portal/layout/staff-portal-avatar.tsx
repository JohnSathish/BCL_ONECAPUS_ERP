'use client';

import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

const SIZE = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

type Props = {
  photoUrl?: string | null;
  name: string;
  size?: keyof typeof SIZE;
  className?: string;
};

export function StaffPortalAvatar({ photoUrl, name, size = 'md', className }: Props) {
  const photoSrc = photoUrl ? resolveUploadAssetUrl(photoUrl) : null;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  if (photoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSrc}
        alt=""
        className={cn(
          'shrink-0 rounded-full border-2 border-border/60 object-cover shadow-sm',
          SIZE[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground',
        SIZE[size],
        className,
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
