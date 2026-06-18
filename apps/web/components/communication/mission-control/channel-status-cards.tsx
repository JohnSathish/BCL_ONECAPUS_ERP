'use client';

import { Mail, MessageSquare, Phone, Smartphone, Wifi, WifiOff } from 'lucide-react';

import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import type { CommunicationChannelHealth, CommunicationQueueStats } from '@/types/communication';
import { cn } from '@/utils/cn';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')}
    />
  );
}

export function ChannelStatusCards({
  health,
  queueStats,
}: {
  health?: CommunicationChannelHealth;
  queueStats?: CommunicationQueueStats;
}) {
  const cards = [
    {
      title: 'Email (SMTP)',
      icon: Mail,
      connected: health?.email?.connected ?? false,
      rows: [
        { label: 'Provider', value: health?.email?.provider ?? '—' },
        {
          label: 'Last Sent',
          value: health?.email?.lastSent ? new Date(health.email.lastSent).toLocaleString() : '—',
        },
        { label: 'Queue', value: String(health?.email?.queueSize ?? queueStats?.waiting ?? 0) },
      ],
    },
    {
      title: 'SMS Gateway',
      icon: MessageSquare,
      connected: health?.sms?.connected ?? false,
      rows: [
        { label: 'Provider', value: health?.sms?.provider ?? '—' },
        { label: 'Used Today', value: String(health?.sms?.usedToday ?? 0) },
        { label: 'This Month', value: String(health?.sms?.usedThisMonth ?? 0) },
      ],
    },
    {
      title: 'WhatsApp',
      icon: Phone,
      connected: health?.whatsapp?.connected ?? false,
      rows: [
        { label: 'Templates Approved', value: String(health?.whatsapp?.templatesApproved ?? 0) },
        { label: 'Delivered', value: String(health?.whatsapp?.messagesDelivered ?? 0) },
      ],
    },
    {
      title: 'Push (Firebase)',
      icon: Smartphone,
      connected: health?.push?.connected ?? false,
      rows: [
        { label: 'Active Devices', value: String(health?.push?.activeDevices ?? 0) },
        {
          label: 'Delivery Rate',
          value: health?.push?.deliveryRate != null ? `${health.push.deliveryRate}%` : '—',
        },
      ],
    },
  ];

  return (
    <div>
      <SectionTitle title="Channel Status" subtitle="Real-time provider health" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <SaaSCard key={card.title}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <card.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{card.title}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <StatusDot ok={card.connected} />
                {card.connected ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
            </div>
            <dl className="space-y-1.5 text-xs">
              {card.rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          </SaaSCard>
        ))}
      </div>
      {queueStats ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Queue: {queueStats.waiting} waiting · {queueStats.active} processing · {queueStats.failed}{' '}
          failed
        </p>
      ) : null}
    </div>
  );
}
