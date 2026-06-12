'use client';

import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer } from '@/components/dashboard/chart-container';
import {
  DEPARTMENT_PERFORMANCE,
  ENROLLMENT_TREND,
  REVENUE_TREND,
} from '@/modules/dashboard/mock-data';

export function AnalyticsCharts() {
  return (
    <div className="grid w-full grid-cols-12 gap-4 md:gap-6">
      <ChartCard
        title="Student enrollment"
        description="Actual vs target intake"
        className="col-span-12 lg:col-span-6"
      >
        <ChartContainer height={260}>
          <LineChart data={ENROLLMENT_TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="students"
              name="Enrolled"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="target"
              name="Target"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Revenue analytics"
        description="Collected vs due (₹ Cr)"
        className="col-span-12 lg:col-span-6"
      >
        <ChartContainer height={260}>
          <BarChart data={REVENUE_TREND}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
              }}
            />
            <Legend />
            <Bar
              dataKey="collected"
              name="Collected"
              fill="hsl(var(--primary))"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="due"
              name="Due"
              fill="hsl(var(--accent))"
              radius={[6, 6, 0, 0]}
              opacity={0.65}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Department performance"
        description="Composite academic score index"
        className="col-span-12"
      >
        <ChartContainer height={240}>
          <BarChart data={DEPARTMENT_PERFORMANCE} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="dept" tick={{ fontSize: 12 }} width={48} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
              }}
            />
            <Bar dataKey="score" name="Score" fill="url(#deptGradient)" radius={[0, 8, 8, 0]} />
            <defs>
              <linearGradient id="deptGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card min-w-0 rounded-2xl p-5 ${className ?? ''}`}
    >
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </motion.div>
  );
}
