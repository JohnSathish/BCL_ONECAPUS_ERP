'use client';

import type { ReactNode } from 'react';

/** Fixed square stage — aspect-ratio keeps orbit circular at any width. */
export function OrbitStage({
  maxSize,
  children,
  className = '',
}: {
  maxSize: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`orbit-stage relative mx-auto aspect-square w-full ${className}`}
      style={{ maxWidth: maxSize, height: 'auto' }}
    >
      <div className="orbit-container">{children}</div>
    </div>
  );
}
