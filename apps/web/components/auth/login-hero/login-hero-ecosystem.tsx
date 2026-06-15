'use client';

import { motion } from 'framer-motion';
import { EcosystemOrbit } from '@/components/landing/ecosystem-orbit';
import { ORBIT_MODULES } from '@/components/landing/landing.constants';
import { TRUST_PILLS } from '@/components/landing/landing.constants';
import { useLoginHeroMotion } from './use-login-hero-motion';
import { useState } from 'react';

export function LoginHeroEcosystem() {
  const animate = useLoginHeroMotion();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const displayIndex = hoveredIndex ?? spotlightIndex;
  const displayModule = ORBIT_MODULES[displayIndex] ?? null;

  return (
    <div className="login-hero-section flex w-full shrink-0 flex-col items-center">
      <motion.div
        initial={animate ? { opacity: 0, scale: 0.9 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[380px]"
      >
        <EcosystemOrbit
          size="login"
          motionEnabled={animate}
          onModuleHover={setHoveredIndex}
          onSpotlightChange={setSpotlightIndex}
        />

        <motion.div
          className="mt-3 min-h-[52px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm"
          initial={false}
          animate={{ opacity: displayModule ? 1 : 0.7 }}
        >
          {displayModule ? (
            <motion.div
              key={displayModule.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-xs font-semibold text-white">
                <span className="mr-1">{displayModule.emoji}</span>
                {displayModule.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/55">
                {displayModule.description}
              </p>
            </motion.div>
          ) : (
            <p className="text-center text-[11px] text-white/45">
              Explore the OneCampus ERP ecosystem
            </p>
          )}
        </motion.div>
      </motion.div>

      <motion.ul
        className="mt-4 flex flex-wrap items-center justify-center gap-2"
        initial={animate ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        {TRUST_PILLS.map(({ icon: Icon, label }) => (
          <li key={label}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/75 backdrop-blur-sm">
              <Icon className="h-3 w-3 text-cyan-300/80" aria-hidden />
              {label}
            </span>
          </li>
        ))}
      </motion.ul>
    </div>
  );
}
