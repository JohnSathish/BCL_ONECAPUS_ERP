'use client';

import Image from 'next/image';
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
 */
export function BrandingLogoImage({
  src,
  alt = '',
  size,
  className,
  priority,
  unoptimized,
}: Props) {
  const shouldUnoptimize = unoptimized ?? (src.startsWith('http') || src.startsWith('/uploads'));

  return (
    <div
      className={cn('relative shrink-0', !size && 'h-full w-full', className)}
      style={size ? { width: size, height: size } : undefined}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={size ? `${size}px` : '96px'}
        className="object-contain"
        unoptimized={shouldUnoptimize}
        priority={priority}
      />
    </div>
  );
}
