import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisCalendarService } from './school-sis-calendar.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import { SchoolReportBrandingService } from './report-engine/report-branding.service';
import { SchoolReportPdfService } from './report-engine/report-pdf.service';
import { SchoolSisAccountsPostingService } from './school-sis-accounts.posting.service';
import {
  evaluateFormulaPaise,
  formatInrPaise,
  maskAccount,
  maskPan,
  paiseToRupees,
} from './school-sis-hr-formula';
import type {
  AssignSalaryDto,
  CreateHrEmployeeDto,
  CreatePayrollDto,
  ExitDto,
  ImportEmployeesDto,
  LeaveRequestDto,
  LoanDto,
  MarkStaffAttendanceDto,
  PayLineDto,
  ReimbursementDto,
  SalaryRevisionDto,
  SaveHrBankDto,
  SaveHrComponentDto,
  SaveHrDepartmentDto,
  SaveHrDesignationDto,
  SaveHrEmployeeTypeDto,
  SaveHrEmploymentDto,
  SaveHrSettingsDto,
  SaveHrStructureDto,
  SaveLeavePolicyDto,
  SaveLeaveTypeDto,
  StatutoryRuleDto,
} from './dto/school-hr.dto';
import type { ReportDocument } from './report-engine/report-types';

export type HrActor = {
  userId: string;
  manageHr: boolean;
  payrollView: boolean;
  payrollCalc: boolean;
  payrollApprove: boolean;
  payrollPay: boolean;
  revealBank: boolean;
  ip?: string;
};

const DEFAULT_TYPES = [
  { code: 'PERMANENT', name: 'Permanent', sortOrder: 1 },
  { code: 'PROBATION', name: 'Probation', sortOrder: 2 },
  { code: 'CONTRACT', name: 'Contract', sortOrder: 3 },
  { code: 'TEMPORARY', name: 'Temporary', sortOrder: 4 },
  { code: 'PART_TIME', name: 'Part-time', sortOrder: 5 },
  { code: 'GUEST', name: 'Guest Faculty', sortOrder: 6 },
  { code: 'CONSULTANT', name: 'Consultant', sortOrder: 7 },
  { code: 'INTERN', name: 'Intern', sortOrder: 8 },
];

const DEFAULT_DEPTS = [
  { code: 'ADMIN', name: 'Administration' },
  { code: 'ACAD', name: 'Academics' },
  { code: 'ACCT', name: 'Accounts' },
  { code: 'LIB', name: 'Library' },
  { code: 'TRN', name: 'Transport' },
  { code: 'MNT', name: 'Maintenance' },
  { code: 'OFF', name: 'Office' },
  { code: 'IT', name: 'IT' },
  { code: 'SEC', name: 'Security' },
];

const DEFAULT_DESIG = [
  { code: 'PRIN', name: 'Principal' },
  { code: 'VP', name: 'Vice Principal' },
  { code: 'TCH', name: 'Teacher' },
  { code: 'ACCT', name: 'Accountant' },
  { code: 'CLK', name: 'Clerk' },
  { code: 'LIB', name: 'Librarian' },
  { code: 'DRV', name: 'Driver' },
  { code: 'LAB', name: 'Lab Assistant' },
  { code: 'OA', name: 'Office Assistant' },
  { code: 'SEC', name: 'Security' },
  { code: 'PEON', name: 'Peon' },
];

const DEFAULT_LEAVE = [
  { code: 'CL', name: 'Casual Leave', paid: true, isLop: false },
  { code: 'ML', name: 'Medical Leave', paid: true, isLop: false },
  { code: 'EL', name: 'Earned Leave', paid: true, isLop: false },
  { code: 'PL', name: 'Privilege Leave', paid: true, isLop: false },
  { code: 'MAT', name: 'Maternity Leave', paid: true, isLop: false },
  { code: 'PAT', name: 'Paternity Leave', paid: true, isLop: false },
  { code: 'LOP', name: 'Loss of Pay', paid: false, isLop: true },
];

const DEFAULT_COMPONENTS: Array<{
  code: string;
  name: string;
  kind: string;
  calcType: string;
  formula?: string;
  sortOrder: number;
}> = [
  {
    code: 'BASIC',
    name: 'Basic Salary',
    kind: 'EARNING',
    calcType: 'FIXED',
    sortOrder: 1,
  },
  {
    code: 'DA',
    name: 'Dearness Allowance',
    kind: 'EARNING',
    calcType: 'FIXED',
    sortOrder: 2,
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    kind: 'EARNING',
    calcType: 'FORMULA',
    formula: 'BASIC * 0.20',
    sortOrder: 3,
  },
  {
    code: 'TRANSPORT',
    name: 'Transport Allowance',
    kind: 'EARNING',
    calcType: 'FIXED',
    sortOrder: 4,
  },
  {
    code: 'SPECIAL',
    name: 'Special Allowance',
    kind: 'EARNING',
    calcType: 'FIXED',
    sortOrder: 5,
  },
  {
    code: 'PF',
    name: 'Provident Fund',
    kind: 'DEDUCTION',
    calcType: 'FORMULA',
    formula: 'BASIC * 0.12',
    sortOrder: 10,
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    kind: 'DEDUCTION',
    calcType: 'FIXED',
    sortOrder: 11,
  },
  {
    code: 'LOP',
    name: 'Loss of Pay',
    kind: 'DEDUCTION',
    calcType: 'FORMULA',
    formula: 'GROSS * LOP_DAYS / WORKING_DAYS',
    sortOrder: 12,
  },
  {
    code: 'LOAN',
    name: 'Loan Deduction',
    kind: 'DEDUCTION',
    calcType: 'MANUAL',
    sortOrder: 13,
  },
];

function monthRange(periodMonth: string) {
  const [y, m] = periodMonth.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  return { from, to, days: to.getUTCDate() };
}

function toInt(p: bigint) {
  if (p > 2_000_000_000n || p < -2_000_000_000n) {
    throw new BadRequestException('Amount exceeds supported payroll range');
  }
  return Number(p);
}

function dayKey(d: Date | string) {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

@Injectable()
export class SchoolSisHrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly calendar: SchoolSisCalendarService,
    private readonly events: SchoolSisEventBus,
    private readonly branding: SchoolReportBrandingService,
    private readonly pdf: SchoolReportPdfService,
    private readonly accounts: SchoolSisAccountsPostingService,
  ) {}

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolHrSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
    if (
      !(await this.prisma.schoolHrEmployeeType.count({ where: { tenantId } }))
    ) {
      await this.prisma.schoolHrEmployeeType.createMany({
        data: DEFAULT_TYPES.map((t) => ({ tenantId, ...t })),
      });
    }
    if (
      !(await this.prisma.schoolHrDepartment.count({ where: { tenantId } }))
    ) {
      await this.prisma.schoolHrDepartment.createMany({
        data: DEFAULT_DEPTS.map((d, i) => ({ tenantId, ...d, sortOrder: i })),
      });
    }
    if (
      !(await this.prisma.schoolHrDesignation.count({ where: { tenantId } }))
    ) {
      await this.prisma.schoolHrDesignation.createMany({
        data: DEFAULT_DESIG.map((d) => ({ tenantId, ...d })),
      });
    }
    if (!(await this.prisma.schoolHrLeaveType.count({ where: { tenantId } }))) {
      await this.prisma.schoolHrLeaveType.createMany({
        data: DEFAULT_LEAVE.map((t, i) => ({ tenantId, ...t, sortOrder: i })),
      });
    }
    if (
      !(await this.prisma.schoolHrSalaryComponent.count({
        where: { tenantId },
      }))
    ) {
      await this.prisma.schoolHrSalaryComponent.createMany({
        data: DEFAULT_COMPONENTS.map((c) => ({ tenantId, ...c })),
      });
    }
    if (
      !(await this.prisma.schoolHrStatutoryRule.count({ where: { tenantId } }))
    ) {
      await this.prisma.schoolHrStatutoryRule.create({
        data: {
          tenantId,
          code: 'PF_EMPLOYEE',
          name: 'Employee PF (configurable)',
          rateBps: 1200,
          effectiveFrom: new Date('2000-01-01'),
        },
      });
    }
    return this.prisma.schoolHrSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  private async audit(
    tenantId: string,
    actor: HrActor,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.prisma.schoolHrAudit.create({
      data: {
        tenantId,
        actorId: actor.userId,
        action,
        entity: String(extra.entity ?? 'hr'),
        entityId: extra.entityId ? String(extra.entityId) : undefined,
        staffId: extra.staffId ? String(extra.staffId) : undefined,
        beforeJson: extra.before as Prisma.InputJsonValue,
        afterJson: extra.after as Prisma.InputJsonValue,
        ip: actor.ip,
      },
    });
  }

  private async timeline(
    tenantId: string,
    staffId: string,
    event: string,
    detail?: string,
    actorId?: string,
  ) {
    await this.prisma.schoolHrTimelineEvent.create({
      data: { tenantId, staffId, event, detail, actorId },
    });
  }

  async dashboard(tenantId: string, periodMonth?: string) {
    const settings = await this.ensureSetup(tenantId);
    const month = periodMonth || new Date().toISOString().slice(0, 7);
    const today = new Date();
    const todayKey = dayKey(today);
    const [staff, attToday, leaveToday, run, expiring] = await Promise.all([
      this.prisma.schoolStaff.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          hrEmployment: { include: { department: true, employeeType: true } },
        },
      }),
      this.prisma.schoolHrAttendance.findMany({
        where: { tenantId, date: new Date(todayKey) },
      }),
      this.prisma.schoolHrLeaveRequest.findMany({
        where: {
          tenantId,
          status: 'APPROVED',
          fromDate: { lte: new Date(todayKey) },
          toDate: { gte: new Date(todayKey) },
        },
      }),
      this.prisma.schoolHrPayrollRun.findFirst({
        where: { tenantId, periodMonth: month, status: { not: 'REVERSED' } },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.schoolHrDocument.count({
        where: {
          tenantId,
          expiryDate: {
            gte: today,
            lte: new Date(today.getTime() + 30 * 86400000),
          },
        },
      }),
    ]);
    const active = staff.filter((s) => s.status === 'ACTIVE');
    const byType: Record<string, number> = {};
    const byDept: Record<string, number> = {};
    for (const s of active) {
      const t = s.hrEmployment?.employeeType?.name || s.staffType;
      byType[t] = (byType[t] ?? 0) + 1;
      const d =
        s.hrEmployment?.department?.name || s.department || 'Unassigned';
      byDept[d] = (byDept[d] ?? 0) + 1;
    }
    const attCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0 };
    for (const a of attToday) {
      if (a.status in attCounts)
        (attCounts as Record<string, number>)[a.status] += 1;
    }
    const birthdays = active
      .filter(
        (s) =>
          s.dateOfBirth && s.dateOfBirth.getUTCMonth() === today.getUTCMonth(),
      )
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth,
      }));
    const anniversaries = active
      .filter(
        (s) =>
          s.joiningDate && s.joiningDate.getUTCMonth() === today.getUTCMonth(),
      )
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        joiningDate: s.joiningDate,
      }));
    const paid =
      run?.lines
        .filter((l) => l.payStatus === 'PAID')
        .reduce((s, l) => s + l.netPaise, 0) ?? 0;
    const net = run?.lines.reduce((s, l) => s + l.netPaise, 0) ?? 0;
    return {
      settings,
      periodMonth: month,
      kpis: {
        total: staff.length,
        teaching: staff.filter((s) => s.staffType === 'TEACHING').length,
        nonTeaching: staff.filter((s) => s.staffType !== 'TEACHING').length,
        active: active.length,
        onLeaveToday: leaveToday.length,
        presentToday: attCounts.PRESENT,
        absentToday: attCounts.ABSENT,
        lateToday: attCounts.LATE,
        payrollGross: run?.lines.reduce((s, l) => s + l.grossPaise, 0) ?? 0,
        payrollNet: net,
        salaryPaid: paid,
        salaryPending: net - paid,
        pendingPayroll:
          run && !['PAID', 'LOCKED', 'PROCESSED'].includes(run.status),
        expiringDocuments: expiring,
      },
      byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
      byDept: Object.entries(byDept).map(([name, value]) => ({ name, value })),
      attendance: attCounts,
      leave: {
        pending: await this.prisma.schoolHrLeaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        approved: await this.prisma.schoolHrLeaveRequest.count({
          where: { tenantId, status: 'APPROVED' },
        }),
        rejected: await this.prisma.schoolHrLeaveRequest.count({
          where: { tenantId, status: 'REJECTED' },
        }),
      },
      payrollStatus: run?.status ?? 'NOT_STARTED',
      birthdays,
      anniversaries,
    };
  }

  async departments(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrDepartment.findMany({
      where: { tenantId, deletedAt: null },
      include: { head: { select: { id: true, fullName: true } }, parent: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveDepartment(
    tenantId: string,
    dto: SaveHrDepartmentDto,
    id?: string,
  ) {
    await this.ensureSetup(tenantId);
    const data = {
      code: dto.code.toUpperCase(),
      name: dto.name,
      parentId: dto.parentId,
      description: dto.description,
      headStaffId: dto.headStaffId,
      active: dto.active ?? true,
    };
    if (id)
      return this.prisma.schoolHrDepartment.update({ where: { id }, data });
    return this.prisma.schoolHrDepartment.create({
      data: { tenantId, ...data },
    });
  }

  async designations(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrDesignation.findMany({
      where: { tenantId, deletedAt: null },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  async saveDesignation(
    tenantId: string,
    dto: SaveHrDesignationDto,
    id?: string,
  ) {
    await this.ensureSetup(tenantId);
    const data = {
      code: dto.code.toUpperCase(),
      name: dto.name,
      departmentId: dto.departmentId,
      grade: dto.grade,
      jobDescription: dto.jobDescription,
      salaryMinPaise: dto.salaryMinPaise ?? 0,
      salaryMaxPaise: dto.salaryMaxPaise ?? 0,
      active: dto.active ?? true,
    };
    if (id)
      return this.prisma.schoolHrDesignation.update({ where: { id }, data });
    return this.prisma.schoolHrDesignation.create({
      data: { tenantId, ...data },
    });
  }

  async employeeTypes(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrEmployeeType.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveEmployeeType(tenantId: string, dto: SaveHrEmployeeTypeDto) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrEmployeeType.upsert({
      where: { tenantId_code: { tenantId, code: dto.code.toUpperCase() } },
      update: { name: dto.name, active: dto.active ?? true },
      create: {
        tenantId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        active: dto.active ?? true,
      },
    });
  }

  async nextEmployeeCode(tenantId: string) {
    const settings = await this.ensureSetup(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const seq = await this.prisma.schoolIdSequence.upsert({
      where: {
        tenantId_academicYearId_kind: {
          tenantId,
          academicYearId: year.id,
          kind: 'HR_EMP',
        },
      },
      update: { lastValue: { increment: 1 } },
      create: {
        tenantId,
        academicYearId: year.id,
        kind: 'HR_EMP',
        lastValue: 1,
      },
    });
    return `${settings.employeeCodePrefix}-${year.code}-${String(seq.lastValue).padStart(4, '0')}`;
  }

  async createEmployee(
    tenantId: string,
    dto: CreateHrEmployeeDto,
    actor: HrActor,
  ) {
    await this.ensureSetup(tenantId);
    const code =
      dto.employeeCode?.trim() || (await this.nextEmployeeCode(tenantId));
    const staff = await this.prisma.schoolStaff.create({
      data: {
        tenantId,
        employeeCode: code.toUpperCase(),
        fullName: dto.fullName.trim(),
        staffType: dto.staffType ?? 'TEACHING',
        gender: dto.gender,
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
      },
    });
    if (dto.departmentId || dto.designationId || dto.employeeTypeId) {
      await this.saveEmployment(
        tenantId,
        staff.id,
        {
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          employeeTypeId: dto.employeeTypeId,
        },
        actor,
      );
    }
    await this.timeline(
      tenantId,
      staff.id,
      'Joining',
      'Employee created',
      actor.userId,
    );
    await this.audit(tenantId, actor, 'CREATED', {
      entity: 'employee',
      staffId: staff.id,
    });
    return this.employee(tenantId, staff.id, actor);
  }

  async employees(
    tenantId: string,
    q: {
      staffType?: string;
      departmentId?: string;
      status?: string;
      search?: string;
      page?: number;
    },
    actor: HrActor,
  ) {
    await this.ensureSetup(tenantId);
    const page = Math.max(1, q.page ?? 1);
    const take = 50;
    const where: Prisma.SchoolStaffWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.staffType ? { staffType: q.staffType } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.departmentId
        ? { hrEmployment: { departmentId: q.departmentId } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: 'insensitive' } },
              { employeeCode: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
              { email: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.schoolStaff.count({ where }),
      this.prisma.schoolStaff.findMany({
        where,
        include: {
          hrEmployment: {
            include: {
              department: true,
              designation: true,
              employeeType: true,
            },
          },
          hrSalaries: {
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            include: { structure: true },
          },
        },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * take,
        take,
      }),
    ]);
    return {
      total,
      page,
      rows: rows.map((s) => this.serializeEmployee(s, actor)),
    };
  }

  private serializeEmployee(
    s: {
      id: string;
      employeeCode: string;
      fullName: string;
      staffType: string;
      status: string;
      photoUrl: string | null;
      phone: string | null;
      email: string | null;
      joiningDate: Date | null;
      gender: string | null;
      department: string | null;
      designation: string | null;
      hrEmployment: {
        panFull: string | null;
        department?: { name: string } | null;
        designation?: { name: string } | null;
        employeeType?: { name: string } | null;
      } | null;
      hrSalaries?: Array<{ basicPaise: number; structure: { name: string } }>;
    },
    actor: HrActor,
  ) {
    const sal = s.hrSalaries?.[0];
    return {
      id: s.id,
      employeeCode: s.employeeCode,
      fullName: s.fullName,
      staffType: s.staffType,
      status: s.status,
      photoUrl: s.photoUrl,
      phone: s.phone,
      email: s.email,
      joiningDate: s.joiningDate,
      gender: s.gender,
      department: s.hrEmployment?.department?.name || s.department,
      designation: s.hrEmployment?.designation?.name || s.designation,
      employeeType: s.hrEmployment?.employeeType?.name,
      pan: s.hrEmployment?.panFull
        ? actor.revealBank
          ? s.hrEmployment.panFull
          : maskPan(s.hrEmployment.panFull)
        : null,
      salary: sal && actor.payrollView ? paiseToRupees(sal.basicPaise) : null,
      structure: sal && actor.payrollView ? sal.structure.name : null,
    };
  }

  async employee(tenantId: string, staffId: string, actor: HrActor) {
    await this.ensureSetup(tenantId);
    const s = await this.prisma.schoolStaff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
      include: {
        hrEmployment: {
          include: { department: true, designation: true, employeeType: true },
        },
        hrBankAccounts: true,
        hrDocuments: { orderBy: { createdAt: 'desc' } },
        hrContacts: true,
        hrNominees: true,
        hrSalaries: {
          orderBy: { effectiveFrom: 'desc' },
          include: { structure: true },
        },
        hrRevisions: { orderBy: { effectiveDate: 'desc' } },
        hrLeaveBalances: { include: { leaveType: true } },
        hrLeaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { leaveType: true },
        },
        hrAttendance: { orderBy: { date: 'desc' }, take: 40 },
        hrLoans: { where: { status: 'ACTIVE' } },
        hrReimbursements: { orderBy: { createdAt: 'desc' }, take: 10 },
        hrTimeline: { orderBy: { createdAt: 'desc' }, take: 30 },
        hrPayrollLines: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { run: true },
        },
      },
    });
    if (!s) throw new NotFoundException('Employee not found');
    if (!actor.payrollView && !actor.manageHr) {
      // still return profile without salary
    }
    const banks = s.hrBankAccounts.map((b) => ({
      ...b,
      accountFull: actor.revealBank
        ? b.accountFull
        : maskAccount(b.accountFull),
    }));
    if (actor.revealBank) {
      await this.audit(tenantId, actor, 'VIEWED_SENSITIVE', {
        entity: 'bank',
        staffId,
      });
    }
    const payslips = actor.payrollView
      ? s.hrPayrollLines.filter((l) =>
          ['APPROVED', 'PROCESSED', 'PAID', 'LOCKED'].includes(l.run.status),
        )
      : [];
    return {
      ...s,
      hrBankAccounts: banks,
      hrPayrollLines: payslips,
      pan: s.hrEmployment?.panFull
        ? actor.revealBank
          ? s.hrEmployment.panFull
          : maskPan(s.hrEmployment.panFull)
        : null,
    };
  }

  async saveEmployment(
    tenantId: string,
    staffId: string,
    dto: SaveHrEmploymentDto,
    actor: HrActor,
  ) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Employee not found');
    const panFull = dto.panFull?.toUpperCase();
    const row = await this.prisma.schoolHrEmployment.upsert({
      where: { staffId },
      create: {
        tenantId,
        staffId,
        ...dto,
        panFull,
        panMasked: panFull ? maskPan(panFull) : undefined,
      },
      update: {
        ...dto,
        panFull,
        panMasked: panFull ? maskPan(panFull) : undefined,
      },
    });
    if (dto.departmentId) {
      const d = await this.prisma.schoolHrDepartment.findFirst({
        where: { id: dto.departmentId },
      });
      if (d)
        await this.prisma.schoolStaff.update({
          where: { id: staffId },
          data: { department: d.name },
        });
    }
    if (dto.designationId) {
      const d = await this.prisma.schoolHrDesignation.findFirst({
        where: { id: dto.designationId },
      });
      if (d)
        await this.prisma.schoolStaff.update({
          where: { id: staffId },
          data: { designation: d.name },
        });
    }
    await this.timeline(
      tenantId,
      staffId,
      'Employment updated',
      undefined,
      actor.userId,
    );
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'employment',
      staffId,
      after: dto,
    });
    return row;
  }

  async saveBank(
    tenantId: string,
    staffId: string,
    dto: SaveHrBankDto,
    actor: HrActor,
  ) {
    if (!actor.revealBank && !actor.manageHr)
      throw new ForbiddenException('Not allowed to change bank details');
    const last4 = dto.accountFull.replace(/\s/g, '').slice(-4);
    const row = await this.prisma.schoolHrBankAccount.create({
      data: {
        tenantId,
        staffId,
        holderName: dto.holderName,
        bankName: dto.bankName,
        branch: dto.branch,
        accountLast4: last4,
        accountFull: dto.accountFull.replace(/\s/g, ''),
        ifsc: dto.ifsc.toUpperCase(),
        accountType: dto.accountType ?? 'SAVINGS',
        isPrimary: dto.isPrimary ?? true,
      },
    });
    await this.audit(tenantId, actor, 'UPDATED', { entity: 'bank', staffId });
    return { ...row, accountFull: maskAccount(row.accountFull) };
  }

  async components(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrSalaryComponent.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveComponent(tenantId: string, dto: SaveHrComponentDto) {
    if (dto.formula)
      evaluateFormulaPaise(
        dto.formula.replace(/BASIC|GROSS|WORKING_DAYS|LOP_DAYS/g, '1'),
        { BASIC: 1n, GROSS: 1n, WORKING_DAYS: 1n, LOP_DAYS: 1n },
      );
    return this.prisma.schoolHrSalaryComponent.upsert({
      where: { tenantId_code: { tenantId, code: dto.code.toUpperCase() } },
      update: { ...dto, code: dto.code.toUpperCase() },
      create: { tenantId, ...dto, code: dto.code.toUpperCase() },
    });
  }

  async structures(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrSalaryStructure.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        lines: { include: { component: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async saveStructure(tenantId: string, dto: SaveHrStructureDto, id?: string) {
    await this.ensureSetup(tenantId);
    const structure = id
      ? await this.prisma.schoolHrSalaryStructure.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            code: dto.code.toUpperCase(),
          },
        })
      : await this.prisma.schoolHrSalaryStructure.create({
          data: {
            tenantId,
            code: dto.code.toUpperCase(),
            name: dto.name,
            description: dto.description,
          },
        });
    await this.prisma.schoolHrStructureLine.deleteMany({
      where: { structureId: structure.id },
    });
    await this.prisma.schoolHrStructureLine.createMany({
      data: dto.lines.map((l, i) => ({
        structureId: structure.id,
        componentId: l.componentId,
        formula: l.formula,
        amountPaise: l.amountPaise ?? 0,
        sortOrder: i,
      })),
    });
    return this.prisma.schoolHrSalaryStructure.findFirst({
      where: { id: structure.id },
      include: { lines: { include: { component: true } } },
    });
  }

  async assignSalary(tenantId: string, dto: AssignSalaryDto, actor: HrActor) {
    if (!actor.payrollCalc)
      throw new ForbiddenException('Not allowed to assign salary');
    const current = await this.prisma.schoolHrEmployeeSalary.findFirst({
      where: { tenantId, staffId: dto.staffId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    const from = new Date(dto.effectiveFrom);
    if (current) {
      const end = new Date(from);
      end.setUTCDate(end.getUTCDate() - 1);
      await this.prisma.schoolHrEmployeeSalary.update({
        where: { id: current.id },
        data: { effectiveTo: end },
      });
    }
    const row = await this.prisma.schoolHrEmployeeSalary.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        structureId: dto.structureId,
        basicPaise: dto.basicPaise,
        effectiveFrom: from,
        remarks: dto.remarks,
        approvedBy: actor.userId,
      },
    });
    await this.timeline(
      tenantId,
      dto.staffId,
      'Salary assigned',
      `Basic ${formatInrPaise(dto.basicPaise)}`,
      actor.userId,
    );
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'salary',
      staffId: dto.staffId,
      after: dto,
    });
    return row;
  }

  async reviseSalary(tenantId: string, dto: SalaryRevisionDto, actor: HrActor) {
    const current = await this.prisma.schoolHrEmployeeSalary.findFirst({
      where: { tenantId, staffId: dto.staffId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!current) throw new BadRequestException('No current salary assignment');
    const prev = current.basicPaise;
    const inc = dto.newPaise - prev;
    const pct = prev ? Number(((inc / prev) * 100).toFixed(2)) : 0;
    await this.assignSalary(
      tenantId,
      {
        staffId: dto.staffId,
        structureId: current.structureId,
        basicPaise: dto.newPaise,
        effectiveFrom: dto.effectiveDate,
        remarks: dto.reason,
      },
      actor,
    );
    const rev = await this.prisma.schoolHrSalaryRevision.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        previousPaise: prev,
        newPaise: dto.newPaise,
        incrementPaise: inc,
        incrementPct: pct,
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
        approvedBy: actor.userId,
      },
    });
    await this.timeline(
      tenantId,
      dto.staffId,
      'Salary revised',
      `${formatInrPaise(prev)} → ${formatInrPaise(dto.newPaise)}`,
      actor.userId,
    );
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'salary_revision',
      staffId: dto.staffId,
      before: { salary: prev },
      after: { salary: dto.newPaise },
    });
    return rev;
  }

  async leaveTypes(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolHrLeaveType.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveLeaveType(tenantId: string, dto: SaveLeaveTypeDto) {
    return this.prisma.schoolHrLeaveType.upsert({
      where: { tenantId_code: { tenantId, code: dto.code.toUpperCase() } },
      update: dto,
      create: { tenantId, ...dto, code: dto.code.toUpperCase() },
    });
  }

  async saveLeavePolicy(tenantId: string, dto: SaveLeavePolicyDto) {
    return this.prisma.schoolHrLeavePolicy.create({
      data: {
        tenantId,
        leaveTypeId: dto.leaveTypeId,
        employeeTypeId: dto.employeeTypeId,
        annualEntitlement: dto.annualEntitlement ?? 0,
        monthlyAccrual: dto.monthlyAccrual ?? 0,
        carryForward: dto.carryForward ?? false,
        requiresApproval: dto.requiresApproval ?? true,
      },
    });
  }

  async leaveRequests(tenantId: string, status?: string, staffId?: string) {
    if (staffId === 'none') return [];
    return this.prisma.schoolHrLeaveRequest.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(staffId ? { staffId } : {}),
      },
      include: {
        staff: { select: { fullName: true, employeeCode: true } },
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async requestLeave(tenantId: string, dto: LeaveRequestDto, actor: HrActor) {
    if (!actor.manageHr) {
      const own = await this.ownStaffId(tenantId, actor.userId);
      if (own !== dto.staffId)
        throw new ForbiddenException('You can only apply leave for yourself');
    }
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    const days =
      dto.days ?? Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const row = await this.prisma.schoolHrLeaveRequest.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        fromDate: from,
        toDate: to,
        days,
        reason: dto.reason,
        submittedBy: actor.userId,
      },
    });
    await this.events.publish({
      event: 'hr.leave.requested',
      tenantId,
      entityId: row.id,
      data: { staff_id: dto.staffId },
    });
    return row;
  }

  async reviewLeave(
    tenantId: string,
    id: string,
    actor: HrActor,
    approve: boolean,
    note?: string,
  ) {
    const row = await this.prisma.schoolHrLeaveRequest.findFirst({
      where: { id, tenantId },
      include: { leaveType: true },
    });
    if (!row) throw new NotFoundException('Leave request not found');
    await this.prisma.schoolHrLeaveRequest.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    if (approve) {
      const year = new Date().getUTCFullYear();
      await this.prisma.schoolHrLeaveBalance.upsert({
        where: {
          tenantId_staffId_leaveTypeId_year: {
            tenantId,
            staffId: row.staffId,
            leaveTypeId: row.leaveTypeId,
            year,
          },
        },
        update: { taken: { increment: row.days } },
        create: {
          tenantId,
          staffId: row.staffId,
          leaveTypeId: row.leaveTypeId,
          year,
          taken: row.days,
        },
      });
      const cur = new Date(row.fromDate);
      while (cur <= row.toDate) {
        await this.prisma.schoolHrAttendance.upsert({
          where: {
            tenantId_staffId_date: {
              tenantId,
              staffId: row.staffId,
              date: cur,
            },
          },
          create: {
            tenantId,
            staffId: row.staffId,
            date: new Date(cur),
            status: row.leaveType.isLop ? 'ABSENT' : 'LEAVE',
            source: 'LEAVE',
            markedBy: actor.userId,
          },
          update: { status: row.leaveType.isLop ? 'ABSENT' : 'LEAVE' },
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    await this.events.publish({
      event: approve ? 'hr.leave.approved' : 'hr.leave.rejected',
      tenantId,
      entityId: id,
    });
    await this.audit(tenantId, actor, approve ? 'APPROVED' : 'REJECTED', {
      entity: 'leave',
      entityId: id,
      staffId: row.staffId,
    });
    return { ok: true };
  }

  async markAttendance(
    tenantId: string,
    dto: MarkStaffAttendanceDto,
    actor: HrActor,
  ) {
    const date = new Date(dto.date);
    await this.prisma.$transaction(
      dto.rows.map((r) =>
        this.prisma.schoolHrAttendance.upsert({
          where: {
            tenantId_staffId_date: { tenantId, staffId: r.staffId, date },
          },
          create: {
            tenantId,
            staffId: r.staffId,
            date,
            status: r.status.toUpperCase(),
            remark: r.remark,
            markedBy: actor.userId,
          },
          update: {
            status: r.status.toUpperCase(),
            remark: r.remark,
            markedBy: actor.userId,
          },
        }),
      ),
    );
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'staff_attendance',
      after: { date: dto.date, count: dto.rows.length },
    });
    return { ok: true, count: dto.rows.length };
  }

  async attendanceDay(tenantId: string, date: string) {
    const staff = await this.prisma.schoolStaff.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
    });
    const marks = await this.prisma.schoolHrAttendance.findMany({
      where: { tenantId, date: new Date(date) },
    });
    const map = new Map(marks.map((m) => [m.staffId, m]));
    return staff.map((s) => ({
      staffId: s.id,
      fullName: s.fullName,
      employeeCode: s.employeeCode,
      staffType: s.staffType,
      status: map.get(s.id)?.status ?? 'PRESENT',
      remark: map.get(s.id)?.remark ?? null,
      finalized: map.get(s.id)?.finalized ?? false,
    }));
  }

  async finalizeAttendanceMonth(
    tenantId: string,
    periodMonth: string,
    actor: HrActor,
  ) {
    const { from, to } = monthRange(periodMonth);
    await this.prisma.schoolHrAttendance.updateMany({
      where: { tenantId, date: { gte: from, lte: to } },
      data: { finalized: true },
    });
    await this.audit(tenantId, actor, 'FINALIZED', {
      entity: 'staff_attendance',
      after: { periodMonth },
    });
    return { ok: true };
  }

  async createPayroll(tenantId: string, dto: CreatePayrollDto, actor: HrActor) {
    if (!actor.payrollCalc)
      throw new ForbiddenException('Not allowed to calculate payroll');
    await this.ensureSetup(tenantId);
    const scopeKey = `${dto.departmentId ?? 'ALL'}|${dto.employeeTypeId ?? 'ALL'}`;
    const existing = await this.prisma.schoolHrPayrollRun.findUnique({
      where: {
        tenantId_periodMonth_scopeKey: {
          tenantId,
          periodMonth: dto.periodMonth,
          scopeKey,
        },
      },
    });
    if (
      existing &&
      !['DRAFT', 'CALCULATED', 'UNDER_REVIEW'].includes(existing.status)
    ) {
      throw new ConflictException(
        'Payroll for this period is locked. Use reversal or a correction run.',
      );
    }
    const run = existing
      ? existing
      : await this.prisma.schoolHrPayrollRun.create({
          data: {
            tenantId,
            periodMonth: dto.periodMonth,
            scopeKey,
            departmentId: dto.departmentId,
            employeeTypeId: dto.employeeTypeId,
            createdBy: actor.userId,
            status: 'DRAFT',
          },
        });
    return this.calculateRun(tenantId, run.id, actor);
  }

  async calculateRun(tenantId: string, runId: string, actor: HrActor) {
    const run = await this.prisma.schoolHrPayrollRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['APPROVED', 'PROCESSED', 'PAID', 'LOCKED'].includes(run.status)) {
      throw new ForbiddenException('Finalized payroll cannot be recalculated');
    }
    const settings = await this.ensureSetup(tenantId);
    const { from, to, days } = monthRange(run.periodMonth);
    const year = await this.sis.currentYear(tenantId);
    const working = await this.calendar.workingDaysInRange(
      tenantId,
      dayKey(from),
      dayKey(to),
      year.id,
    );
    let divisor = working.working;
    if (settings.lopDivisor === 'CALENDAR') divisor = days;
    if (settings.lopDivisor === 'FIXED_30') divisor = 30;
    if (settings.lopDivisor === 'CUSTOM') divisor = settings.customDivisor;
    if (!divisor) divisor = 30;

    const staff = await this.prisma.schoolStaff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(run.departmentId
          ? { hrEmployment: { departmentId: run.departmentId } }
          : {}),
        ...(run.employeeTypeId
          ? { hrEmployment: { employeeTypeId: run.employeeTypeId } }
          : {}),
      },
      include: {
        hrEmployment: true,
        hrBankAccounts: { where: { isPrimary: true } },
        hrSalaries: {
          where: {
            effectiveFrom: { lte: to },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            structure: {
              include: {
                lines: {
                  include: { component: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        hrLoans: { where: { status: 'ACTIVE' } },
      },
    });

    const att = await this.prisma.schoolHrAttendance.findMany({
      where: { tenantId, date: { gte: from, lte: to } },
    });
    const attByStaff = new Map<string, typeof att>();
    for (const a of att) {
      const list = attByStaff.get(a.staffId) ?? [];
      list.push(a);
      attByStaff.set(a.staffId, list);
    }
    const statutory = await this.prisma.schoolHrStatutoryRule.findMany({
      where: { tenantId, active: true, effectiveFrom: { lte: to } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const pf = statutory.find((s) => s.code === 'PF_EMPLOYEE');
    const configSnap = {
      lopDivisor: settings.lopDivisor,
      divisor,
      workingDays: working.working,
      calendarDays: days,
      statutory: statutory.map((s) => ({
        code: s.code,
        rateBps: s.rateBps,
        ceilingPaise: s.ceilingPaise,
      })),
      calculatedAt: new Date().toISOString(),
    };

    const errors: Array<{ staffId: string; name: string; error: string }> = [];
    const lines: Prisma.SchoolHrPayrollLineCreateManyInput[] = [];

    for (const emp of staff) {
      const sal = emp.hrSalaries[0];
      if (!sal) {
        errors.push({
          staffId: emp.id,
          name: emp.fullName,
          error: 'Missing salary structure',
        });
        continue;
      }
      if (settings.requireAttendance) {
        const marks = attByStaff.get(emp.id) ?? [];
        if (!marks.length) {
          errors.push({
            staffId: emp.id,
            name: emp.fullName,
            error: 'Missing attendance for this month',
          });
          continue;
        }
      }
      const marks = attByStaff.get(emp.id) ?? [];
      const lopDays = marks.filter((m) => m.status === 'ABSENT').length;
      const present = marks.filter(
        (m) => m.status === 'PRESENT' || m.status === 'LATE',
      ).length;
      const leaveDays = marks.filter((m) => m.status === 'LEAVE').length;
      const vars: Record<string, bigint> = {
        BASIC: BigInt(sal.basicPaise),
        WORKING_DAYS: BigInt(divisor),
        LOP_DAYS: BigInt(lopDays),
        PRESENT_DAYS: BigInt(present),
        CALENDAR_DAYS: BigInt(days),
        GROSS: 0n,
      };
      const earnings: Array<{ code: string; name: string; paise: number }> = [];
      const deductions: Array<{ code: string; name: string; paise: number }> =
        [];
      try {
        for (const line of sal.structure.lines) {
          const c = line.component;
          if (!c.active) continue;
          let paise = 0n;
          const formula = line.formula || c.formula;
          if (c.code === 'BASIC' || c.calcType === 'FIXED') {
            paise = BigInt(
              line.amountPaise ||
                (c.code === 'BASIC' ? sal.basicPaise : c.defaultPaise),
            );
          } else if (c.calcType === 'FORMULA' || formula) {
            if (c.code === 'PF' && pf) {
              paise = (vars.BASIC * BigInt(pf.rateBps)) / 10000n;
              if (pf.ceilingPaise && paise > BigInt(pf.ceilingPaise))
                paise = BigInt(pf.ceilingPaise);
            } else {
              paise = evaluateFormulaPaise(formula || '0', vars);
            }
          }
          if (c.code === 'LOAN') {
            paise = BigInt(
              emp.hrLoans.reduce((s, l) => s + l.installmentPaise, 0),
            );
          }
          vars[c.code] = paise;
          if (c.kind === 'EARNING') {
            earnings.push({ code: c.code, name: c.name, paise: toInt(paise) });
          } else {
            deductions.push({
              code: c.code,
              name: c.name,
              paise: toInt(paise),
            });
          }
        }
        const gross = earnings.reduce((s, e) => s + BigInt(e.paise), 0n);
        vars.GROSS = gross;
        const lopComp = deductions.find((d) => d.code === 'LOP');
        if (lopComp) {
          const recalc = evaluateFormulaPaise(
            'GROSS * LOP_DAYS / WORKING_DAYS',
            vars,
          );
          lopComp.paise = toInt(recalc);
        }
        const ded = deductions.reduce((s, e) => s + BigInt(e.paise), 0n);
        const net = gross - ded;
        if (net < 0n) {
          errors.push({
            staffId: emp.id,
            name: emp.fullName,
            error: 'Negative net salary',
          });
          continue;
        }
        const employerPf = pf ? (vars.BASIC * BigInt(pf.rateBps)) / 10000n : 0n;
        lines.push({
          tenantId,
          runId: run.id,
          staffId: emp.id,
          earningsJson: earnings as Prisma.InputJsonValue,
          deductionsJson: deductions as Prisma.InputJsonValue,
          attendanceSnap: {
            present,
            lopDays,
            leaveDays,
            divisor,
            working: working.working,
          } as Prisma.InputJsonValue,
          configSnap: configSnap as Prisma.InputJsonValue,
          grossPaise: toInt(gross),
          deductionPaise: toInt(ded),
          netPaise: toInt(net),
          employerPaise: toInt(employerPf),
          error: emp.hrBankAccounts[0] ? null : 'Missing bank account',
        });
      } catch (e) {
        errors.push({
          staffId: emp.id,
          name: emp.fullName,
          error: e instanceof Error ? e.message : 'Invalid formula',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolHrPayrollLine.deleteMany({ where: { runId: run.id } });
      if (lines.length)
        await tx.schoolHrPayrollLine.createMany({ data: lines });
      const gross = lines.reduce((s, l) => s + l.grossPaise, 0);
      const net = lines.reduce((s, l) => s + l.netPaise, 0);
      const ded = lines.reduce((s, l) => s + l.deductionPaise, 0);
      const empCost = lines.reduce((s, l) => s + (l.employerPaise ?? 0), 0);
      await tx.schoolHrPayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'CALCULATED',
          calculatedAt: new Date(),
          settingsSnap: configSnap as Prisma.InputJsonValue,
          totalsJson: {
            employees: lines.length,
            errors: errors.length,
            errorRows: errors,
            gross,
            deductions: ded,
            net,
            employerCost: empCost,
          } as Prisma.InputJsonValue,
        },
      });
    });
    await this.audit(tenantId, actor, 'CALCULATED', {
      entity: 'payroll',
      entityId: run.id,
    });
    await this.events.publish({
      event: 'hr.payroll.calculated',
      tenantId,
      entityId: run.id,
      data: { period: run.periodMonth, employees: lines.length },
    });
    return this.payrollRun(tenantId, run.id, actor);
  }

  async payrollRun(tenantId: string, id: string, actor: HrActor) {
    if (!actor.payrollView)
      throw new ForbiddenException('Payroll view is not granted');
    const run = await this.prisma.schoolHrPayrollRun.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            staff: {
              select: { fullName: true, employeeCode: true, staffType: true },
            },
          },
          orderBy: { staff: { fullName: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async payrollList(tenantId: string, actor: HrActor) {
    if (!actor.payrollView)
      throw new ForbiddenException('Payroll view is not granted');
    return this.prisma.schoolHrPayrollRun.findMany({
      where: { tenantId },
      orderBy: { periodMonth: 'desc' },
      take: 48,
    });
  }

  async transitionPayroll(
    tenantId: string,
    id: string,
    actor: HrActor,
    to: string,
    reason?: string,
  ) {
    const run = await this.prisma.schoolHrPayrollRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    const map: Record<string, string[]> = {
      UNDER_REVIEW: ['CALCULATED'],
      APPROVED: ['CALCULATED', 'UNDER_REVIEW'],
      PROCESSED: ['APPROVED'],
      PAID: ['PROCESSED', 'APPROVED'],
      LOCKED: ['PAID', 'PROCESSED', 'APPROVED'],
      REVERSED: ['APPROVED', 'PROCESSED', 'PAID', 'LOCKED'],
    };
    if (!(map[to] ?? []).includes(run.status) && to !== 'CALCULATED') {
      throw new BadRequestException(
        `Cannot move payroll from ${run.status} to ${to}`,
      );
    }
    if (['APPROVED', 'LOCKED'].includes(to) && !actor.payrollApprove) {
      throw new ForbiddenException('Not allowed to approve/lock payroll');
    }
    if (to === 'REVERSED') {
      if (!actor.payrollApprove)
        throw new ForbiddenException('Not allowed to reverse payroll');
      if (!reason) throw new BadRequestException('Reversal requires a reason');
    }
    await this.prisma.schoolHrPayrollRun.update({
      where: { id },
      data: {
        status: to,
        approvedAt: to === 'APPROVED' ? new Date() : run.approvedAt,
        approvedBy: to === 'APPROVED' ? actor.userId : run.approvedBy,
        finalizedAt:
          to === 'LOCKED' || to === 'PROCESSED' ? new Date() : run.finalizedAt,
        finalizedBy:
          to === 'LOCKED' || to === 'PROCESSED'
            ? actor.userId
            : run.finalizedBy,
        lockedAt: to === 'LOCKED' ? new Date() : run.lockedAt,
        reversedAt: to === 'REVERSED' ? new Date() : run.reversedAt,
        reverseReason: reason,
      },
    });
    if (to === 'APPROVED') {
      await this.events.publish({
        event: 'hr.payroll.approved',
        tenantId,
        entityId: id,
      });
    }
    await this.audit(tenantId, actor, to, {
      entity: 'payroll',
      entityId: id,
      after: { reason },
    });
    if (to === 'PROCESSED') {
      const full = await this.payrollRun(tenantId, id, actor);
      const gross = full.lines.reduce((s, l) => s + l.grossPaise, 0);
      await this.accounts.postPayrollAccrual(tenantId, {
        runId: id,
        grossPaise: gross,
        actorUserId: actor.userId,
      });
    }
    return this.payrollRun(tenantId, id, actor);
  }

  async payLines(tenantId: string, dto: PayLineDto, actor: HrActor) {
    if (!actor.payrollPay)
      throw new ForbiddenException('Not allowed to process salary payments');
    await this.prisma.schoolHrPayrollLine.updateMany({
      where: { tenantId, id: { in: dto.lineIds } },
      data: {
        payStatus: 'PAID',
        paymentMode: dto.paymentMode,
        paymentRef: dto.paymentRef,
        paidAt: new Date(),
        paidBy: actor.userId,
      },
    });
    const paid = await this.prisma.schoolHrPayrollLine.findMany({
      where: { tenantId, id: { in: dto.lineIds } },
    });
    const net = paid.reduce((s, l) => s + l.netPaise, 0);
    await this.accounts.postPayrollPayment(tenantId, {
      runId: paid[0]?.runId ?? dto.lineIds[0],
      netPaise: net,
      mode: (dto.paymentMode || 'BANK').toUpperCase(),
      actorUserId: actor.userId,
    });
    await this.audit(tenantId, actor, 'PAID', {
      entity: 'salary_payment',
      after: dto,
    });
    return { ok: true };
  }

  async payslipPdf(tenantId: string, lineId: string, actor: HrActor) {
    const line = await this.prisma.schoolHrPayrollLine.findFirst({
      where: { id: lineId, tenantId },
      include: { staff: true, run: true },
    });
    if (!line) throw new NotFoundException('Payslip not found');
    if (
      !['APPROVED', 'PROCESSED', 'PAID', 'LOCKED'].includes(line.run.status)
    ) {
      throw new BadRequestException(
        'Payslip is available after payroll approval',
      );
    }
    const own = await this.ownStaffId(tenantId, actor.userId);
    if (!actor.payrollView && own !== line.staffId) {
      throw new ForbiddenException('You can only view your own payslip');
    }
    const brand = await this.branding.load(tenantId);
    const earnings = line.earningsJson as Array<{
      name: string;
      paise: number;
    }>;
    const deductions = line.deductionsJson as Array<{
      name: string;
      paise: number;
    }>;
    const doc: ReportDocument = {
      key: 'hr-payslip',
      title: 'Payslip',
      subtitle: line.run.periodMonth,
      academicYear: line.run.periodMonth,
      generatedBy: 'School ERP',
      filters: {
        Employee: `${line.staff.fullName} · ${line.staff.employeeCode}`,
        Note: 'This is a system-generated payslip.',
      },
      columns: [
        { key: 'label', label: 'Particulars' },
        { key: 'amount', label: 'Amount (₹)' },
      ],
      rows: [
        ...earnings.map((e) => ({
          label: e.name,
          amount: paiseToRupees(e.paise),
        })),
        { label: 'Gross', amount: paiseToRupees(line.grossPaise) },
        ...deductions.map((e) => ({
          label: e.name,
          amount: paiseToRupees(e.paise),
        })),
        { label: 'Net salary', amount: paiseToRupees(line.netPaise) },
      ],
    };
    return this.pdf.render(doc, brand);
  }

  async ownStaffId(tenantId: string, userId: string) {
    const acc = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId, personType: 'STAFF', staffId: { not: null } },
    });
    return acc?.staffId ?? null;
  }

  async loans(tenantId: string, staffId?: string) {
    return this.prisma.schoolHrLoan.findMany({
      where: { tenantId, ...(staffId ? { staffId } : {}) },
      include: { staff: { select: { fullName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLoan(tenantId: string, dto: LoanDto, actor: HrActor) {
    const row = await this.prisma.schoolHrLoan.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        loanType: dto.loanType,
        principalPaise: dto.principalPaise,
        startDate: new Date(dto.startDate),
        tenureMonths: dto.tenureMonths,
        installmentPaise: dto.installmentPaise,
        outstandingPaise: dto.principalPaise,
      },
    });
    await this.timeline(
      tenantId,
      dto.staffId,
      'Loan created',
      formatInrPaise(dto.principalPaise),
      actor.userId,
    );
    return row;
  }

  async reimbursements(tenantId: string, staffId?: string) {
    return this.prisma.schoolHrReimbursement.findMany({
      where: { tenantId, ...(staffId ? { staffId } : {}) },
      include: { staff: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReimbursement(
    tenantId: string,
    dto: ReimbursementDto,
    actor: HrActor,
  ) {
    return this.prisma.schoolHrReimbursement.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        category: dto.category,
        amountPaise: dto.amountPaise,
        expenseDate: new Date(dto.expenseDate),
        description: dto.description,
        status: 'SUBMITTED',
      },
    });
  }

  async reviewReimbursement(
    tenantId: string,
    id: string,
    actor: HrActor,
    approve: boolean,
  ) {
    return this.prisma.schoolHrReimbursement.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewedBy: actor.userId,
      },
    });
  }

  async createExit(tenantId: string, dto: ExitDto, actor: HrActor) {
    const row = await this.prisma.schoolHrExit.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        kind: dto.kind,
        resignationDate: dto.resignationDate
          ? new Date(dto.resignationDate)
          : undefined,
        lastWorkingDate: dto.lastWorkingDate
          ? new Date(dto.lastWorkingDate)
          : undefined,
        reason: dto.reason,
      },
    });
    if (
      dto.kind === 'RESIGNATION' ||
      dto.kind === 'TERMINATION' ||
      dto.kind === 'RETIREMENT'
    ) {
      await this.prisma.schoolStaff.update({
        where: { id: dto.staffId },
        data: { status: 'INACTIVE' },
      });
    }
    await this.timeline(
      tenantId,
      dto.staffId,
      dto.kind,
      dto.reason,
      actor.userId,
    );
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'exit',
      staffId: dto.staffId,
    });
    return row;
  }

  async importEmployees(
    tenantId: string,
    dto: ImportEmployeesDto,
    actor: HrActor,
  ) {
    const errors: Array<{ row: number; error: string }> = [];
    dto.rows.forEach((r, i) => {
      if (!r.fullName?.trim())
        errors.push({ row: i + 1, error: 'Full name is required' });
    });
    if (errors.length) return { ok: false, errors };
    const created: string[] = [];
    for (const r of dto.rows) {
      const code =
        r.employeeCode?.trim() || (await this.nextEmployeeCode(tenantId));
      const staff = await this.prisma.schoolStaff.create({
        data: {
          tenantId,
          employeeCode: code,
          fullName: r.fullName.trim(),
          staffType: r.staffType ?? 'TEACHING',
          phone: r.phone,
          email: r.email,
          gender: r.gender,
          joiningDate: r.joiningDate ? new Date(r.joiningDate) : undefined,
        },
      });
      created.push(staff.id);
    }
    await this.audit(tenantId, actor, 'CREATED', {
      entity: 'employee_import',
      after: { count: created.length },
    });
    return { ok: true, count: created.length };
  }

  async saveSettings(tenantId: string, dto: SaveHrSettingsDto, actor: HrActor) {
    await this.ensureSetup(tenantId);
    const row = await this.prisma.schoolHrSettings.update({
      where: { tenantId },
      data: dto,
    });
    await this.audit(tenantId, actor, 'UPDATED', { entity: 'hr_settings' });
    return row;
  }

  async saveStatutory(tenantId: string, dto: StatutoryRuleDto, actor: HrActor) {
    const row = await this.prisma.schoolHrStatutoryRule.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        rateBps: dto.rateBps,
        ceilingPaise: dto.ceilingPaise ?? 0,
        formula: dto.formula,
        effectiveFrom: new Date(dto.effectiveFrom),
      },
    });
    await this.audit(tenantId, actor, 'UPDATED', {
      entity: 'statutory',
      after: dto,
    });
    return row;
  }

  async reportBundle(tenantId: string, key: string) {
    await this.ensureSetup(tenantId);
    if (
      key === 'staff_payroll' ||
      key === 'staff_salary' ||
      key === 'staff_deduction'
    ) {
      const run = await this.prisma.schoolHrPayrollRun.findFirst({
        where: { tenantId, status: { not: 'REVERSED' } },
        include: { lines: { include: { staff: true } } },
        orderBy: { periodMonth: 'desc' },
      });
      if (!run)
        return {
          columns: [{ key: 'note', label: 'Note' }],
          rows: [],
          kpis: [],
        };
      return {
        columns: [
          { key: 'employee', label: 'Employee' },
          { key: 'gross', label: 'Gross' },
          { key: 'deductions', label: 'Deductions' },
          { key: 'net', label: 'Net' },
          { key: 'status', label: 'Pay status' },
        ],
        rows: run.lines.map((l) => ({
          employee: l.staff.fullName,
          gross: paiseToRupees(l.grossPaise),
          deductions: paiseToRupees(l.deductionPaise),
          net: paiseToRupees(l.netPaise),
          status: l.payStatus,
        })),
        kpis: [
          { key: 'period', label: 'Period', value: run.periodMonth },
          { key: 'n', label: 'Employees', value: run.lines.length },
        ],
      };
    }
    if (key === 'staff_leave') {
      const rows = await this.leaveRequests(tenantId);
      return {
        columns: [
          { key: 'employee', label: 'Employee' },
          { key: 'type', label: 'Type' },
          { key: 'from', label: 'From' },
          { key: 'to', label: 'To' },
          { key: 'status', label: 'Status' },
        ],
        rows: rows.map((r) => ({
          employee: r.staff.fullName,
          type: r.leaveType.name,
          from: dayKey(r.fromDate),
          to: dayKey(r.toDate),
          status: r.status,
        })),
        kpis: [{ key: 'n', label: 'Requests', value: rows.length }],
      };
    }
    if (key.startsWith('staff_attendance') || key === 'staff_late') {
      const today = dayKey(new Date());
      const rows = await this.attendanceDay(tenantId, today);
      return {
        columns: [
          { key: 'employee', label: 'Employee' },
          { key: 'code', label: 'Code' },
          { key: 'status', label: 'Status' },
        ],
        rows: rows.map((r) => ({
          employee: r.fullName,
          code: r.employeeCode,
          status: r.status,
        })),
        kpis: [{ key: 'n', label: 'Staff', value: rows.length }],
      };
    }
    const staff = await this.prisma.schoolStaff.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        hrEmployment: { include: { department: true, designation: true } },
      },
    });
    return {
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'department', label: 'Department' },
        { key: 'status', label: 'Status' },
      ],
      rows: staff.map((s) => ({
        code: s.employeeCode,
        name: s.fullName,
        type: s.staffType,
        department: s.hrEmployment?.department?.name ?? s.department,
        status: s.status,
      })),
      kpis: [{ key: 'n', label: 'Employees', value: staff.length }],
    };
  }
}
