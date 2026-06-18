'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from './hooks/use-scroll-reveal';
import { REQUEST_DEMO_PATH } from './landing.constants';

export function LandingCta() {
  const { ref, inView } = useScrollReveal({ threshold: 0.3 });

  return (
    <section ref={ref} className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="landing-cta-panel relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16"
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="landing-cta-glow absolute inset-0" aria-hidden />

          <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
            Ready to transform your campus?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-white/65">
            Join colleges running on OneCampus ERP — NEP-ready, FYUGP-compatible, and powered by AI
            from day one.
          </p>

          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={REQUEST_DEMO_PATH}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-indigo-700 shadow-xl transition-transform hover:scale-[1.03]"
            >
              Start Free Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={REQUEST_DEMO_PATH}
              className="text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
