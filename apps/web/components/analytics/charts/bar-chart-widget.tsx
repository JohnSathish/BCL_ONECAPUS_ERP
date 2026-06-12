'use client';

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/dashboard/chart-container';
import type { ChartSeriesPoint } from '@/types/dashboard-analytics';

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
};

type Props = {
  data: ChartSeriesPoint[];
  height?: number;
  layout?: 'vertical' | 'horizontal';
  dataKey?: string;
  color?: string;
};

export function BarChartWidget({
  data,
  height = 260,
  layout = 'horizontal',
  dataKey = 'value',
  color = 'var(--institution-primary, hsl(var(--primary)))',
}: Props) {
  if (layout === 'vertical') {
    return (
      <ChartContainer height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            type="category"
            dataKey="label"
            width={56}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
