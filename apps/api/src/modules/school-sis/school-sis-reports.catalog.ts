export type ReportModule =
  | 'dashboard'
  | 'student'
  | 'attendance'
  | 'academic'
  | 'fees'
  | 'admission'
  | 'staff'
  | 'transport'
  | 'library'
  | 'inventory'
  | 'communication'
  | 'management'
  | 'custom'
  | 'saved'
  | 'scheduled'
  | 'templates'
  | 'audit';

export type ReportFilterKey =
  | 'academicYearId'
  | 'gradeId'
  | 'sectionId'
  | 'studentId'
  | 'gender'
  | 'category'
  | 'dateFrom'
  | 'dateTo'
  | 'month'
  | 'examId'
  | 'subjectId'
  | 'paymentMode'
  | 'collectedById'
  | 'staffId'
  | 'department'
  | 'routeId'
  | 'vehicleId'
  | 'status';

export type ReportDef = {
  key: string;
  title: string;
  description: string;
  module: ReportModule;
  filters: ReportFilterKey[];
  sensitive?: boolean;
  emptyHint?: string;
};

export const REPORT_MODULES: { id: ReportModule; label: string }[] = [
  { id: 'dashboard', label: 'Reports Dashboard' },
  { id: 'student', label: 'Student Reports' },
  { id: 'attendance', label: 'Attendance Reports' },
  { id: 'academic', label: 'Academic / Examination' },
  { id: 'fees', label: 'Fee & Finance' },
  { id: 'admission', label: 'Admission Reports' },
  { id: 'staff', label: 'Staff & HR' },
  { id: 'transport', label: 'Transport Reports' },
  { id: 'library', label: 'Library Reports' },
  { id: 'inventory', label: 'Inventory Reports' },
  { id: 'communication', label: 'Communication Reports' },
  { id: 'management', label: 'Management / MIS' },
  { id: 'custom', label: 'Custom Report Builder' },
  { id: 'saved', label: 'Saved Reports' },
  { id: 'scheduled', label: 'Scheduled Reports' },
  { id: 'templates', label: 'Report Templates' },
  { id: 'audit', label: 'Report Activity / Audit' },
];

const F_STUDENT: ReportFilterKey[] = [
  'academicYearId',
  'gradeId',
  'sectionId',
  'gender',
  'category',
  'status',
];
const F_ATT: ReportFilterKey[] = [
  'academicYearId',
  'gradeId',
  'sectionId',
  'dateFrom',
  'dateTo',
];
const F_FEE: ReportFilterKey[] = [
  'academicYearId',
  'gradeId',
  'sectionId',
  'paymentMode',
  'collectedById',
  'dateFrom',
  'dateTo',
];
const F_EXAM: ReportFilterKey[] = [
  'academicYearId',
  'gradeId',
  'sectionId',
  'examId',
  'subjectId',
];

function r(
  module: ReportModule,
  key: string,
  title: string,
  description: string,
  filters: ReportFilterKey[],
  extra?: Partial<ReportDef>,
): ReportDef {
  return { module, key, title, description, filters, ...extra };
}

export const REPORT_CATALOG: ReportDef[] = [
  r(
    'student',
    'student_master',
    'Student Master List',
    'All enrolled students with class and section.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_strength',
    'Student Strength Report',
    'Headcount by status for the selected year.',
    ['academicYearId'],
  ),
  r(
    'student',
    'student_class_strength',
    'Class-wise Student Strength',
    'Enrollment counts by class.',
    ['academicYearId'],
  ),
  r(
    'student',
    'student_section_strength',
    'Section-wise Strength',
    'Enrollment counts by section.',
    ['academicYearId', 'gradeId'],
  ),
  r(
    'student',
    'student_gender',
    'Gender-wise Strength',
    'Students grouped by gender.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_category',
    'Category-wise Strength',
    'Students grouped by category.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_age',
    'Age-wise Student Report',
    'Age bands from date of birth.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_dob',
    'Date of Birth Report',
    'Student birthdays.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_new',
    'New Admission Report',
    'Enrollments created in the date range.',
    [...F_STUDENT, 'dateFrom', 'dateTo'],
  ),
  r(
    'student',
    'student_readmit',
    'Re-admission Report',
    'Enrollment events marked as re-admission.',
    [...F_STUDENT, 'dateFrom', 'dateTo'],
  ),
  r(
    'student',
    'student_withdrawn',
    'Withdrawn Students',
    'Students with withdrawn or left status.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_transfer',
    'Transfer Students',
    'Enrollment transfer events.',
    [...F_STUDENT, 'dateFrom', 'dateTo'],
  ),
  r(
    'student',
    'student_active',
    'Active Students',
    'Currently active enrollments.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_inactive',
    'Inactive Students',
    'Inactive or archived students.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_contacts',
    'Student Contact List',
    'Student phones and emails.',
    F_STUDENT,
    { sensitive: true },
  ),
  r(
    'student',
    'student_guardians',
    'Parent / Guardian Report',
    'Primary guardians.',
    F_STUDENT,
    { sensitive: true },
  ),
  r(
    'student',
    'student_address',
    'Student Address Report',
    'Current address lines.',
    F_STUDENT,
    { sensitive: true },
  ),
  r(
    'student',
    'student_documents',
    'Student Document Status',
    'Document slots and verification.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_profile',
    'Student Profile Report',
    'Core profile fields.',
    F_STUDENT,
  ),
  r(
    'student',
    'student_history',
    'Student Complete History',
    'Enrollment events for a student.',
    ['studentId', 'academicYearId'],
  ),
  r(
    'student',
    'student_promotion',
    'Student Promotion Report',
    'Promotion enrollment events.',
    ['academicYearId', 'dateFrom', 'dateTo'],
  ),
  r(
    'student',
    'student_retention',
    'Student Retention Report',
    'Year-on-year continuing students.',
    ['academicYearId'],
  ),
  r(
    'student',
    'student_migration',
    'Student Migration Report',
    'Section or class changes.',
    ['academicYearId', 'dateFrom', 'dateTo'],
  ),

  r(
    'attendance',
    'attendance_daily',
    'Daily Attendance',
    'Daily present / absent / leave / late.',
    F_ATT,
    {
      emptyHint:
        'Daily attendance capture is not live in this school yet. Thresholds are still configurable.',
    },
  ),
  r(
    'attendance',
    'attendance_monthly',
    'Monthly Attendance',
    'Month summary by class.',
    [...F_ATT, 'month'],
  ),
  r(
    'attendance',
    'attendance_range',
    'Date Range Attendance',
    'Attendance between two dates.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_class',
    'Class Attendance',
    'Class comparison.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_section',
    'Section Attendance',
    'Section comparison.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_student',
    'Student Attendance',
    'Per-student register.',
    [...F_ATT, 'studentId'],
  ),
  r(
    'attendance',
    'attendance_subject',
    'Subject Attendance',
    'Period attendance when captured.',
    [...F_ATT, 'subjectId'],
  ),
  r(
    'attendance',
    'attendance_teacher',
    'Teacher Attendance',
    'Staff attendance.',
    ['dateFrom', 'dateTo', 'staffId'],
  ),
  r(
    'attendance',
    'attendance_staff',
    'Staff Attendance',
    'Non-teaching attendance.',
    ['dateFrom', 'dateTo', 'staffId'],
  ),
  r(
    'attendance',
    'attendance_register',
    'Attendance Register',
    'Printable class register.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_absentees',
    'Absentee List',
    'Students marked absent.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_absentees_daily',
    'Daily Absentee List',
    'Absentees for one day.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_absentees_monthly',
    'Monthly Absentee List',
    'Absentees in a month.',
    [...F_ATT, 'month'],
  ),
  r(
    'attendance',
    'attendance_chronic',
    'Chronic Absenteeism',
    'Students below the school threshold for an extended period.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_low',
    'Low Attendance Students',
    'Below the configured minimum attendance %.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_percent',
    'Attendance Percentage',
    'Present days / working days.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_trend',
    'Attendance Trend',
    'Month-wise attendance %.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_class_compare',
    'Class Comparison',
    'Class attendance side by side.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_section_compare',
    'Section Comparison',
    'Section attendance side by side.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_history',
    'Student Attendance History',
    'History for one student.',
    ['studentId', 'academicYearId'],
  ),
  r(
    'attendance',
    'attendance_leave',
    'Leave Report',
    'Approved leave days.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_late',
    'Late Arrival Report',
    'Late marks.',
    F_ATT,
  ),
  r(
    'attendance',
    'attendance_early',
    'Early Departure Report',
    'Early exits.',
    F_ATT,
  ),

  r(
    'academic',
    'exam_result',
    'Exam Result Report',
    'Published results.',
    F_EXAM,
  ),
  r('academic', 'exam_student', 'Student Result', 'One student across exams.', [
    ...F_EXAM,
    'studentId',
  ]),
  r(
    'academic',
    'exam_class',
    'Class Result',
    'Class averages and pass %.',
    F_EXAM,
  ),
  r('academic', 'exam_section', 'Section Result', 'Section averages.', F_EXAM),
  r(
    'academic',
    'exam_subject',
    'Subject Result',
    'Subject-wise averages.',
    F_EXAM,
  ),
  r('academic', 'exam_marksheet', 'Mark Sheet', 'Student mark sheet rows.', [
    ...F_EXAM,
    'studentId',
  ]),
  r(
    'academic',
    'exam_report_card',
    'Report Card',
    'Published report-card snapshot.',
    [...F_EXAM, 'studentId'],
  ),
  r('academic', 'exam_grade', 'Grade Report', 'Grade distribution.', F_EXAM),
  r(
    'academic',
    'exam_pass_fail',
    'Pass / Fail Report',
    'Result status counts.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_subject_avg',
    'Subject-wise Average',
    'Mean marks by subject.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_class_avg',
    'Class Average',
    'Mean percent by class.',
    F_EXAM,
  ),
  r('academic', 'exam_highest', 'Highest Marks', 'Top scores.', F_EXAM),
  r('academic', 'exam_lowest', 'Lowest Marks', 'Lowest scores.', F_EXAM),
  r(
    'academic',
    'exam_rank',
    'Rank / Merit Report',
    'Class and section ranks.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_top',
    'Top Performers',
    'Highest percent students.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_below_pass',
    'Students Below Pass Mark',
    'Uses school pass percent.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_failed',
    'Failed Students',
    'FAIL status results.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_improve',
    'Improvement Required',
    'Below pass or FAIL.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_compare',
    'Exam Performance Comparison',
    'Exam vs exam.',
    F_EXAM,
  ),
  r('academic', 'exam_term_compare', 'Term Comparison', 'Term averages.', [
    'academicYearId',
  ]),
  r(
    'academic',
    'exam_subject_compare',
    'Subject Comparison',
    'Subject vs subject.',
    F_EXAM,
  ),
  r('academic', 'exam_progress', 'Student Progress', 'Percent over exams.', [
    'studentId',
    'academicYearId',
  ]),
  r('academic', 'exam_history', 'Academic History', 'All published results.', [
    'studentId',
  ]),
  r(
    'academic',
    'exam_completion',
    'Marks Entry Completion',
    'Published vs pending exams.',
    ['academicYearId'],
  ),
  r(
    'academic',
    'exam_missing',
    'Missing Marks Report',
    'Students without a result row.',
    F_EXAM,
  ),
  r(
    'academic',
    'exam_absent',
    'Absent in Exam Report',
    'ABSENT result status.',
    F_EXAM,
  ),

  r('fees', 'fee_daily', 'Daily Collection', 'Receipts for a day.', F_FEE),
  r('fees', 'fee_monthly', 'Monthly Collection', 'Receipts in a month.', [
    ...F_FEE,
    'month',
  ]),
  r(
    'fees',
    'fee_range',
    'Date Range Collection',
    'Receipts between dates.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_user_wise',
    'User-wise Collection',
    'Cashier / counter collection by mode.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_cashier',
    'Cashier Collection',
    'Same as user-wise with cash emphasis.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_counter',
    'Counter Collection',
    'Office-channel receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_mode',
    'Payment Mode Collection',
    'Totals by payment mode.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_online',
    'Online Payment Collection',
    'ONLINE / gateway receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_gateway',
    'Gateway Collection',
    'Gateway channel receipts.',
    F_FEE,
  ),
  r('fees', 'fee_cash', 'Cash Collection', 'CASH receipts.', F_FEE),
  r('fees', 'fee_upi', 'UPI Collection', 'UPI receipts.', F_FEE),
  r('fees', 'fee_bank', 'Bank Collection', 'BANK receipts.', F_FEE),
  r('fees', 'fee_cheque', 'Cheque Collection', 'CHEQUE receipts.', F_FEE),
  r('fees', 'fee_card', 'Card Collection', 'CARD receipts.', F_FEE),
  r('fees', 'fee_outstanding', 'Outstanding Fees', 'Due month accounts.', [
    'academicYearId',
    'gradeId',
    'sectionId',
    'status',
  ]),
  r('fees', 'fee_defaulters', 'Defaulters', 'Students with overdue dues.', [
    'academicYearId',
    'gradeId',
    'sectionId',
  ]),
  r(
    'fees',
    'fee_class_outstanding',
    'Class-wise Outstanding',
    'Dues grouped by class.',
    ['academicYearId'],
  ),
  r(
    'fees',
    'fee_student_outstanding',
    'Student-wise Outstanding',
    'Ledger-style dues.',
    ['academicYearId', 'studentId'],
  ),
  r(
    'fees',
    'fee_head_outstanding',
    'Fee Head Outstanding',
    'Due by fee month.',
    ['academicYearId'],
  ),
  r(
    'fees',
    'fee_month_outstanding',
    'Month-wise Outstanding',
    'Due by billing month.',
    ['academicYearId'],
  ),
  r('fees', 'fee_aging', 'Aging Report', 'Outstanding aged by month.', [
    'academicYearId',
  ]),
  r('fees', 'fee_overdue', 'Overdue Report', 'Past due month accounts.', [
    'academicYearId',
    'gradeId',
  ]),
  r('fees', 'fee_trend', 'Collection Trend', 'Month-wise collected totals.', [
    'academicYearId',
  ]),
  r(
    'fees',
    'fee_vs_outstanding',
    'Collection vs Outstanding',
    'Paid versus still due.',
    ['academicYearId'],
  ),
  r(
    'fees',
    'fee_class_collection',
    'Class-wise Collection',
    'Receipts by class.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_head_collection',
    'Fee Head Collection',
    'Receipts by fee month.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_mode_dist',
    'Payment Mode Distribution',
    'Share by mode.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_daily_cashier',
    'Daily Cashier Summary',
    'Per-user totals for a day.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_month_compare',
    'Monthly Collection Comparison',
    'Month vs previous month.',
    ['academicYearId'],
  ),
  r(
    'fees',
    'fee_year_compare',
    'Academic Year Comparison',
    'Year vs previous year.',
    ['academicYearId'],
  ),
  r(
    'fees',
    'fee_concession',
    'Concession Report',
    'Discounted receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_scholarship',
    'Scholarship Report',
    'Scholarship / concession reasons.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_late',
    'Late Fee Report',
    'Late fee amounts on receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_refund',
    'Refund Report',
    'Refunded amounts on receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_cancelled',
    'Cancelled Receipt Report',
    'Voided receipts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_register',
    'Receipt Register',
    'All receipts in range.',
    F_FEE,
  ),
  r('fees', 'fee_ledger', 'Fee Ledger', 'Student month accounts.', [
    'academicYearId',
    'studentId',
  ]),
  r(
    'fees',
    'fee_student_ledger',
    'Student Fee Ledger',
    'One student paid vs due.',
    ['studentId', 'academicYearId'],
  ),
  r(
    'fees',
    'fee_gateway_recon',
    'Gateway Reconciliation',
    'Gateway transactions.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_failed_tx',
    'Failed Transactions',
    'Failed gateway attempts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_pending_online',
    'Pending Online Payments',
    'Pending gateway checkouts.',
    F_FEE,
  ),
  r(
    'fees',
    'fee_cash_closing',
    'Daily Cash Closing',
    'Counter close status from fee cash closes.',
    ['dateFrom', 'dateTo', 'collectedById', 'academicYearId'],
  ),

  r(
    'admission',
    'adm_enquiries',
    'Admission Enquiries',
    'Applications as enquiry pipeline.',
    ['status', 'dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_applications',
    'Applications',
    'All school applications.',
    ['status', 'dateFrom', 'dateTo', 'gender'],
  ),
  r(
    'admission',
    'adm_approved',
    'Approved Applications',
    'Approved applications.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_rejected',
    'Rejected Applications',
    'Rejected applications.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_pending',
    'Pending Applications',
    'Submitted / pending.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_conversion',
    'Admission Conversion',
    'Applications converted to students.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_class',
    'Class-wise Admissions',
    'New enrollments by class.',
    ['academicYearId'],
  ),
  r(
    'admission',
    'adm_gender',
    'Gender-wise Admissions',
    'Applications by gender.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'admission',
    'adm_category',
    'Category-wise Admissions',
    'Students by category among new admits.',
    ['academicYearId'],
  ),
  r(
    'admission',
    'adm_new_vs_re',
    'New vs Re-admission',
    'Enrollment sources.',
    ['academicYearId'],
  ),
  r('admission', 'adm_source', 'Admission Source', 'Enrollment source field.', [
    'academicYearId',
  ]),
  r('admission', 'adm_trend', 'Admission Date Trend', 'Applications by day.', [
    'dateFrom',
    'dateTo',
  ]),
  r('admission', 'adm_withdrawals', 'Withdrawals', 'Withdrawn students.', [
    'academicYearId',
  ]),
  r(
    'admission',
    'adm_cancel',
    'Admission Cancellation',
    'Cancelled applications.',
    ['dateFrom', 'dateTo'],
  ),

  r('staff', 'staff_list', 'Staff List', 'All staff records.', [
    'status',
    'department',
  ]),
  r('staff', 'staff_teaching', 'Teaching Staff', 'TEACHING staff type.', [
    'status',
  ]),
  r('staff', 'staff_nonteaching', 'Non-teaching Staff', 'Non-teaching staff.', [
    'status',
  ]),
  r(
    'staff',
    'staff_department',
    'Department-wise Staff',
    'Counts by department.',
    ['status'],
  ),
  r(
    'staff',
    'staff_attendance',
    'Staff Attendance',
    'Staff daily attendance.',
    ['dateFrom', 'dateTo'],
    { emptyHint: 'Staff attendance capture is not live yet.' },
  ),
  r(
    'staff',
    'staff_leave',
    'Staff Leave',
    'Leave register.',
    ['dateFrom', 'dateTo', 'staffId'],
    {
      emptyHint: 'Leave register is not live yet.',
    },
  ),
  r(
    'staff',
    'staff_late',
    'Staff Late Arrival',
    'Late marks.',
    ['dateFrom', 'dateTo'],
    {
      emptyHint: 'Staff attendance capture is not live yet.',
    },
  ),
  r(
    'staff',
    'staff_hours',
    'Staff Working Hours',
    'Duty hours.',
    ['dateFrom', 'dateTo'],
    {
      emptyHint: 'Working-hour capture is not live yet.',
    },
  ),
  r(
    'staff',
    'staff_payroll',
    'Staff Payroll Summary',
    'Payroll totals.',
    ['month'],
    {
      sensitive: true,
      emptyHint: 'Payroll is not configured for this school yet.',
    },
  ),
  r('staff', 'staff_salary', 'Salary Report', 'Salary lines.', ['month'], {
    sensitive: true,
    emptyHint: 'Payroll is not configured for this school yet.',
  }),
  r(
    'staff',
    'staff_deduction',
    'Deduction Report',
    'Salary deductions.',
    ['month'],
    {
      sensitive: true,
      emptyHint: 'Payroll is not configured for this school yet.',
    },
  ),
  r('staff', 'staff_joining', 'Employee Joining Report', 'Joining dates.', [
    'dateFrom',
    'dateTo',
  ]),
  r('staff', 'staff_exit', 'Employee Exit Report', 'Inactive / exited staff.', [
    'dateFrom',
    'dateTo',
  ]),
  r(
    'staff',
    'staff_ratio',
    'Staff-Student Ratio',
    'Active staff vs active students.',
    ['academicYearId'],
  ),

  r('transport', 'tr_vehicles', 'Vehicle List', 'School vehicles.', ['status']),
  r('transport', 'tr_routes', 'Route List', 'Transport routes.', ['status']),
  r('transport', 'tr_stops', 'Stop List', 'Route stops.', ['routeId']),
  r('transport', 'tr_drivers', 'Driver List', 'Drivers and attendants.', [
    'status',
  ]),
  r('transport', 'tr_alloc', 'Student Allocation', 'Active allocations.', [
    'academicYearId',
    'routeId',
  ]),
  r(
    'transport',
    'tr_route_students',
    'Route-wise Students',
    'Students per route.',
    ['academicYearId'],
  ),
  r(
    'transport',
    'tr_stop_students',
    'Stop-wise Students',
    'Pickup stop occupancy.',
    ['academicYearId', 'routeId'],
  ),
  r(
    'transport',
    'tr_occupancy',
    'Vehicle Occupancy',
    'Allocated vs capacity.',
    ['academicYearId'],
  ),
  r('transport', 'tr_seats', 'Available Seats', 'Remaining seats by vehicle.', [
    'academicYearId',
  ]),
  r('transport', 'tr_fee', 'Transport Fee', 'Fee assignments.', [
    'academicYearId',
  ]),
  r('transport', 'tr_route_fee', 'Route-wise Fee', 'Fee by route.', [
    'academicYearId',
  ]),
  r('transport', 'tr_attendance', 'Transport Attendance', 'Boarding events.', [
    'dateFrom',
    'dateTo',
    'routeId',
  ]),
  r('transport', 'tr_driver_att', 'Driver Attendance', 'Duty assignments.', [
    'dateFrom',
    'dateTo',
  ]),
  r('transport', 'tr_maint', 'Vehicle Maintenance', 'Maintenance logs.', [
    'vehicleId',
    'dateFrom',
    'dateTo',
  ]),
  r('transport', 'tr_fuel', 'Fuel Report', 'Fuel logs.', [
    'vehicleId',
    'dateFrom',
    'dateTo',
  ]),
  r('transport', 'tr_cost', 'Transport Cost Analysis', 'Fuel + expenses.', [
    'dateFrom',
    'dateTo',
  ]),

  r(
    'library',
    'lib_inventory',
    'Book Inventory',
    'Library holdings.',
    ['status'],
    {
      emptyHint: 'Library holdings are not in the school SIS database yet.',
    },
  ),
  r('library', 'lib_available', 'Available Books', 'Copies on shelf.', [], {
    emptyHint: 'Library holdings are not in the school SIS database yet.',
  }),
  r('library', 'lib_issued', 'Issued Books', 'Current issues.', [], {
    emptyHint: 'Circulation is not in the school SIS database yet.',
  }),
  r(
    'library',
    'lib_returned',
    'Returned Books',
    'Returns in range.',
    ['dateFrom', 'dateTo'],
    {
      emptyHint: 'Circulation is not in the school SIS database yet.',
    },
  ),
  r('library', 'lib_overdue', 'Overdue Books', 'Overdue issues.', [], {
    emptyHint: 'Circulation is not in the school SIS database yet.',
  }),
  r(
    'library',
    'lib_fine',
    'Fine Collection',
    'Library fines.',
    ['dateFrom', 'dateTo'],
    {
      emptyHint: 'Library fines are not in the school SIS database yet.',
    },
  ),
  r(
    'library',
    'lib_student',
    'Student-wise Borrowing',
    'Issues by student.',
    ['studentId'],
    {
      emptyHint: 'Circulation is not in the school SIS database yet.',
    },
  ),
  r(
    'library',
    'lib_class',
    'Class-wise Borrowing',
    'Issues by class.',
    ['academicYearId'],
    {
      emptyHint: 'Circulation is not in the school SIS database yet.',
    },
  ),
  r('library', 'lib_popular', 'Most Borrowed Books', 'Issue frequency.', [], {
    emptyHint: 'Circulation is not in the school SIS database yet.',
  }),
  r('library', 'lib_lost', 'Lost Books', 'Lost copies.', [], {
    emptyHint: 'Library holdings are not in the school SIS database yet.',
  }),
  r('library', 'lib_damaged', 'Damaged Books', 'Damaged copies.', [], {
    emptyHint: 'Library holdings are not in the school SIS database yet.',
  }),
  r(
    'library',
    'lib_usage',
    'Library Usage Analytics',
    'Issue trend.',
    ['dateFrom', 'dateTo'],
    {
      emptyHint: 'Circulation is not in the school SIS database yet.',
    },
  ),

  r('inventory', 'inv_stock', 'Current Stock', 'Stationery on hand.', [
    'status',
  ]),
  r('inventory', 'inv_low', 'Low Stock', 'Below minimum stock.', []),
  r('inventory', 'inv_out', 'Out of Stock', 'Zero quantity.', []),
  r('inventory', 'inv_value', 'Stock Valuation', 'Qty × purchase price.', []),
  r('inventory', 'inv_purchase', 'Purchase Report', 'Purchase orders.', [
    'dateFrom',
    'dateTo',
  ]),
  r('inventory', 'inv_receive', 'Receiving Report', 'Received stock.', [
    'dateFrom',
    'dateTo',
  ]),
  r('inventory', 'inv_issue', 'Issue Report', 'POS sales.', [
    'dateFrom',
    'dateTo',
  ]),
  r('inventory', 'inv_return', 'Return Report', 'Returns.', [
    'dateFrom',
    'dateTo',
  ]),
  r('inventory', 'inv_adjust', 'Adjustment Report', 'Stock adjustments.', [
    'dateFrom',
    'dateTo',
  ]),
  r('inventory', 'inv_supplier', 'Supplier Report', 'Suppliers.', ['status']),
  r('inventory', 'inv_movement', 'Product Movement', 'Stock movements.', [
    'dateFrom',
    'dateTo',
  ]),
  r(
    'inventory',
    'inv_category',
    'Category-wise Stock',
    'On-hand by category.',
    [],
  ),

  r(
    'communication',
    'sms_sent',
    'SMS Sent',
    'Outbound SMS (when wired).',
    ['dateFrom', 'dateTo'],
    {
      emptyHint:
        'SMS is not a live school channel yet. WhatsApp and push are available below.',
    },
  ),
  r(
    'communication',
    'wa_sent',
    'WhatsApp Messages Sent',
    'Outbound WhatsApp.',
    ['dateFrom', 'dateTo', 'status'],
  ),
  r(
    'communication',
    'wa_delivered',
    'WhatsApp Delivered',
    'Delivered WhatsApp.',
    ['dateFrom', 'dateTo'],
  ),
  r('communication', 'wa_read', 'WhatsApp Read', 'Read WhatsApp.', [
    'dateFrom',
    'dateTo',
  ]),
  r('communication', 'wa_failed', 'WhatsApp Failed', 'Failed WhatsApp.', [
    'dateFrom',
    'dateTo',
  ]),
  r(
    'communication',
    'wa_campaign',
    'WhatsApp Campaign Report',
    'Campaign totals.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'communication',
    'wa_template',
    'WhatsApp Template Usage',
    'Template send counts.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'communication',
    'push_sent',
    'Push Notifications Sent',
    'Push recipients.',
    ['dateFrom', 'dateTo', 'status'],
  ),
  r('communication', 'push_delivered', 'Push Delivered', 'Delivered push.', [
    'dateFrom',
    'dateTo',
  ]),
  r('communication', 'push_opened', 'Push Opened', 'Opened push.', [
    'dateFrom',
    'dateTo',
  ]),
  r('communication', 'push_failed', 'Push Failed', 'Failed push.', [
    'dateFrom',
    'dateTo',
  ]),

  r(
    'management',
    'mis_strength',
    'School Strength',
    'Active enrollment snapshot.',
    ['academicYearId'],
  ),
  r(
    'management',
    'mis_enroll_trend',
    'Enrollment Trend',
    'Enrollment by month.',
    ['academicYearId'],
  ),
  r(
    'management',
    'mis_att_trend',
    'Attendance Trend',
    'Attendance % by month.',
    ['academicYearId'],
  ),
  r('management', 'mis_fee_collection', 'Fee Collection', 'Year collection.', [
    'academicYearId',
  ]),
  r('management', 'mis_outstanding', 'Outstanding Fees', 'Year outstanding.', [
    'academicYearId',
  ]),
  r(
    'management',
    'mis_academic',
    'Academic Performance',
    'Published exam averages.',
    ['academicYearId'],
  ),
  r('management', 'mis_staff', 'Staff Strength', 'Active staff counts.', []),
  r(
    'management',
    'mis_staff_att',
    'Staff Attendance',
    'Staff attendance KPI.',
    ['dateFrom', 'dateTo'],
  ),
  r(
    'management',
    'mis_adm_trend',
    'Admission Trend',
    'Applications over time.',
    ['dateFrom', 'dateTo'],
  ),
  r('management', 'mis_transport', 'Transport Usage', 'Allocated students.', [
    'academicYearId',
  ]),
  r('management', 'mis_library', 'Library Usage', 'Circulation summary.', [
    'academicYearId',
  ]),
  r(
    'management',
    'mis_inventory',
    'Inventory Summary',
    'Stock value and low stock.',
    [],
  ),
  r(
    'management',
    'mis_revenue',
    'Revenue Summary',
    'Fee + stationery collections.',
    ['academicYearId', 'dateFrom', 'dateTo'],
  ),
  r('management', 'mis_ops', 'Operational Summary', 'Cross-module snapshot.', [
    'academicYearId',
  ]),
  r(
    'management',
    'mis_monthly',
    'Monthly School MIS',
    'Principal multi-section MIS pack.',
    ['academicYearId', 'month'],
  ),
  r(
    'management',
    'principal_daily',
    "Principal's Daily Brief",
    'Today operational brief.',
    ['academicYearId'],
  ),
  r(
    'management',
    'accountant_dash',
    'Accountant Dashboard',
    'Collection and cash close.',
    ['academicYearId', 'dateFrom'],
  ),
  r(
    'management',
    'academic_coord',
    'Academic Coordinator Dashboard',
    'Exams and class averages.',
    ['academicYearId'],
  ),
];

export const CUSTOM_SOURCES = [
  { id: 'STUDENT', label: 'Student' },
  { id: 'ATTENDANCE', label: 'Attendance' },
  { id: 'FEES', label: 'Fees' },
  { id: 'EXAMINATION', label: 'Examination' },
  { id: 'STAFF', label: 'Staff' },
  { id: 'ADMISSION', label: 'Admission' },
  { id: 'TRANSPORT', label: 'Transport' },
  { id: 'LIBRARY', label: 'Library' },
  { id: 'INVENTORY', label: 'Inventory' },
  { id: 'COMMUNICATION', label: 'Communication' },
] as const;

export const CUSTOM_FIELDS: Record<string, { id: string; label: string }[]> = {
  STUDENT: [
    { id: 'admissionNumber', label: 'Admission No' },
    { id: 'fullName', label: 'Student Name' },
    { id: 'gender', label: 'Gender' },
    { id: 'className', label: 'Class' },
    { id: 'sectionName', label: 'Section' },
    { id: 'casteCategory', label: 'Category' },
    { id: 'status', label: 'Status' },
    { id: 'phone', label: 'Phone' },
  ],
  FEES: [
    { id: 'receiptNumber', label: 'Receipt No' },
    { id: 'studentName', label: 'Student' },
    { id: 'paymentMode', label: 'Payment Mode' },
    { id: 'totalAmount', label: 'Amount (₹)' },
    { id: 'paidAt', label: 'Date' },
    { id: 'status', label: 'Status' },
  ],
  EXAMINATION: [
    { id: 'studentName', label: 'Student' },
    { id: 'percent', label: 'Percent' },
    { id: 'grade', label: 'Grade' },
    { id: 'status', label: 'Status' },
    { id: 'totalObtained', label: 'Obtained' },
    { id: 'totalMax', label: 'Maximum' },
  ],
  STAFF: [
    { id: 'employeeCode', label: 'Employee Code' },
    { id: 'fullName', label: 'Name' },
    { id: 'staffType', label: 'Type' },
    { id: 'department', label: 'Department' },
    { id: 'status', label: 'Status' },
  ],
  ADMISSION: [
    { id: 'applicationNumber', label: 'Application No' },
    { id: 'fullName', label: 'Name' },
    { id: 'status', label: 'Status' },
    { id: 'gender', label: 'Gender' },
    { id: 'submittedAt', label: 'Submitted' },
  ],
  TRANSPORT: [
    { id: 'studentName', label: 'Student' },
    { id: 'routeName', label: 'Route' },
    { id: 'status', label: 'Status' },
  ],
  INVENTORY: [
    { id: 'sku', label: 'SKU' },
    { id: 'name', label: 'Product' },
    { id: 'qtyOnHand', label: 'Qty' },
    { id: 'minStock', label: 'Min' },
  ],
  COMMUNICATION: [
    { id: 'status', label: 'Status' },
    { id: 'direction', label: 'Direction' },
    { id: 'createdAt', label: 'Created' },
  ],
  ATTENDANCE: [{ id: 'note', label: 'Note' }],
  LIBRARY: [{ id: 'note', label: 'Note' }],
};

export const REPORT_TEMPLATES = [
  {
    id: 'principal_daily',
    title: "Principal's Daily Brief",
    reportKey: 'principal_daily',
  },
  {
    id: 'accountant_daily',
    title: 'Accountant Daily Report',
    reportKey: 'accountant_dash',
  },
  { id: 'monthly_fee', title: 'Monthly Fee Report', reportKey: 'fee_monthly' },
  {
    id: 'monthly_att',
    title: 'Monthly Attendance Report',
    reportKey: 'attendance_monthly',
  },
  { id: 'exam_result', title: 'Exam Result Report', reportKey: 'exam_result' },
  { id: 'mis', title: 'Management MIS', reportKey: 'mis_monthly' },
  { id: 'admission', title: 'Admission Report', reportKey: 'adm_applications' },
];

export function reportByKey(key: string) {
  return REPORT_CATALOG.find((x) => x.key === key);
}

export const MODULE_FOR_ROLES: Record<string, ReportModule[]> = {
  full: REPORT_MODULES.map((m) => m.id),
  principal: REPORT_MODULES.map((m) => m.id),
  accountant: [
    'dashboard',
    'fees',
    'admission',
    'management',
    'saved',
    'scheduled',
    'templates',
    'audit',
    'custom',
  ],
  teacher: [
    'dashboard',
    'student',
    'attendance',
    'academic',
    'management',
    'saved',
    'templates',
  ],
  librarian: ['dashboard', 'library', 'inventory', 'student', 'saved'],
  transport: ['dashboard', 'transport', 'student', 'saved'],
  hr: ['dashboard', 'staff', 'saved'],
};
