'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';
import { NAV_LINKS } from './landing.constants';

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0.4, 0.92]);
  const blur = useTransform(scrollY, [0, 80], [8, 16]);
  const backgroundColor = useTransform(bgOpacity, (v) => `rgba(15, 23, 42, ${v})`);
  const backdropFilter = useTransform(blur, (v) => `blur(${v}px)`);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10"
      style={{ backgroundColor, backdropFilter }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <BrandingLogoImage src={DEFAULT_LOGIN_LOGO} className="h-6 w-6" priority />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-white">BCL OneCampus ERP</p>
            <p className="text-[10px] text-white/50">BaseCode Labs</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
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
            href="/login"
            className="text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
          >
            Start Free Demo
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/10 bg-slate-950/95 px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-white/80"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              Start Free Demo
            </Link>
          </nav>
        </motion.div>
      ) : null}
    </motion.header>
  );
}
