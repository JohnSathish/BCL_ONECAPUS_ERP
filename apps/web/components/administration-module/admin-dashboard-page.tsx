'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  Eraser,
  HardDrive,
  Hash,
  KeyRound,
  LayoutDashboard,
  Monitor,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Ban,
} from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { ImpersonationBanner } from '@/components/administration-module/impersonation-banner';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { ChartContainer } from '@/components/dashboard/chart-container';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchUserSummary } from '@/services/administration';
import { fetchBackupDashboard } from '@/services/backup';
import { cn } from '@/utils/cn';

type Accent = 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'teal' | 'sky' | 'indigo' | 'amber';

const ACCENT: Record<
  Accent,
  { iconBg: string; iconText: string; ring: string; stroke: string; value: string }
> = {
  blue: {
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-600',
    ring: 'ring-blue-500/20',
    stroke: '#2563eb',
    value: 'text-slate-900 dark:text-slate-50',
  },
  green: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
    stroke: '#059669',
    value: 'text-emerald-600',
  },
  orange: {
    iconBg: 'bg-orange-500/10',
    iconText: 'text-orange-600',
    ring: 'ring-orange-500/20',
    stroke: '#ea580c',
    value: 'text-orange-600',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-600',
    ring: 'ring-violet-500/20',
    stroke: '#7c3aed',
    value: 'text-violet-600',
  },
  red: {
    iconBg: 'bg-red-500/10',
    iconText: 'text-red-600',
    ring: 'ring-red-500/20',
    stroke: '#dc2626',
    value: 'text-red-600',
  },
  teal: {
    iconBg: 'bg-teal-500/10',
    iconText: 'text-teal-600',
    ring: 'ring-teal-500/20',
    stroke: '#0d9488',
    value: 'text-slate-900 dark:text-slate-50',
  },
  sky: {
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-600',
    ring: 'ring-sky-500/20',
    stroke: '#0284c7',
    value: 'text-slate-900 dark:text-slate-50',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10',
    iconText: 'text-indigo-600',
    ring: 'ring-indigo-500/20',
    stroke: '#4f46e5',
    value: 'text-slate-900 dark:text-slate-50',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-600',
    ring: 'ring-amber-500/20',
    stroke: '#d97706',
    value: 'text-slate-900 dark:text-slate-50',
  },
};

const MODULES: Array<{
  href: string;
  label: string;
  icon: typeof Users;
  desc: string;
  accent: Accent;
}> = [
  {
    href: '/admin/administration/portal-users',
    label: 'Portal Users',
    icon: Users,
    desc: 'Manage student, staff and parent login accounts.',
    accent: 'blue',
  },
  {
    href: '/admin/administration/roles',
    label: 'Roles & Permissions',
    icon: KeyRound,
    desc: 'Manage roles, permissions and access control.',
    accent: 'violet',
  },
  {
    href: '/admin/administration/activation',
    label: 'User Activation',
    icon: UserCheck,
    desc: 'Approve and activate pending user accounts.',
    accent: 'green',
  },
  {
    href: '/admin/administration/support-data',
    label: 'Support Data',
    icon: Database,
    desc: 'Manage master lookups and reference data.',
    accent: 'indigo',
  },
  {
    href: '/admin/administration/roll-number-settings',
    label: 'Roll Number Settings',
    icon: Hash,
    desc: 'Configure roll number prefixes & sequences.',
    accent: 'teal',
  },
  {
    href: '/admin/administration/student-display-settings',
    label: 'Student Display',
    icon: Users,
    desc: 'Manage name formatting and display preferences.',
    accent: 'orange',
  },
  {
    href: '/admin/administration/data-cleanup',
    label: 'Data Cleanup',
    icon: Eraser,
    desc: 'Remove unused, duplicate and orphan records.',
    accent: 'red',
  },
  {
    href: '/admin/administration/device-login',
    label: 'Device & Login',
    icon: Shield,
    desc: 'Manage active sessions, devices & policies.',
    accent: 'sky',
  },
  {
    href: '/admin/administration/audit-logs',
    label: 'Audit Logs',
    icon: ScrollText,
    desc: 'View system logs and platform activities.',
    accent: 'violet',
  },
  {
    href: '/admin/administration/import-export',
    label: 'Import / Export',
    icon: ArrowLeftRight,
    desc: 'Import or export data in bulk securely.',
    accent: 'green',
  },
  {
    href: '/admin/administration/backups',
    label: 'Backup & DR Center',
    icon: HardDrive,
    desc: 'Automated backups, restore and disaster recovery.',
    accent: 'amber',
  },
];

const LINKS = [
  { href: '/admin/organization', label: 'Organization Setup' },
  { href: '/admin/administration/theme-branding', label: 'Theme Studio' },
  { href: '/admin/shifts', label: 'Shift Management' },
  { href: '/admin/students/import', label: 'Student Import' },
  { href: '/admin/administration/mobile-app', label: 'Login Notice Board' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Deterministic decorative sparkline from a seed value (no historical API). */
function sparkFromValue(seed: number, points = 8): { i: number; v: number }[] {
  const base = Math.max(seed, 1);
  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin(i * 0.9 + base * 0.01) * 0.12 + 1;
    const drift = 0.92 + (i / (points - 1)) * 0.16;
    return { i, v: Math.round(base * wave * drift) };
  });
}

function formatBackupAt(iso?: string | null) {
  if (!iso) return 'No backup yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AdminHero({ name }: { name: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e4fd6] via-[#2563eb] to-[#1d4ed8] text-white shadow-lg"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)',
          backgroundSize: '28px 28px, 36px 36px',
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8 lg:p-10">
        <div className="max-w-xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-100/90">
            Don Bosco College ERP Administration
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {greeting()}, {name}{' '}
            <span aria-hidden className="inline-block origin-bottom-right animate-none">
              👋
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-blue-50/90 md:text-[15px]">
            Welcome to Don Bosco College ERP Administration. Manage users, security and system
            configuration from one centralized dashboard.
          </p>
        </div>

        <div className="relative mx-auto flex h-36 w-full max-w-[280px] shrink-0 items-center justify-center md:mx-0 md:h-40">
          <motion.div
            className="absolute left-4 top-6 flex h-24 w-32 flex-col overflow-hidden rounded-xl border border-white/25 bg-white/15 shadow-xl backdrop-blur-sm"
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-1 border-b border-white/20 px-2 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-300/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
            </div>
            <div className="grid flex-1 grid-cols-3 gap-1 p-2">
              <div className="rounded bg-white/25" />
              <div className="col-span-2 rounded bg-white/15" />
              <div className="col-span-2 rounded bg-white/20" />
              <div className="rounded bg-white/30" />
            </div>
            <Monitor className="absolute bottom-2 right-2 h-4 w-4 text-white/50" />
          </motion.div>

          <motion.div
            className="absolute right-2 top-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-sky-400/30 shadow-lg backdrop-blur"
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 3.6, ease: 'easeInOut', delay: 0.3 }}
          >
            <ShieldCheck className="h-7 w-7 text-white" />
          </motion.div>

          <motion.div
            className="absolute bottom-1 right-8 flex h-16 w-12 flex-col justify-end gap-1 rounded-lg border border-white/25 bg-white/20 p-1.5 shadow-lg backdrop-blur"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut', delay: 0.6 }}
          >
            <Server className="mx-auto h-4 w-4 text-white/80" />
            <div className="h-1.5 rounded-sm bg-emerald-300/70" />
            <div className="h-1.5 rounded-sm bg-white/40" />
            <div className="h-1.5 rounded-sm bg-white/30" />
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  index,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
  accent: Accent;
  index: number;
}) {
  const a = ACCENT[accent];
  const chartData = useMemo(() => sparkFromValue(value + index * 17), [value, index]);
  const gradId = `admin-spark-${accent}-${index}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -3 }}
    >
      <AdminGlassCard className="h-full p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
              a.iconBg,
              a.iconText,
              a.ring,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn('mt-0.5 text-2xl font-bold tabular-nums tracking-tight', a.value)}>
          {value.toLocaleString()}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        <ChartContainer height={40} className="mt-2 opacity-90">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={a.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={a.stroke}
              fill={`url(#${gradId})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </AdminGlassCard>
    </motion.div>
  );
}

export function AdminDashboardPage() {
  const session = useRequireAuth();
  const { isImpersonating } = useAdminPermissions();
  const authEnabled = Boolean(session?.accessToken);

  const summaryQ = useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: fetchUserSummary,
    enabled: authEnabled,
  });

  const backupQ = useQuery({
    queryKey: ['admin', 'backups', 'dashboard'],
    queryFn: fetchBackupDashboard,
    enabled: authEnabled,
    staleTime: 60_000,
    retry: false,
  });

  const displayName =
    session?.user?.displayName?.trim() ||
    session?.user?.email?.split('@')[0]?.replace(/[._]/g, ' ') ||
    'Administrator';
  const titleName = displayName.replace(/\b\w/g, (c) => c.toUpperCase());

  const summary = summaryQ.data;
  const lastBackupAt =
    backupQ.data?.diagnostics?.lastSuccessfulAt ?? backupQ.data?.latestBackup?.completedAt ?? null;
  const dbOnline =
    backupQ.data?.dbHealth?.status?.toLowerCase() === 'ok' ||
    backupQ.data?.health?.database?.toLowerCase() === 'healthy' ||
    backupQ.data?.health?.database?.toLowerCase() === 'ok' ||
    !backupQ.isError;

  return (
    <DashboardShell role="admin" title="Administration">
      <AdminShell>
        {isImpersonating ? <ImpersonationBanner /> : null}

        <div className="space-y-6">
          <AdminHero name={titleName} />

          {summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                index={0}
                label="Portal Users"
                value={summary.total}
                hint="Total registered users"
                icon={Users}
                accent="blue"
              />
              <KpiCard
                index={1}
                label="Active"
                value={summary.active}
                hint="Active portal users"
                icon={UserCheck}
                accent="green"
              />
              <KpiCard
                index={2}
                label="Pending Activation"
                value={summary.pending}
                hint="Awaiting activation"
                icon={UserPlus}
                accent="orange"
              />
              <KpiCard
                index={3}
                label="Suspended"
                value={summary.suspended}
                hint="Temporarily suspended"
                icon={UserX}
                accent="violet"
              />
              <KpiCard
                index={4}
                label="Blocked"
                value={summary.blocked}
                hint="Blocked users"
                icon={Ban}
                accent="red"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <AdminGlassCard key={i} className="h-[140px] animate-pulse p-4">
                  <div className="h-10 w-10 rounded-xl bg-muted" />
                  <div className="mt-4 h-3 w-20 rounded bg-muted" />
                  <div className="mt-2 h-7 w-14 rounded bg-muted" />
                </AdminGlassCard>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((m, i) => {
              const a = ACCENT[m.accent];
              return (
                <motion.div
                  key={m.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.03 }}
                >
                  <Link href={m.href} className="block h-full">
                    <AdminGlassCard className="group flex h-full items-start gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
                          a.iconBg,
                          a.iconText,
                          a.ring,
                        )}
                      >
                        <m.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-snug group-hover:text-primary">
                            {m.label}
                          </h3>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {m.desc}
                        </p>
                      </div>
                    </AdminGlassCard>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutDashboard className="h-4 w-4" /> Related settings
            </h2>
            <div className="flex flex-wrap gap-2">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <AdminGlassCard className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">v2.5.0</span>
              </span>
              <span className="hidden h-4 w-px bg-border sm:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5" />
                Last Backup:{' '}
                <span className="font-medium text-foreground">
                  {backupQ.isLoading ? '…' : formatBackupAt(lastBackupAt)}
                </span>
              </span>
              <span className="hidden h-4 w-px bg-border sm:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                Server:{' '}
                <span
                  className={cn('font-medium', dbOnline ? 'text-emerald-600' : 'text-amber-600')}
                >
                  {dbOnline ? 'Online' : 'Check status'}
                </span>
              </span>
              <span className="hidden h-4 w-px bg-border sm:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Database: <span className="font-medium text-foreground">PostgreSQL</span>
              </span>
            </div>
            <Link
              href="/admin/administration/backups"
              className="text-xs font-medium text-primary hover:underline"
            >
              Open Backup Center →
            </Link>
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
