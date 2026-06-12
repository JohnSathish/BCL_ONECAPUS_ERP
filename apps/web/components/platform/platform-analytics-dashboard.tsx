'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, IndianRupee, ShieldCheck, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPlatformAnalytics } from '@/services/platform-licensing';

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function PlatformAnalyticsDashboard() {
  const enabled = useAuthQueryEnabled();
  const analytics = useQuery({
    queryKey: ['platform', 'analytics'],
    queryFn: fetchPlatformAnalytics,
    enabled,
  });

  if (analytics.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading analytics…</p>;
  }

  if (analytics.isError || !analytics.data) {
    return <p className="text-sm text-destructive">Failed to load platform analytics.</p>;
  }

  const data = analytics.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">License analytics</h2>
        <p className="text-sm text-muted-foreground">
          Cross-tenant subscription health and renewal forecast.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Licensed institutions"
          value={data.totalLicensedInstitutions}
          icon={Building2}
        />
        <KpiCard title="Active licenses" value={data.activeLicenses} icon={ShieldCheck} />
        <KpiCard
          title="Near expiry / grace"
          value={data.nearExpiryLicenses}
          icon={TrendingUp}
          hint="Renewal forecast"
        />
        <KpiCard title="Expired" value={data.expiredLicenses} icon={AlertTriangle} />
        <KpiCard title="Suspended" value={data.suspendedLicenses} icon={AlertTriangle} />
        <KpiCard
          title="YTD revenue"
          value={`₹${data.annualRevenue.toLocaleString('en-IN')}`}
          icon={IndianRupee}
        />
      </div>
    </div>
  );
}
