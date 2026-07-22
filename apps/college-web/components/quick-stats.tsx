'use client';

import { useEffect, useRef, useState } from 'react';

type Stat = { value: number; suffix?: string; label: string };

type Props = {
  stats: Stat[];
};

function useInViewOnce() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function Counter({ value, suffix = '', label, active }: Stat & { active: boolean }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCurrent(Math.floor(progress * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);

  return (
    <div className="quick-stat">
      <strong>
        {current.toLocaleString('en-IN')}
        {suffix}
      </strong>
      <span>{label}</span>
    </div>
  );
}

export function QuickStats({ stats }: Props) {
  const { ref, visible } = useInViewOnce();
  return (
    <section className="quick-stats" aria-label="Institution highlights">
      <div className="shell quick-stats-grid" ref={ref}>
        {stats.map((stat) => (
          <Counter key={stat.label} {...stat} active={visible} />
        ))}
      </div>
    </section>
  );
}
