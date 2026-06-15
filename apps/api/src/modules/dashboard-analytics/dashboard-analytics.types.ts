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

export type OperationsActionItem = {
  id: string;
  icon: string;
  message: string;
  href: string;
  priority: 'critical' | 'high' | 'medium';
  count?: number;
};

export type OperationsCenterResponse = {
  greeting: {
    userName: string;
    dateLabel: string;
    dayLabel: string;
  };
  institution: {
    academicYear: string;
    semester: string;
    cycle: string | null;
    studentCount: number;
    staffCount: number;
  };
  actions: OperationsActionItem[];
  upcomingEvents: Array<{ date: string; label: string; href?: string }>;
  academic: {
    classesScheduled: number;
    classesCompleted: number;
    classesPending: number;
    facultyPresent: number;
    facultyAbsent: number;
    facultyAttendancePct: number;
    studentAttendancePct: number;
    studentsPresent: number;
    studentsAbsent: number;
    dataSource: 'live' | 'estimated';
  };
  finance: {
    todayCollection: number;
    monthCollection: number;
    pendingDues: number;
    defaulters: number;
    collectionRate: number;
    monthlyTuitionPending: number;
    collectionSparkline: number[];
  };
  pulse: {
    urgentActions: number;
    attendanceTodayPct: number;
    collectionRate: number;
    pendingDues: number;
  };
  admissions: {
    seasonOpen: boolean;
    received: number;
    submitted: number;
    approved: number;
    pendingReview: number;
    rejected: number;
    seatsRemaining: number;
    totalSeats: number;
    seatsFilled: number;
    completionPct: number;
  } | null;
  examinations: {
    marksPending: number;
    resultsPending: number;
    hallTicketsPct: number;
    notEligible: number;
    daysToExams: number | null;
  };
  communication: {
    smsToday: number;
    whatsappToday: number;
    unreadNotifications: number;
    pendingCirculars: number;
  };
  announcements: Array<{ title: string; date: string; href?: string }>;
  departments: Array<{
    name: string;
    students: number;
    attendancePct: number | null;
  }>;
  aiInsights: string[];
  updatedAt: string;
};
