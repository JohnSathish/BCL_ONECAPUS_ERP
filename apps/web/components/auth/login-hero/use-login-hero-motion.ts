'use client';

import { useReducedMotion } from 'framer-motion';
import { LOGIN_HERO_ANIMATIONS_ENABLED } from './login-hero.constants';

export function useLoginHeroMotion() {
  const prefersReduced = useReducedMotion();
  return LOGIN_HERO_ANIMATIONS_ENABLED && !prefersReduced;
}
