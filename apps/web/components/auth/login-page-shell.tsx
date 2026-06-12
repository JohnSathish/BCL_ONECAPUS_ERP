'use client';

import type { ReactNode } from 'react';
import { LOGIN_HERO_ANIMATIONS_ENABLED } from '@/components/auth/login-hero/login-hero.constants';
import { cn } from '@/utils/cn';

type Props = {
  hero: ReactNode;
  auth: ReactNode;
};

export function LoginPageShell({ hero, auth }: Props) {
  return (
    <div
      className={cn(
        'login-split-grid grid min-h-[100dvh] w-full lg:h-screen lg:max-h-[100dvh] lg:grid-cols-[3fr_2fr] lg:overflow-hidden',
        !LOGIN_HERO_ANIMATIONS_ENABLED && 'login-hero-static',
      )}
    >
      {hero}
      {auth}
    </div>
  );
}
