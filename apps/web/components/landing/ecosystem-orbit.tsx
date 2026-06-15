'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { ConnectionLines } from './connection-lines';
import { FloatingModuleCard } from './floating-module-card';
import { ORBIT_MODULES } from './landing.constants';
import { OrbitCenterNode } from './orbit-center-node';
import { OrbitStage } from './orbit-stage';
import { useLandingMotion } from './hooks/use-landing-motion';

type OrbitMode = 'spin' | 'spotlight';

type Props = {
  size?: 'login' | 'hero' | 'section';
  motionEnabled?: boolean;
  onModuleHover?: (index: number | null) => void;
  onSpotlightChange?: (index: number) => void;
};

const SIZE_CONFIG = {
  login: {
    box: 380,
    radius: 152,
    orbitDuration: 45,
    moduleSize: 'md' as const,
    iconOnly: true,
    premium: true,
    centerVariant: 'login' as const,
    mode: 'spotlight' as OrbitMode,
    spotlightInterval: 1940,
    flyFraction: 0.44,
    flyDuration: 0.58,
  },
  hero: {
    box: 440,
    radius: 168,
    orbitDuration: 48,
    moduleSize: 'md' as const,
    iconOnly: false,
    premium: true,
    centerVariant: 'default' as const,
    mode: 'spin' as OrbitMode,
    spotlightInterval: 1940,
    flyFraction: 0.44,
    flyDuration: 0.58,
  },
  section: {
    box: 540,
    radius: 208,
    orbitDuration: 50,
    moduleSize: 'lg' as const,
    iconOnly: false,
    premium: true,
    centerVariant: 'default' as const,
    mode: 'spin' as OrbitMode,
    spotlightInterval: 1940,
    flyFraction: 0.44,
    flyDuration: 0.58,
  },
};

function polarPercent(index: number, count: number, radiusPct: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    left: round(50 + Math.cos(angle) * radiusPct),
    top: round(50 + Math.sin(angle) * radiusPct),
  };
}

function towardCenter(left: number, top: number, fraction: number) {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    left: round(left + (50 - left) * fraction),
    top: round(top + (50 - top) * fraction),
  };
}

export function EcosystemOrbit({
  size = 'hero',
  motionEnabled,
  onModuleHover,
  onSpotlightChange,
}: Props) {
  const landingMotion = useLandingMotion();
  const animate = motionEnabled ?? landingMotion;
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const config = SIZE_CONFIG[size];
  const radiusPct = (config.radius / config.box) * 100;
  const count = ORBIT_MODULES.length;
  const isSpotlight = config.mode === 'spotlight';
  const activeIndex = hoveredIndex ?? (isSpotlight ? spotlightIndex : null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSpotlight) return;
    onSpotlightChange?.(spotlightIndex);
  }, [isSpotlight, onSpotlightChange, spotlightIndex]);

  useEffect(() => {
    if (!mounted || !animate || paused || !isSpotlight) return;
    const id = window.setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % count);
    }, config.spotlightInterval);
    return () => window.clearInterval(id);
  }, [animate, config.spotlightInterval, count, isSpotlight, mounted, paused]);

  const nodes = useMemo(
    () =>
      ORBIT_MODULES.map((mod, i) => ({
        mod,
        i,
        ...polarPercent(i, count, radiusPct),
      })),
    [count, radiusPct],
  );

  const orbitTransition =
    animate && !paused && !isSpotlight
      ? { duration: config.orbitDuration, repeat: Infinity, ease: 'linear' as const }
      : undefined;

  const handleHover = (index: number) => {
    setHoveredIndex(index);
    onModuleHover?.(index);
    if (isSpotlight) setPaused(true);
  };

  const handleLeave = () => {
    setHoveredIndex(null);
    onModuleHover?.(null);
    if (isSpotlight) setPaused(false);
  };

  return (
    <OrbitStage maxSize={config.box}>
      {mounted ? (
        <ConnectionLines
          radiusPct={radiusPct}
          activeIndex={activeIndex}
          moduleCount={count}
          premium={config.premium}
          spotlightMode={isSpotlight}
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div
            className="rounded-full border border-dashed border-indigo-300/25"
            style={{ width: `${radiusPct * 2}%`, aspectRatio: '1 / 1' }}
          />
        </div>
      )}

      {config.premium ? (
        <>
          <div className="orbit-halo orbit-halo-1 pointer-events-none absolute rounded-full" />
          <div className="orbit-halo orbit-halo-2 pointer-events-none absolute rounded-full" />
        </>
      ) : null}

      {isSpotlight && mounted && animate ? (
        <div
          className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center"
          aria-hidden
        >
          <motion.span
            key={`ripple-${spotlightIndex}`}
            className="absolute rounded-full border border-cyan-300/35"
            style={{ width: '28%', aspectRatio: '1 / 1' }}
            initial={{ scale: 0.75, opacity: 0.55 }}
            animate={{ scale: 1.65, opacity: 0 }}
            transition={{ duration: 1.15, ease: [0.33, 0, 0.67, 1] }}
          />
        </div>
      ) : null}

      {mounted && isSpotlight ? (
        <div className="orbit-ring absolute inset-0">
          {nodes.map(({ mod, i, left, top }) => {
            const highlighted = activeIndex === i;
            const target = towardCenter(left, top, config.flyFraction);
            return (
              <motion.div
                key={mod.id}
                className="orbit-node absolute"
                style={{ zIndex: highlighted ? 30 : 10, x: '-50%', y: '-50%' }}
                animate={{
                  left: highlighted ? `${target.left}%` : `${left}%`,
                  top: highlighted ? `${target.top}%` : `${top}%`,
                  scale: highlighted ? 1.32 : 1,
                }}
                transition={{
                  duration: config.flyDuration,
                  ease: [0.33, 0, 0.67, 1],
                }}
              >
                <FloatingModuleCard
                  module={mod}
                  size={config.moduleSize}
                  active={highlighted}
                  spotlightActive={highlighted && hoveredIndex === null}
                  onHover={() => handleHover(i)}
                  onLeave={handleLeave}
                  inOrbit
                  iconOnly={config.iconOnly}
                  premium={config.premium}
                />
              </motion.div>
            );
          })}
        </div>
      ) : null}

      {mounted && !isSpotlight ? (
        <motion.div
          className="orbit-ring absolute inset-0"
          animate={orbitTransition ? { rotate: 360 } : undefined}
          transition={orbitTransition}
          style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
          onHoverStart={() => setPaused(true)}
          onHoverEnd={() => setPaused(false)}
        >
          {nodes.map(({ mod, i, left, top }) => (
            <div
              key={mod.id}
              className="orbit-node absolute z-10"
              style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
            >
              <motion.div
                animate={orbitTransition ? { rotate: -360 } : undefined}
                transition={orbitTransition}
                style={{ transformOrigin: 'center center', willChange: 'transform' }}
              >
                <FloatingModuleCard
                  module={mod}
                  size={config.moduleSize}
                  active={hoveredIndex === i}
                  onHover={() => handleHover(i)}
                  onLeave={handleLeave}
                  inOrbit
                  iconOnly={config.iconOnly}
                  premium={config.premium}
                />
              </motion.div>
            </div>
          ))}
        </motion.div>
      ) : null}

      <div className="center-node pointer-events-none z-20 flex items-center justify-center">
        <div className="pointer-events-auto">
          <OrbitCenterNode
            variant={config.centerVariant}
            animate={mounted && animate}
            staticCenter={isSpotlight}
          />
        </div>
      </div>
    </OrbitStage>
  );
}

export function getOrbitModule(index: number) {
  return ORBIT_MODULES[index] ?? null;
}
