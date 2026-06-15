import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LineChart,
  Receipt,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';

export type FeeReportId =
  | 'daily-collection'
  | 'monthly-collection'
  | 'yearly-collection'
  | 'fee-heads'
  | 'defaulters'
  | 'admission-cycles'
  | 'monthly-status'
  | 'payment-modes'
  | 'cash-book'
  | 'cash-register'
  | 'scholarships'
  | 'fines'
  | 'audit'
  | 'outstanding'
  | 'collections'
  | 'reconciliation'
  | 'student-ledger'
  | 'compliance';

export type FeeReportColumn = { key: string; label: string; align?: 'left' | 'right' };

export type FeeReportDefinition = {
  id: FeeReportId;
  label: string;
  description: string;
  apiType: string;
  icon: LucideIcon;
  columns: FeeReportColumn[];
  exportable: boolean;
  link?: string;
  soon?: boolean;
};

export type FeeReportCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  reports: FeeReportDefinition[];
};

export const FEE_REPORT_CATEGORIES: FeeReportCategory[] = [
  {
    id: 'collection',
    label: 'Collection Reports',
    icon: Wallet,
    reports: [
      {
        id: 'daily-collection',
        label: 'Daily Collection',
        description: 'Receipt-wise collections with student, mode, and collector.',
        apiType: 'daily-collection',
        icon: Receipt,
        exportable: true,
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'receiptNo', label: 'Receipt No' },
          { key: 'studentName', label: 'Student' },
          { key: 'enrollmentNumber', label: 'Enrollment' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'mode', label: 'Mode' },
          { key: 'collectedBy', label: 'Collected By' },
        ],
      },
      {
        id: 'monthly-collection',
        label: 'Monthly Collection',
        description: 'Month-wise admission, monthly, fine, and other collections.',
        apiType: 'monthly-collection',
        icon: BarChart3,
        exportable: true,
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'admission', label: 'Admission', align: 'right' },
          { key: 'monthly', label: 'Monthly', align: 'right' },
          { key: 'fine', label: 'Fine', align: 'right' },
          { key: 'other', label: 'Other', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
      },
      {
        id: 'yearly-collection',
        label: 'Yearly Collection',
        description: 'Academic year demand, collected, outstanding, and collection %.',
        apiType: 'yearly-collection',
        icon: LineChart,
        exportable: true,
        columns: [
          { key: 'academicYear', label: 'Academic Year' },
          { key: 'totalDemand', label: 'Total Demand', align: 'right' },
          { key: 'collected', label: 'Collected', align: 'right' },
          { key: 'outstanding', label: 'Outstanding', align: 'right' },
          { key: 'collectionPct', label: 'Collection %', align: 'right' },
        ],
      },
    ],
  },
  {
    id: 'fee-heads',
    label: 'Fee Head Reports',
    icon: Layers,
    reports: [
      {
        id: 'fee-heads',
        label: 'Collection by Fee Head',
        description: 'Audit-ready breakdown by admission, library, development, and other heads.',
        apiType: 'fee-heads',
        icon: FileSpreadsheet,
        exportable: true,
        columns: [
          { key: 'feeHead', label: 'Fee Head' },
          { key: 'code', label: 'Code' },
          { key: 'demanded', label: 'Demanded', align: 'right' },
          { key: 'collected', label: 'Collected', align: 'right' },
          { key: 'outstanding', label: 'Outstanding', align: 'right' },
        ],
      },
    ],
  },
  {
    id: 'student',
    label: 'Student Ledger Reports',
    icon: BookOpen,
    reports: [
      {
        id: 'student-ledger',
        label: 'Student Fee History',
        description: 'Complete ledger, payments, adjustments, and scholarships per student.',
        apiType: 'student-ledger',
        icon: Users,
        exportable: false,
        link: '/admin/fees/ledger',
        columns: [],
      },
    ],
  },
  {
    id: 'defaulters',
    label: 'Defaulter Reports',
    icon: AlertTriangle,
    reports: [
      {
        id: 'defaulters',
        label: 'Defaulter List',
        description: 'Students with outstanding dues, mobile, and months pending.',
        apiType: 'defaulters',
        icon: AlertTriangle,
        exportable: true,
        columns: [
          { key: 'studentName', label: 'Student' },
          { key: 'enrollmentNumber', label: 'Enrollment' },
          { key: 'mobileNumber', label: 'Mobile' },
          { key: 'programme', label: 'Programme' },
          { key: 'amountDue', label: 'Amount Due', align: 'right' },
          { key: 'monthsPending', label: 'Months Pending', align: 'right' },
        ],
      },
      {
        id: 'outstanding',
        label: 'Outstanding Demands',
        description: 'All open fee demands with balances.',
        apiType: 'outstanding',
        icon: ClipboardList,
        exportable: true,
        columns: [
          { key: 'studentName', label: 'Student' },
          { key: 'demandType', label: 'Type' },
          { key: 'billingPeriod', label: 'Period' },
          { key: 'balanceAmount', label: 'Balance', align: 'right' },
        ],
      },
    ],
  },
  {
    id: 'admission',
    label: 'Admission Fee Reports',
    icon: GraduationCap,
    reports: [
      {
        id: 'admission-cycles',
        label: 'Admission Cycle Status',
        description: 'Sem I–II, III–IV, V–VI, VII–VIII collection status.',
        apiType: 'admission-cycles',
        icon: GraduationCap,
        exportable: true,
        columns: [
          { key: 'cycle', label: 'Cycle' },
          { key: 'students', label: 'Students', align: 'right' },
          { key: 'demanded', label: 'Demanded', align: 'right' },
          { key: 'collected', label: 'Collected', align: 'right' },
          { key: 'outstanding', label: 'Outstanding', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
  {
    id: 'monthly',
    label: 'Monthly Fee Reports',
    icon: CalendarClock,
    reports: [
      {
        id: 'monthly-status',
        label: 'Month-wise Paid vs Pending',
        description: 'July through December — paid and pending tuition by month.',
        apiType: 'monthly-status',
        icon: CalendarClock,
        exportable: true,
        columns: [
          { key: 'monthLabel', label: 'Month' },
          { key: 'paid', label: 'Paid', align: 'right' },
          { key: 'pending', label: 'Pending', align: 'right' },
          { key: 'studentsPaid', label: 'Students Paid', align: 'right' },
          { key: 'studentsPending', label: 'Students Pending', align: 'right' },
        ],
      },
    ],
  },
  {
    id: 'payment-modes',
    label: 'Payment Mode Reports',
    icon: Banknote,
    reports: [
      {
        id: 'payment-modes',
        label: 'Mode-wise Collection',
        description: 'Gateway, UPI, cash, SBI iCollect, bank, cheque, scholarship breakdown.',
        apiType: 'payment-modes',
        icon: Banknote,
        exportable: true,
        columns: [
          { key: 'mode', label: 'Payment Mode' },
          { key: 'count', label: 'Transactions', align: 'right' },
          { key: 'amount', label: 'Amount', align: 'right' },
        ],
      },
      {
        id: 'reconciliation',
        label: 'Reconciliation',
        description: 'Cross-check ERP, SBI, bank, QR, and external payments.',
        apiType: 'reconciliation',
        icon: Shield,
        exportable: true,
        columns: [
          { key: 'transactionNo', label: 'Transaction' },
          { key: 'paymentSourceLabel', label: 'Source' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'paidAt', label: 'Paid At' },
        ],
      },
    ],
  },
  {
    id: 'cash',
    label: 'Cash Book Reports',
    icon: Wallet,
    reports: [
      {
        id: 'cash-book',
        label: 'Cash Book',
        description: 'Opening, collections, refunds, adjustments, and closing balance.',
        apiType: 'cash-book',
        icon: BookOpen,
        exportable: true,
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'receiptNo', label: 'Receipt' },
          { key: 'studentName', label: 'Student' },
          { key: 'paymentMode', label: 'Mode' },
          { key: 'amount', label: 'Amount', align: 'right' },
        ],
      },
      {
        id: 'cash-register',
        label: 'Cash Register',
        description: 'Daily cash, cheque, and DD collections at the counter.',
        apiType: 'cash-register',
        icon: Receipt,
        exportable: true,
        link: '/admin/fees/cash-register',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'receiptNo', label: 'Receipt' },
          { key: 'studentName', label: 'Student' },
          { key: 'paymentMode', label: 'Mode' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'collectedBy', label: 'Collector' },
        ],
      },
    ],
  },
  {
    id: 'scholarship',
    label: 'Scholarship & Concession',
    icon: Users,
    reports: [
      {
        id: 'scholarships',
        label: 'Scholarship & Waiver',
        description: 'Approved concessions, amount waived, and remaining balance.',
        apiType: 'scholarships',
        icon: Users,
        exportable: true,
        columns: [
          { key: 'studentName', label: 'Student' },
          { key: 'enrollmentNumber', label: 'Enrollment' },
          { key: 'scholarshipType', label: 'Type' },
          { key: 'amountWaived', label: 'Waived', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
        ],
      },
      {
        id: 'fines',
        label: 'Fine & Penalty',
        description: 'Late fees, penalties, and special charges.',
        apiType: 'fines',
        icon: AlertTriangle,
        exportable: true,
        columns: [
          { key: 'studentName', label: 'Student' },
          { key: 'billingPeriod', label: 'Period' },
          { key: 'lateFee', label: 'Late Fee', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
        ],
      },
    ],
  },
  {
    id: 'audit',
    label: 'Audit & Compliance',
    icon: Shield,
    reports: [
      {
        id: 'audit',
        label: 'Finance Audit Trail',
        description: 'Deleted receipts, reversals, manual entries, and external payments.',
        apiType: 'audit',
        icon: Shield,
        exportable: true,
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'action', label: 'Action' },
          { key: 'reference', label: 'Reference' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'performedAt', label: 'When' },
        ],
      },
      {
        id: 'compliance',
        label: 'Compliance Reports',
        description: 'NAAC, UGC, management, and department compliance packs.',
        apiType: 'compliance',
        icon: FileSpreadsheet,
        exportable: false,
        soon: true,
        columns: [],
      },
    ],
  },
];

export const ALL_FEE_REPORTS = FEE_REPORT_CATEGORIES.flatMap((c) => c.reports);

export const DEFAULT_SAVED_TEMPLATES = [
  { id: 'tpl-defaulters', name: 'My Defaulter Report', reportId: 'defaulters' as FeeReportId },
  {
    id: 'tpl-monthly',
    name: 'Monthly Collection Report',
    reportId: 'monthly-collection' as FeeReportId,
  },
  { id: 'tpl-daily', name: 'Daily Collection Report', reportId: 'daily-collection' as FeeReportId },
];

export const SCHEDULE_PRESETS = [
  { id: 'daily-collection', label: 'Daily Collection Report', frequency: 'Daily' },
  { id: 'weekly-defaulters', label: 'Weekly Defaulter Report', frequency: 'Weekly' },
  { id: 'monthly-finance', label: 'Monthly Finance Report', frequency: 'Monthly' },
];
