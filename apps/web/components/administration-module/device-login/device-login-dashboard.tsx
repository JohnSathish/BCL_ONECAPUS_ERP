'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  Download,
  Lock,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { downloadDeviceReport, fetchDeviceDashboard } from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import { DistributionList, FlagBadges, KpiCard, MiniBarChart } from './device-login-ui';
import { formatClientIp } from './device-login-utils';

function shortDay(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DeviceLoginDashboard() {
  useRequireAuth();
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'dashboard'],
    queryFn: fetchDeviceDashboard,
    refetchInterval: 60_000,
  });
  const d = q.data;

  return (
    <DashboardShell role="admin" title="Device & Login">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Device & Login Management"
            subtitle="Monitor sessions, devices, failed attempts, and security alerts in one place"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={q.isFetching}
              onClick={() => void q.refetch()}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadDeviceReport('login-activity')}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export activity
            </Button>
          </div>
        </div>
        <DeviceLoginNav />

        {q.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-xl border border-border/70 bg-muted/40"
              />
            ))}
          </div>
        ) : q.isError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
            Could not load the security dashboard. Check your connection and try Refresh.
          </div>
        ) : d ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Active sessions"
                value={d.kpis.activeSessions}
                hint={`${d.kpis.webSessions} web · ${d.kpis.mobileSessions} mobile`}
                href="/admin/administration/device-login/sessions"
                icon={Monitor}
                tone="info"
              />
              <KpiCard
                label="Online users"
                value={d.kpis.onlineUsers}
                hint="Active in the last 5 minutes"
                href="/admin/administration/device-login/sessions"
                icon={Users}
                tone="success"
              />
              <KpiCard
                label="Today's logins"
                value={d.kpis.todaysLogins}
                hint={`${d.kpis.successRate}% success rate`}
                href="/admin/administration/device-login/history"
                icon={ShieldCheck}
                tone="success"
              />
              <KpiCard
                label="Failed today"
                value={d.kpis.failedLoginsToday}
                hint="Failures and lockouts"
                href="/admin/administration/device-login/failed"
                icon={AlertTriangle}
                tone={d.kpis.failedLoginsToday > 0 ? 'warning' : 'neutral'}
              />
              <KpiCard
                label="Blocked devices"
                value={d.kpis.blockedDevices}
                hint="Cannot sign in from these devices"
                href="/admin/administration/device-login/blocked"
                icon={Ban}
                tone={d.kpis.blockedDevices > 0 ? 'danger' : 'neutral'}
              />
              <KpiCard
                label="Trusted devices"
                value={d.kpis.trustedDevices}
                hint="Marked safe by admins"
                href="/admin/administration/device-login/devices"
                icon={Smartphone}
                tone="info"
              />
              <KpiCard
                label="Temporarily locked"
                value={d.kpis.lockedAccounts}
                hint="Too many wrong passwords"
                href="/admin/administration/device-login/failed"
                icon={Lock}
                tone={d.kpis.lockedAccounts > 0 ? 'warning' : 'neutral'}
              />
              <KpiCard
                label="New devices today"
                value={d.kpis.newDevicesDetected}
                hint="First-time fingerprints"
                href="/admin/administration/device-login/devices"
                icon={Smartphone}
                tone={d.kpis.newDevicesDetected > 0 ? 'info' : 'neutral'}
              />
            </div>

            <div className="mb-4 grid gap-3 lg:grid-cols-2">
              <MiniBarChart
                title="Daily login trend"
                subtitle="Successful logins · last 14 days"
                items={d.charts.dailyLoginTrend}
                labelKey={(row) => shortDay(String(row.date))}
                colorClass="bg-primary"
              />
              <MiniBarChart
                title="Logins by hour"
                subtitle="When users typically sign in"
                items={d.charts.loginByHour}
                labelKey={(row) => `${String(row.hour).padStart(2, '0')}:00`}
                colorClass="bg-emerald-600"
              />
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <DistributionList title="Device types" items={d.charts.deviceDistribution} />
              <DistributionList title="Browsers" items={d.charts.browserDistribution} />
              <DistributionList title="Operating systems" items={d.charts.osDistribution} />
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              {[
                {
                  href: '/admin/administration/device-login/sessions',
                  title: 'Review sessions',
                  desc: 'Force-logout idle or suspicious sessions',
                },
                {
                  href: '/admin/administration/device-login/failed',
                  title: 'Investigate failures',
                  desc: 'See bad passwords, lockouts, and attackers',
                },
                {
                  href: '/admin/administration/device-login/policies',
                  title: 'Tune policies',
                  desc: 'Alerts, MFA, session limits, and geo lookup',
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="text-sm font-semibold">{action.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{action.desc}</p>
                </Link>
              ))}
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Recent security alerts</h3>
                  <p className="text-xs text-muted-foreground">
                    New devices, multi-device use, and other risk flags
                  </p>
                </div>
                <Link
                  href="/admin/administration/device-login/history"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View full history
                </Link>
              </div>
              {d.recentAlerts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                  No suspicious flags in the last 14 days — looking good.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-semibold">When</th>
                        <th className="px-3 py-2.5 font-semibold">User</th>
                        <th className="px-3 py-2.5 font-semibold">Flags</th>
                        <th className="px-3 py-2.5 font-semibold">IP</th>
                        <th className="px-3 py-2.5 font-semibold">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recentAlerts.map((a) => (
                        <tr key={a.id} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                            {formatDisplayDateTime(a.createdAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">
                              {a.user?.displayName || a.user?.email || a.identifier}
                            </div>
                            {a.user?.email && a.user.displayName ? (
                              <div className="text-xs text-muted-foreground">{a.user.email}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <FlagBadges flags={a.flags} />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            {formatClientIp(a.ipAddress)}
                          </td>
                          <td className="px-3 py-2.5">
                            {a.accessDeviceId ? (
                              <Link
                                href={`/admin/administration/device-login/devices/${a.accessDeviceId}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                View device
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </AdminShell>
    </DashboardShell>
  );
}
