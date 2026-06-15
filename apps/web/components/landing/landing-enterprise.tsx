'use client';

import { motion } from 'framer-motion';
import { Award, Building2, Cloud, Shield } from 'lucide-react';
import { useScrollReveal } from './hooks/use-scroll-reveal';

const ENTERPRISE_FEATURES = [
  {
    icon: Shield,
    title: 'Enterprise RBAC',
    description: 'Granular permissions across admin, faculty, student, and portal roles.',
  },
  {
    icon: Building2,
    title: 'Multi-Campus Ready',
    description: 'Manage shifts, departments, and programmes across institutions.',
  },
  {
    icon: Award,
    title: 'NAAC / NBA Reporting',
    description: 'Compliance-ready exports and accreditation dashboards built in.',
  },
  {
    icon: Cloud,
    title: 'Cloud-Native Architecture',
    description: 'Secure, scalable, and always available — 98.9% uptime SLA.',
  },
];

export function LandingEnterprise() {
  const { ref, inView } = useScrollReveal({ threshold: 0.12 });

  return (
    <section id="enterprise" ref={ref} className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300/80">
            Enterprise Grade
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Built for institutions that scale
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {ENTERPRISE_FEATURES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                className="landing-enterprise-card flex gap-5 rounded-2xl border border-white/10 p-6"
                initial={{ opacity: 0, y: 32 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.55 }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-6 w-6 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
