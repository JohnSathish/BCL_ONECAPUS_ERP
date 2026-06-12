'use client';

import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Clock, GraduationCap, UserCheck } from 'lucide-react';
import { ACTIVITY_FEED } from '@/modules/dashboard/mock-data';
import { cn } from '@/utils/cn';

const TYPE_META = {
  admission: { icon: UserCheck, color: 'bg-primary/15 text-primary' },
  results: { icon: BookOpen, color: 'bg-accent/15 text-accent' },
  timetable: { icon: Clock, color: 'bg-warning/15 text-warning' },
  grievance: { icon: CheckCircle2, color: 'bg-success/15 text-success' },
  placement: { icon: GraduationCap, color: 'bg-primary/15 text-primary' },
};

export function ActivityFeed() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Recent activity</h3>
          <p className="text-xs text-muted-foreground">Live operational feed</p>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
      </div>

      <ol className="relative space-y-0">
        <span className="absolute bottom-2 left-[19px] top-2 w-px bg-border" aria-hidden />
        {ACTIVITY_FEED.map((item, i) => {
          const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.admission;
          const Icon = meta.icon;
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative flex gap-4 py-3"
            >
              <span
                className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  meta.color,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.meta}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">{item.time}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
