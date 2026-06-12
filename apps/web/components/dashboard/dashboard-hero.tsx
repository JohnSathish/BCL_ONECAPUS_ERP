'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero({
  name,
  liveStats,
}: {
  name: string;
  liveStats?: {
    applications?: number;
    pendingReview?: number;
    programs?: number;
    campuses?: number;
  };
}) {
  const title = name.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const pending = liveStats?.pendingReview ?? 3;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="gradient-border relative w-full overflow-hidden rounded-2xl"
    >
      <div className="hero-mesh relative w-full rounded-2xl p-6 md:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <motion.div
          className="pointer-events-none absolute bottom-4 right-12 hidden h-24 w-24 rounded-2xl border border-white/10 bg-white/5 backdrop-blur md:block"
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3 xl:pr-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Smart AI-Powered Campus Operating System
            </div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl lg:text-4xl">
              {greeting()}, {title} 👋
            </h2>
            <p className="text-sm text-muted-foreground md:text-base">
              Your institution is operating at{' '}
              <span className="font-semibold text-foreground">92% efficiency</span> today.{' '}
              <span className="text-primary">{pending} approvals</span> require your attention.
            </p>
            <div className="flex flex-wrap gap-2">
              <InsightChip
                label="Applications"
                value={String(liveStats?.applications ?? '—')}
                trend="up"
              />
              <InsightChip
                label="Programs"
                value={String(liveStats?.programs ?? '—')}
                trend="stable"
              />
              <InsightChip
                label="Campuses"
                value={String(liveStats?.campuses ?? '—')}
                trend="stable"
              />
              <InsightChip label="Fee collection" value="78.2%" trend="up" />
            </div>
          </div>

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 md:min-w-[280px]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-accent ai-pulse" />
              AI Command Center
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              OneCampus AI recommends reviewing Mechanical department OBE attainment and enabling
              ABC transfers for 2 partner institutions.
            </p>
            <Button size="sm" className="w-full gap-1">
              Open insights
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function InsightChip({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: 'up' | 'stable' | 'alert';
}) {
  const colors = {
    up: 'border-success/30 bg-success/10 text-success',
    stable: 'border-border bg-muted/50 text-muted-foreground',
    alert: 'border-warning/30 bg-warning/10 text-warning',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${colors[trend]}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
