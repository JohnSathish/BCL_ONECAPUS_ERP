'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

type Props = {
  src: string;
  alt?: string;
  /** Size of the square container (px). Prefer `className` when responsive sizing is needed. */
  size?: number;
  className?: string;
  priority?: boolean;
  unoptimized?: boolean;
};

/**
 * Logo/favicon wrapper that avoids Next.js aspect-ratio warnings when CSS resizes the image.
 * Uses fill + object-contain inside a sized relative container.
 * Falls back to the default BCL logo if the tenant asset 404s.
 */
export function BrandingLogoImage({
  src,
  alt = '',
  size,
  className,
  priority,
  unoptimized,
}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const effectiveSrc = failedSrc === src && src !== DEFAULT_LOGIN_LOGO ? DEFAULT_LOGIN_LOGO : src;
  const shouldUnoptimize =
    unoptimized ?? (effectiveSrc.startsWith('http') || effectiveSrc.startsWith('/uploads'));
  const shouldPriority = priority ?? effectiveSrc === DEFAULT_LOGIN_LOGO;

  return (
    <div
      className={cn('relative shrink-0', !size && 'h-full w-full', className)}
      style={size ? { width: size, height: size } : undefined}
    >
      <Image
        src={effectiveSrc}
        alt={alt}
        fill
        sizes={size ? `${size}px` : '96px'}
        className="object-contain"
        unoptimized={shouldUnoptimize}
        priority={shouldPriority}
        onError={() => {
          if (effectiveSrc !== DEFAULT_LOGIN_LOGO) setFailedSrc(src);
        }}
      />
    </div>
  );
}
