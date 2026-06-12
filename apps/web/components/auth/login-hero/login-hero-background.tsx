'use client';

import { useLoginHeroMotion } from './use-login-hero-motion';

const PARTICLE_COUNT = 8;

export function LoginHeroBackground() {
  const animate = useLoginHeroMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="login-hero-mesh absolute inset-0" />
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
        ? Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <span
              key={i}
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
