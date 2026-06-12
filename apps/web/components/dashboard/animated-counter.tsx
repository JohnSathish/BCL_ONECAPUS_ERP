'use client';

import { useEffect, useState } from 'react';

export function AnimatedCounter({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    const from = display;
    const diff = value - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + diff * eased);
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from current display
  }, [value]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span>
      {formatted}
      {suffix}
    </span>
  );
}
