'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { EcosystemOrbit } from '@/components/landing/ecosystem-orbit';
import { ORBIT_MODULES, TRUST_PILLS } from '@/components/landing/landing.constants';
import { resolveProductName, resolveProductTagline } from '@/lib/branding-defaults';
import type { LoginContext } from '@/types/login-context';
import { useLoginHeroMotion } from './use-login-hero-motion';

type Props = {
  context?: LoginContext | null;
};

export function LoginHeroEcosystem({ context = null }: Props) {
  const animate = useLoginHeroMotion();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const displayIndex = hoveredIndex ?? spotlightIndex;
  const displayModule = ORBIT_MODULES[displayIndex] ?? null;
  const productName = resolveProductName(context?.productName);
  const productTagline = resolveProductTagline(context?.productTagline);

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
          productName={productName}
          productTagline={productTagline}
        />

        <motion.div
          className="mt-3 min-h-[52px] rounded-xl border border-white/20 bg-white/[0.08] px-3 py-2.5 backdrop-blur-sm"
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
              <p className="mt-0.5 text-[11px] leading-snug text-white/70">
                {displayModule.description}
              </p>
            </motion.div>
          ) : (
            <p className="text-center text-[11px] text-white/60">
              Explore the {productName} ecosystem
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur-sm">
              <Icon className="h-3 w-3 text-blue-200/90" aria-hidden />
              {label}
            </span>
          </li>
        ))}
      </motion.ul>
    </div>
  );
}
