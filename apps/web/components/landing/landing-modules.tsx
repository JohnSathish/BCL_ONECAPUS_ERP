'use client';

import { motion } from 'framer-motion';
import { FloatingModuleCard } from './floating-module-card';
import { ORBIT_MODULES } from './landing.constants';
import { useScrollReveal } from './hooks/use-scroll-reveal';
import { useLandingMotion } from './hooks/use-landing-motion';

export function LandingModules() {
  const { ref, inView } = useScrollReveal({ threshold: 0.12 });
  const animate = useLandingMotion();

  return (
    <section id="modules" ref={ref} className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
            Integrated Modules
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Every campus function, connected
          </h2>
          <p className="mt-4 text-base text-white/60">
            Floating module cards reveal the depth of OneCampus — hover to highlight live
            connections across your institution.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ORBIT_MODULES.map((mod, i) => (
            <motion.div
              key={mod.id}
              className="landing-module-panel group relative overflow-hidden rounded-2xl border border-white/10 p-5"
              initial={{ opacity: 0, y: 36 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              whileHover={animate ? { y: -6, scale: 1.02 } : undefined}
              style={{ willChange: 'transform' }}
            >
              <div
                className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${mod.color} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`}
              />
              <FloatingModuleCard module={mod} size="sm" />
              <p className="mt-4 text-sm leading-relaxed text-white/55">{mod.description}</p>
              <motion.div
                className="mt-4 h-0.5 w-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 group-hover:w-full"
                transition={{ duration: 0.4 }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
