import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

function ageYears(dob: Date, asOf = new Date()) {
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age -= 1;
  return age;
}

function experienceYears(joined: Date, asOf = new Date()) {
  return Math.max(
    0,
    Math.floor(
      (asOf.getTime() - joined.getTime()) / (365.25 * 24 * 3600 * 1000),
    ),
  );
}

function bucketCount(
  items: string[],
  buckets: Array<{ label: string; match: (v: string) => boolean }>,
) {
  const counts = buckets.map((b) => ({ label: b.label, value: 0 }));
  for (const item of items) {
    const idx = buckets.findIndex((b) => b.match(item));
    if (idx >= 0) counts[idx].value += 1;
  }
  return counts.filter((c) => c.value > 0);
}

@Injectable()
export class PayrollAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async executiveDashboard(tenantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oneYearAhead = new Date(now);
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

    const baseWhere = { tenantId, deletedAt: null, status: 'ACTIVE' as const };

    const [
      profiles,
      onLeave,
      newJoinings,
      retiringSoon,
      payrollDue,
      publishedRuns,
      loans,
      assignments,
      departments,
    ] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where: baseWhere,
        select: {
          staffType: true,
          gender: true,
          dateOfBirth: true,
          joiningDate: true,
          retirementDate: true,
          departmentId: true,
        },
      }),
      this.prisma.staffProfile.count({
        where: { tenantId, deletedAt: null, status: 'ON_LEAVE' },
      }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, joiningDate: { gte: thirtyDaysAgo } },
      }),
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          OR: [
            { retirementDate: { lte: oneYearAhead, gte: now } },
            { retirementDate: { lte: now } },
          ],
        },
      }),
      this.prisma.payrollRun.count({
        where: {
          tenantId,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          status: { in: ['DRAFT', 'VERIFIED', 'APPROVED'] },
        },
      }),
      this.prisma.payrollRun.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
      this.prisma.staffLoan.aggregate({
        where: { tenantId, status: 'ACTIVE' },
        _sum: { balanceAmount: true },
        _count: true,
      }),
      this.prisma.staffPayAssignment.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          basicPay: true,
          payScaleType: true,
          staffProfile: {
            select: {
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.department.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);

    const deptName = new Map(departments.map((d) => [d.id, d.name]));

    let teachingStaff = 0;
    let nonTeachingStaff = 0;
    let contractStaff = 0;
    let guestFaculty = 0;
    const genderMap = new Map<string, number>();
    const deptStrength = new Map<string, number>();
    const ages: string[] = [];
    const experiences: string[] = [];

    for (const p of profiles) {
      if (p.staffType === 'TEACHING' || p.staffType === 'VISITING')
        teachingStaff += 1;
      else if (p.staffType === 'NON_TEACHING' || p.staffType === 'ADMIN')
        nonTeachingStaff += 1;
      else if (p.staffType === 'CONTRACT') contractStaff += 1;
      else if (p.staffType === 'GUEST') guestFaculty += 1;

      const g = (p.gender ?? 'Unknown').trim() || 'Unknown';
      genderMap.set(g, (genderMap.get(g) ?? 0) + 1);

      if (p.departmentId) {
        const label = deptName.get(p.departmentId) ?? 'Unassigned';
        deptStrength.set(label, (deptStrength.get(label) ?? 0) + 1);
      }

      if (p.dateOfBirth) {
        const age = ageYears(p.dateOfBirth, now);
        if (age < 30) ages.push('20–29');
        else if (age < 40) ages.push('30–39');
        else if (age < 50) ages.push('40–49');
        else if (age < 60) ages.push('50–59');
        else ages.push('60+');
      }

      if (p.joiningDate) {
        const exp = experienceYears(p.joiningDate, now);
        if (exp <= 2) experiences.push('0–2 yrs');
        else if (exp <= 5) experiences.push('3–5 yrs');
        else if (exp <= 10) experiences.push('6–10 yrs');
        else if (exp <= 15) experiences.push('11–15 yrs');
        else experiences.push('16+ yrs');
      }
    }

    const salaryByDept = new Map<string, number>();
    const payScaleMap = new Map<string, number>();
    for (const a of assignments) {
      const dept = a.staffProfile.department?.name ?? 'Unassigned';
      salaryByDept.set(
        dept,
        (salaryByDept.get(dept) ?? 0) + Number(a.basicPay),
      );
      payScaleMap.set(
        a.payScaleType,
        (payScaleMap.get(a.payScaleType) ?? 0) + 1,
      );
    }

    const monthlyPayrollCost = publishedRuns[0]
      ? Number(publishedRuns[0].totalNet)
      : 0;

    return {
      totalStaff: profiles.length,
      teachingStaff,
      nonTeachingStaff,
      contractStaff,
      guestFaculty,
      staffOnLeaveToday: onLeave,
      newJoinings,
      retiringSoon,
      payrollDue,
      activeLoans: loans._count,
      loanOutstanding: Number(loans._sum.balanceAmount ?? 0),
      monthlyPayrollCost,
      departmentStrength: [...deptStrength.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
      genderDistribution: [...genderMap.entries()].map(([label, value]) => ({
        label,
        value,
      })),
      salaryCostByDepartment: [...salaryByDept.entries()]
        .map(([label, value]) => ({ label, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      ageDistribution: bucketCount(ages, [
        { label: '20–29', match: (v) => v === '20–29' },
        { label: '30–39', match: (v) => v === '30–39' },
        { label: '40–49', match: (v) => v === '40–49' },
        { label: '50–59', match: (v) => v === '50–59' },
        { label: '60+', match: (v) => v === '60+' },
      ]),
      experienceDistribution: bucketCount(experiences, [
        { label: '0–2 yrs', match: (v) => v === '0–2 yrs' },
        { label: '3–5 yrs', match: (v) => v === '3–5 yrs' },
        { label: '6–10 yrs', match: (v) => v === '6–10 yrs' },
        { label: '11–15 yrs', match: (v) => v === '11–15 yrs' },
        { label: '16+ yrs', match: (v) => v === '16+ yrs' },
      ]),
      staffByPayScale: [...payScaleMap.entries()].map(([label, value]) => ({
        label,
        value,
      })),
      monthlyPayrollTrend: publishedRuns
        .slice()
        .reverse()
        .map((r) => ({
          label: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][r.month - 1]} ${r.year}`,
          month: r.month,
          year: r.year,
          value: Number(r.totalNet),
          employeeCount: r.employeeCount,
        })),
    };
  }

  async dashboard(tenantId: string) {
    const [staffCounts, publishedRuns, loans, pfEntries] = await Promise.all([
      this.prisma.staffProfile.groupBy({
        by: ['staffType'],
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
        _count: true,
      }),
      this.prisma.payrollRun.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
      this.prisma.staffLoan.aggregate({
        where: { tenantId, status: 'ACTIVE' },
        _sum: { balanceAmount: true },
        _count: true,
      }),
      this.prisma.pfCpfLedgerEntry.aggregate({
        where: { tenantId },
        _sum: { employeeContribution: true, employerContribution: true },
      }),
    ]);

    const assignmentCounts = await this.prisma.staffPayAssignment.groupBy({
      by: ['payScaleType'],
      where: { tenantId, status: 'ACTIVE' },
      _count: true,
    });

    const monthlyCost = publishedRuns.slice(0, 1)[0]?.totalNet ?? 0;
    const yearlyCost = publishedRuns
      .filter((r) => r.year === new Date().getFullYear())
      .reduce((s, r) => s + Number(r.totalNet), 0);

    return {
      totalEmployees: staffCounts.reduce((s, c) => s + c._count, 0),
      staffByType: staffCounts.map((c) => ({
        staffType: c.staffType,
        count: c._count,
      })),
      staffByPayScale: assignmentCounts.map((c) => ({
        payScaleType: c.payScaleType,
        count: c._count,
      })),
      monthlyPayrollCost: Number(monthlyCost),
      yearlyPayrollCost: yearlyCost,
      loanOutstanding: Number(loans._sum.balanceAmount ?? 0),
      activeLoans: loans._count,
      pfLiability:
        Number(pfEntries._sum.employeeContribution ?? 0) +
        Number(pfEntries._sum.employerContribution ?? 0),
      salaryTrend: publishedRuns.map((r) => ({
        month: r.month,
        year: r.year,
        totalNet: Number(r.totalNet),
        employeeCount: r.employeeCount,
      })),
    };
  }
}
