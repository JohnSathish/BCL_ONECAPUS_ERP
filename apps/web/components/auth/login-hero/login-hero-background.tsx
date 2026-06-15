'use client';

import { motion } from 'framer-motion';
import { useLoginHeroMotion } from './use-login-hero-motion';

const STAR_COUNT = 18;

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
        <div className="login-hero-particles login-hero-particles-float absolute inset-0 opacity-60" />
      ) : null}
      {animate
        ? Array.from({ length: STAR_COUNT }, (_, i) => (
            <span
              key={i}
              className="login-hero-star"
              style={{
                left: `${6 + ((i * 19) % 88)}%`,
                top: `${8 + ((i * 27) % 84)}%`,
                animationDelay: `${(i % 6) * -1.2}s`,
                animationDuration: `${2.5 + (i % 4) * 0.8}s`,
              }}
            />
          ))
        : null}
      {animate
        ? Array.from({ length: 6 }, (_, i) => (
            <span
              key={`dot-${i}`}
              className="login-hero-ai-dot"
              style={{
                left: `${10 + ((i * 23) % 80)}%`,
                top: `${12 + ((i * 31) % 76)}%`,
                animationDelay: `${(i % 4) * -1.5}s`,
              }}
            />
          ))
        : null}
    </div>
  );
}
