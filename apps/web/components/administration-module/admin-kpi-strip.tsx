'use client';

import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { AdminGlassCard } from './ui/admin-shell';

type Kpi = { label: string; value: number; tone?: string; onClick?: () => void };

export function AdminKpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <AdminGlassCard
            className={cn(
              'cursor-default p-4 transition hover:shadow-glow',
              item.onClick && 'cursor-pointer',
            )}
            onClick={item.onClick}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', item.tone)}>
              {item.value.toLocaleString()}
            </p>
          </AdminGlassCard>
        </motion.div>
      ))}
    </div>
  );
}
