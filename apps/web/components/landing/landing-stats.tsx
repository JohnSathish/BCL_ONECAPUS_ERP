'use client';

import { motion } from 'framer-motion';
import { useAnimatedCounter } from './hooks/use-animated-counter';
import { useScrollReveal } from './hooks/use-scroll-reveal';
import { STAT_COUNTERS } from './landing.constants';

function StatItem({
  value,
  suffix,
  label,
  decimals,
  animate,
}: {
  value: number;
  suffix: string;
  label: string;
  decimals: number;
  animate: boolean;
}) {
  const count = useAnimatedCounter(value, animate, 1400, decimals);
  const formatted = decimals > 0 ? count.toFixed(decimals) : count.toLocaleString('en-IN');

  return (
    <div className="text-center">
      <p className="text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
        {formatted}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/50">{label}</p>
    </div>
  );
}

export function LandingStats() {
  const { ref, inView } = useScrollReveal({ threshold: 0.3 });

  return (
    <section ref={ref} className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="landing-stats-panel grid grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10 backdrop-blur-md sm:grid-cols-4 sm:gap-6 sm:px-10"
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {STAT_COUNTERS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
            >
              <StatItem {...stat} animate={inView} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
