'use client';

import { motion } from 'framer-motion';
import { Bot, MessageSquare, Sparkles } from 'lucide-react';
import { AI_FEATURES } from './landing.constants';
import { useScrollReveal } from './hooks/use-scroll-reveal';
import { useLandingMotion } from './hooks/use-landing-motion';

const DEMO_MESSAGES = [
  { role: 'user' as const, text: 'Show fee defaulters in Semester 3 Commerce.' },
  {
    role: 'assistant' as const,
    text: '12 students have outstanding fees totalling ₹2.4L. 4 are at risk of exam block.',
  },
  { role: 'user' as const, text: 'Generate NAAC Criterion 2.1 summary for this year.' },
  {
    role: 'assistant' as const,
    text: 'Draft report ready — 847 admissions, 94.2% retention, FYUGP-compliant programme mix.',
  },
];

export function LandingAiShowcase() {
  const { ref, inView } = useScrollReveal({ threshold: 0.15 });
  const animate = useLandingMotion();

  return (
    <section id="ai" ref={ref} className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            AI Assistant
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Your campus intelligence layer
          </h2>
          <p className="mt-4 text-base text-white/60">
            Ask questions in plain language. Get instant answers across admissions, academics,
            finance, HR, and compliance — powered by OneCampus AI.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            {AI_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  className="landing-ai-feature flex gap-4 rounded-2xl border border-white/10 p-5"
                  initial={{ opacity: 0, x: -24 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
                  whileHover={animate ? { x: 4 } : undefined}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="mt-1 text-sm text-white/55">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            className="landing-ai-chat relative overflow-hidden rounded-3xl border border-white/15 p-5 sm:p-6"
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.25, duration: 0.7 }}
          >
            <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">OneCampus AI</p>
                <p className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Online · Campus-aware
                </p>
              </div>
              <Sparkles className="ml-auto h-4 w-4 text-amber-300/80" />
            </div>

            <div className="space-y-3">
              {DEMO_MESSAGES.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.5 + i * 0.2 }}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-500/30 text-white'
                        : 'border border-white/10 bg-white/5 text-white/85'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <MessageSquare className="h-4 w-4 text-white/40" />
              <span className="text-sm text-white/40">Ask anything about your campus…</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
