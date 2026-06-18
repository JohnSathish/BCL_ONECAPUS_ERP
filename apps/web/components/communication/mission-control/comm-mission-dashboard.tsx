'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Mail,
  Megaphone,
  MousePointerClick,
  Send,
} from 'lucide-react';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import {
  SaaSCard,
  SectionTitle,
  fadeUp,
  staggerContainer,
} from '@/components/dashboard/command-center-ui';
import { ChannelStatusCards } from '@/components/communication/mission-control/channel-status-cards';
import { LiveActivityFeed } from '@/components/communication/mission-control/live-activity-feed';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard } from '@/services/communication';
import { cn } from '@/utils/cn';

function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: number | string | null;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  sub?: string;
}) {
  return (
    <motion.div variants={fadeUp}>
      <SaaSCard className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {typeof value === 'number' ? (
                <AnimatedCounter value={value} suffix={suffix} />
              ) : (
                <span>
                  {value ?? '—'}
                  {suffix ?? ''}
                </span>
              )}
            </p>
            {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              accent ?? 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </SaaSCard>
    </motion.div>
  );
}

export function CommMissionDashboard() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading mission control…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-800 px-6 py-5 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-200">
          Communication Mission Control
        </p>
        <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
          Institutional Communication Hub
        </h1>
        <p className="mt-1 text-sm text-indigo-100/90">
          Email · SMS · WhatsApp · Push · In-App · Circulars · Alerts
        </p>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <KpiCard
          label="Sent Today"
          value={data?.messagesSentToday ?? 0}
          icon={Send}
          accent="bg-sky-500/10 text-sky-600"
        />
        <KpiCard
          label="Sent This Month"
          value={data?.messagesSentThisMonth ?? 0}
          icon={BarChart3}
          accent="bg-violet-500/10 text-violet-600"
        />
        <KpiCard
          label="Success Rate"
          value={data?.deliverySuccessRate ?? 0}
          suffix="%"
          icon={CheckCircle2}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <KpiCard
          label="Failed"
          value={data?.failedCount ?? 0}
          icon={AlertTriangle}
          accent="bg-red-500/10 text-red-600"
        />
        <KpiCard
          label="Open Rate"
          value={data?.openRate != null ? data.openRate : '—'}
          suffix={data?.openRate != null ? '%' : undefined}
          icon={Mail}
          sub="Email tracking"
        />
        <KpiCard
          label="Click Rate"
          value={data?.clickRate != null ? data.clickRate : '—'}
          suffix={data?.clickRate != null ? '%' : undefined}
          icon={MousePointerClick}
          sub="Email tracking"
        />
        <KpiCard label="Active Campaigns" value={data?.activeCampaigns ?? 0} icon={Megaphone} />
        <KpiCard label="Scheduled" value={data?.scheduledCount ?? 0} icon={CalendarClock} />
      </motion.div>

      <ChannelStatusCards health={data?.channelHealth} queueStats={data?.queueStats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <LiveActivityFeed items={data?.liveActivity ?? []} />
        <SaaSCard>
          <SectionTitle title="Recent Campaigns" subtitle="Latest broadcast activity" />
          <div className="space-y-2">
            {(data?.recentCampaigns ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.audienceType} · {c.status}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.sentAt ?? c.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {!data?.recentCampaigns?.length ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : null}
          </div>
        </SaaSCard>
      </div>
    </div>
  );
}
