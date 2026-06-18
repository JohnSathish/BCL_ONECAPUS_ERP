'use client';

import { motion } from 'framer-motion';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLandingMotion } from './hooks/use-landing-motion';

type Props = {
  radiusPct: number;
  activeIndex?: number | null;
  moduleCount: number;
  premium?: boolean;
  spotlightMode?: boolean;
};

function orbitPoint(index: number, count: number, radiusPct: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    x2: round(50 + Math.cos(angle) * radiusPct),
    y2: round(50 + Math.sin(angle) * radiusPct),
  };
}

export function ConnectionLines({
  radiusPct,
  activeIndex,
  moduleCount,
  premium = false,
  spotlightMode = false,
}: Props) {
  const animate = useLandingMotion();
  const [mounted, setMounted] = useState(false);
  const gradientId = useId().replace(/:/g, '');
  const glowId = useId().replace(/:/g, '');

  useEffect(() => {
    setMounted(true);
  }, []);

  const lines = useMemo(
    () =>
      Array.from({ length: moduleCount }, (_, i) => ({
        ...orbitPoint(i, moduleCount, radiusPct),
        i,
      })),
    [moduleCount, radiusPct],
  );

  if (!mounted) return null;

  const OrbitRing = animate ? motion.circle : 'circle';

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(99,102,241,0.75)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.45)" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(129,140,248,0.18)" />
          <stop offset="70%" stopColor="rgba(99,102,241,0.06)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0)" />
        </radialGradient>
        <filter id={`blur-${glowId}`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {premium ? <circle cx="50" cy="50" r={radiusPct + 4} fill={`url(#${glowId})`} /> : null}

      {/* Outer pulse ring */}
      {premium && animate ? (
        <motion.circle
          cx="50"
          cy="50"
          fill="none"
          stroke="rgba(167,139,250,0.12)"
          strokeWidth="0.6"
          initial={{ r: radiusPct + 1.5, opacity: 0.25 }}
          animate={{
            opacity: [0.25, 0.55, 0.25],
            r: [radiusPct + 1, radiusPct + 2.5, radiusPct + 1],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      {/* Main orbit track */}
      <OrbitRing
        cx="50"
        cy="50"
        r={radiusPct}
        fill="none"
        stroke={premium ? 'rgba(167,139,250,0.35)' : 'rgba(148,163,255,0.22)'}
        strokeWidth={premium ? 0.45 : 0.35}
        strokeDasharray={premium ? '2 3.5' : '1.5 2.5'}
        strokeDashoffset={0}
        vectorEffect="non-scaling-stroke"
        {...(animate && !spotlightMode
          ? {
              initial: { strokeDashoffset: 0 },
              animate: { strokeDashoffset: [0, -20] },
              transition: { duration: 14, repeat: Infinity, ease: 'linear' },
            }
          : {})}
      />

      {/* Inner accent ring */}
      {premium ? (
        <circle
          cx="50"
          cy="50"
          r={radiusPct * 0.55}
          fill="none"
          stroke="rgba(56,189,248,0.08)"
          strokeWidth="0.25"
          strokeDasharray="1 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {lines.map(({ x2, y2, i }) => {
        const active = activeIndex === i;
        const Line = animate ? motion.line : 'line';
        return (
          <Line
            key={i}
            x1={50}
            y1={50}
            x2={x2}
            y2={y2}
            stroke={active ? `url(#${gradientId})` : 'rgba(129,140,248,0.22)'}
            strokeWidth={active ? 0.7 : 0.38}
            strokeDasharray={animate ? '1.2 1.8' : undefined}
            strokeDashoffset={animate ? 0 : undefined}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            {...(animate
              ? {
                  initial: {
                    opacity: spotlightMode ? 0.18 : 0.2,
                    strokeDashoffset: 0,
                  },
                  animate: {
                    opacity: active ? 1 : spotlightMode ? 0.18 : [0.28, 0.5, 0.28],
                    strokeDashoffset: active ? [0, -8] : spotlightMode ? 0 : [0, -4],
                  },
                  transition: {
                    strokeDashoffset: {
                      duration: active ? 1.2 : 3,
                      repeat: spotlightMode && !active ? 0 : Infinity,
                      ease: 'linear',
                    },
                    opacity: active
                      ? { duration: 0.35 }
                      : spotlightMode
                        ? { duration: 0.35 }
                        : { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                  },
                }
              : {})}
          />
        );
      })}

      {/* Center anchor glow */}
      {premium ? (
        <circle
          cx="50"
          cy="50"
          r="3.5"
          fill="rgba(129,140,248,0.25)"
          filter={`url(#blur-${glowId})`}
        />
      ) : null}
    </svg>
  );
}
