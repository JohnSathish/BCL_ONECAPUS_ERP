'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, FileText, Send, Users, AlertTriangle } from 'lucide-react';

import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard } from '@/services/communication';

const AUDIENCE_HINTS = [
  'All students',
  'Department-wise',
  'Semester-wise',
  'Section-wise',
  'Shift-wise',
  'Individual student',
  'Faculty / staff',
  'Parents',
] as const;

export function PushCenterPage() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
  });

  const push = data?.channelHealth?.push;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Firebase / FCM</p>
          <p className="mt-2 text-xl font-bold">
            {push?.connected ? (push.demoMode ? 'Demo mode' : 'Connected') : 'Not configured'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure FCM_* env on the API. Mobile apps register Expo push tokens on login.
          </p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Active devices with tokens</p>
          <p className="mt-2 text-xl font-bold">{push?.activeDevices ?? 0}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Push delivery rate</p>
          <p className="mt-2 text-xl font-bold">
            {push?.deliveryRate != null ? `${push.deliveryRate}%` : '—'}
          </p>
        </SaaSCard>
      </div>

      <SaaSCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Send a push campaign</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compose opens with the PUSH channel selected. Use audience filters for students,
              faculty, parents, and staff.
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link href="/admin/communication/compose?channel=PUSH">
              <Send className="h-4 w-4" />
              Compose push
            </Link>
          </Button>
        </div>
      </SaaSCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/admin/communication/templates"
          icon={<FileText className="h-4 w-4" />}
          title="Templates"
          subtitle="Fee reminder, circular, result…"
        />
        <QuickLink
          href="/admin/communication/scheduled"
          icon={<CalendarClock className="h-4 w-4" />}
          title="Scheduled"
          subtitle="Tomorrow 9 AM, weekly reminders"
        />
        <QuickLink
          href="/admin/communication/audience"
          icon={<Users className="h-4 w-4" />}
          title="Audience"
          subtitle="Department, semester, section"
        />
        <QuickLink
          href="/admin/communication/failed"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Failed"
          subtitle="Retry undelivered pushes"
        />
      </div>

      <SaaSCard>
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Audience targeting</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supported via Compose / Audience builders:
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {AUDIENCE_HINTS.map((hint) => (
                <li key={hint}>• {hint}</li>
              ))}
            </ul>
          </div>
        </div>
      </SaaSCard>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </Link>
  );
}
