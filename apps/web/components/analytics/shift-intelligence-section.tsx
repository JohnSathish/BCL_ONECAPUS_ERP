'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { HeatmapGrid } from '@/components/analytics/charts/heatmap-grid';
import { StackedBarChartWidget } from '@/components/analytics/charts/stacked-bar-chart-widget';
import { ChartWidgetCard } from '@/components/analytics/chart-widget-card';
import { WidgetSkeleton } from '@/components/analytics/widget-skeleton';
import { useInView } from '@/hooks/use-in-view';
import { fetchShiftIntelligence } from '@/services/dashboard-analytics';
import { useDashboardFilters, useDashboardFiltersStore } from '@/store/dashboard-filters-store';

export function ShiftIntelligenceSection() {
  const filters = useDashboardFilters();
  const autoRefresh = useDashboardFiltersStore((s) => s.autoRefresh);
  const { ref, inView } = useInView('200px');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'shift-intelligence', filters],
    queryFn: () => fetchShiftIntelligence(filters),
    enabled: inView,
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    placeholderData: (prev) => prev,
  });

  const stacks = ['Present', 'Absent'];

  return (
    <section ref={ref} className="col-span-12 space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Shift intelligence
        </h2>
        <p className="text-xs text-muted-foreground">
          Enrollment, occupancy, faculty load, and revenue by shift
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <ChartWidgetCard
          title="Shift enrollment"
          description="Students and registrations per shift"
          source={data?.source}
          className="col-span-12 md:col-span-6 xl:col-span-3"
        >
          {!inView || isLoading ? (
            <WidgetSkeleton className="h-[220px]" />
          ) : (
            <BarChartWidget data={data?.enrollment ?? []} height={220} />
          )}
        </ChartWidgetCard>

        <ChartWidgetCard
          title="Shift occupancy"
          description="Capacity utilization %"
          source={data?.source}
          className="col-span-12 md:col-span-6 xl:col-span-3"
        >
          {!inView || isLoading ? (
            <WidgetSkeleton className="h-[220px]" />
          ) : (
            <DonutChartWidget data={data?.occupancy ?? []} height={220} />
          )}
        </ChartWidgetCard>

        <ChartWidgetCard
          title="Attendance by shift"
          description="Estimated present vs absent"
          source="seed"
          className="col-span-12 md:col-span-6 xl:col-span-3"
        >
          {!inView || isLoading ? (
            <WidgetSkeleton className="h-[220px]" />
          ) : (data?.attendanceByShift?.length ?? 0) > 0 ? (
            <StackedBarChartWidget
              data={data!.attendanceByShift}
              height={220}
              stackKeys={stacks}
              colors={['hsl(var(--primary))', 'hsl(var(--muted))']}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No shift data</p>
          )}
        </ChartWidgetCard>

        <ChartWidgetCard
          title="Revenue by shift"
          description="Fee collection benchmark"
          source="seed"
          className="col-span-12 md:col-span-6 xl:col-span-3"
        >
          {!inView || isLoading ? (
            <WidgetSkeleton className="h-[220px]" />
          ) : (
            <BarChartWidget data={data?.revenue ?? []} height={220} />
          )}
        </ChartWidgetCard>

        <ChartWidgetCard
          title="Faculty load"
          description="Teaching hours heatmap by shift"
          source={data?.source}
          className="col-span-12"
        >
          {!inView || isLoading ? (
            <WidgetSkeleton className="h-[200px]" />
          ) : data?.facultyLoad?.length ? (
            <HeatmapGrid cells={data.facultyLoad} />
          ) : (
            <p className="text-sm text-muted-foreground">No faculty load data</p>
          )}
        </ChartWidgetCard>
      </div>
    </section>
  );
}
