'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/utils/cn';

type Props = {
  height: number;
  className?: string;
  children: ReactElement;
};

/**
 * Defers Recharts render until the parent has a measurable width/height.
 * Prevents "width(-1) and height(-1)" console warnings from ResponsiveContainer.
 */
export function ChartContainer({ height, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setReady(el.clientWidth > 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [height]);

  return (
    <div
      ref={ref}
      className={cn('w-full min-w-0', className)}
      style={{ height }}
      aria-hidden={!ready}
    >
      {ready ? (
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
