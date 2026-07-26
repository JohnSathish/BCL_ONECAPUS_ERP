'use client';

import { motion } from 'framer-motion';

const QUOTE = 'Education is a matter of the heart — form good Christians and honest citizens.';
const ATTRIBUTION = '— St. John Bosco';

export function StudentCampusQuoteCard() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.25 }}
      className="relative hidden min-h-[148px] overflow-hidden rounded-2xl shadow-sm lg:block"
      aria-label="Campus inspiration"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/alumni-campus-hero.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f2744]/88 via-[#152a45]/72 to-[#1e4d8c]/55" />
      <div className="relative flex h-full flex-col justify-end p-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9a227]">
          Don Bosco College Tura
        </p>
        <blockquote className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-white/95">
          “{QUOTE}”
        </blockquote>
        <p className="mt-2 text-xs text-sky-100/90">{ATTRIBUTION}</p>
      </div>
    </motion.aside>
  );
}
