'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { EcosystemOrbit } from './ecosystem-orbit';
import { ParticleCanvas } from './particle-canvas';
import { REQUEST_DEMO_PATH, TRUST_PILLS } from './landing.constants';
import { useLandingMotion } from './hooks/use-landing-motion';

export function LandingHero() {
  const animate = useLandingMotion();

  return (
    <section className="landing-hero relative min-h-screen overflow-hidden pt-16">
      <div className="landing-hero-gradient absolute inset-0" aria-hidden />
      <ParticleCanvas />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-8 lg:py-24">
        <motion.div
          className="flex-1 text-center lg:text-left"
          initial={animate ? { opacity: 0, y: 32 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-cyan-200/90 backdrop-blur-sm"
            initial={animate ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Campus Management Platform
          </motion.div>

          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem] xl:text-6xl">
            The complete{' '}
            <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
              ERP ecosystem
            </span>{' '}
            for modern colleges
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/65 lg:mx-0 lg:text-lg">
            OneCampus ERP unifies admissions, academics, attendance, examinations, HR, finance,
            library, and analytics — built for NEP 2020, FYUGP, and multi-shift campuses.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href={REQUEST_DEMO_PATH}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 px-7 py-3.5 text-sm font-bold text-slate-900 shadow-xl shadow-emerald-500/25 transition-transform hover:scale-[1.03]"
            >
              Register Free Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#modules"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Explore Modules
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {TRUST_PILLS.map((pill, i) => {
              const Icon = pill.icon;
              return (
                <motion.span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75"
                  initial={animate ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-300/80" />
                  {pill.label}
                </motion.span>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-1 items-center justify-center"
          initial={animate ? { opacity: 0, scale: 0.85 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="scale-[0.78] sm:scale-90 lg:scale-100">
            <EcosystemOrbit size="hero" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
