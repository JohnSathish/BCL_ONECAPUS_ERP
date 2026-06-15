'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LandingModule } from './landing.constants';
import { useLandingMotion } from './hooks/use-landing-motion';

type Props = {
  module: LandingModule;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  spotlightActive?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  inOrbit?: boolean;
  iconOnly?: boolean;
  premium?: boolean;
};

const SIZE_MAP = {
  sm: { box: 'h-10 w-10', icon: 'h-4 w-4', text: 'text-[10px]' },
  md: { box: 'h-12 w-12', icon: 'h-5 w-5', text: 'text-xs' },
  lg: { box: 'h-14 w-14', icon: 'h-6 w-6', text: 'text-sm' },
} as const;

export function FloatingModuleCard({
  module,
  size = 'md',
  active = false,
  spotlightActive = false,
  onHover,
  onLeave,
  inOrbit = false,
  iconOnly = false,
  premium = false,
}: Props) {
  const animate = useLandingMotion();
  const Icon = module.icon;
  const s = SIZE_MAP[size];
  const shouldAnimate = animate && !inOrbit;
  const showTooltip = iconOnly && (active || spotlightActive);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      onHoverStart={onHover}
      onHoverEnd={onLeave}
      animate={
        shouldAnimate
          ? { y: [0, -6, 0], scale: active ? 1.08 : 1 }
          : active && !spotlightActive
            ? { scale: 1.12 }
            : undefined
      }
      transition={
        shouldAnimate
          ? {
              y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
              scale: { duration: 0.25 },
            }
          : { scale: { duration: 0.25 } }
      }
      style={{ willChange: 'transform' }}
    >
      <div
        className={`relative flex ${s.box} items-center justify-center rounded-2xl bg-gradient-to-br ${module.color} shadow-lg ${module.glow} ${
          active ? 'ring-2 ring-white/80' : premium ? 'ring-1 ring-white/25' : ''
        } ${premium ? 'orbit-module-icon' : ''}`}
      >
        <Icon className={`${s.icon} text-white drop-shadow-sm`} strokeWidth={2} />
        {active ? (
          <motion.span
            className="absolute inset-0 rounded-2xl bg-white/30"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        ) : premium ? (
          <span className="orbit-module-shine absolute inset-0 rounded-2xl" aria-hidden />
        ) : null}
      </div>

      {iconOnly ? (
        <AnimatePresence>
          {showTooltip ? (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="orbit-module-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
            >
              <span className="mr-1.5">{module.emoji}</span>
              {module.label}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <span
          className={`${s.text} mt-1.5 max-w-[88px] text-center font-semibold leading-tight text-white/90`}
        >
          {module.label}
        </span>
      )}
    </motion.div>
  );
}
