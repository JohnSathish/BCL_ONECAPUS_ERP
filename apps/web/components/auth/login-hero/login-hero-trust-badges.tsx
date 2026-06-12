'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { TRUST_BADGES, TRUST_BADGES_VISIBLE } from './login-hero.constants';
import { useLoginHeroMotion } from './use-login-hero-motion';

const ROTATE_MS = 4500;

export function LoginHeroTrustBadges() {
  const animate = useLoginHeroMotion();
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(TRUST_BADGES.length / TRUST_BADGES_VISIBLE);

  const visible = useMemo(() => {
    if (!animate) return TRUST_BADGES;
    const start = page * TRUST_BADGES_VISIBLE;
    return TRUST_BADGES.slice(start, start + TRUST_BADGES_VISIBLE);
  }, [animate, page]);

  useEffect(() => {
    if (!animate || pageCount <= 1) return;
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % pageCount);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [animate, pageCount]);

  const badges = (
    <ul className="login-hero-badge-grid grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visible.map(({ icon: Icon, label }) => (
        <li key={label}>
          <span className="login-hero-badge-tile login-pill flex h-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-snug text-white/88">
            <span className="login-hero-badge-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-400/10">
              <Icon className="h-3.5 w-3.5 text-cyan-200/90" aria-hidden />
            </span>
            <span className="min-w-0">{label}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="login-hero-section" aria-live={animate ? 'polite' : 'off'}>
      {!animate ? <p className="login-hero-section-label mb-2.5">Platform capabilities</p> : null}
      {animate ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {badges}
          </motion.div>
        </AnimatePresence>
      ) : (
        badges
      )}
    </div>
  );
}
