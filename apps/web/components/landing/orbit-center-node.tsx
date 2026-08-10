'use client';

import { motion } from 'framer-motion';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import { useLandingMotion } from './hooks/use-landing-motion';

type Props = {
  variant?: 'login' | 'default';
  animate?: boolean;
  staticCenter?: boolean;
  productName?: string;
  productTagline?: string;
};

const GLOW_SEQUENCE_DEFAULT = [
  '0 0 12px rgba(99,102,241,0.35), 0 0 28px rgba(129,140,248,0.2)',
  '0 0 28px rgba(99,102,241,0.75), 0 0 48px rgba(168,85,247,0.45)',
  '0 0 12px rgba(99,102,241,0.35), 0 0 28px rgba(129,140,248,0.2)',
];

const GLOW_SEQUENCE_LOGIN = [
  '0 0 14px rgba(43,79,163,0.45), 0 0 32px rgba(23,59,115,0.3)',
  '0 0 28px rgba(43,79,163,0.75), 0 0 52px rgba(23,59,115,0.45)',
  '0 0 14px rgba(43,79,163,0.45), 0 0 32px rgba(23,59,115,0.3)',
];

export function OrbitCenterNode({
  variant = 'default',
  animate: motionEnabled,
  staticCenter = false,
  productName = 'Bosco Connect',
  productTagline = 'Smart Education Management Platform',
}: Props) {
  const landingMotion = useLandingMotion();
  const animate = motionEnabled ?? landingMotion;
  const isLogin = variant === 'login';
  const glowSequence = isLogin ? GLOW_SEQUENCE_LOGIN : GLOW_SEQUENCE_DEFAULT;

  return (
    <motion.div
      className={`orbit-core landing-core-glow relative flex flex-col items-center justify-center rounded-full border border-white/30 text-center backdrop-blur-md ${
        isLogin
          ? 'h-36 w-36 bg-gradient-to-br from-[#173B73]/90 via-[#2B4FA3]/85 to-[#0B1F3A]/95 px-3'
          : 'h-28 w-28 bg-gradient-to-br from-indigo-500/45 via-violet-600/55 to-purple-700/65 sm:h-32 sm:w-32'
      }`}
      animate={
        animate
          ? staticCenter
            ? {
                boxShadow: glowSequence,
              }
            : {
                y: [-6, 6, -6],
                scale: [1, 1.03, 1],
                boxShadow: glowSequence,
              }
          : undefined
      }
      transition={
        animate
          ? staticCenter
            ? {
                boxShadow: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }
            : {
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
                boxShadow: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }
          : undefined
      }
      style={{ willChange: 'transform' }}
    >
      <div
        className={`mb-1 flex items-center justify-center rounded-xl bg-white/15 shadow-inner ${
          isLogin ? 'h-11 w-11' : 'h-10 w-10 sm:h-12 sm:w-12'
        }`}
      >
        <BrandingLogoImage
          src={DEFAULT_LOGIN_LOGO}
          className={isLogin ? 'h-8 w-8' : 'h-8 w-8 sm:h-9 sm:w-9'}
          priority
        />
      </div>

      {isLogin ? (
        <>
          <p className="mt-0.5 text-[12px] font-bold leading-tight text-white">{productName}</p>
          <p className="mt-1 max-w-[7.75rem] text-[8px] font-medium leading-snug text-blue-100/80">
            {productTagline}
          </p>
        </>
      ) : (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:text-[11px]">
            OneCampus
          </p>
          <p className="text-[9px] font-semibold tracking-wide text-cyan-200/90 sm:text-[10px]">
            ERP
          </p>
        </>
      )}
    </motion.div>
  );
}
