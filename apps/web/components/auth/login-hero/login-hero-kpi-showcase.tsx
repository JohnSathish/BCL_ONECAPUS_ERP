'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { KPI_METRICS } from './login-hero.constants';
import { useAnimatedCounter } from './use-animated-counter';
import { useLoginHeroMotion } from './use-login-hero-motion';
import { useScrollReveal } from '@/components/landing/hooks/use-scroll-reveal';

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

export function LoginHeroKpiShowcase() {
  const animate = useLoginHeroMotion();
  const { ref, inView } = useScrollReveal({ threshold: 0.2, once: true });
  const [index, setIndex] = useState(0);
  const metric = KPI_METRICS[index]!;

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % KPI_METRICS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [animate]);

  if (!animate) {
    return (
      <div className="login-hero-section">
        <p className="login-hero-section-label mb-2.5">At a glance</p>
        <ul className="login-hero-kpi-grid grid grid-cols-2 gap-2">
          {KPI_METRICS.filter((m) => !m.textOnly)
            .slice(0, 4)
            .map((m) => (
              <li
                key={m.label}
                className="login-hero-kpi-cell login-glass-compact rounded-lg px-3 py-2.5"
              >
                <KpiValue metric={m} animate={false} />
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div ref={ref} className="login-hero-section w-full">
      <motion.div
        className="login-glass-compact rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md"
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="login-hero-section-label mb-2">At a glance</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.35 }}
            className="flex items-end justify-between gap-4"
          >
            <KpiValue metric={metric} animate={inView} />
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
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
