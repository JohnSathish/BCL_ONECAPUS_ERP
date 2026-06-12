'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';
type Props = {
  children: ReactNode;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
  };
  loginBackgroundStyle?: 'gradient' | 'solid' | 'mesh';
};

export function LoginAuthPanel({ children, theme, loginBackgroundStyle = 'gradient' }: Props) {
  const style = {
    ...(theme
      ? {
          '--login-institution-primary': theme.primaryColor,
          '--login-institution-accent': theme.accentColor,
        }
      : {}),
  } as CSSProperties;

  return (
    <div
      className={cn(
        'login-auth-surface login-institution-themed flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        'px-3 py-4 sm:px-5 sm:py-5 lg:py-6',
        loginBackgroundStyle === 'solid' && 'login-auth-surface-solid',
        loginBackgroundStyle === 'mesh' && 'login-auth-surface-mesh',
      )}
      style={style}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start pt-1 lg:justify-center lg:pt-0">
        {children}
      </div>{' '}
    </div>
  );
}
