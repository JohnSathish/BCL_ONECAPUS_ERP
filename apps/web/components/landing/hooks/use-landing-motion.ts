'use client';

import { useReducedMotion } from 'framer-motion';

export function useLandingMotion() {
  const prefersReduced = useReducedMotion();
  return !prefersReduced;
}
