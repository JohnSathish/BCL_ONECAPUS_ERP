import { PrismaService } from '../../../database/prisma.service';
import {
  CASUAL_LEAVE_ANNUAL_DAYS,
  HOLIDAY_EVENT_TYPES,
  chargeableDates,
  eachDate,
  isCasualLeaveType,
  utcDateKey,
} from './casual-leave.policy';

export type LeaveCalendar = {
  holidays: Set<string>;
  vacations: Set<string>;
};

const OPEN_LEAVE_STATUSES = ['REJECTED', 'CANCELLED', 'APPROVED'] as const;

export async function ensureCasualLeaveType(
  prisma: PrismaService,
  tenantId: string,
) {
  const existing = await prisma.staffLeaveType.findFirst({
    where: { tenantId, code: { in: ['CL', 'CASUAL'] } },
    orderBy: { code: 'asc' },
  });
  if (!existing) {
    return prisma.staffLeaveType.create({
      data: {
        tenantId,
        code: 'CL',
        name: 'Casual Leave',
        yearlyLimit: CASUAL_LEAVE_ANNUAL_DAYS,
        active: true,
      },
    });
  }
  if (Number(existing.yearlyLimit ?? 0) < CASUAL_LEAVE_ANNUAL_DAYS) {
    return prisma.staffLeaveType.update({
      where: { id: existing.id },
      data: { yearlyLimit: CASUAL_LEAVE_ANNUAL_DAYS },
    });
  }
  return existing;
}

export async function ensurePrivilegedLeaveTypes(
  prisma: PrismaService,
  tenantId: string,
) {
  const specs = [
    {
      code: 'MAT',
      name: 'Maternity Leave',
      genderRestriction: 'FEMALE',
    },
    {
      code: 'PAT',
      name: 'Paternity Leave',
      genderRestriction: 'MALE',
    },
  ];
  for (const spec of specs) {
    const existing = await prisma.staffLeaveType.findFirst({
      where: { tenantId, code: spec.code },
    });
    if (existing) continue;
    await prisma.staffLeaveType.create({
      data: {
        tenantId,
        code: spec.code,
        name: spec.name,
        genderRestriction: spec.genderRestriction,
        attachmentRequired: true,
        approvalFlow: ['PRINCIPAL'],
        active: true,
      },
    });
  }
}

export async function loadLeaveYear(
  prisma: PrismaService,
  tenantId: string,
  year: number,
): Promise<LeaveCalendar> {
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year}-12-31T00:00:00.000Z`);
  const [holidays, events] = await Promise.all([
    prisma.staffPublicHoliday.findMany({
      where: {
        tenantId,
        active: true,
        OR: [
          { holidayDate: { gte: yearStart, lte: yearEnd } },
          { recurring: true },
        ],
      },
      select: { holidayDate: true, holidayType: true, recurring: true },
    }),
    prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        active: true,
        deletedAt: null,
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
        OR: [
          { type: { in: [...HOLIDAY_EVENT_TYPES, 'TEACHING_BREAK'] } },
          { title: { contains: 'vacation', mode: 'insensitive' } },
        ],
      },
      select: { type: true, title: true, startDate: true, endDate: true },
    }),
  ]);

  const calendar: LeaveCalendar = { holidays: new Set(), vacations: new Set() };
  for (const holiday of holidays) {
    const key = utcDateKey(holiday.holidayDate);
    const dated = holiday.recurring ? `${year}-${key.slice(5)}` : key;
    if (!dated.startsWith(String(year))) continue;
    if ((holiday.holidayType ?? '').toUpperCase().includes('VACATION')) {
      calendar.vacations.add(dated);
    } else {
      calendar.holidays.add(dated);
    }
  }

  for (const event of events) {
    const vacation =
      event.type === 'TEACHING_BREAK' || /vacation/i.test(event.title ?? '');
    for (const day of eachDate(
      utcDateKey(event.startDate),
      utcDateKey(event.endDate),
    )) {
      if (!day.startsWith(String(year))) continue;
      if (vacation) calendar.vacations.add(day);
      else calendar.holidays.add(day);
    }
  }
  for (const day of calendar.vacations) calendar.holidays.delete(day);
  return calendar;
}

export async function readCasualLeaveSnapshot(
  prisma: PrismaService,
  tenantId: string,
  staffProfileId: string,
) {
  const year = new Date().getFullYear();
  const leaveType = await ensureCasualLeaveType(prisma, tenantId);
  await prisma.staffLeaveBalance.updateMany({
    where: {
      tenantId,
      staffProfileId,
      year,
      allocatedDays: { lt: CASUAL_LEAVE_ANNUAL_DAYS },
      leaveTypeId: leaveType.id,
    },
    data: { allocatedDays: CASUAL_LEAVE_ANNUAL_DAYS },
  });

  const [balance, openApps, calendar] = await Promise.all([
    prisma.staffLeaveBalance.findUnique({
      where: {
        tenantId_staffProfileId_leaveTypeId_year: {
          tenantId,
          staffProfileId,
          leaveTypeId: leaveType.id,
          year,
        },
      },
    }),
    prisma.staffLeaveApplication.findMany({
      where: {
        tenantId,
        staffProfileId,
        leaveTypeId: leaveType.id,
        status: { notIn: [...OPEN_LEAVE_STATUSES] },
        fromDate: { lte: new Date(`${year}-12-31T00:00:00.000Z`) },
        toDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`) },
      },
      select: { fromDate: true, toDate: true },
    }),
    loadLeaveYear(prisma, tenantId, year),
  ]);

  const pendingDates = new Set<string>();
  for (const app of openApps) {
    for (const day of chargeableDates(
      eachDate(utcDateKey(app.fromDate), utcDateKey(app.toDate)),
      calendar.holidays,
    )) {
      if (day.startsWith(String(year))) pendingDates.add(day);
    }
  }

  const allocated = balance
    ? Number(balance.allocatedDays)
    : CASUAL_LEAVE_ANNUAL_DAYS;
  const carried = balance ? Number(balance.carriedForward) : 0;
  const availed = balance ? Number(balance.usedDays) : 0;
  const casualBalance = allocated + carried - availed;

  return {
    year,
    leaveTypeId: leaveType.id,
    allocated,
    availed,
    pending: pendingDates.size,
    balance: casualBalance,
    casual: casualBalance,
    sick: 0,
    earned: 0,
    pendingRequests: openApps.length,
    casualLeave: {
      year,
      allocated,
      availed,
      pending: pendingDates.size,
      balance: casualBalance,
    },
  };
}

export function genderAllowsLeave(
  restriction: string | null | undefined,
  gender: string | null | undefined,
) {
  if (!restriction || !gender?.trim()) return true;
  const rule = restriction.toUpperCase();
  const value = gender.trim().toUpperCase();
  if (rule === 'FEMALE')
    return value === 'F' || value === 'FEMALE' || value === 'WOMAN';
  if (rule === 'MALE')
    return value === 'M' || value === 'MALE' || value === 'MAN';
  return true;
}

export { isCasualLeaveType };
