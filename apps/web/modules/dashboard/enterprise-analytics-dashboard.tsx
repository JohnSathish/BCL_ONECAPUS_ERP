'use client';

import {
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AnalyticsPageShell } from '@/components/analytics/analytics-page-shell';
import { DashboardChartWidget } from '@/components/analytics/dashboard-chart-widget';
import { DashboardFilterBar } from '@/components/analytics/dashboard-filter-bar';
import { KpiMetricCard } from '@/components/analytics/kpi-metric-card';
import { ShiftIntelligenceSection } from '@/components/analytics/shift-intelligence-section';
import { WidgetSkeleton } from '@/components/analytics/widget-skeleton';
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel';
import { LicenseDashboardWidget } from '@/components/licensing/license-dashboard-widget';
import { fetchDashboardOverview } from '@/services/dashboard-analytics';
import { useDashboardFilters, useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import type { DashboardKpiMetric } from '@/types/dashboard-analytics';
import { usePermissions } from '@/hooks/use-permissions';
import { DASHBOARD_WIDGET_PERMISSIONS } from '@/lib/permissions/permission-registry';

const KPI_ICONS: Record<string, LucideIcon> = {
  students: Users,
  applications: ClipboardList,
  attendance: UserCheck,
  fees: Wallet,
  placement: TrendingUp,
  pending: Clock,
  faculty: GraduationCap,
  completion: CheckCircle2,
  hostel: BedDouble,
};

export function EnterpriseAnalyticsDashboard() {
  const queryClient = useQueryClient();
  const filters = useDashboardFilters();
  const autoRefresh = useDashboardFiltersStore((s) => s.autoRefresh);
  const { canAny } = usePermissions();

  const canWidget = (widgetId: string) => {
    const required = DASHBOARD_WIDGET_PERMISSIONS[widgetId];
    if (!required?.length) return true;
    return canAny(...required);
  };

  const hasOverviewAccess = canAny(
    'reports:read',
    'students:read',
    'academic:read',
    'fees:read',
    'front-office:read',
    'library:read',
  );

  const overview = useQuery({
    queryKey: ['dashboard', 'overview', filters],
    queryFn: () => fetchDashboardOverview(filters),
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    placeholderData: (prev) => prev,
    enabled: hasOverviewAccess,
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0">
      <AnalyticsPageShell>
        <section className="col-span-12">
          <DashboardFilterBar
            lastUpdated={overview.data?.updatedAt}
            onRefresh={refreshAll}
            isRefreshing={overview.isFetching}
          />
        </section>

        <section className="col-span-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
            {!hasOverviewAccess ? (
              <p className="col-span-full text-sm text-muted-foreground">
                No dashboard widgets available for your role.
              </p>
            ) : overview.isLoading && !overview.data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <WidgetSkeleton key={i} className="h-[168px]" />
              ))
            ) : (
              (overview.data?.kpis ?? []).map((metric: DashboardKpiMetric) => (
                <KpiMetricCard
                  key={metric.id}
                  metric={metric}
                  icon={KPI_ICONS[metric.id] ?? Users}
                />
              ))
            )}
          </div>
        </section>

        {hasOverviewAccess ? (
          <section className="col-span-12">
            <AiInsightsPanel />
          </section>
        ) : null}

        {canWidget('license-status') ? (
          <section className="col-span-12">
            <LicenseDashboardWidget />
          </section>
        ) : null}

        {canWidget('department-admissions') ? (
          <DashboardChartWidget
            widgetId="department-admissions"
            title="Department admissions"
            description="Applications by department or programme"
          />
        ) : null}
        {canWidget('fee-collection-trend') ? (
          <DashboardChartWidget
            widgetId="fee-collection-trend"
            title="Fee collection trend"
            description="Monthly collection vs due (₹ crore)"
          />
        ) : null}

        {canWidget('shift-attendance') ? (
          <DashboardChartWidget
            widgetId="shift-attendance"
            title="Shift attendance"
            description="Present vs absent by shift"
            lazy
          />
        ) : null}
        {canWidget('registration-completion') ? (
          <DashboardChartWidget
            widgetId="registration-completion"
            title="Registration completion"
            description="Semester registration status mix"
            lazy
          />
        ) : null}

        {canWidget('section-utilization') ? (
          <DashboardChartWidget
            widgetId="section-utilization"
            title="Section utilization"
            description="Capacity usage by shift and course"
            lazy
          />
        ) : null}
        {canWidget('pending-approvals') ? (
          <DashboardChartWidget
            widgetId="pending-approvals"
            title="Pending approvals"
            description="Admissions and registration queues"
            lazy
          />
        ) : null}

        {canWidget('shift-attendance') ? <ShiftIntelligenceSection /> : null}
      </AnalyticsPageShell>
    </motion.div>
  );
}
