export const KPI_METRICS = [
  {
    id: 'students',
    label: 'Total Students',
    value: 12847,
    change: 4.2,
    trend: 'up' as const,
    context: 'vs last semester',
    sparkline: [42, 48, 45, 52, 58, 61, 64],
  },
  {
    id: 'faculty',
    label: 'Active Faculty',
    value: 842,
    change: 1.8,
    trend: 'up' as const,
    context: 'on campus today',
    sparkline: [38, 39, 40, 41, 40, 42, 42],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    value: 91.4,
    suffix: '%',
    change: -0.6,
    trend: 'down' as const,
    context: 'institution average',
    sparkline: [93, 92, 91, 92, 91, 90, 91],
  },
  {
    id: 'fees',
    label: 'Fee Collection',
    value: 78.2,
    suffix: '%',
    change: 6.1,
    trend: 'up' as const,
    context: 'this academic year',
    sparkline: [62, 65, 68, 71, 74, 76, 78],
  },
  {
    id: 'placement',
    label: 'Placement Rate',
    value: 86.5,
    suffix: '%',
    change: 3.4,
    trend: 'up' as const,
    context: 'final year cohort',
    sparkline: [72, 74, 78, 80, 83, 85, 86],
  },
  {
    id: 'grievances',
    label: 'Pending Grievances',
    value: 23,
    change: -12,
    trend: 'up' as const,
    context: 'resolved this week',
    sparkline: [35, 32, 30, 28, 26, 24, 23],
  },
  {
    id: 'completion',
    label: 'Course Completion',
    value: 88.9,
    suffix: '%',
    change: 2.1,
    trend: 'up' as const,
    context: 'CBCS progress',
    sparkline: [82, 84, 85, 86, 87, 88, 89],
  },
  {
    id: 'hostel',
    label: 'Hostel Occupancy',
    value: 94.1,
    suffix: '%',
    change: 0.3,
    trend: 'up' as const,
    context: 'all residences',
    sparkline: [91, 92, 93, 93, 94, 94, 94],
  },
];

export const ENROLLMENT_TREND = [
  { month: 'Aug', students: 11200, target: 11500 },
  { month: 'Sep', students: 11850, target: 12000 },
  { month: 'Oct', students: 12100, target: 12200 },
  { month: 'Nov', students: 12340, target: 12400 },
  { month: 'Dec', students: 12580, target: 12600 },
  { month: 'Jan', students: 12720, target: 12800 },
  { month: 'Feb', students: 12847, target: 13000 },
];

export const REVENUE_TREND = [
  { month: 'Aug', collected: 4.2, due: 5.1 },
  { month: 'Sep', collected: 5.8, due: 6.2 },
  { month: 'Oct', collected: 6.4, due: 6.8 },
  { month: 'Nov', collected: 7.1, due: 7.4 },
  { month: 'Dec', collected: 7.8, due: 8.0 },
  { month: 'Jan', collected: 8.4, due: 8.6 },
  { month: 'Feb', collected: 8.9, due: 9.2 },
];

export const DEPARTMENT_PERFORMANCE = [
  { dept: 'CSE', score: 92 },
  { dept: 'ECE', score: 88 },
  { dept: 'MECH', score: 85 },
  { dept: 'MBA', score: 90 },
  { dept: 'LAW', score: 87 },
];

export type AiInsightPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE_SIGNAL';

export type AiInsightTrend = 'worsening' | 'improving' | 'stable';

export type AiInsightCategory =
  | 'attendance'
  | 'finance'
  | 'academic'
  | 'infrastructure'
  | 'timetable'
  | 'admissions'
  | 'staff'
  | 'students';

export type AiCampusInsight = {
  id: string;
  category: AiInsightCategory;
  priority: AiInsightPriority;
  title: string;
  summary: string;
  confidence: number;
  trend: AiInsightTrend;
  impact: string;
  updatedAt: string;
  action: string;
  href: string;
  sparkline: number[];
  affectedEntities: string[];
  predictions: string[];
  recommendations: string[];
  reasoning: string;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

export const AI_INSIGHTS: AiCampusInsight[] = [
  {
    id: 'attendance-risk',
    category: 'attendance',
    priority: 'CRITICAL',
    title: 'Attendance deficit prediction',
    summary: '124 students across 6 departments may fall below 75% within two weeks.',
    confidence: 94,
    trend: 'worsening',
    impact: 'High student compliance risk',
    updatedAt: minutesAgo(2),
    action: 'Review cases',
    href: '/admin/staff/attendance/reports',
    sparkline: [82, 80, 78, 76, 74, 72, 69],
    affectedEntities: ['Commerce', 'Arts Sem 1', 'Science Sem 3'],
    predictions: [
      '38 students likely to cross deficit threshold this week.',
      'Morning shift absence velocity is 1.4x higher than day shift.',
    ],
    recommendations: [
      'Trigger attendance advisory notifications.',
      'Ask departments to verify timetable-attendance mappings.',
    ],
    reasoning:
      'The model combines rolling attendance, current semester pace, and unresolved missing-punch records.',
  },
  {
    id: 'fee-decline',
    category: 'finance',
    priority: 'HIGH',
    title: 'Fee collection decline',
    summary: 'Collections dropped 8% week-over-week in FYUGP Commerce and Arts blocks.',
    confidence: 88,
    trend: 'worsening',
    impact: 'Cash-flow follow-up required',
    updatedAt: minutesAgo(8),
    action: 'Open collections',
    href: '/admin/reports',
    sparkline: [79, 81, 78, 75, 73, 71, 70],
    affectedEntities: ['Commerce', 'BA Garo', 'BA Economics'],
    predictions: [
      'Projected month-end collection may close 5.2% below target.',
      'Installment reminders can recover an estimated 31% of overdue amount.',
    ],
    recommendations: [
      'Send targeted reminders to overdue cohorts.',
      'Review waiver and installment approvals pending over 72 hours.',
    ],
    reasoning:
      'The signal compares expected collection pace, overdue balances, and historical payment recovery patterns.',
  },
  {
    id: 'department-performance',
    category: 'academic',
    priority: 'POSITIVE_SIGNAL',
    title: 'Academic performance lift',
    summary:
      'Mechanical and Science departments show improved OBE attainment after mapping updates.',
    confidence: 91,
    trend: 'improving',
    impact: 'Positive academic quality signal',
    updatedAt: minutesAgo(14),
    action: 'View report',
    href: '/admin/academic-engine/curriculum-completion',
    sparkline: [71, 73, 78, 80, 84, 87, 90],
    affectedEntities: ['Mechanical', 'Science Faculty', 'OBE Mapping'],
    predictions: ['Completion confidence may rise another 3% if pending mappings close this week.'],
    recommendations: [
      'Replicate mapping workflow to Humanities departments.',
      'Highlight improved departments in academic review.',
    ],
    reasoning:
      'The model detects stronger completion trends after curriculum mapping and outcome alignment updates.',
  },
  {
    id: 'infra-capacity',
    category: 'infrastructure',
    priority: 'MEDIUM',
    title: 'Campus capacity intelligence',
    summary: 'Peak lab utilization suggests adding 2 classrooms or rebalancing Block C schedules.',
    confidence: 86,
    trend: 'stable',
    impact: 'Medium infrastructure planning need',
    updatedAt: minutesAgo(22),
    action: 'Simulate capacity',
    href: '/admin/reports',
    sparkline: [66, 68, 71, 70, 73, 74, 74],
    affectedEntities: ['Block C', 'Computer Lab', 'FYUGP practical batches'],
    predictions: ['Lab pressure will exceed 90% if Science elective intake grows by 12%.'],
    recommendations: [
      'Move two practical blocks to afternoon slots.',
      'Reserve one shared hall for combined MDC classes.',
    ],
    reasoning:
      'The signal uses section capacity, room availability, shift load, and recent timetable demand.',
  },
  {
    id: 'timetable-conflicts',
    category: 'timetable',
    priority: 'HIGH',
    title: 'Timetable conflict risk',
    summary: 'Shared faculty and room allocations may collide in upcoming FYUGP stream routines.',
    confidence: 89,
    trend: 'worsening',
    impact: 'Operational scheduling risk',
    updatedAt: minutesAgo(30),
    action: 'Open timetable',
    href: '/admin/academics/timetable',
    sparkline: [18, 21, 26, 32, 35, 39, 42],
    affectedEntities: ['Arts Day Shift', 'Science Day Shift', 'Shared Hall'],
    predictions: [
      '3 rooms are likely to exceed safe occupancy if combined classes are not merged.',
    ],
    recommendations: [
      'Run validation before publishing routines.',
      'Assign common papers to shared hall blocks.',
    ],
    reasoning:
      'The model compares faculty load, room occupancy, stream grouping, and combined class requirements.',
  },
  {
    id: 'admissions-forecast',
    category: 'admissions',
    priority: 'LOW',
    title: 'Admissions pipeline forecast',
    summary:
      'Application velocity is stable, with mild growth expected in Arts and Commerce streams.',
    confidence: 82,
    trend: 'stable',
    impact: 'Low risk monitoring signal',
    updatedAt: minutesAgo(42),
    action: 'Analyze trend',
    href: '/admin/admissions',
    sparkline: [40, 44, 43, 45, 47, 47, 48],
    affectedEntities: ['Arts', 'Commerce', 'BA Garo'],
    predictions: ['Final admission count may land within 96-102% of current target.'],
    recommendations: [
      'Keep merit list publishing cadence unchanged.',
      'Monitor programme-specific seat pressure weekly.',
    ],
    reasoning:
      'The forecast blends application count, conversion rate, and historical acceptance movement.',
  },
  {
    id: 'staff-load',
    category: 'staff',
    priority: 'MEDIUM',
    title: 'Faculty utilization alert',
    summary:
      'Several faculty workloads are trending near safe upper limits after new subject assignments.',
    confidence: 84,
    trend: 'worsening',
    impact: 'Medium faculty load pressure',
    updatedAt: minutesAgo(50),
    action: 'Review workload',
    href: '/admin/staff/workload',
    sparkline: [62, 66, 68, 72, 74, 77, 79],
    affectedEntities: ['English', 'Garo', 'Computer Science'],
    predictions: [
      'Two departments may exceed balanced workload targets once timetable slots are finalized.',
    ],
    recommendations: [
      'Review shared AEC assignments.',
      'Redistribute tutorial blocks before approval.',
    ],
    reasoning:
      'The signal correlates faculty assignments, timetable slot demand, and practical/tutorial load.',
  },
  {
    id: 'student-success',
    category: 'students',
    priority: 'POSITIVE_SIGNAL',
    title: 'Student success improvement',
    summary:
      'Registration completion and curriculum mapping activity indicate improved semester readiness.',
    confidence: 90,
    trend: 'improving',
    impact: 'Positive readiness signal',
    updatedAt: minutesAgo(60),
    action: 'View students',
    href: '/admin/students',
    sparkline: [55, 61, 66, 70, 76, 81, 85],
    affectedEntities: ['Semester 1', 'Semester 3', 'Subject Registration'],
    predictions: ['Readiness score may cross 90% if pending baskets are approved by Friday.'],
    recommendations: [
      'Clear pending student registration approvals.',
      'Prioritize students with incomplete MDC/SEC choices.',
    ],
    reasoning:
      'The model weighs registration completion, academic mapping, and unresolved basket choices.',
  },
];

export const ACTIVITY_FEED = [
  {
    id: '1',
    type: 'admission',
    title: '42 admissions approved',
    time: '12 min ago',
    meta: 'UG · Don Bosco College Tura',
  },
  {
    id: '2',
    type: 'results',
    title: 'Semester 3 results published',
    time: '45 min ago',
    meta: 'School of Engineering',
  },
  {
    id: '3',
    type: 'timetable',
    title: 'Timetable revision completed',
    time: '1 hr ago',
    meta: 'Faculty of Science',
  },
  {
    id: '4',
    type: 'grievance',
    title: '18 grievances resolved',
    time: '2 hr ago',
    meta: 'Student affairs',
  },
  {
    id: '5',
    type: 'placement',
    title: 'Infosys drive scheduled',
    time: '3 hr ago',
    meta: 'Placement cell',
  },
];

export const NOTIFICATIONS = [
  {
    id: '1',
    title: '3 approvals pending',
    body: 'Leave requests require your sign-off before EOD.',
    time: '5m',
    unread: true,
    category: 'approval',
  },
  {
    id: '2',
    title: 'Examination schedule draft',
    body: 'End-semester timetable ready for review.',
    time: '1h',
    unread: true,
    category: 'exam',
  },
  {
    id: '3',
    title: 'AI recommendation',
    body: 'Consider enabling ABC credit transfer for 2 partner institutions.',
    time: '2h',
    unread: false,
    category: 'ai',
  },
  {
    id: '4',
    title: 'Fee dues reminder',
    body: '214 students have installments due this week.',
    time: '4h',
    unread: true,
    category: 'finance',
  },
];

export const DASHBOARD_RECENT_ADMISSIONS = [
  {
    id: '1',
    application: 'BCA-2026-0001',
    applicant: 'Rahul Sharma',
    program: 'BCA',
    score: '92.5',
    status: 'shortlisted',
  },
  {
    id: '2',
    application: 'BCA-2026-0002',
    applicant: 'Priya Nair',
    program: 'BCA',
    score: '89.2',
    status: 'submitted',
  },
  {
    id: '3',
    application: 'BCA-2026-0003',
    applicant: 'Amit Patel',
    program: 'BCA',
    score: '87.8',
    status: 'shortlisted',
  },
  {
    id: '4',
    application: 'BCA-2026-0004',
    applicant: 'Sneha Reddy',
    program: 'BCA',
    score: '85.1',
    status: 'submitted',
  },
  {
    id: '5',
    application: 'BCA-2026-0005',
    applicant: 'Vikram Singh',
    program: 'BCA',
    score: '83.4',
    status: 'submitted',
  },
];

export const DASHBOARD_PENDING_APPROVALS = [
  {
    id: '1',
    request: 'Leave approval',
    owner: 'Dr. Mehta',
    module: 'HR',
    due: 'Today',
    priority: 'high',
  },
  {
    id: '2',
    request: 'Merit list publish',
    owner: 'Admissions',
    module: 'Admissions',
    due: 'Tomorrow',
    priority: 'medium',
  },
  {
    id: '3',
    request: 'Fee waiver',
    owner: 'Finance',
    module: 'Fees',
    due: '2 days',
    priority: 'medium',
  },
];

export const DASHBOARD_FEE_DUES = [
  {
    id: '1',
    student: 'Ananya Iyer',
    program: 'BCA',
    amount: '₹42,000',
    dueDate: '18 May',
    status: 'due',
  },
  {
    id: '2',
    student: 'Rohan Das',
    program: 'MBA',
    amount: '₹68,500',
    dueDate: '15 May',
    status: 'overdue',
  },
  {
    id: '3',
    student: 'Kavya Menon',
    program: 'B.Tech',
    amount: '₹55,200',
    dueDate: '20 May',
    status: 'due',
  },
];

export const COMMAND_ITEMS = [
  { group: 'Students', items: ['Rahul Sharma · EN2024001', 'Priya Nair · EN2024088'] },
  { group: 'Faculty', items: ['Dr. Ananya Iyer', 'Prof. Vikram Mehta'] },
  { group: 'Courses', items: ['CS101 Programming', 'MA201 Linear Algebra'] },
  { group: 'Fees', items: ['Fee structure 2026', 'Pending collections report'] },
  { group: 'Reports', items: ['Attendance summary', 'Placement analytics'] },
];
