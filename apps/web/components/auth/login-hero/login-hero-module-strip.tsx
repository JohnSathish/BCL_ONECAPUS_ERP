'use client';

import { useState } from 'react';
import { MODULE_STRIP } from './login-hero.constants';
import { useLoginHeroMotion } from './use-login-hero-motion';
import { cn } from '@/utils/cn';

export function LoginHeroModuleStrip() {
  const animate = useLoginHeroMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="login-hero-section">
      <p className="login-hero-section-label mb-2.5">Integrated modules</p>
      <div
        className="login-glass-compact login-hero-module-panel relative overflow-hidden rounded-xl px-3 py-3"
        role="list"
        aria-label="Integrated campus modules"
      >
        {animate ? (
          <span
            className="login-module-flow pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cyan-400/15 to-transparent"
            aria-hidden
          />
        ) : null}
        <ul className="login-hero-module-grid relative grid grid-cols-3 gap-1.5">
          {MODULE_STRIP.map(({ icon: Icon, label }) => (
            <li key={label}>
              <span
                role="listitem"
                className={cn(
                  'login-module-node login-hero-module-tile flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center',
                  animate && 'transition-colors',
                  hovered === label
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'text-white/75 hover:bg-white/[0.04]',
                )}
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    hovered === label ? 'text-cyan-200' : 'text-cyan-200/70',
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
