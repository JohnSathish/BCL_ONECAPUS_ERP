'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { GraduationCap, LogIn, Menu, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';
import { LOGIN_PATH, NAV_LINKS, QUICK_ACCESS_LINKS, REQUEST_DEMO_PATH } from './landing.constants';

const signInButtonClass =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/50 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const demoButtonClass =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0.4, 0.92]);
  const blur = useTransform(scrollY, [0, 80], [8, 16]);
  const backgroundColor = useTransform(bgOpacity, (v) => `rgba(15, 23, 42, ${v})`);
  const backdropFilter = useTransform(blur, (v) => `blur(${v}px)`);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeMenu]);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10"
      style={{ backgroundColor, backdropFilter }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-[44px] min-w-0 shrink items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 sm:h-9 sm:w-9">
            <BrandingLogoImage
              src={DEFAULT_LOGIN_LOGO}
              className="h-5 w-5 sm:h-6 sm:w-6"
              priority
            />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-white">BCL OneCampus ERP</p>
            <p className="text-[10px] text-white/50">BaseCode Labs</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.slice(0, 4).map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={LOGIN_PATH}
            className="text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href={REQUEST_DEMO_PATH}
            className="rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
          >
            Start Free Demo
          </Link>
        </div>

        {/* Mobile: Sign In always visible + menu toggle */}
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          <Link
            href={LOGIN_PATH}
            className={signInButtonClass}
            aria-label="Sign in to your account"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            <span>Sign In</span>
          </Link>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <motion.div
          id="landing-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex max-h-[calc(100dvh-3.5rem)] flex-col border-t border-white/10 bg-slate-950/98 md:hidden sm:max-h-[calc(100dvh-4rem)]"
        >
          {/* Top action area — login + demo never below the fold */}
          <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/90">
              Quick Access
            </p>
            <Link
              href={QUICK_ACCESS_LINKS[0].href}
              onClick={closeMenu}
              className={cn(
                'flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-center shadow-lg shadow-indigo-600/25',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              )}
            >
              <span className="inline-flex items-center gap-2 text-base font-bold text-white">
                <LogIn className="h-4 w-4" aria-hidden />
                {QUICK_ACCESS_LINKS[0].label}
              </span>
              {'subtitle' in QUICK_ACCESS_LINKS[0] && QUICK_ACCESS_LINKS[0].subtitle ? (
                <span className="text-[11px] font-medium text-white/80">
                  {QUICK_ACCESS_LINKS[0].subtitle}
                </span>
              ) : null}
            </Link>
            <Link href={REQUEST_DEMO_PATH} onClick={closeMenu} className={demoButtonClass}>
              Start Free Demo
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={LOGIN_PATH}
                onClick={closeMenu}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 text-xs font-semibold text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Student portal sign in"
              >
                <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Student Portal
              </Link>
              <Link
                href={LOGIN_PATH}
                onClick={closeMenu}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 text-xs font-semibold text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Staff portal sign in"
              >
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Staff Portal
              </Link>
            </div>
          </div>

          {/* Scrollable informational links — compact spacing */}
          <nav
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-4"
            aria-label="Site sections"
          >
            <ul className="divide-y divide-white/5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex min-h-[44px] items-center py-1 text-sm font-medium text-white/85 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    onClick={closeMenu}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Fixed bottom CTA — stays visible while scrolling nav */}
          <div className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 py-2.5 backdrop-blur sm:px-4">
            <Link href={REQUEST_DEMO_PATH} onClick={closeMenu} className={demoButtonClass}>
              Start Free Demo
            </Link>
          </div>
        </motion.div>
      ) : null}
    </motion.header>
  );
}
