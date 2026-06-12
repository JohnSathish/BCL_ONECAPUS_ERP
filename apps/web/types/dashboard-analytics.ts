export type DashboardDataSource = 'live' | 'seed';

export type DashboardFilters = {
  academicYearId?: string;
  semesterId?: string;
  shiftId?: string;
  departmentId?: string;
  programVersionId?: string;
  campusId?: string;
  institutionId?: string;
};

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

export type DashboardOverview = {
  kpis: DashboardKpiMetric[];
  updatedAt: string;
};

export type ChartSeriesPoint = {
  label: string;
  value: number;
  [key: string]: string | number;
};

export type DashboardChart = {
  widgetId: string;
  chartType: 'bar' | 'line' | 'stackedBar' | 'donut' | 'heatmap' | 'list';
  source: DashboardDataSource;
  series: ChartSeriesPoint[];
  meta?: Record<string, unknown>;
};

export type ShiftIntelligence = {
  enrollment: ChartSeriesPoint[];
  occupancy: ChartSeriesPoint[];
  attendanceByShift: ChartSeriesPoint[];
  facultyLoad: { row: string; col: string; value: number }[];
  revenue: ChartSeriesPoint[];
  source: DashboardDataSource;
  updatedAt: string;
};

export const DASHBOARD_CHART_WIDGETS = [
  'department-admissions',
  'fee-collection-trend',
  'shift-attendance',
  'shift-enrollment',
  'registration-completion',
  'section-utilization',
  'pending-approvals',
] as const;

export type DashboardChartWidgetId = (typeof DASHBOARD_CHART_WIDGETS)[number];
