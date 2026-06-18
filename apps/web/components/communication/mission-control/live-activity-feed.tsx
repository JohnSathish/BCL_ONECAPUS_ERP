'use client';

import { Activity } from 'lucide-react';

import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import type { CommunicationLiveActivity } from '@/types/communication';
import { cn } from '@/utils/cn';

const STATUS_COLOR: Record<string, string> = {
  SENT: 'text-sky-600',
  DELIVERED: 'text-emerald-600',
  FAILED: 'text-red-600',
  PENDING: 'text-amber-600',
};

export function LiveActivityFeed({ items }: { items: CommunicationLiveActivity[] }) {
  return (
    <SaaSCard>
      <SectionTitle
        title="Live Activity Feed"
        subtitle="Latest delivery events"
        action={
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        }
      />
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
          >
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.time).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ·{' '}
                <span className={cn(STATUS_COLOR[item.status] ?? 'text-muted-foreground')}>
                  {item.channel} · {item.status}
                </span>
              </p>
            </div>
          </div>
        ))}
        {!items.length ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : null}
      </div>
    </SaaSCard>
  );
}
