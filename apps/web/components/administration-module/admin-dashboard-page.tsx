'use client';

import Link from 'next/link';
import {
  ArrowLeftRight,
  Database,
  Eraser,
  Hash,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminKpiStrip } from '@/components/administration-module/admin-kpi-strip';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchUserSummary } from '@/services/administration';

const MODULES = [
  {
    href: '/admin/administration/portal-users',
    label: 'Portal Users',
    icon: Users,
    desc: 'Manage login accounts',
  },
  {
    href: '/admin/administration/roles',
    label: 'Roles & Permissions',
    icon: KeyRound,
    desc: 'RBAC matrix',
  },
  {
    href: '/admin/administration/activation',
    label: 'User Activation',
    icon: UserCheck,
    desc: 'Pending & blocked users',
  },
  {
    href: '/admin/administration/support-data',
    label: 'Support Data',
    icon: Database,
    desc: 'Master lookups',
  },
  {
    href: '/admin/administration/roll-number-settings',
    label: 'Roll Number Settings',
    icon: Hash,
    desc: 'College roll prefixes & sequences',
  },
  {
    href: '/admin/administration/student-display-settings',
    label: 'Student Display',
    icon: Users,
    desc: 'Name formatting across the ERP',
  },
  {
    href: '/admin/administration/data-cleanup',
    label: 'Data Cleanup',
    icon: Eraser,
    desc: 'Unused programmes & orphan versions',
  },
  {
    href: '/admin/administration/security',
    label: 'Security & Sessions',
    icon: Shield,
    desc: 'Sessions & password policy',
  },
  {
    href: '/admin/administration/audit-logs',
    label: 'Audit Logs',
    icon: ScrollText,
    desc: 'Platform activity',
  },
  {
    href: '/admin/administration/import-export',
    label: 'Import / Export',
    icon: ArrowLeftRight,
    desc: 'Bulk data center',
  },
];

const LINKS = [
  { href: '/admin/organization', label: 'Organization Setup' },
  { href: '/admin/administration/theme-branding', label: 'Theme Studio' },
  { href: '/admin/shifts', label: 'Shift Management' },
  { href: '/admin/students/import', label: 'Student Import' },
];

export function AdminDashboardPage() {
  useRequireAuth();
  const summaryQ = useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: fetchUserSummary,
  });

  return (
    <DashboardShell role="admin" title="Administration">
      <AdminShell>
        <AdminPageHeader
          title="Administration"
          subtitle="Centralized control center for portal users, security, and platform configuration"
        />

        {summaryQ.data ? (
          <AdminKpiStrip
            items={[
              { label: 'Portal users', value: summaryQ.data.total },
              { label: 'Active', value: summaryQ.data.active, tone: 'text-emerald-600' },
              { label: 'Pending activation', value: summaryQ.data.pending, tone: 'text-amber-600' },
              { label: 'Suspended', value: summaryQ.data.suspended },
              { label: 'Blocked', value: summaryQ.data.blocked, tone: 'text-red-600' },
            ]}
          />
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}>
              <AdminGlassCard className="group h-full p-5 transition hover:shadow-glow">
                <m.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-3 font-semibold group-hover:text-primary">{m.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              </AdminGlassCard>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="h-4 w-4" /> Related settings
          </h2>
          <div className="flex flex-wrap gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full bg-muted px-4 py-2 text-sm hover:bg-muted/80"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
