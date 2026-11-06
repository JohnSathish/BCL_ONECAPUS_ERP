'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnalyticsPageShell } from '@/components/analytics/analytics-page-shell';
import { DashboardFilterBar } from '@/components/analytics/dashboard-filter-bar';
import { WidgetSkeleton } from '@/components/analytics/widget-skeleton';
import { FinanceAnalyticsBoard } from '@/modules/dashboard/finance-analytics-board';
import { fetchDashboardOverview } from '@/services/dashboard-analytics';
import { useEffectiveDashboardFilters } from '@/hooks/use-effective-dashboard-filters';
import { useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import { usePermissions } from '@/hooks/use-permissions';

export function EnterpriseAnalyticsDashboard() {
  const queryClient = useQueryClient();
  const filters = useEffectiveDashboardFilters();
  const autoRefresh = useDashboardFiltersStore((s) => s.autoRefresh);
  const { canAny } = usePermissions();

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
    <AnalyticsPageShell>
      <section className="col-span-12">
        <DashboardFilterBar
          lastUpdated={overview.data?.updatedAt}
          onRefresh={refreshAll}
          isRefreshing={overview.isFetching}
        />
      </section>
      <section className="col-span-12">
        {!hasOverviewAccess ? (
          <p className="text-sm text-slate-500">
            No dashboard figures are available for your role.
          </p>
        ) : overview.isLoading && !overview.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <WidgetSkeleton key={index} className="h-36" />
            ))}
          </div>
        ) : overview.isError || !overview.data?.board ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
            The finance figures could not be loaded. Refresh the page after the latest API is
            running.
          </p>
        ) : (
          <FinanceAnalyticsBoard
            kpis={overview.data.kpis}
            board={overview.data.board}
            onRefresh={refreshAll}
            refreshing={overview.isFetching}
          />
        )}
      </section>
    </AnalyticsPageShell>
  );
}
