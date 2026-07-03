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
  /** Max characters for category labels before ellipsis. */
  labelMaxChars?: number;
};

function truncateLabel(label: string, maxChars: number) {
  const text = String(label ?? '').trim();
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(4, maxChars - 1))}…`;
}

export function BarChartWidget({
  data,
  height = 260,
  layout = 'horizontal',
  dataKey = 'value',
  color = 'var(--institution-primary, hsl(var(--primary)))',
  labelMaxChars,
}: Props) {
  if (layout === 'vertical') {
    const count = Math.max(data.length, 1);
    // Enough vertical room per bar so Y-axis labels never stack on each other.
    const rowHeight = count > 12 ? 26 : count > 8 ? 30 : 34;
    const chartHeight = Math.max(height, count * rowHeight + 48);
    const longest = data.reduce((max, point) => Math.max(max, String(point.label ?? '').length), 0);
    const maxChars = labelMaxChars ?? (longest > 36 ? 34 : 40);
    const yAxisWidth = Math.min(220, Math.max(120, Math.round(maxChars * 6.2)));

    return (
      <ChartContainer height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 20, left: 4, bottom: 8 }}
          barCategoryGap={count > 10 ? '18%' : '22%'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisWidth}
            interval={0}
            tick={{ fontSize: count > 12 ? 10 : 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value: string) => truncateLabel(value, maxChars)}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number | string) => [value, 'Students']}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
          interval={0}
          angle={data.length > 4 ? -20 : 0}
          textAnchor={data.length > 4 ? 'end' : 'middle'}
          height={data.length > 4 ? 48 : 28}
          tickFormatter={(value: string) =>
            truncateLabel(value, labelMaxChars ?? (data.length > 8 ? 14 : 22))
          }
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
