'use client';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import type { ReportBucket } from '@/services/student-reports';

function toChartData(buckets: ReportBucket[]) {
  return buckets.map((b) => ({ label: b.label, value: b.count }));
}

type Props = {
  title: string;
  total: number;
  buckets: ReportBucket[];
  crossTabs?: { label: string; buckets: ReportBucket[] }[];
  extra?: React.ReactNode;
};

export function DistributionReportPanel({ title, total, buckets, crossTabs, extra }: Props) {
  const chartData = toChartData(buckets.slice(0, 12));

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <CompactCard className="lg:col-span-4">
        <CompactCardHeader title={title} description={`Total: ${total.toLocaleString()}`} />
        <CompactCardBody>
          {extra}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Count</th>
                  <th className="pb-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.key} className="border-b border-border/40">
                    <td className="py-1.5">{b.label}</td>
                    <td className="py-1.5 tabular-nums">{b.count.toLocaleString()}</td>
                    <td className="py-1.5 tabular-nums">{b.percentage ?? '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CompactCardBody>
      </CompactCard>

      <CompactCard className="lg:col-span-4">
        <CompactCardHeader title="Bar Chart" />
        <CompactCardBody>
          {chartData.length ? (
            <BarChartWidget data={chartData} height={280} />
          ) : (
            <p className="text-sm text-muted-foreground">No data for selected filters.</p>
          )}
        </CompactCardBody>
      </CompactCard>

      <CompactCard className="lg:col-span-4">
        <CompactCardHeader title="Distribution" />
        <CompactCardBody>
          {chartData.length ? (
            <DonutChartWidget data={chartData} height={280} />
          ) : (
            <p className="text-sm text-muted-foreground">No data for selected filters.</p>
          )}
        </CompactCardBody>
      </CompactCard>

      {crossTabs?.map((tab) => (
        <CompactCard key={tab.label} className="lg:col-span-6">
          <CompactCardHeader title={tab.label} />
          <CompactCardBody>
            <BarChartWidget
              data={toChartData(tab.buckets.slice(0, 15))}
              height={220}
              layout="vertical"
            />
          </CompactCardBody>
        </CompactCard>
      ))}
    </div>
  );
}
