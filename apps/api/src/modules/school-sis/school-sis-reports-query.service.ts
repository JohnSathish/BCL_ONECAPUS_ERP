import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CUSTOM_FIELDS,
  MODULE_FOR_ROLES,
  REPORT_CATALOG,
  REPORT_MODULES,
  REPORT_TEMPLATES,
  reportByKey,
  type ReportDef,
  type ReportModule,
} from './school-sis-reports.catalog';
import { SchoolSisAttendanceService } from './school-sis-attendance.service';

export type ReportFilters = {
  academicYearId?: string;
  gradeId?: string;
  sectionId?: string;
  studentId?: string;
  gender?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  examId?: string;
  subjectId?: string;
  paymentMode?: string;
  collectedById?: string;
  staffId?: string;
  department?: string;
  routeId?: string;
  vehicleId?: string;
  status?: string;
  page?: number;
  limit?: number;
  exportMode?: boolean;
  drillGradeId?: string;
  drillSectionId?: string;
};

type Col = { key: string; label: string };
type Row = Record<string, string | number | null>;
type Kpi = {
  key: string;
  label: string;
  value: string | number;
  drill?: string;
};
type Chart = {
  type: 'bar' | 'line' | 'donut' | 'area';
  title: string;
  data: { name: string; value: number }[];
};

export type ReportResult = {
  report: ReportDef;
  columns: Col[];
  rows: Row[];
  kpis: Kpi[];
  charts: Chart[];
  empty: boolean;
  emptyHint?: string;
  total: number;
  page: number;
  limit: number;
  filtersApplied: ReportFilters;
};

const IST_MS = 5.5 * 60 * 60 * 1000;

function rupees(paise: number) {
  return Number((paise / 100).toFixed(2));
}

function inr(paise: number) {
  return `₹${rupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function ymd(d = new Date()) {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

function dayBounds(from?: string, to?: string) {
  const a = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
  const b = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : a;
  if (!a) return null;
  return {
    start: new Date(`${a}T00:00:00+05:30`),
    end: new Date(`${b ?? a}T23:59:59.999+05:30`),
  };
}

function num(v: Prisma.Decimal | number | null | undefined) {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function ageYears(dob: Date | null) {
  if (!dob) return null;
  const now = new Date();
  let a = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a -= 1;
  return a;
}

function personaFrom(
  roles: string[],
  permissions: string[],
): keyof typeof MODULE_FOR_ROLES {
  const blob = roles.join(' ').toLowerCase();
  const p = permissions;
  if (
    p.includes('*') ||
    p.includes('school-sis:manage') ||
    /principal|super|admin/.test(blob)
  )
    return 'full';
  if (/accountant|accounts|cashier/.test(blob) || p.includes('reports.fees'))
    return 'accountant';
  if (/librarian/.test(blob)) return 'librarian';
  if (/transport/.test(blob)) return 'transport';
  if (/\bhr\b/.test(blob)) return 'hr';
  if (/teacher/.test(blob)) return 'teacher';
  return 'teacher';
}

@Injectable()
export class SchoolSisReportsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: SchoolSisAttendanceService,
  ) {}

  catalog(roles: string[], permissions: string[]) {
    const persona = personaFrom(roles, permissions);
    const allowed = new Set(
      MODULE_FOR_ROLES[persona] ?? MODULE_FOR_ROLES.teacher,
    );
    return {
      modules: REPORT_MODULES.filter((m) => allowed.has(m.id)),
      reports: REPORT_CATALOG.filter((r) => allowed.has(r.module)),
      templates: REPORT_TEMPLATES,
      customSources: Object.keys(CUSTOM_FIELDS).map((id) => ({
        id,
        fields: CUSTOM_FIELDS[id],
      })),
      persona,
    };
  }

  assertReport(key: string, roles: string[], permissions: string[]) {
    const def = reportByKey(key);
    if (!def) throw new BadRequestException('Unknown report');
    const persona = personaFrom(roles, permissions);
    const allowed = new Set(MODULE_FOR_ROLES[persona] ?? []);
    if (!allowed.has(def.module)) {
      throw new ForbiddenException('You do not have access to this report');
    }
    if (def.sensitive && persona === 'teacher') {
      throw new ForbiddenException(
        'This report contains restricted personal data',
      );
    }
    return def;
  }

  async settings(tenantId: string) {
    const row = await this.prisma.schoolMisSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
    return row;
  }

  async saveSettings(
    tenantId: string,
    patch: Partial<{
      attendanceMinPercent: number;
      passPercent: number;
      currency: string;
      dateFormat: string;
      footerText: string;
      signatoryName: string;
      pageFormat: string;
    }>,
  ) {
    const min = patch.attendanceMinPercent;
    if (min != null && (min < 1 || min > 100)) {
      throw new BadRequestException(
        'Attendance threshold must be between 1 and 100',
      );
    }
    return this.prisma.schoolMisSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...patch },
      update: patch,
    });
  }

  async resolveYear(tenantId: string, academicYearId?: string) {
    if (academicYearId) {
      const y = await this.prisma.schoolAcademicYear.findFirst({
        where: { id: academicYearId, tenantId, deletedAt: null },
      });
      if (!y) throw new BadRequestException('Academic year not found');
      return y;
    }
    const current = await this.prisma.schoolAcademicYear.findFirst({
      where: { tenantId, deletedAt: null, status: 'CURRENT' },
      orderBy: { startDate: 'desc' },
    });
    if (current) return current;
    return this.prisma.schoolAcademicYear.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  async filterOptions(tenantId: string, academicYearId?: string) {
    const year = await this.resolveYear(tenantId, academicYearId);
    const [grades, sections, years] = await Promise.all([
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null, active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      year
        ? this.prisma.schoolSection.findMany({
            where: {
              tenantId,
              academicYearId: year.id,
              deletedAt: null,
              active: true,
            },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, gradeId: true },
          })
        : [],
      this.prisma.schoolAcademicYear.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, status: true },
      }),
    ]);
    return { year, grades, sections, years };
  }

  async dashboard(tenantId: string, filters: ReportFilters) {
    const year = await this.resolveYear(tenantId, filters.academicYearId);
    const settings = await this.settings(tenantId);
    const today = ymd();
    const bounds = dayBounds(today, today)!;
    const monthStart = today.slice(0, 7) + '-01';
    const monthBounds = dayBounds(monthStart, today)!;
    const yearId = year?.id;

    const enrollWhere: Prisma.SchoolEnrollmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(yearId ? { academicYearId: yearId } : {}),
    };

    const [
      totalStudents,
      activeStudents,
      withdrawn,
      newAdmissions,
      genderGroups,
      classGroups,
      categoryGroups,
      expectedDue,
      collectedPaid,
      todayPaid,
      monthPaid,
      modeGroups,
      concessions,
      lateFees,
      voided,
      apps,
      staff,
      vehicles,
      routes,
      allocs,
      examAgg,
    ] = await Promise.all([
      this.prisma.schoolStudent.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.schoolEnrollment.count({
        where: { ...enrollWhere, status: 'ACTIVE' },
      }),
      this.prisma.schoolStudent.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['WITHDRAWN', 'LEFT', 'INACTIVE'] },
        },
      }),
      this.prisma.schoolEnrollment.count({
        where: {
          ...enrollWhere,
          createdAt: { gte: monthBounds.start, lte: monthBounds.end },
        },
      }),
      this.prisma.schoolStudent.groupBy({
        by: ['gender'],
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.schoolEnrollment.groupBy({
        by: ['sectionId'],
        where: { ...enrollWhere, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.schoolStudent.groupBy({
        by: ['casteCategory'],
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.schoolFeeMonthAccount.aggregate({
        where: { tenantId, ...(yearId ? { academicYearId: yearId } : {}) },
        _sum: { dueAmount: true, paidAmount: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _sum: { totalAmount: true, discountAmount: true, lateFeeAmount: true },
        _count: { _all: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          paidAt: { gte: bounds.start, lte: bounds.end },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          paidAt: { gte: monthBounds.start, lte: monthBounds.end },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.schoolFeePayment.groupBy({
        by: ['paymentMode'],
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          discountAmount: { gt: 0 },
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _sum: { discountAmount: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          status: 'PAID',
          voidedAt: null,
          lateFeeAmount: { gt: 0 },
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _sum: { lateFeeAmount: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where: {
          tenantId,
          voidedAt: { not: null },
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.schoolApplication.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.schoolStaff.groupBy({
        by: ['staffType', 'status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.schoolTransportVehicle.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.schoolTransportRoute.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.schoolTransportStudentAllocation.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(yearId ? { academicYearId: yearId } : {}),
        },
      }),
      this.prisma.schoolExamResult.aggregate({
        where: {
          tenantId,
          ...(yearId ? { exam: { academicYearId: yearId } } : {}),
        },
        _avg: { percent: true },
        _max: { percent: true },
        _min: { percent: true },
        _count: { _all: true },
      }),
    ]);

    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        ...(yearId ? { academicYearId: yearId } : {}),
        deletedAt: null,
      },
      select: { id: true, name: true, grade: { select: { name: true } } },
    });
    const sectionMap = new Map(
      sections.map((s) => [s.id, `${s.grade.name} ${s.name}`]),
    );
    const classChart = classGroups.map((g) => ({
      name: sectionMap.get(g.sectionId) ?? 'Section',
      value: g._count._all,
    }));

    const due = expectedDue._sum.dueAmount ?? 0;
    const paidAcc = expectedDue._sum.paidAmount ?? 0;
    const collected = collectedPaid._sum.totalAmount ?? 0;
    const modeMap = Object.fromEntries(
      modeGroups.map((m) => [m.paymentMode, m._sum.totalAmount ?? 0]),
    );
    const appMap = Object.fromEntries(
      apps.map((a) => [a.status, a._count._all]),
    );
    const appTotal = apps.reduce((s, a) => s + a._count._all, 0);
    const enrolledApps = appMap['ENROLLED'] ?? appMap['CONVERTED'] ?? 0;
    const teaching = staff
      .filter((s) => s.staffType === 'TEACHING' && s.status === 'ACTIVE')
      .reduce((n, s) => n + s._count._all, 0);
    const nonTeaching = staff
      .filter((s) => s.staffType !== 'TEACHING' && s.status === 'ACTIVE')
      .reduce((n, s) => n + s._count._all, 0);
    const staffActive = teaching + nonTeaching;
    const passPct = examAgg._count._all
      ? Math.round(
          (num(examAgg._avg.percent) >= settings.passPercent ? 1 : 0) * 100,
        )
      : 0;

    const feeTrendRows = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        status: 'PAID',
        voidedAt: null,
        ...(yearId ? { academicYearId: yearId } : {}),
      },
      select: { paidAt: true, totalAmount: true },
      take: 8000,
    });
    const trend = new Map<string, number>();
    for (const p of feeTrendRows) {
      const k = p.paidAt.toISOString().slice(0, 7);
      trend.set(k, (trend.get(k) ?? 0) + p.totalAmount);
    }
    const feeTrend = [...trend.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([name, value]) => ({ name, value: rupees(value) }));

    const kpis: Kpi[] = [
      {
        key: 'students',
        label: 'Total Students',
        value: totalStudents,
        drill: 'student_master',
      },
      {
        key: 'active',
        label: 'Active Students',
        value: activeStudents,
        drill: 'student_active',
      },
      {
        key: 'new',
        label: 'New Admissions (month)',
        value: newAdmissions,
        drill: 'student_new',
      },
      {
        key: 'withdrawn',
        label: 'Withdrawn / Inactive',
        value: withdrawn,
        drill: 'student_withdrawn',
      },
      {
        key: 'att_today',
        label: "Today's Attendance %",
        value: '—',
        drill: 'attendance_daily',
      },
      {
        key: 'att_month',
        label: 'Monthly Attendance %',
        value: '—',
        drill: 'attendance_monthly',
      },
      {
        key: 'att_low',
        label: `Low attendance (<${settings.attendanceMinPercent}%)`,
        value: 0,
        drill: 'attendance_low',
      },
      {
        key: 'fees_due',
        label: 'Total Fees Expected',
        value: inr(due),
        drill: 'fee_outstanding',
      },
      {
        key: 'fees_collected',
        label: 'Total Collected',
        value: inr(collected),
        drill: 'fee_register',
      },
      {
        key: 'fees_out',
        label: 'Total Outstanding',
        value: inr(Math.max(0, due - paidAcc)),
        drill: 'fee_outstanding',
      },
      {
        key: 'fees_today',
        label: "Today's Collection",
        value: inr(todayPaid._sum.totalAmount ?? 0),
        drill: 'fee_daily',
      },
      {
        key: 'fees_month',
        label: 'Monthly Collection',
        value: inr(monthPaid._sum.totalAmount ?? 0),
        drill: 'fee_monthly',
      },
      {
        key: 'cash',
        label: 'Cash Collection',
        value: inr(modeMap['CASH'] ?? 0),
        drill: 'fee_cash',
      },
      {
        key: 'upi',
        label: 'UPI Collection',
        value: inr(modeMap['UPI'] ?? 0),
        drill: 'fee_upi',
      },
      {
        key: 'bank',
        label: 'Bank Collection',
        value: inr(modeMap['BANK'] ?? 0),
        drill: 'fee_bank',
      },
      {
        key: 'online',
        label: 'Online Gateway',
        value: inr((modeMap['ONLINE'] ?? 0) + (modeMap['GATEWAY'] ?? 0)),
        drill: 'fee_online',
      },
      {
        key: 'concession',
        label: 'Concessions',
        value: inr(concessions._sum.discountAmount ?? 0),
        drill: 'fee_concession',
      },
      {
        key: 'late',
        label: 'Late Fees',
        value: inr(lateFees._sum.lateFeeAmount ?? 0),
        drill: 'fee_late',
      },
      {
        key: 'void',
        label: 'Cancelled Receipts',
        value: voided._count._all,
        drill: 'fee_cancelled',
      },
      {
        key: 'avg_marks',
        label: 'Average Marks',
        value: examAgg._count._all
          ? `${num(examAgg._avg.percent).toFixed(1)}%`
          : '—',
        drill: 'exam_class_avg',
      },
      {
        key: 'high',
        label: 'Highest Score',
        value:
          examAgg._max.percent != null
            ? `${num(examAgg._max.percent).toFixed(1)}%`
            : '—',
        drill: 'exam_highest',
      },
      {
        key: 'low',
        label: 'Lowest Score',
        value:
          examAgg._min.percent != null
            ? `${num(examAgg._min.percent).toFixed(1)}%`
            : '—',
        drill: 'exam_lowest',
      },
      {
        key: 'apps',
        label: 'Applications',
        value: appTotal,
        drill: 'adm_applications',
      },
      {
        key: 'approved',
        label: 'Approved',
        value: appMap['APPROVED'] ?? 0,
        drill: 'adm_approved',
      },
      {
        key: 'pending',
        label: 'Pending',
        value: (appMap['SUBMITTED'] ?? 0) + (appMap['PENDING'] ?? 0),
        drill: 'adm_pending',
      },
      {
        key: 'rejected',
        label: 'Rejected',
        value: appMap['REJECTED'] ?? 0,
        drill: 'adm_rejected',
      },
      {
        key: 'enrolled_apps',
        label: 'Enrolled',
        value: enrolledApps,
        drill: 'adm_conversion',
      },
      {
        key: 'conv',
        label: 'Conversion rate',
        value: appTotal
          ? `${Math.round((enrolledApps / appTotal) * 100)}%`
          : '—',
      },
      {
        key: 'staff',
        label: 'Total Staff',
        value: staffActive,
        drill: 'staff_list',
      },
      {
        key: 'teaching',
        label: 'Teaching Staff',
        value: teaching,
        drill: 'staff_teaching',
      },
      {
        key: 'nonteaching',
        label: 'Non-teaching',
        value: nonTeaching,
        drill: 'staff_nonteaching',
      },
      {
        key: 'ratio',
        label: 'Staff-Student Ratio',
        value: staffActive
          ? `1:${Math.round(activeStudents / staffActive)}`
          : '—',
        drill: 'staff_ratio',
      },
      {
        key: 'vehicles',
        label: 'Vehicles',
        value: vehicles,
        drill: 'tr_vehicles',
      },
      {
        key: 'routes',
        label: 'Active Routes',
        value: routes,
        drill: 'tr_routes',
      },
      {
        key: 'transport_students',
        label: 'Students Using Transport',
        value: allocs,
        drill: 'tr_alloc',
      },
    ];

    return {
      year,
      settings: {
        attendanceMinPercent: settings.attendanceMinPercent,
        passPercent: settings.passPercent,
      },
      kpis,
      charts: [
        {
          type: 'line' as const,
          title: 'Fee Collection Trend',
          data: feeTrend,
        },
        {
          type: 'donut' as const,
          title: 'Students by Gender',
          data: genderGroups.map((g) => ({
            name: g.gender || 'Unspecified',
            value: g._count._all,
          })),
        },
        {
          type: 'bar' as const,
          title: 'Students by Class / Section',
          data: classChart.slice(0, 16),
        },
        {
          type: 'donut' as const,
          title: 'Payment Mode',
          data: modeGroups.map((m) => ({
            name: m.paymentMode,
            value: rupees(m._sum.totalAmount ?? 0),
          })),
        },
        {
          type: 'bar' as const,
          title: 'Students by Category',
          data: categoryGroups.map((g) => ({
            name: g.casteCategory || 'Unspecified',
            value: g._count._all,
          })),
        },
      ],
      alerts: [
        ...(due - paidAcc > 0
          ? [`Outstanding fees ${inr(Math.max(0, due - paidAcc))}`]
          : []),
        'Daily student attendance register is not live — attendance KPIs stay empty until capture exists.',
      ],
    };
  }

  async run(
    tenantId: string,
    key: string,
    filters: ReportFilters,
    roles: string[],
    permissions: string[],
  ): Promise<ReportResult> {
    const report = this.assertReport(key, roles, permissions);
    const page = Math.max(1, filters.page ?? 1);
    const limit = filters.exportMode
      ? Math.min(50_000, Math.max(1, filters.limit ?? 20_000))
      : Math.min(200, Math.max(10, filters.limit ?? 50));
    const skip = (page - 1) * limit;
    const year = await this.resolveYear(tenantId, filters.academicYearId);
    const settings = await this.settings(tenantId);
    const emptyAtt = this.empty(
      report,
      filters,
      page,
      limit,
      settings.attendanceMinPercent,
    );

    if (key === 'mis_staff_att' || key === 'attendance_staff') {
      return emptyAtt;
    }
    if (report.module === 'attendance' || key === 'mis_att_trend') {
      const built = await this.attendance.reportBundle(tenantId, key, filters);
      const rows = built.rows as Row[];
      return {
        report,
        columns: built.columns,
        rows,
        kpis: built.kpis ?? [],
        charts: built.charts ?? [],
        empty: rows.length === 0,
        emptyHint:
          rows.length === 0 ? this.emptyMessage(report, filters) : undefined,
        total: rows.length,
        page,
        limit,
        filtersApplied: filters,
      };
    }
    if (
      report.module === 'library' ||
      key.startsWith('lib_') ||
      key === 'mis_library'
    ) {
      return this.empty(report, filters, page, limit);
    }
    if (
      key.startsWith('staff_attendance') ||
      key === 'staff_leave' ||
      key === 'staff_late' ||
      key === 'staff_hours' ||
      key.startsWith('staff_pay') ||
      key === 'staff_salary' ||
      key === 'staff_deduction'
    ) {
      return this.empty(report, filters, page, limit);
    }
    if (key === 'sms_sent') return this.empty(report, filters, page, limit);

    const ctx = {
      tenantId,
      filters,
      yearId: year?.id,
      page,
      limit,
      skip,
      settings,
      report,
    };
    const built = await this.dispatch(key, ctx);
    return {
      report,
      columns: built.columns,
      rows: built.rows,
      kpis: built.kpis ?? [],
      charts: built.charts ?? [],
      empty: built.rows.length === 0,
      emptyHint:
        built.rows.length === 0
          ? this.emptyMessage(report, filters)
          : undefined,
      total: built.total,
      page,
      limit,
      filtersApplied: filters,
    };
  }

  parseAsk(question: string, roles: string[], permissions: string[]) {
    const q = question.toLowerCase();
    let key = 'student_master';
    if (
      q.includes('cashier') ||
      q.includes('user-wise') ||
      q.includes('user wise')
    )
      key = 'fee_user_wise';
    else if (q.includes('cash closing') || q.includes('cashier closing'))
      key = 'fee_cash_closing';
    else if (q.includes('outstanding') || q.includes('defaulter'))
      key = 'fee_outstanding';
    else if (q.includes('collection') && q.includes('today')) key = 'fee_daily';
    else if (q.includes('collection')) key = 'fee_register';
    else if (q.includes('attendance')) key = 'attendance_low';
    else if (q.includes('result') || q.includes('marks') || q.includes('exam'))
      key = 'exam_result';
    else if (q.includes('admission')) key = 'adm_applications';
    else if (q.includes('staff')) key = 'staff_list';
    else if (q.includes('transport') || q.includes('bus')) key = 'tr_alloc';
    else if (q.includes('library')) key = 'lib_issued';
    else if (q.includes('stock') || q.includes('inventory')) key = 'inv_stock';
    const def = this.assertReport(key, roles, permissions);
    return { key: def.key, title: def.title, filters: {} as ReportFilters };
  }

  async runCustom(
    tenantId: string,
    source: string,
    fields: string[],
    filters: ReportFilters,
    roles: string[],
    permissions: string[],
  ) {
    const allowed = CUSTOM_FIELDS[source];
    if (!allowed) throw new BadRequestException('Unknown data source');
    const allow = new Set(allowed.map((f) => f.id));
    const cols = fields.filter((f) => allow.has(f));
    if (!cols.length)
      throw new BadRequestException('Select at least one allowed field');
    const map: Record<string, string> = {
      STUDENT: 'student_master',
      FEES: 'fee_register',
      EXAMINATION: 'exam_result',
      STAFF: 'staff_list',
      ADMISSION: 'adm_applications',
      TRANSPORT: 'tr_alloc',
      INVENTORY: 'inv_stock',
      COMMUNICATION: 'wa_sent',
      ATTENDANCE: 'attendance_daily',
      LIBRARY: 'lib_inventory',
    };
    const key = map[source];
    const result = await this.run(tenantId, key, filters, roles, permissions);
    result.columns = result.columns.filter((c) => cols.includes(c.key));
    result.rows = result.rows.map((row) => {
      const next: Row = {};
      for (const c of result.columns) next[c.key] = row[c.key] ?? null;
      return next;
    });
    return result;
  }

  previewHtml(schoolName: string, result: ReportResult, generatedBy: string) {
    const head = result.columns.map((c) => `<th>${esc(c.label)}</th>`).join('');
    const body = result.rows
      .map(
        (r) =>
          `<tr>${result.columns.map((c) => `<td>${esc(String(r[c.key] ?? ''))}</td>`).join('')}</tr>`,
      )
      .join('');
    const filters = Object.entries(result.filtersApplied)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(result.report.title)}</title>
<style>body{font-family:Georgia,serif;color:#111;padding:24px}h1{font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f4f7fb}.meta{color:#555;font-size:12px;margin-top:8px}</style>
</head><body>
<p>${esc(schoolName)}</p>
<h1>${esc(result.report.title)}</h1>
<p class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${esc(generatedBy)} · ${esc(filters)}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${result.columns.length}">${esc(result.emptyHint || 'No records')}</td></tr>`}</tbody></table>
<p class="meta">${esc(result.report.description)}</p>
</body></html>`;
  }

  toCsv(result: ReportResult) {
    const header = result.columns.map((c) => csvCell(c.label)).join(',');
    const lines = result.rows.map((r) =>
      result.columns.map((c) => csvCell(r[c.key])).join(','),
    );
    return [header, ...lines].join('\n');
  }

  private empty(
    report: ReportDef,
    filters: ReportFilters,
    page: number,
    limit: number,
    threshold?: number,
  ): ReportResult {
    const hint =
      report.emptyHint ||
      (threshold
        ? `No attendance records. School minimum attendance is ${threshold}% (configurable in Report Settings).`
        : this.emptyMessage(report, filters));
    return {
      report,
      columns: [{ key: 'note', label: 'Note' }],
      rows: [],
      kpis: [],
      charts: [],
      empty: true,
      emptyHint: hint,
      total: 0,
      page,
      limit,
      filtersApplied: filters,
    };
  }

  private emptyMessage(report: ReportDef, filters: ReportFilters) {
    const bits = [report.title];
    if (filters.month) bits.push(`for ${filters.month}`);
    if (filters.dateFrom) bits.push(`from ${filters.dateFrom}`);
    if (filters.dateTo) bits.push(`to ${filters.dateTo}`);
    return `No records found for ${bits.join(' ')}. Adjust or clear filters and try again.`;
  }

  private async dispatch(key: string, ctx: QueryCtx): Promise<Built> {
    if (
      key.startsWith('student_') ||
      key.startsWith('adm_class') ||
      key === 'mis_strength' ||
      key === 'mis_enroll_trend'
    ) {
      return this.students(key, ctx);
    }
    if (
      key.startsWith('fee_') ||
      key.startsWith('mis_fee') ||
      key === 'mis_outstanding' ||
      key === 'mis_revenue' ||
      key === 'accountant_dash'
    ) {
      return this.fees(key, ctx);
    }
    if (
      key.startsWith('exam_') ||
      key === 'mis_academic' ||
      key === 'academic_coord'
    ) {
      return this.exams(key, ctx);
    }
    if (key.startsWith('adm_')) return this.admissions(key, ctx);
    if (key.startsWith('staff_')) return this.staff(key, ctx);
    if (key.startsWith('tr_') || key === 'mis_transport')
      return this.transport(key, ctx);
    if (key.startsWith('inv_') || key === 'mis_inventory')
      return this.inventory(key, ctx);
    if (key.startsWith('wa_') || key.startsWith('push_'))
      return this.comms(key, ctx);
    if (key.startsWith('mis_') || key === 'principal_daily')
      return this.mis(key, ctx);
    return this.students('student_master', ctx);
  }

  private async students(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, yearId, skip, limit } = ctx;
    const enrollWhere: Prisma.SchoolEnrollmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(yearId ? { academicYearId: yearId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      ...(filters.gradeId ? { section: { gradeId: filters.gradeId } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    if (
      key === 'student_class_strength' ||
      key === 'adm_class' ||
      key === 'mis_strength'
    ) {
      const rows = await this.prisma.schoolEnrollment.groupBy({
        by: ['sectionId'],
        where: { ...enrollWhere, status: 'ACTIVE' },
        _count: { _all: true },
      });
      const sections = await this.prisma.schoolSection.findMany({
        where: { id: { in: rows.map((r) => r.sectionId) } },
        select: {
          id: true,
          name: true,
          grade: { select: { id: true, name: true } },
        },
      });
      const map = new Map(sections.map((s) => [s.id, s]));
      return {
        columns: [
          { key: 'className', label: 'Class' },
          { key: 'sectionName', label: 'Section' },
          { key: 'count', label: 'Students' },
        ],
        rows: rows.map((r) => ({
          className: map.get(r.sectionId)?.grade.name ?? '',
          sectionName: map.get(r.sectionId)?.name ?? '',
          count: r._count._all,
          drillGradeId: map.get(r.sectionId)?.grade.id ?? '',
          drillSectionId: r.sectionId,
        })),
        total: rows.length,
        kpis: [{ key: 'n', label: 'Classes / sections', value: rows.length }],
        charts: [
          {
            type: 'bar',
            title: 'Strength',
            data: rows.map((r) => ({
              name: map.get(r.sectionId)?.grade.name ?? r.sectionId,
              value: r._count._all,
            })),
          },
        ],
      };
    }
    if (key === 'student_section_strength') {
      return this.students('student_class_strength', ctx);
    }
    if (key === 'student_gender' || key === 'adm_gender') {
      const rows = await this.prisma.schoolStudent.groupBy({
        by: ['gender'],
        where: {
          tenantId,
          deletedAt: null,
          ...(filters.gender ? { gender: filters.gender } : {}),
        },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'gender', label: 'Gender' },
          { key: 'count', label: 'Students' },
        ],
        rows: rows.map((r) => ({
          gender: r.gender ?? 'Unspecified',
          count: r._count._all,
        })),
        total: rows.length,
        charts: [
          {
            type: 'donut',
            title: 'Gender',
            data: rows.map((r) => ({
              name: r.gender || 'Unspecified',
              value: r._count._all,
            })),
          },
        ],
      };
    }
    if (key === 'student_category' || key === 'adm_category') {
      const rows = await this.prisma.schoolStudent.groupBy({
        by: ['casteCategory'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'count', label: 'Students' },
        ],
        rows: rows.map((r) => ({
          category: r.casteCategory ?? 'Unspecified',
          count: r._count._all,
        })),
        total: rows.length,
        charts: [
          {
            type: 'bar',
            title: 'Category',
            data: rows.map((r) => ({
              name: r.casteCategory || 'Unspecified',
              value: r._count._all,
            })),
          },
        ],
      };
    }
    if (key === 'student_strength') {
      const rows = await this.prisma.schoolStudent.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Students' },
        ],
        rows: rows.map((r) => ({ status: r.status, count: r._count._all })),
        total: rows.length,
      };
    }

    let status = filters.status;
    if (key === 'student_active') status = 'ACTIVE';
    if (
      key === 'student_inactive' ||
      key === 'student_withdrawn' ||
      key === 'adm_withdrawals'
    ) {
      status = undefined;
    }
    const studentWhere: Prisma.SchoolStudentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(filters.gender ? { gender: filters.gender } : {}),
      ...(filters.category ? { casteCategory: filters.category } : {}),
      ...(filters.studentId ? { id: filters.studentId } : {}),
      ...(status ? { status } : {}),
      ...(key === 'student_withdrawn' || key === 'adm_withdrawals'
        ? { status: { in: ['WITHDRAWN', 'LEFT', 'INACTIVE'] } }
        : {}),
      ...(key === 'student_inactive' ? { status: { not: 'ACTIVE' } } : {}),
    };
    const date = dayBounds(filters.dateFrom, filters.dateTo);
    if ((key === 'student_new' || key === 'student_readmit') && date) {
      enrollWhere.createdAt = { gte: date.start, lte: date.end };
    }

    const [total, list] = await Promise.all([
      this.prisma.schoolEnrollment.count({
        where: { ...enrollWhere, student: studentWhere },
      }),
      this.prisma.schoolEnrollment.findMany({
        where: { ...enrollWhere, student: studentWhere },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            include: {
              guardians: { include: { guardian: true } },
              documents: true,
            },
          },
          section: { include: { grade: true } },
        },
      }),
    ]);

    if (key === 'student_documents') {
      return {
        columns: [
          { key: 'admissionNumber', label: 'Admission No' },
          { key: 'fullName', label: 'Student' },
          { key: 'docs', label: 'Documents' },
          { key: 'pending', label: 'Pending verification' },
        ],
        rows: list.map((e) => ({
          admissionNumber: e.student.admissionNumber,
          fullName: e.student.fullName,
          docs: e.student.documents.length,
          pending: e.student.documents.filter(
            (d) => d.verificationStatus !== 'VERIFIED',
          ).length,
        })),
        total,
      };
    }
    if (
      key === 'student_history' ||
      key === 'student_promotion' ||
      key === 'student_migration' ||
      key === 'student_transfer' ||
      key === 'student_readmit'
    ) {
      const events = await this.prisma.schoolEnrollmentEvent.findMany({
        where: {
          tenantId,
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
          ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
          ...(key === 'student_promotion'
            ? { type: { contains: 'PROMOT' } }
            : {}),
          ...(key === 'student_transfer' || key === 'student_migration'
            ? { type: { contains: 'TRANSFER' } }
            : {}),
          ...(key === 'student_readmit'
            ? { type: { contains: 'READMIT' } }
            : {}),
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { student: true },
      });
      const count = await this.prisma.schoolEnrollmentEvent.count({
        where: {
          tenantId,
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
        },
      });
      return {
        columns: [
          { key: 'fullName', label: 'Student' },
          { key: 'type', label: 'Event' },
          { key: 'note', label: 'Note' },
          { key: 'createdAt', label: 'Date' },
        ],
        rows: events.map((e) => ({
          fullName: e.student.fullName,
          type: e.type,
          note: e.note ?? '',
          createdAt: e.createdAt.toISOString().slice(0, 10),
        })),
        total: count,
      };
    }
    if (key === 'student_retention') {
      return {
        columns: [{ key: 'note', label: 'Note' }],
        rows: [
          {
            note: 'Retention compares consecutive academic years. Select a year to count ACTIVE enrollments continuing from the previous year.',
          },
        ],
        total: 1,
      };
    }

    const columns: Col[] = [
      { key: 'admissionNumber', label: 'Admission No' },
      { key: 'fullName', label: 'Student Name' },
      { key: 'className', label: 'Class' },
      { key: 'sectionName', label: 'Section' },
      { key: 'gender', label: 'Gender' },
      { key: 'status', label: 'Status' },
    ];
    if (key === 'student_age' || key === 'student_dob') {
      columns.push(
        { key: 'dateOfBirth', label: 'Date of Birth' },
        { key: 'age', label: 'Age' },
      );
    }
    if (key === 'student_contacts' || key === 'student_profile') {
      columns.push(
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
      );
    }
    if (key === 'student_address')
      columns.push({ key: 'address', label: 'Address' });
    if (key === 'student_guardians') {
      columns.push(
        { key: 'guardian', label: 'Guardian' },
        { key: 'guardianPhone', label: 'Guardian phone' },
      );
    }
    if (key === 'student_category')
      columns.push({ key: 'casteCategory', label: 'Category' });

    return {
      columns,
      rows: list.map((e) => {
        const g = e.student.guardians?.[0]?.guardian;
        return {
          admissionNumber: e.student.admissionNumber,
          fullName: e.student.fullName,
          className: e.section.grade.name,
          sectionName: e.section.name,
          gender: e.student.gender ?? '',
          status: e.status,
          casteCategory: e.student.casteCategory ?? '',
          phone: e.student.phone ?? '',
          email: e.student.email ?? '',
          address: e.student.address ?? '',
          dateOfBirth: e.student.dateOfBirth
            ? e.student.dateOfBirth.toISOString().slice(0, 10)
            : '',
          age: ageYears(e.student.dateOfBirth),
          guardian: g?.fullName ?? '',
          guardianPhone: g?.phone ?? '',
          studentId: e.studentId,
        };
      }),
      total,
      kpis: [{ key: 'n', label: 'Rows', value: total }],
    };
  }

  private paidWhere(
    ctx: QueryCtx,
    extra?: Prisma.SchoolFeePaymentWhereInput,
  ): Prisma.SchoolFeePaymentWhereInput {
    const date = dayBounds(ctx.filters.dateFrom, ctx.filters.dateTo);
    const month = ctx.filters.month;
    return {
      tenantId: ctx.tenantId,
      ...(ctx.yearId ? { academicYearId: ctx.yearId } : {}),
      ...(ctx.filters.gradeId ? { gradeId: ctx.filters.gradeId } : {}),
      ...(ctx.filters.sectionId ? { sectionId: ctx.filters.sectionId } : {}),
      ...(ctx.filters.studentId ? { studentId: ctx.filters.studentId } : {}),
      ...(ctx.filters.paymentMode
        ? { paymentMode: ctx.filters.paymentMode }
        : {}),
      ...(ctx.filters.collectedById
        ? { collectedById: ctx.filters.collectedById }
        : {}),
      ...(date ? { paidAt: { gte: date.start, lte: date.end } } : {}),
      ...(month ? { feeMonth: month } : {}),
      ...extra,
    };
  }

  private async fees(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, yearId, skip, limit } = ctx;
    if (
      key === 'fee_outstanding' ||
      key === 'fee_pending' ||
      key === 'fee_defaulters' ||
      key === 'fee_overdue' ||
      key === 'fee_aging' ||
      key === 'fee_class_outstanding' ||
      key === 'fee_student_outstanding' ||
      key === 'fee_head_outstanding' ||
      key === 'fee_month_outstanding' ||
      key === 'fee_ledger' ||
      key === 'fee_student_ledger' ||
      key === 'mis_outstanding'
    ) {
      const where: Prisma.SchoolFeeMonthAccountWhereInput = {
        tenantId,
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.status
          ? { status: filters.status }
          : { status: { not: 'PAID' } }),
      };
      if (key === 'fee_class_outstanding') {
        const payments = await this.prisma.schoolFeeMonthAccount.findMany({
          where,
          include: {
            student: {
              include: {
                enrollments: {
                  where: {
                    ...(yearId ? { academicYearId: yearId } : {}),
                    deletedAt: null,
                  },
                  include: { section: { include: { grade: true } } },
                  take: 1,
                },
              },
            },
          },
          take: 4000,
        });
        const map = new Map<string, { due: number; paid: number }>();
        for (const a of payments) {
          const g =
            a.student.enrollments[0]?.section.grade.name ?? 'Unassigned';
          const cur = map.get(g) ?? { due: 0, paid: 0 };
          cur.due += a.dueAmount;
          cur.paid += a.paidAmount;
          map.set(g, cur);
        }
        const rows = [...map.entries()].map(([className, v]) => ({
          className,
          due: rupees(v.due),
          paid: rupees(v.paid),
          outstanding: rupees(Math.max(0, v.due - v.paid)),
        }));
        return {
          columns: [
            { key: 'className', label: 'Class' },
            { key: 'due', label: 'Due ₹' },
            { key: 'paid', label: 'Paid ₹' },
            { key: 'outstanding', label: 'Outstanding ₹' },
          ],
          rows,
          total: rows.length,
          charts: [
            {
              type: 'bar',
              title: 'Outstanding by class',
              data: rows.map((r) => ({
                name: String(r.className),
                value: Number(r.outstanding),
              })),
            },
          ],
        };
      }
      const [total, list] = await Promise.all([
        this.prisma.schoolFeeMonthAccount.count({ where }),
        this.prisma.schoolFeeMonthAccount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { feeMonth: 'asc' },
          include: { student: true },
        }),
      ]);
      const outstanding = list.reduce(
        (s, a) => s + Math.max(0, a.dueAmount - a.paidAmount),
        0,
      );
      return {
        columns: [
          { key: 'admissionNumber', label: 'Admission No' },
          { key: 'fullName', label: 'Student' },
          { key: 'feeMonth', label: 'Month' },
          { key: 'due', label: 'Due ₹' },
          { key: 'paid', label: 'Paid ₹' },
          { key: 'outstanding', label: 'Outstanding ₹' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((a) => ({
          admissionNumber: a.student.admissionNumber,
          fullName: a.student.fullName,
          feeMonth: a.feeMonth,
          due: rupees(a.dueAmount),
          paid: rupees(a.paidAmount),
          outstanding: rupees(Math.max(0, a.dueAmount - a.paidAmount)),
          status: a.status,
          studentId: a.studentId,
        })),
        total,
        kpis: [
          { key: 'out', label: 'Outstanding (page)', value: inr(outstanding) },
        ],
      };
    }

    if (
      key === 'fee_user_wise' ||
      key === 'fee_cashier' ||
      key === 'fee_daily_cashier' ||
      key === 'accountant_dash'
    ) {
      const where = this.paidWhere(ctx, { status: 'PAID', voidedAt: null });
      const groups = await this.prisma.schoolFeePayment.groupBy({
        by: ['collectedById', 'paymentMode'],
        where,
        _sum: { totalAmount: true },
        _count: { _all: true },
      });
      const userIds = [
        ...new Set(groups.map((g) => g.collectedById).filter(Boolean)),
      ] as string[];
      const users = userIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          })
        : [];
      const names = new Map(users.map((u) => [u.id, u.displayName ?? 'Staff']));
      const byUser = new Map<
        string,
        Record<string, number> & { receipts: number }
      >();
      for (const g of groups) {
        const id = g.collectedById ?? 'unassigned';
        const row = byUser.get(id) ?? {
          receipts: 0,
          CASH: 0,
          UPI: 0,
          ONLINE: 0,
          BANK: 0,
          CHEQUE: 0,
          CARD: 0,
          OTHER: 0,
          TOTAL: 0,
        };
        const amt = g._sum.totalAmount ?? 0;
        const mode = g.paymentMode in row ? g.paymentMode : 'OTHER';
        row[mode] = (row[mode] ?? 0) + amt;
        row.TOTAL += amt;
        row.receipts += g._count._all;
        byUser.set(id, row);
      }
      const rows = [...byUser.entries()].map(([id, v]) => ({
        userName:
          names.get(id) ?? (id === 'unassigned' ? 'Unassigned' : 'Staff'),
        collectedById: id,
        cash: rupees(v.CASH ?? 0),
        upi: rupees(v.UPI ?? 0),
        online: rupees((v.ONLINE ?? 0) + (v.BANK ?? 0)),
        total: rupees(v.TOTAL ?? 0),
        receipts: v.receipts,
      }));
      return {
        columns: [
          { key: 'userName', label: 'User' },
          { key: 'cash', label: 'Cash ₹' },
          { key: 'upi', label: 'UPI ₹' },
          { key: 'online', label: 'Online / Bank ₹' },
          { key: 'total', label: 'Total ₹' },
          { key: 'receipts', label: 'Receipts' },
        ],
        rows,
        total: rows.length,
        charts: [
          {
            type: 'bar',
            title: 'User-wise collection',
            data: rows.map((r) => ({
              name: String(r.userName),
              value: Number(r.total),
            })),
          },
        ],
      };
    }

    if (key === 'fee_cash_closing') {
      const date = dayBounds(filters.dateFrom, filters.dateTo);
      const where: Prisma.SchoolFeeCashCloseWhereInput = {
        tenantId,
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(filters.collectedById ? { userId: filters.collectedById } : {}),
        ...(date ? { businessDate: { gte: date.start, lte: date.end } } : {}),
      };
      const [total, list] = await Promise.all([
        this.prisma.schoolFeeCashClose.count({ where }),
        this.prisma.schoolFeeCashClose.findMany({
          where,
          skip,
          take: limit,
          orderBy: { businessDate: 'desc' },
        }),
      ]);
      const users = await this.prisma.user.findMany({
        where: { id: { in: list.map((r) => r.userId) } },
        select: { id: true, displayName: true },
      });
      const names = new Map(users.map((u) => [u.id, u.displayName]));
      return {
        columns: [
          { key: 'userName', label: 'User' },
          { key: 'businessDate', label: 'Date' },
          { key: 'openingCash', label: 'Opening ₹' },
          { key: 'cashCollected', label: 'Cash collected ₹' },
          { key: 'expectedClosing', label: 'Expected ₹' },
          { key: 'actualCashCount', label: 'Actual ₹' },
          { key: 'difference', label: 'Difference ₹' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((r) => ({
          userName: names.get(r.userId) ?? 'Staff',
          businessDate: r.businessDate.toISOString().slice(0, 10),
          openingCash: rupees(r.openingCash),
          cashCollected: rupees(r.cashCollected),
          expectedClosing: rupees(r.expectedClosing),
          actualCashCount: rupees(r.actualCashCount),
          difference: rupees(r.difference),
          status: r.status,
        })),
        total,
      };
    }

    if (key === 'fee_mode' || key === 'fee_mode_dist') {
      const groups = await this.prisma.schoolFeePayment.groupBy({
        by: ['paymentMode'],
        where: this.paidWhere(ctx, { status: 'PAID', voidedAt: null }),
        _sum: { totalAmount: true },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'paymentMode', label: 'Mode' },
          { key: 'receipts', label: 'Receipts' },
          { key: 'amount', label: 'Amount ₹' },
        ],
        rows: groups.map((g) => ({
          paymentMode: g.paymentMode,
          receipts: g._count._all,
          amount: rupees(g._sum.totalAmount ?? 0),
        })),
        total: groups.length,
        charts: [
          {
            type: 'donut',
            title: 'Payment mode',
            data: groups.map((g) => ({
              name: g.paymentMode,
              value: rupees(g._sum.totalAmount ?? 0),
            })),
          },
        ],
      };
    }

    if (
      key === 'fee_trend' ||
      key === 'fee_month_compare' ||
      key === 'fee_year_compare' ||
      key === 'fee_vs_outstanding' ||
      key === 'mis_fee_collection'
    ) {
      const payments = await this.prisma.schoolFeePayment.findMany({
        where: this.paidWhere(ctx, { status: 'PAID', voidedAt: null }),
        select: { paidAt: true, totalAmount: true, feeMonth: true },
        take: 8000,
      });
      const map = new Map<string, number>();
      for (const p of payments) {
        const k =
          key === 'fee_trend' ? p.paidAt.toISOString().slice(0, 7) : p.feeMonth;
        map.set(k, (map.get(k) ?? 0) + p.totalAmount);
      }
      const rows = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, amount]) => ({
          period,
          amount: rupees(amount),
        }));
      return {
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'amount', label: 'Collected ₹' },
        ],
        rows,
        total: rows.length,
        charts: [
          {
            type: 'line',
            title: 'Collection trend',
            data: rows.map((r) => ({
              name: String(r.period),
              value: Number(r.amount),
            })),
          },
        ],
      };
    }

    if (
      key === 'fee_gateway' ||
      key === 'fee_gateway_recon' ||
      key === 'fee_failed_tx' ||
      key === 'fee_pending_online'
    ) {
      const status =
        key === 'fee_failed_tx'
          ? { in: ['FAILED', 'CANCELLED'] }
          : key === 'fee_pending_online'
            ? { in: ['CREATED', 'PENDING'] }
            : undefined;
      const where: Prisma.SchoolPaymentGatewayTransactionWhereInput = {
        tenantId,
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(status ? { status } : {}),
      };
      const [total, list] = await Promise.all([
        this.prisma.schoolPaymentGatewayTransaction.count({ where }),
        this.prisma.schoolPaymentGatewayTransaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { student: true },
        }),
      ]);
      return {
        columns: [
          { key: 'orderId', label: 'Order' },
          { key: 'fullName', label: 'Student' },
          { key: 'amount', label: 'Amount ₹' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Created' },
        ],
        rows: list.map((t) => ({
          orderId: t.orderId,
          fullName: t.student.fullName,
          amount: rupees(t.amount),
          status: t.status,
          createdAt: t.createdAt.toISOString().slice(0, 16),
        })),
        total,
      };
    }

    let extra: Prisma.SchoolFeePaymentWhereInput = {
      status: 'PAID',
      voidedAt: null,
    };
    if (key === 'fee_cash') extra = { ...extra, paymentMode: 'CASH' };
    if (key === 'fee_upi') extra = { ...extra, paymentMode: 'UPI' };
    if (key === 'fee_bank') extra = { ...extra, paymentMode: 'BANK' };
    if (key === 'fee_cheque') extra = { ...extra, paymentMode: 'CHEQUE' };
    if (key === 'fee_card') extra = { ...extra, paymentMode: 'CARD' };
    if (key === 'fee_online' || key === 'fee_gateway')
      extra = { ...extra, paymentMode: { in: ['ONLINE', 'UPI', 'BANK'] } };
    if (key === 'fee_counter') extra = { ...extra, channel: 'OFFICE' };
    if (key === 'fee_concession' || key === 'fee_scholarship')
      extra = { ...extra, discountAmount: { gt: 0 } };
    if (key === 'fee_late') extra = { ...extra, lateFeeAmount: { gt: 0 } };
    if (key === 'fee_cancelled') extra = { voidedAt: { not: null } };
    if (key === 'fee_refund') extra = { remainingAmount: { lt: 0 } };
    if (key === 'fee_class_collection') {
      const groups = await this.prisma.schoolFeePayment.groupBy({
        by: ['gradeId'],
        where: this.paidWhere(ctx, extra),
        _sum: { totalAmount: true },
        _count: { _all: true },
      });
      const grades = await this.prisma.schoolGrade.findMany({
        where: { id: { in: groups.map((g) => g.gradeId) } },
        select: { id: true, name: true },
      });
      const names = new Map(grades.map((g) => [g.id, g.name]));
      return {
        columns: [
          { key: 'className', label: 'Class' },
          { key: 'receipts', label: 'Receipts' },
          { key: 'amount', label: 'Amount ₹' },
        ],
        rows: groups.map((g) => ({
          className: names.get(g.gradeId) ?? '',
          receipts: g._count._all,
          amount: rupees(g._sum.totalAmount ?? 0),
          drillGradeId: g.gradeId,
        })),
        total: groups.length,
        charts: [
          {
            type: 'bar',
            title: 'Class collection',
            data: groups.map((g) => ({
              name: names.get(g.gradeId) ?? '',
              value: rupees(g._sum.totalAmount ?? 0),
            })),
          },
        ],
      };
    }

    const where = this.paidWhere(ctx, extra);
    const [total, list, sum] = await Promise.all([
      this.prisma.schoolFeePayment.count({ where }),
      this.prisma.schoolFeePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: { student: true },
      }),
      this.prisma.schoolFeePayment.aggregate({
        where,
        _sum: { totalAmount: true, discountAmount: true, lateFeeAmount: true },
      }),
    ]);
    const sectionIds = [...new Set(list.map((p) => p.sectionId))];
    const sections = sectionIds.length
      ? await this.prisma.schoolSection.findMany({
          where: { id: { in: sectionIds } },
          include: { grade: true },
        })
      : [];
    const classOf = new Map(
      sections.map((s) => [s.id, `${s.grade.name} ${s.name}`.trim()]),
    );
    const registerLike =
      key === 'fee_register' ||
      key === 'fee_collection' ||
      key === 'fee_monthly' ||
      key === 'fee_daily' ||
      key === 'fee_range';
    return {
      columns: registerLike
        ? [
            { key: 'fullName', label: 'Student' },
            { key: 'admissionNumber', label: 'Admission No' },
            { key: 'className', label: 'Class' },
            { key: 'feeMonth', label: 'Month' },
            { key: 'tuitionAmount', label: 'Tuition ₹' },
            { key: 'otherAmount', label: 'Other ₹' },
            { key: 'lateFeeAmount', label: 'Late Fee ₹' },
            { key: 'totalAmount', label: 'Total ₹' },
            { key: 'paymentMode', label: 'Payment Mode' },
            { key: 'receiptNumber', label: 'Receipt' },
            { key: 'paidAt', label: 'Date' },
            { key: 'status', label: 'Status' },
          ]
        : [
            { key: 'receiptNumber', label: 'Receipt No' },
            { key: 'fullName', label: 'Student' },
            { key: 'feeMonth', label: 'Month' },
            { key: 'paymentMode', label: 'Mode' },
            { key: 'totalAmount', label: 'Amount ₹' },
            { key: 'paidAt', label: 'Paid at' },
            { key: 'status', label: 'Status' },
          ],
      rows: list.map((p) => ({
        receiptNumber: p.receiptNumber,
        fullName: p.student.fullName,
        studentName: p.student.fullName,
        admissionNumber: p.student.admissionNumber,
        className: classOf.get(p.sectionId) ?? '',
        feeMonth: p.feeMonth,
        paymentMode: p.paymentMode,
        tuitionAmount: rupees(p.tuitionAmount),
        otherAmount: rupees(p.otherAmount),
        lateFeeAmount: rupees(p.lateFeeAmount),
        totalAmount: rupees(p.totalAmount),
        paidAt: p.paidAt.toISOString().slice(0, 16),
        status: p.voidedAt ? 'VOID' : p.status,
        studentId: p.studentId,
      })),
      total,
      kpis: [
        {
          key: 'total',
          label: 'Collected',
          value: inr(sum._sum.totalAmount ?? 0),
        },
        { key: 'n', label: 'Receipts', value: total },
        {
          key: 'late',
          label: 'Late fees',
          value: inr(sum._sum.lateFeeAmount ?? 0),
        },
        {
          key: 'disc',
          label: 'Concessions',
          value: inr(sum._sum.discountAmount ?? 0),
        },
      ],
    };
  }

  private async exams(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, yearId, skip, limit, settings } = ctx;
    const where: Prisma.SchoolExamResultWhereInput = {
      tenantId,
      ...(filters.examId ? { examId: filters.examId } : {}),
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(yearId ? { exam: { academicYearId: yearId } } : {}),
      ...(key === 'exam_failed' ? { status: 'FAIL' } : {}),
      ...(key === 'exam_absent' ? { status: 'ABSENT' } : {}),
      ...(key === 'exam_below_pass' || key === 'exam_improve'
        ? { percent: { lt: settings.passPercent } }
        : {}),
    };
    if (key === 'exam_completion' || key === 'exam_missing') {
      const exams = await this.prisma.schoolExam.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        select: {
          id: true,
          name: true,
          status: true,
          publishedAt: true,
          _count: { select: { results: true } },
        },
        take: 100,
      });
      return {
        columns: [
          { key: 'name', label: 'Exam' },
          { key: 'status', label: 'Status' },
          { key: 'results', label: 'Results' },
        ],
        rows: exams.map((e) => ({
          name: e.name,
          status: e.status,
          results: e._count.results,
        })),
        total: exams.length,
      };
    }
    if (
      key === 'exam_class' ||
      key === 'exam_class_avg' ||
      key === 'mis_academic' ||
      key === 'academic_coord'
    ) {
      const results = await this.prisma.schoolExamResult.findMany({
        where,
        include: {
          student: {
            include: {
              enrollments: {
                where: {
                  ...(yearId ? { academicYearId: yearId } : {}),
                  deletedAt: null,
                },
                include: { section: { include: { grade: true } } },
                take: 1,
              },
            },
          },
        },
        take: 4000,
      });
      const map = new Map<string, { n: number; sum: number; pass: number }>();
      for (const r of results) {
        const name =
          r.student.enrollments[0]?.section.grade.name ?? 'Unassigned';
        const cur = map.get(name) ?? { n: 0, sum: 0, pass: 0 };
        cur.n += 1;
        cur.sum += num(r.percent);
        if (num(r.percent) >= settings.passPercent) cur.pass += 1;
        map.set(name, cur);
      }
      const rows = [...map.entries()].map(([className, v]) => ({
        className,
        average: v.n ? Number((v.sum / v.n).toFixed(1)) : 0,
        passPercent: v.n ? Number(((v.pass / v.n) * 100).toFixed(1)) : 0,
        students: v.n,
      }));
      return {
        columns: [
          { key: 'className', label: 'Class' },
          { key: 'average', label: 'Average %' },
          { key: 'passPercent', label: 'Pass %' },
          { key: 'students', label: 'Students' },
        ],
        rows,
        total: rows.length,
        charts: [
          {
            type: 'bar',
            title: 'Class average',
            data: rows.map((r) => ({
              name: String(r.className),
              value: Number(r.average),
            })),
          },
        ],
      };
    }
    if (
      key === 'exam_subject' ||
      key === 'exam_subject_avg' ||
      key === 'exam_subject_compare'
    ) {
      const subjects = await this.prisma.schoolExamResultSubject.groupBy({
        by: ['subjectId'],
        where: {
          tenantId,
          ...(filters.examId ? { result: { examId: filters.examId } } : {}),
        },
        _avg: { percent: true },
        _count: { _all: true },
      });
      const names = await this.prisma.schoolSubject.findMany({
        where: { id: { in: subjects.map((s) => s.subjectId) } },
        select: { id: true, name: true },
      });
      const map = new Map(names.map((s) => [s.id, s.name]));
      return {
        columns: [
          { key: 'subject', label: 'Subject' },
          { key: 'average', label: 'Average %' },
          { key: 'n', label: 'Marks' },
        ],
        rows: subjects.map((s) => ({
          subject: map.get(s.subjectId) ?? '',
          average: Number(num(s._avg.percent).toFixed(1)),
          n: s._count._all,
        })),
        total: subjects.length,
        charts: [
          {
            type: 'bar',
            title: 'Subject average',
            data: subjects.map((s) => ({
              name: map.get(s.subjectId) ?? '',
              value: num(s._avg.percent),
            })),
          },
        ],
      };
    }
    if (key === 'exam_grade' || key === 'exam_pass_fail') {
      const groups = await this.prisma.schoolExamResult.groupBy({
        by: [key === 'exam_grade' ? 'grade' : 'status'],
        where,
        _count: { _all: true },
      });
      const label = key === 'exam_grade' ? 'grade' : 'status';
      return {
        columns: [
          { key: label, label: key === 'exam_grade' ? 'Grade' : 'Status' },
          { key: 'count', label: 'Students' },
        ],
        rows: groups.map((g) => ({
          [label]:
            (g as { grade?: string | null; status?: string })[
              label as 'grade'
            ] ?? '',
          count: g._count._all,
        })),
        total: groups.length,
        charts: [
          {
            type: 'donut',
            title: key,
            data: groups.map((g) => ({
              name: String(
                (g as { grade?: string; status?: string }).grade ??
                  (g as { status?: string }).status ??
                  '',
              ),
              value: g._count._all,
            })),
          },
        ],
      };
    }

    const orderBy: Prisma.SchoolExamResultOrderByWithRelationInput =
      key === 'exam_highest' || key === 'exam_top' || key === 'exam_rank'
        ? { percent: 'desc' }
        : key === 'exam_lowest'
          ? { percent: 'asc' }
          : { updatedAt: 'desc' };
    const [total, list] = await Promise.all([
      this.prisma.schoolExamResult.count({ where }),
      this.prisma.schoolExamResult.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { student: true, exam: true },
      }),
    ]);
    const agg = await this.prisma.schoolExamResult.aggregate({
      where,
      _avg: { percent: true },
      _max: { percent: true },
      _min: { percent: true },
    });
    return {
      columns: [
        { key: 'fullName', label: 'Student' },
        { key: 'exam', label: 'Exam' },
        { key: 'percent', label: '%' },
        { key: 'grade', label: 'Grade' },
        { key: 'status', label: 'Status' },
        { key: 'rankClass', label: 'Class rank' },
      ],
      rows: list.map((r) => ({
        fullName: r.student.fullName,
        studentName: r.student.fullName,
        exam: r.exam.name,
        percent: num(r.percent),
        grade: r.grade ?? '',
        status: r.status,
        rankClass: r.rankClass ?? '',
        totalObtained: num(r.totalObtained),
        totalMax: num(r.totalMax),
        studentId: r.studentId,
      })),
      total,
      kpis: [
        {
          key: 'avg',
          label: 'Average',
          value: Number(num(agg._avg.percent).toFixed(1)),
        },
        {
          key: 'max',
          label: 'Highest',
          value: Number(num(agg._max.percent).toFixed(1)),
        },
        {
          key: 'min',
          label: 'Lowest',
          value: Number(num(agg._min.percent).toFixed(1)),
        },
        {
          key: 'passMark',
          label: 'School pass %',
          value: settings.passPercent,
        },
      ],
    };
  }

  private async admissions(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, skip, limit } = ctx;
    const date = dayBounds(filters.dateFrom, filters.dateTo);
    let status = filters.status;
    if (key === 'adm_approved') status = 'APPROVED';
    if (key === 'adm_rejected') status = 'REJECTED';
    if (key === 'adm_pending') status = 'SUBMITTED';
    if (key === 'adm_cancel') status = 'CANCELLED';
    const where: Prisma.SchoolApplicationWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(filters.gender ? { gender: filters.gender } : {}),
      ...(date ? { submittedAt: { gte: date.start, lte: date.end } } : {}),
      ...(key === 'adm_conversion' ? { studentId: { not: null } } : {}),
    };
    if (key === 'adm_source' || key === 'adm_new_vs_re') {
      const groups = await this.prisma.schoolEnrollment.groupBy({
        by: ['source'],
        where: {
          tenantId,
          deletedAt: null,
          ...(ctx.yearId ? { academicYearId: ctx.yearId } : {}),
        },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'source', label: 'Source' },
          { key: 'count', label: 'Enrollments' },
        ],
        rows: groups.map((g) => ({ source: g.source, count: g._count._all })),
        total: groups.length,
      };
    }
    if (key === 'adm_trend' || key === 'mis_adm_trend') {
      const list = await this.prisma.schoolApplication.findMany({
        where,
        select: { submittedAt: true },
        take: 4000,
      });
      const map = new Map<string, number>();
      for (const a of list) {
        const d = a.submittedAt.toISOString().slice(0, 10);
        map.set(d, (map.get(d) ?? 0) + 1);
      }
      const rows = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => ({ day, count }));
      return {
        columns: [
          { key: 'day', label: 'Date' },
          { key: 'count', label: 'Applications' },
        ],
        rows,
        total: rows.length,
        charts: [
          {
            type: 'area',
            title: 'Applications',
            data: rows.map((r) => ({
              name: String(r.day),
              value: Number(r.count),
            })),
          },
        ],
      };
    }
    const [total, list] = await Promise.all([
      this.prisma.schoolApplication.count({ where }),
      this.prisma.schoolApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
    ]);
    return {
      columns: [
        { key: 'applicationNumber', label: 'Application No' },
        { key: 'fullName', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'gender', label: 'Gender' },
        { key: 'guardianName', label: 'Guardian' },
        { key: 'submittedAt', label: 'Submitted' },
      ],
      rows: list.map((a) => ({
        applicationNumber: a.applicationNumber,
        fullName: a.fullName,
        status: a.status,
        gender: a.gender ?? '',
        guardianName: a.guardianName,
        submittedAt: a.submittedAt.toISOString().slice(0, 10),
      })),
      total,
    };
  }

  private async staff(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, skip, limit } = ctx;
    const where: Prisma.SchoolStaffWhereInput = {
      tenantId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.department ? { department: filters.department } : {}),
      ...(filters.staffId ? { id: filters.staffId } : {}),
      ...(key === 'staff_teaching' ? { staffType: 'TEACHING' } : {}),
      ...(key === 'staff_nonteaching'
        ? { staffType: { not: 'TEACHING' } }
        : {}),
      ...(key === 'staff_exit' ? { status: { not: 'ACTIVE' } } : {}),
    };
    if (key === 'staff_department') {
      const groups = await this.prisma.schoolStaff.groupBy({
        by: ['department'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'department', label: 'Department' },
          { key: 'count', label: 'Staff' },
        ],
        rows: groups.map((g) => ({
          department: g.department ?? 'Unspecified',
          count: g._count._all,
        })),
        total: groups.length,
      };
    }
    if (key === 'staff_ratio') {
      const [staffN, students] = await Promise.all([
        this.prisma.schoolStaff.count({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.schoolEnrollment.count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'ACTIVE',
            ...(ctx.yearId ? { academicYearId: ctx.yearId } : {}),
          },
        }),
      ]);
      return {
        columns: [
          { key: 'staff', label: 'Active staff' },
          { key: 'students', label: 'Active students' },
          { key: 'ratio', label: 'Ratio' },
        ],
        rows: [
          {
            staff: staffN,
            students,
            ratio: staffN ? `1:${Math.round(students / staffN)}` : '—',
          },
        ],
        total: 1,
      };
    }
    const date = dayBounds(filters.dateFrom, filters.dateTo);
    if (key === 'staff_joining' && date) {
      where.joiningDate = { gte: date.start, lte: date.end };
    }
    const [total, list] = await Promise.all([
      this.prisma.schoolStaff.count({ where }),
      this.prisma.schoolStaff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
      }),
    ]);
    return {
      columns: [
        { key: 'employeeCode', label: 'Code' },
        { key: 'fullName', label: 'Name' },
        { key: 'staffType', label: 'Type' },
        { key: 'department', label: 'Department' },
        { key: 'status', label: 'Status' },
        { key: 'joiningDate', label: 'Joining' },
      ],
      rows: list.map((s) => ({
        employeeCode: s.employeeCode,
        fullName: s.fullName,
        staffType: s.staffType,
        department: s.department ?? '',
        status: s.status,
        joiningDate: s.joiningDate
          ? s.joiningDate.toISOString().slice(0, 10)
          : '',
      })),
      total,
    };
  }

  private async transport(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, yearId, skip, limit } = ctx;
    if (key === 'tr_vehicles' || key === 'tr_occupancy' || key === 'tr_seats') {
      const vehicles = await this.prisma.schoolTransportVehicle.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: { _count: { select: { routes: true } } },
      });
      const alloc = await this.prisma.schoolTransportStudentAllocation.groupBy({
        by: ['vehicleId'],
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        _count: { _all: true },
      });
      const occ = new Map(alloc.map((a) => [a.vehicleId ?? '', a._count._all]));
      return {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'registrationNumber', label: 'Registration' },
          { key: 'totalCapacity', label: 'Capacity' },
          { key: 'allocated', label: 'Allocated' },
          { key: 'available', label: 'Available' },
          { key: 'status', label: 'Status' },
        ],
        rows: vehicles.map((v) => ({
          code: v.code,
          registrationNumber: v.registrationNumber,
          totalCapacity: v.totalCapacity,
          allocated: occ.get(v.id) ?? 0,
          available: Math.max(0, v.totalCapacity - (occ.get(v.id) ?? 0)),
          status: v.status,
        })),
        total: vehicles.length,
      };
    }
    if (key === 'tr_routes' || key === 'tr_route_students') {
      const routes = await this.prisma.schoolTransportRoute.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: { _count: { select: { allocations: true, stops: true } } },
      });
      return {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Route' },
          { key: 'students', label: 'Students' },
          { key: 'stops', label: 'Stops' },
          { key: 'status', label: 'Status' },
        ],
        rows: routes.map((r) => ({
          code: r.code,
          name: r.name,
          routeName: r.name,
          students: r._count.allocations,
          stops: r._count.stops,
          status: r.status,
        })),
        total: routes.length,
      };
    }
    if (key === 'tr_stops' || key === 'tr_stop_students') {
      const stops = await this.prisma.schoolTransportStop.findMany({
        where: { tenantId, deletedAt: null },
        include: { _count: { select: { pickupAllocations: true } } },
        skip,
        take: limit,
      });
      return {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Stop' },
          { key: 'students', label: 'Pickup students' },
        ],
        rows: stops.map((s) => ({
          code: s.code,
          name: s.name,
          students: s._count.pickupAllocations,
        })),
        total: stops.length,
      };
    }
    if (key === 'tr_drivers') {
      const list = await this.prisma.schoolTransportPersonnel.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(filters.status ? { status: filters.status } : {}),
        },
      });
      return {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'fullName', label: 'Name' },
          { key: 'kind', label: 'Role' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((p) => ({
          code: p.code,
          fullName: p.fullName,
          kind: p.kind,
          status: p.status,
        })),
        total: list.length,
      };
    }
    if (key === 'tr_fuel' || key === 'tr_cost' || key === 'tr_maint') {
      if (key === 'tr_maint') {
        const list = await this.prisma.schoolTransportMaintenance.findMany({
          where: {
            tenantId,
            deletedAt: null,
            ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          },
          include: { vehicle: true },
          skip,
          take: limit,
          orderBy: { date: 'desc' },
        });
        return {
          columns: [
            { key: 'vehicle', label: 'Vehicle' },
            { key: 'serviceType', label: 'Service' },
            { key: 'cost', label: 'Cost ₹' },
            { key: 'date', label: 'Date' },
          ],
          rows: list.map((m) => ({
            vehicle: m.vehicle.registrationNumber,
            serviceType: m.serviceType,
            cost: rupees(m.cost),
            date: m.date.toISOString().slice(0, 10),
          })),
          total: list.length,
        };
      }
      const list = await this.prisma.schoolTransportFuelLog.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        },
        include: { vehicle: true },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      });
      const expenses =
        key === 'tr_cost'
          ? await this.prisma.schoolTransportExpense.aggregate({
              where: { tenantId, deletedAt: null },
              _sum: { amount: true },
            })
          : null;
      return {
        columns: [
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'litres', label: 'Litres' },
          { key: 'totalAmount', label: 'Amount ₹' },
          { key: 'date', label: 'Date' },
        ],
        rows: list.map((f) => ({
          vehicle: f.vehicle.registrationNumber,
          litres: num(f.litres),
          totalAmount: rupees(f.totalAmount),
          date: f.date.toISOString().slice(0, 10),
        })),
        total: list.length,
        kpis: expenses
          ? [
              {
                key: 'exp',
                label: 'Other expenses',
                value: inr(expenses._sum.amount ?? 0),
              },
            ]
          : [],
      };
    }
    if (key === 'tr_attendance') {
      const date = dayBounds(filters.dateFrom, filters.dateTo);
      const list = await this.prisma.schoolTransportBoardingEvent.findMany({
        where: {
          tenantId,
          ...(filters.routeId ? { routeId: filters.routeId } : {}),
          ...(date ? { occurredAt: { gte: date.start, lte: date.end } } : {}),
        },
        include: { student: true },
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      });
      return {
        columns: [
          { key: 'fullName', label: 'Student' },
          { key: 'eventType', label: 'Event' },
          { key: 'occurredAt', label: 'Time' },
        ],
        rows: list.map((e) => ({
          fullName: e.student.fullName,
          eventType: e.eventType,
          occurredAt: e.occurredAt.toISOString().slice(0, 16),
        })),
        total: list.length,
      };
    }
    if (key === 'tr_fee' || key === 'tr_route_fee') {
      const list = await this.prisma.schoolTransportFeeAssignment.findMany({
        where: {
          tenantId,
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: { student: true },
        skip,
        take: limit,
      });
      return {
        columns: [
          { key: 'fullName', label: 'Student' },
          { key: 'amount', label: 'Amount ₹' },
          { key: 'netAmount', label: 'Net ₹' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((a) => ({
          fullName: a.student.fullName,
          amount: rupees(a.amount),
          netAmount: rupees(a.netAmount),
          status: a.status,
        })),
        total: list.length,
      };
    }
    const list = await this.prisma.schoolTransportStudentAllocation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.status ? { status: filters.status } : { status: 'ACTIVE' }),
      },
      include: { student: true, route: true },
      skip,
      take: limit,
    });
    const total = await this.prisma.schoolTransportStudentAllocation.count({
      where: {
        tenantId,
        deletedAt: null,
        ...(yearId ? { academicYearId: yearId } : {}),
      },
    });
    return {
      columns: [
        { key: 'fullName', label: 'Student' },
        { key: 'routeName', label: 'Route' },
        { key: 'status', label: 'Status' },
      ],
      rows: list.map((a) => ({
        fullName: a.student.fullName,
        studentName: a.student.fullName,
        routeName: a.route.name,
        status: a.status,
      })),
      total,
    };
  }

  private async inventory(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, skip, limit, filters } = ctx;
    if (key === 'inv_supplier') {
      const list = await this.prisma.schoolStationerySupplier.findMany({
        where: { tenantId, deletedAt: null },
        take: limit,
        skip,
      });
      return {
        columns: [
          { key: 'name', label: 'Supplier' },
          { key: 'phone', label: 'Phone' },
        ],
        rows: list.map((s) => ({
          name: s.name,
          phone: (s as { phone?: string }).phone ?? '',
        })),
        total: list.length,
      };
    }
    if (key === 'inv_purchase' || key === 'inv_receive') {
      const date = dayBounds(filters.dateFrom, filters.dateTo);
      const list = await this.prisma.schoolStationeryPurchase.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(date ? { purchaseDate: { gte: date.start, lte: date.end } } : {}),
        },
        skip,
        take: limit,
        orderBy: { purchaseDate: 'desc' },
        include: { supplier: true },
      });
      return {
        columns: [
          { key: 'invoiceNo', label: 'Invoice' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'grandTotal', label: 'Total ₹' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((p) => ({
          invoiceNo: p.invoiceNo,
          supplier: p.supplier.name,
          grandTotal: rupees(p.grandTotal),
          status: p.status,
        })),
        total: list.length,
      };
    }
    if (key === 'inv_issue') {
      const date = dayBounds(filters.dateFrom, filters.dateTo);
      const [total, list] = await Promise.all([
        this.prisma.schoolStationerySale.count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'COMPLETED',
            ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
          },
        }),
        this.prisma.schoolStationerySale.findMany({
          where: {
            tenantId,
            deletedAt: null,
            status: 'COMPLETED',
            ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { student: true },
        }),
      ]);
      const paid = list.reduce((s, r) => s + r.amountPaid, 0);
      return {
        columns: [
          { key: 'invoiceNo', label: 'Invoice' },
          { key: 'customer', label: 'Customer' },
          { key: 'grandTotal', label: 'Total ₹' },
          { key: 'amountPaid', label: 'Paid ₹' },
          { key: 'status', label: 'Status' },
          { key: 'cashierName', label: 'Cashier' },
        ],
        rows: list.map((s) => ({
          invoiceNo: s.invoiceNo,
          customer: s.student?.fullName || s.walkInName || s.customerType,
          grandTotal: rupees(s.grandTotal),
          amountPaid: rupees(s.amountPaid),
          status: s.status,
          cashierName: s.cashierName,
        })),
        total,
        kpis: [
          { key: 'n', label: 'Bills', value: total },
          { key: 'paid', label: 'Collected', value: inr(paid) },
        ],
      };
    }
    if (key === 'inv_return') {
      const list = await this.prisma.schoolStationeryReturn.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return {
        columns: [
          { key: 'id', label: 'Return' },
          { key: 'status', label: 'Status' },
        ],
        rows: list.map((r) => ({
          id: r.id.slice(0, 8),
          status: r.reason ?? 'RETURNED',
        })),
        total: list.length,
      };
    }
    if (key === 'inv_movement' || key === 'inv_adjust') {
      const list = await this.prisma.schoolStationeryStockMovement.findMany({
        where: {
          tenantId,
          ...(key === 'inv_adjust' ? { type: { contains: 'ADJUST' } } : {}),
        },
        include: { product: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return {
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'type', label: 'Type' },
          { key: 'qty', label: 'Qty' },
        ],
        rows: list.map((m) => ({
          name: m.product.name,
          type: m.type,
          qty: num(m.qty),
        })),
        total: list.length,
      };
    }
    if (key === 'inv_category') {
      const products = await this.prisma.schoolStationeryProduct.findMany({
        where: { tenantId, deletedAt: null },
        include: { category: true },
      });
      const map = new Map<string, number>();
      for (const p of products) {
        const n = p.category.name;
        map.set(n, (map.get(n) ?? 0) + num(p.qtyOnHand));
      }
      const rows = [...map.entries()].map(([category, qty]) => ({
        category,
        qty,
      }));
      return {
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'qty', label: 'Qty' },
        ],
        rows,
        total: rows.length,
      };
    }
    const where: Prisma.SchoolStationeryProductWhereInput = {
      tenantId,
      deletedAt: null,
      ...(key === 'inv_low'
        ? {
            /* filled below */
          }
        : {}),
      ...(key === 'inv_out' ? { qtyOnHand: 0 } : {}),
    };
    const products = await this.prisma.schoolStationeryProduct.findMany({
      where: { tenantId, deletedAt: null },
      skip: key === 'inv_low' ? 0 : skip,
      take: key === 'inv_low' ? 500 : limit,
    });
    const filtered =
      key === 'inv_low'
        ? products.filter((p) => num(p.qtyOnHand) <= num(p.minStock))
        : key === 'inv_out'
          ? products.filter((p) => num(p.qtyOnHand) <= 0)
          : products;
    const value = products.reduce(
      (s, p) => s + num(p.qtyOnHand) * p.purchasePrice,
      0,
    );
    return {
      columns: [
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product' },
        { key: 'qtyOnHand', label: 'Qty' },
        { key: 'minStock', label: 'Min' },
        { key: 'value', label: 'Value ₹' },
      ],
      rows: filtered.slice(0, limit).map((p) => ({
        sku: p.sku,
        name: p.name,
        qtyOnHand: num(p.qtyOnHand),
        minStock: num(p.minStock),
        value: rupees(num(p.qtyOnHand) * p.purchasePrice),
      })),
      total: filtered.length,
      kpis: [{ key: 'val', label: 'Stock valuation', value: inr(value) }],
    };
  }

  private async comms(key: string, ctx: QueryCtx): Promise<Built> {
    const { tenantId, filters, skip, limit } = ctx;
    const date = dayBounds(filters.dateFrom, filters.dateTo);
    if (key.startsWith('push_')) {
      const status =
        key === 'push_delivered'
          ? 'DELIVERED'
          : key === 'push_opened'
            ? 'OPENED'
            : key === 'push_failed'
              ? 'FAILED'
              : filters.status;
      const where: Prisma.SchoolPushRecipientWhereInput = {
        tenantId,
        ...(status ? { status } : {}),
        ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
      };
      const [total, list] = await Promise.all([
        this.prisma.schoolPushRecipient.count({ where }),
        this.prisma.schoolPushRecipient.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return {
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'platform', label: 'Platform' },
          { key: 'createdAt', label: 'Created' },
        ],
        rows: list.map((r) => ({
          status: r.status,
          platform: r.platform ?? '',
          createdAt: r.createdAt.toISOString().slice(0, 16),
        })),
        total,
      };
    }
    if (key === 'wa_campaign') {
      const list = await this.prisma.schoolWhatsappCampaign.findMany({
        where: {
          tenantId,
          ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return {
        columns: [
          { key: 'name', label: 'Campaign' },
          { key: 'sentCount', label: 'Sent' },
          { key: 'deliveredCount', label: 'Delivered' },
          { key: 'failedCount', label: 'Failed' },
        ],
        rows: list.map((c) => ({
          name: c.name,
          sentCount: c.sentCount,
          deliveredCount: c.deliveredCount,
          failedCount: c.failedCount,
        })),
        total: list.length,
      };
    }
    if (key === 'wa_template') {
      const groups = await this.prisma.schoolWhatsappMessage.groupBy({
        by: ['templateId'],
        where: { tenantId, templateId: { not: null } },
        _count: { _all: true },
      });
      return {
        columns: [
          { key: 'templateId', label: 'Template' },
          { key: 'count', label: 'Messages' },
        ],
        rows: groups.map((g) => ({
          templateId: g.templateId ?? '',
          count: g._count._all,
        })),
        total: groups.length,
      };
    }
    const status =
      key === 'wa_delivered'
        ? 'DELIVERED'
        : key === 'wa_read'
          ? 'READ'
          : key === 'wa_failed'
            ? 'FAILED'
            : filters.status;
    const where: Prisma.SchoolWhatsappMessageWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(date ? { createdAt: { gte: date.start, lte: date.end } } : {}),
    };
    const [total, list] = await Promise.all([
      this.prisma.schoolWhatsappMessage.count({ where }),
      this.prisma.schoolWhatsappMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      columns: [
        { key: 'status', label: 'Status' },
        { key: 'direction', label: 'Direction' },
        { key: 'type', label: 'Type' },
        { key: 'createdAt', label: 'Created' },
      ],
      rows: list.map((m) => ({
        status: m.status,
        direction: m.direction,
        type: m.type,
        createdAt: m.createdAt.toISOString().slice(0, 16),
      })),
      total,
    };
  }

  private async mis(key: string, ctx: QueryCtx): Promise<Built> {
    if (
      key === 'principal_daily' ||
      key === 'mis_ops' ||
      key === 'mis_monthly'
    ) {
      const dash = await this.dashboard(ctx.tenantId, ctx.filters);
      return {
        columns: [
          { key: 'label', label: 'KPI' },
          { key: 'value', label: 'Value' },
        ],
        rows: dash.kpis.map((k) => ({ label: k.label, value: k.value })),
        total: dash.kpis.length,
        kpis: dash.kpis,
        charts: dash.charts,
      };
    }
    if (key === 'mis_staff') return this.staff('staff_list', ctx);
    if (key === 'mis_enroll_trend') return this.students('student_new', ctx);
    if (key === 'mis_adm_trend') return this.admissions('adm_trend', ctx);
    if (key === 'mis_transport') return this.transport('tr_alloc', ctx);
    if (key === 'mis_inventory') return this.inventory('inv_stock', ctx);
    return this.students('student_strength', ctx);
  }
}

type Built = {
  columns: Col[];
  rows: Row[];
  total: number;
  kpis?: Kpi[];
  charts?: Chart[];
};

type QueryCtx = {
  tenantId: string;
  filters: ReportFilters;
  yearId?: string;
  page: number;
  limit: number;
  skip: number;
  settings: { attendanceMinPercent: number; passPercent: number };
  report: ReportDef;
};

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function csvCell(v: string | number | null | undefined) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
