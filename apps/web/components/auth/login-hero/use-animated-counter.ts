'use client';

import { useEffect, useState } from 'react';

export function useAnimatedCounter(
  target: number,
  enabled: boolean,
  durationMs = 1200,
  decimals = 0,
) {
  const [display, setDisplay] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);

  const factor = 10 ** decimals;
  const rounded = decimals > 0 ? Math.round(display * factor) / factor : Math.round(display);

  return rounded;
}
