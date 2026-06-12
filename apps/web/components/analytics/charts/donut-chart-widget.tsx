'use client';

import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { ChartContainer } from '@/components/dashboard/chart-container';
import type { ChartSeriesPoint } from '@/types/dashboard-analytics';

const PALETTE = ['hsl(var(--primary))', 'hsl(var(--accent))', '#94a3b8', '#64748b', '#cbd5e1'];

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
};

type Props = {
  data: ChartSeriesPoint[];
  height?: number;
};

export function DonutChartWidget({ data, height = 240 }: Props) {
  return (
    <ChartContainer height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ChartContainer>
  );
}
