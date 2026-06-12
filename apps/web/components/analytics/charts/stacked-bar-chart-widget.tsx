'use client';

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
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
  stackKeys: string[];
  colors: string[];
};

/** Expects long-format rows: label + stack key field + value */
export function StackedBarChartWidget({ data, height = 260, stackKeys, colors }: Props) {
  const labels = [...new Set(data.map((d) => d.label))];
  const pivoted = labels.map((label) => {
    const row: ChartSeriesPoint = { label, value: 0 };
    for (const key of stackKeys) {
      const match = data.find((d) => d.label === label && d.stack === key);
      row[key] = match?.value ?? 0;
    }
    return row;
  });

  return (
    <ChartContainer height={height}>
      <BarChart data={pivoted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {stackKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="a"
            fill={colors[i] ?? 'hsl(var(--primary))'}
            radius={i === stackKeys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
