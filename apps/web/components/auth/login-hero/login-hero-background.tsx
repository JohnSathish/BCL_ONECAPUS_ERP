'use client';

import { motion } from 'framer-motion';
import { useLoginHeroMotion } from './use-login-hero-motion';

export function LoginHeroBackground() {
  const animate = useLoginHeroMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="login-hero-mesh absolute inset-0" />
      <motion.div
        className="login-hero-gradient-wave absolute inset-0"
        animate={
          animate
            ? {
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }
            : undefined
        }
        transition={animate ? { duration: 14, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <div
        className={`login-hero-grid absolute inset-0 ${animate ? 'login-hero-grid-animate' : ''}`}
      />
      <div
        className={`login-hero-orb login-hero-orb-1 ${animate ? '' : 'login-hero-orb-static'}`}
      />
      <div
        className={`login-hero-orb login-hero-orb-2 ${animate ? '' : 'login-hero-orb-static'}`}
      />
      {animate ? (
        <div className="login-hero-particles login-hero-particles-float absolute inset-0 opacity-40" />
      ) : null}
    </div>
  );
}
