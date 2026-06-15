'use client';

import { motion } from 'framer-motion';
import { EcosystemOrbit } from './ecosystem-orbit';
import { ParticleCanvas } from './particle-canvas';
import { useScrollReveal } from './hooks/use-scroll-reveal';

export function LandingEcosystem() {
  const { ref, inView } = useScrollReveal({ threshold: 0.15 });

  return (
    <section
      id="platform"
      ref={ref}
      className="landing-ecosystem relative overflow-hidden py-20 sm:py-28"
    >
      <ParticleCanvas className="opacity-40" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">
              Center Animation
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              ERP ecosystem visualization
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Modules orbit the OneCampus ERP core with animated connection lines — nodes glow on
              hover, cards float gently, and the entire system breathes like a living campus
              network.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-white/70">
              {[
                'Nodes glow on mouse hover',
                'Connection lines animate in real time',
                'Module cards float with GPU transforms',
                '60fps orbit driven by Framer Motion',
              ].map((item, i) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="scale-[0.82] sm:scale-95 lg:scale-100">
              <EcosystemOrbit size="section" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
