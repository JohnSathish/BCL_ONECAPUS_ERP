export type DashboardDataSource = 'live' | 'seed';

export type DashboardKpiMetric = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  changePct: number;
  trend: 'up' | 'down';
  context: string;
  sparkline: number[];
  source: DashboardDataSource;
};

export type DashboardOverviewResponse = {
  kpis: DashboardKpiMetric[];
  updatedAt: string;
};

export type ChartSeriesPoint = {
  label: string;
  value: number;
  [key: string]: string | number;
};

export type DashboardChartResponse = {
  widgetId: string;
  chartType: 'bar' | 'line' | 'stackedBar' | 'donut' | 'heatmap' | 'list';
  source: DashboardDataSource;
  series: ChartSeriesPoint[];
  meta?: Record<string, unknown>;
};

export type ShiftIntelligenceResponse = {
  enrollment: ChartSeriesPoint[];
  occupancy: ChartSeriesPoint[];
  attendanceByShift: ChartSeriesPoint[];
  facultyLoad: { row: string; col: string; value: number }[];
  revenue: ChartSeriesPoint[];
  source: DashboardDataSource;
  updatedAt: string;
};
