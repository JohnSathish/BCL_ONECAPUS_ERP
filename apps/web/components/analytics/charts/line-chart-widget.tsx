'use client';

import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/dashboard/chart-container';
import type { ChartSeriesPoint } from '@/types/dashboard-analytics';

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
};

type LineSeries = { key: string; name: string; color: string; dashed?: boolean };

const DEFAULT_LINES: LineSeries[] = [
  { key: 'value', name: 'Value', color: 'var(--institution-primary, hsl(var(--primary)))' },
];

type Props = {
  data: ChartSeriesPoint[];
  height?: number;
  lines?: LineSeries[];
};

export function LineChartWidget({ data, height = 260, lines }: Props) {
  const series = lines ?? DEFAULT_LINES;

  return (
    <ChartContainer height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            strokeDasharray={s.dashed ? '4 4' : undefined}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
