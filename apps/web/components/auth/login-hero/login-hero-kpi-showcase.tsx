'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { KPI_GRID_METRICS, KPI_METRICS } from './login-hero.constants';
import { useAnimatedCounter } from './use-animated-counter';
import { useLoginHeroMotion } from './use-login-hero-motion';

const ROTATE_MS = 4000;

function KpiValue({ metric, animate }: { metric: (typeof KPI_METRICS)[number]; animate: boolean }) {
  const decimals = metric.decimals ?? 0;
  const isTextOnly = Boolean(metric.textOnly);
  const count = useAnimatedCounter(metric.value, animate && !isTextOnly, 900, decimals);

  if (isTextOnly) {
    return <p className="text-sm font-semibold text-white">{metric.label}</p>;
  }

  const formatted = decimals > 0 ? count.toFixed(decimals) : count.toLocaleString('en-IN');

  return (
    <>
      <p className="login-hero-kpi-value text-xl font-bold tabular-nums tracking-tight text-white sm:text-2xl">
        {metric.prefix}
        {formatted}
        {metric.suffix}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
        {metric.label}
      </p>
    </>
  );
}

function KpiCarousel() {
  const animate = useLoginHeroMotion();
  const [index, setIndex] = useState(0);
  const metric = KPI_METRICS[index]!;

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % KPI_METRICS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [animate]);

  const content = (
    <div className="flex items-end justify-between gap-4">
      <div>
        <KpiValue metric={metric} animate={animate} />
      </div>
      <div className="flex shrink-0 gap-1 pt-1">
        {KPI_METRICS.map((_, i) => (
          <span
            key={i}
            className={`h-0.5 w-4 rounded-full transition-colors ${
              i === index ? 'bg-cyan-400/70' : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={metric.label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

function KpiGrid() {
  const animate = useLoginHeroMotion();

  return (
    <ul className="login-hero-kpi-grid grid grid-cols-2 gap-2">
      {KPI_GRID_METRICS.map((metric) => (
        <li
          key={metric.label}
          className="login-hero-kpi-cell login-glass-compact rounded-lg px-3 py-2.5"
        >
          <KpiValue metric={metric} animate={animate} />
        </li>
      ))}
    </ul>
  );
}

export function LoginHeroKpiShowcase() {
  const animate = useLoginHeroMotion();

  if (animate) {
    return (
      <div className="login-hero-section">
        <div className="login-glass-compact rounded-xl px-4 py-3">
          <KpiCarousel />
        </div>
      </div>
    );
  }

  return (
    <div className="login-hero-section">
      <p className="login-hero-section-label mb-2.5">At a glance</p>
      <KpiGrid />
    </div>
  );
}
