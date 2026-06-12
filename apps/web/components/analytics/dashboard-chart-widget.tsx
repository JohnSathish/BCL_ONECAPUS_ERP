'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { HeatmapGrid } from '@/components/analytics/charts/heatmap-grid';
import { LineChartWidget } from '@/components/analytics/charts/line-chart-widget';
import { StackedBarChartWidget } from '@/components/analytics/charts/stacked-bar-chart-widget';
import { ChartWidgetCard } from '@/components/analytics/chart-widget-card';
import { PendingApprovalsWidget } from '@/components/analytics/pending-approvals-widget';
import { WidgetSkeleton } from '@/components/analytics/widget-skeleton';
import { useInView } from '@/hooks/use-in-view';
import { fetchDashboardChart } from '@/services/dashboard-analytics';
import { useDashboardFilters, useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import type { DashboardChartWidgetId } from '@/types/dashboard-analytics';
import { cn } from '@/utils/cn';

type Props = {
  widgetId: DashboardChartWidgetId;
  title: string;
  description?: string;
  lazy?: boolean;
  className?: string;
};

export function DashboardChartWidget({
  widgetId,
  title,
  description,
  lazy = false,
  className,
}: Props) {
  const filters = useDashboardFilters();
  const autoRefresh = useDashboardFiltersStore((s) => s.autoRefresh);
  const { ref, inView } = useInView();
  const enabled = !lazy || inView;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'chart', widgetId, filters],
    queryFn: () => fetchDashboardChart(widgetId, filters),
    enabled,
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    placeholderData: (prev) => prev,
  });

  const body = (() => {
    if (!enabled || isLoading) {
      return <WidgetSkeleton className="h-[260px] w-full" />;
    }
    if (isError || !data?.series?.length) {
      return (
        <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No data for current filters
        </p>
      );
    }

    switch (data.chartType) {
      case 'bar':
        return (
          <BarChartWidget
            data={data.series}
            layout={widgetId === 'department-admissions' ? 'vertical' : 'horizontal'}
          />
        );
      case 'line':
        return (
          <LineChartWidget
            data={data.series}
            lines={[
              {
                key: 'collected',
                name: 'Collected (₹Cr)',
                color: 'var(--institution-primary, hsl(var(--primary)))',
              },
              {
                key: 'due',
                name: 'Due (₹Cr)',
                color: 'hsl(var(--muted-foreground))',
                dashed: true,
              },
            ]}
          />
        );
      case 'stackedBar': {
        const stacks = [...new Set(data.series.map((d) => d.stack).filter(Boolean))] as string[];
        return (
          <StackedBarChartWidget
            data={data.series}
            stackKeys={stacks.length ? stacks : ['Present', 'Absent']}
            colors={['hsl(var(--primary))', 'hsl(var(--muted))']}
          />
        );
      }
      case 'donut':
        return <DonutChartWidget data={data.series} />;
      case 'heatmap': {
        const cells = data.series
          .filter((s) => s.row != null && s.col != null)
          .map((s) => ({
            row: String(s.row),
            col: String(s.col),
            value: Number(s.value),
          }));
        return cells.length ? (
          <HeatmapGrid cells={cells} />
        ) : (
          <p className="text-sm text-muted-foreground">No section utilization data</p>
        );
      }
      case 'list':
        return <PendingApprovalsWidget items={data.series} />;
      default:
        return null;
    }
  })();

  return (
    <div ref={ref} className={cn('col-span-12 lg:col-span-6', className)}>
      <ChartWidgetCard
        title={title}
        description={description}
        source={data?.source}
        footer={data?.meta?.note ? String(data.meta.note) : undefined}
      >
        {body}
      </ChartWidgetCard>
    </div>
  );
}
