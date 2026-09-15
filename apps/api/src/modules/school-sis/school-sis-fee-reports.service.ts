import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CASH_MODE = 'CASH';
const ONLINE_MODES = new Set(['UPI', 'BANK', 'ONLINE', 'CHEQUE', 'OTHER']);

export type UserWiseSort =
  | 'userName'
  | 'cashCollection'
  | 'onlineCollection'
  | 'totalCollection'
  | 'receiptCount'
  | 'firstCollectionTime'
  | 'lastCollectionTime';

export type UserWiseQuery = {
  date?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  paymentMode?: string;
  userId?: string;
  search?: string;
  sortBy?: UserWiseSort;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

function istDayBounds(dateYmd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new BadRequestException('Date must be YYYY-MM-DD');
  }
  const start = new Date(`${dateYmd}T00:00:00+05:30`);
  const end = new Date(`${dateYmd}T23:59:59.999+05:30`);
  return { start, end, dateYmd };
}

export function istYmd(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istBusinessDate(dateYmd: string) {
  return new Date(`${dateYmd}T00:00:00.000Z`);
}

function isCash(mode: string) {
  return mode === CASH_MODE;
}

function rupees(paise: number) {
  return Number((paise / 100).toFixed(2));
}

function formatTime(d: Date | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function monthLabel(feeMonth: string) {
  const [y, m] = feeMonth.split('-').map(Number);
  if (!y || !m) return feeMonth;
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

@Injectable()
export class SchoolSisFeeReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async userWiseCollection(
    tenantId: string,
    query: UserWiseQuery,
    actor: { userId?: string; canViewAll: boolean; canClose: boolean },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const dateYmd = query.date?.trim() || istYmd();
    const { start, end } = istDayBounds(dateYmd);
    const scopedUserId = actor.canViewAll
      ? query.userId?.trim() || undefined
      : actor.userId;
    if (!actor.canViewAll && !actor.userId) {
      throw new ForbiddenException('Sign in to view your collections');
    }

    const year = await this.sis.currentYear(tenantId);
    const academicYearId = query.academicYearId?.trim() || year.id;
    const where: Prisma.SchoolFeePaymentWhereInput = {
      tenantId,
      status: 'PAID',
      paidAt: { gte: start, lte: end },
      academicYearId,
      ...(query.classId ? { gradeId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.paymentMode && query.paymentMode !== 'ALL'
        ? { paymentMode: query.paymentMode }
        : {}),
      ...(scopedUserId ? { collectedById: scopedUserId } : {}),
    };

    const payments = await this.prisma.schoolFeePayment.findMany({
      where,
      select: {
        id: true,
        collectedById: true,
        paymentMode: true,
        totalAmount: true,
        paidAt: true,
      },
    });

    type Agg = {
      userId: string | null;
      cash: number;
      online: number;
      receipts: number;
      first: Date | null;
      last: Date | null;
    };
    const byUser = new Map<string, Agg>();
    for (const p of payments) {
      const key = p.collectedById ?? 'unassigned';
      const row = byUser.get(key) ?? {
        userId: p.collectedById,
        cash: 0,
        online: 0,
        receipts: 0,
        first: null,
        last: null,
      };
      if (isCash(p.paymentMode)) row.cash += p.totalAmount;
      else if (ONLINE_MODES.has(p.paymentMode) || p.paymentMode) {
        row.online += p.totalAmount;
      }
      row.receipts += 1;
      if (p.paidAt) {
        if (!row.first || p.paidAt < row.first) row.first = p.paidAt;
        if (!row.last || p.paidAt > row.last) row.last = p.paidAt;
      }
      byUser.set(key, row);
    }

    const userIds = [...byUser.values()]
      .map((r) => r.userId)
      .filter((id): id is string => Boolean(id));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds }, tenantId },
          select: {
            id: true,
            displayName: true,
            roles: { where: { deletedAt: null }, include: { role: true } },
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    let rows = [...byUser.values()].map((r) => {
      const u = r.userId ? userMap.get(r.userId) : undefined;
      const role =
        u?.roles[0]?.role?.name ?? (r.userId ? 'Staff' : 'Unassigned');
      const userName = u?.displayName?.trim() || 'Unnamed staff';
      return {
        userId: r.userId,
        userName,
        role,
        cashCollection: rupees(r.cash),
        cashPaise: r.cash,
        onlineCollection: rupees(r.online),
        onlinePaise: r.online,
        totalCollection: rupees(r.cash + r.online),
        totalPaise: r.cash + r.online,
        receiptCount: r.receipts,
        firstCollectionTime: formatTime(r.first),
        lastCollectionTime: formatTime(r.last),
        firstAt: r.first?.toISOString() ?? null,
        lastAt: r.last?.toISOString() ?? null,
      };
    });

    const search = query.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(search) ||
          r.role.toLowerCase().includes(search),
      );
    }

    const sortBy = query.sortBy ?? 'totalCollection';
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const cmp = (
        left: string | number | null,
        right: string | number | null,
      ) => {
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        if (typeof left === 'number' && typeof right === 'number') {
          return left === right ? 0 : left < right ? -1 : 1;
        }
        return String(left).localeCompare(String(right), 'en', {
          sensitivity: 'base',
        });
      };
      switch (sortBy) {
        case 'userName':
          return dir * cmp(a.userName, b.userName);
        case 'cashCollection':
          return dir * cmp(a.cashPaise, b.cashPaise);
        case 'onlineCollection':
          return dir * cmp(a.onlinePaise, b.onlinePaise);
        case 'receiptCount':
          return dir * cmp(a.receiptCount, b.receiptCount);
        case 'firstCollectionTime':
          return dir * cmp(a.firstAt, b.firstAt);
        case 'lastCollectionTime':
          return dir * cmp(a.lastAt, b.lastAt);
        default:
          return dir * cmp(a.totalPaise, b.totalPaise);
      }
    });

    const totalCash = rows.reduce((s, r) => s + r.cashPaise, 0);
    const totalOnline = rows.reduce((s, r) => s + r.onlinePaise, 0);
    const totalTx = rows.reduce((s, r) => s + r.receiptCount, 0);
    const totalCollection = totalCash + totalOnline;
    const userCount = rows.length;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;
    const paged = rows
      .slice(skip, skip + limit)
      .map(
        ({ cashPaise, onlinePaise, totalPaise, firstAt, lastAt, ...rest }) =>
          rest,
      );

    const closes = await this.prisma.schoolFeeCashClose.findMany({
      where: {
        tenantId,
        businessDate: istBusinessDate(dateYmd),
        status: 'CLOSED',
        ...(scopedUserId ? { userId: scopedUserId } : {}),
      },
      select: {
        userId: true,
        status: true,
        difference: true,
        actualCashCount: true,
      },
    });
    const closeMap = new Map(closes.map((c) => [c.userId, c]));

    return {
      date: dateYmd,
      summary: {
        totalCollection: rupees(totalCollection),
        totalCash: rupees(totalCash),
        totalOnline: rupees(totalOnline),
        cashPercent:
          totalCollection > 0
            ? Math.round((totalCash / totalCollection) * 100)
            : 0,
        onlinePercent:
          totalCollection > 0
            ? Math.round((totalOnline / totalCollection) * 100)
            : 0,
        totalTransactions: totalTx,
        userCount,
      },
      users: paged.map((u) => ({
        ...u,
        cashClose: u.userId ? (closeMap.get(u.userId) ?? null) : null,
      })),
      pagination: { page, limit, total: rows.length },
      canViewAll: actor.canViewAll,
      canClose: actor.canClose,
      filters: await this.filterCatalog(tenantId, actor),
    };
  }

  async userReceipts(
    tenantId: string,
    collectorUserId: string | 'unassigned',
    query: UserWiseQuery,
    actor: { userId?: string; canViewAll: boolean },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (!actor.canViewAll && actor.userId && collectorUserId !== actor.userId) {
      throw new ForbiddenException('You can only view your own receipts');
    }
    const dateYmd = query.date?.trim() || istYmd();
    const { start, end } = istDayBounds(dateYmd);
    const year = await this.sis.currentYear(tenantId);
    const where: Prisma.SchoolFeePaymentWhereInput = {
      tenantId,
      status: 'PAID',
      paidAt: { gte: start, lte: end },
      academicYearId: query.academicYearId?.trim() || year.id,
      collectedById: collectorUserId === 'unassigned' ? null : collectorUserId,
      ...(query.classId ? { gradeId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.paymentMode && query.paymentMode !== 'ALL'
        ? { paymentMode: query.paymentMode }
        : {}),
    };
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const [total, rows, collector] = await Promise.all([
      this.prisma.schoolFeePayment.count({ where }),
      this.prisma.schoolFeePayment.findMany({
        where,
        include: {
          student: { select: { fullName: true, admissionNumber: true } },
          lines: { orderBy: { feeMonth: 'asc' } },
        },
        orderBy: { paidAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      collectorUserId === 'unassigned'
        ? null
        : this.prisma.user.findFirst({
            where: { id: collectorUserId, tenantId },
            select: {
              displayName: true,
              roles: { where: { deletedAt: null }, include: { role: true } },
            },
          }),
    ]);

    const gradeIds = [...new Set(rows.map((r) => r.gradeId))];
    const sectionIds = [...new Set(rows.map((r) => r.sectionId))];
    const [grades, sections] = await Promise.all([
      gradeIds.length
        ? this.prisma.schoolGrade.findMany({
            where: { id: { in: gradeIds }, tenantId },
            select: { id: true, name: true },
          })
        : [],
      sectionIds.length
        ? this.prisma.schoolSection.findMany({
            where: { id: { in: sectionIds }, tenantId },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const gradeMap = new Map(grades.map((g) => [g.id, g.name]));
    const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

    const receipts = rows.map((p) => {
      const months = p.lines.length
        ? p.lines.map((l) => monthLabel(l.feeMonth)).join(', ')
        : monthLabel(p.feeMonth);
      return {
        id: p.id,
        receiptNumber: p.receiptNumber,
        studentName: p.student.fullName,
        admissionNo: p.student.admissionNumber,
        className:
          `${gradeMap.get(p.gradeId) ?? ''} ${sectionMap.get(p.sectionId) ?? ''}`.trim(),
        feeMonth: months,
        amount: rupees(p.totalAmount),
        paymentMode: p.paymentMode,
        collectionTime: formatTime(p.paidAt),
        status: p.status,
      };
    });

    return {
      date: dateYmd,
      user: {
        userId: collectorUserId === 'unassigned' ? null : collectorUserId,
        userName: collector?.displayName?.trim() || 'Unassigned',
        role: collector?.roles[0]?.role?.name ?? 'Staff',
      },
      summary: await this.receiptSummary(where),
      receipts,
      pagination: { page, limit, total },
    };
  }

  private async receiptSummary(where: Prisma.SchoolFeePaymentWhereInput) {
    const all = await this.prisma.schoolFeePayment.findMany({
      where,
      select: { totalAmount: true, paymentMode: true },
    });
    let cash = 0;
    let online = 0;
    for (const p of all) {
      if (isCash(p.paymentMode)) cash += p.totalAmount;
      else online += p.totalAmount;
    }
    return {
      cashCollected: rupees(cash),
      onlineCollected: rupees(online),
      total: rupees(cash + online),
      receipts: all.length,
    };
  }

  async collectors(
    tenantId: string,
    canViewAll: boolean,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (!canViewAll && actorUserId) {
      const me = await this.prisma.user.findFirst({
        where: { id: actorUserId, tenantId },
        select: { id: true, displayName: true },
      });
      return me
        ? [{ userId: me.id, userName: me.displayName?.trim() || 'You' }]
        : [];
    }
    const ids = await this.prisma.schoolFeePayment.findMany({
      where: { tenantId, status: 'PAID', collectedById: { not: null } },
      distinct: ['collectedById'],
      select: { collectedById: true },
      take: 200,
    });
    const userIds = ids
      .map((r) => r.collectedById)
      .filter((id): id is string => Boolean(id));
    if (!userIds.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, tenantId },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    return users.map((u) => ({
      userId: u.id,
      userName: u.displayName?.trim() || 'Staff',
    }));
  }

  private async filterCatalog(
    tenantId: string,
    actor: { userId?: string; canViewAll: boolean },
  ) {
    const year = await this.sis.currentYear(tenantId);
    const [years, grades, sections, settings, collectors] = await Promise.all([
      this.prisma.schoolAcademicYear.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, status: true },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null, active: true },
        select: { id: true, name: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSection.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        select: { id: true, gradeId: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.schoolFeeSettings.findUnique({
        where: {
          tenantId_academicYearId: { tenantId, academicYearId: year.id },
        },
        select: {
          paymentMethods: true,
          schoolName: true,
          logoUrl: true,
        },
      }),
      this.collectors(tenantId, actor.canViewAll, actor.userId),
    ]);
    const methods = Array.isArray(settings?.paymentMethods)
      ? (settings.paymentMethods as string[])
      : ['CASH', 'UPI', 'BANK', 'ONLINE', 'CHEQUE', 'OTHER'];
    return {
      academicYear: { id: year.id, name: year.name },
      years,
      grades,
      sections,
      paymentModes: methods,
      collectors,
      schoolName: settings?.schoolName ?? null,
      logoUrl: settings?.logoUrl ?? null,
    };
  }

  async closeCashCounter(
    tenantId: string,
    dto: {
      userId: string;
      date: string;
      academicYearId?: string;
      openingCash: number;
      actualCashCount: number;
      notes?: string;
    },
    actor: { userId?: string; canClose: boolean },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (!actor.canClose) {
      throw new ForbiddenException(
        'Only an administrator can close the cash counter',
      );
    }
    const dateYmd = dto.date?.trim() || istYmd();
    const { start, end } = istDayBounds(dateYmd);
    const year = dto.academicYearId
      ? await this.prisma.schoolAcademicYear.findFirst({
          where: { id: dto.academicYearId, tenantId },
        })
      : await this.sis.currentYear(tenantId);
    if (!year) throw new BadRequestException('Academic year not found');

    const cashRows = await this.prisma.schoolFeePayment.findMany({
      where: {
        tenantId,
        status: 'PAID',
        paymentMode: CASH_MODE,
        collectedById: dto.userId,
        paidAt: { gte: start, lte: end },
      },
      select: { totalAmount: true },
    });
    const cashCollected = cashRows.reduce((s, r) => s + r.totalAmount, 0);
    const cashRefunds = 0;
    const openingCash = Math.round(dto.openingCash * 100);
    const actualCashCount = Math.round(dto.actualCashCount * 100);
    const expectedClosing = openingCash + cashCollected - cashRefunds;
    const difference = actualCashCount - expectedClosing;
    const status =
      difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORT' : 'EXCESS';

    const existing = await this.prisma.schoolFeeCashClose.findUnique({
      where: {
        tenantId_userId_businessDate: {
          tenantId,
          userId: dto.userId,
          businessDate: istBusinessDate(dateYmd),
        },
      },
    });
    if (existing?.status === 'CLOSED') {
      throw new BadRequestException(
        'This cash counter is already closed. Reopen it before closing again.',
      );
    }

    const data = {
      academicYearId: year.id,
      openingCash,
      cashCollected,
      cashRefunds,
      expectedClosing,
      actualCashCount,
      difference,
      status: 'CLOSED',
      notes: dto.notes?.trim() || `${status}`,
      closedAt: new Date(),
      closedById: actor.userId ?? dto.userId,
      reopenedAt: null,
      reopenedById: null,
    };

    const row = existing
      ? await this.prisma.schoolFeeCashClose.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.schoolFeeCashClose.create({
          data: {
            tenantId,
            userId: dto.userId,
            businessDate: istBusinessDate(dateYmd),
            ...data,
          },
        });

    return this.serializeClose(row);
  }

  async reopenCashCounter(
    tenantId: string,
    userId: string,
    dateYmd: string,
    actor: { userId?: string; canClose: boolean },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (!actor.canClose) {
      throw new ForbiddenException(
        'Only an administrator can reopen the cash counter',
      );
    }
    const row = await this.prisma.schoolFeeCashClose.findUnique({
      where: {
        tenantId_userId_businessDate: {
          tenantId,
          userId,
          businessDate: istBusinessDate(dateYmd),
        },
      },
    });
    if (!row || row.status !== 'CLOSED') {
      throw new NotFoundException(
        'No closed cash counter for this user and date',
      );
    }
    const next = await this.prisma.schoolFeeCashClose.update({
      where: { id: row.id },
      data: {
        status: 'REOPENED',
        reopenedAt: new Date(),
        reopenedById: actor.userId ?? null,
      },
    });
    return this.serializeClose(next);
  }

  async getCashClose(tenantId: string, userId: string, dateYmd: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolFeeCashClose.findUnique({
      where: {
        tenantId_userId_businessDate: {
          tenantId,
          userId,
          businessDate: istBusinessDate(dateYmd),
        },
      },
    });
    return row ? this.serializeClose(row) : null;
  }

  async assertCounterOpenForCollect(
    tenantId: string,
    actorUserId: string | undefined,
    canClose: boolean,
  ) {
    if (!actorUserId || canClose) return;
    const dateYmd = istYmd();
    const closed = await this.prisma.schoolFeeCashClose.findFirst({
      where: {
        tenantId,
        userId: actorUserId,
        businessDate: istBusinessDate(dateYmd),
        status: 'CLOSED',
      },
    });
    if (closed) {
      throw new ForbiddenException(
        'Your cash counter is closed for today. Ask an administrator to reopen it before collecting more fees.',
      );
    }
  }

  async assertCounterOpenForVoid(
    tenantId: string,
    paymentPaidAt: Date | null,
    collectedById: string | null,
    canClose: boolean,
  ) {
    if (canClose || !paymentPaidAt || !collectedById) return;
    const dateYmd = istYmd(paymentPaidAt);
    const closed = await this.prisma.schoolFeeCashClose.findFirst({
      where: {
        tenantId,
        userId: collectedById,
        businessDate: istBusinessDate(dateYmd),
        status: 'CLOSED',
      },
    });
    if (closed) {
      throw new ForbiddenException(
        'This receipt belongs to a closed cash counter. Ask an administrator to reopen it before voiding.',
      );
    }
  }

  private serializeClose(row: {
    id: string;
    userId: string;
    businessDate: Date;
    openingCash: number;
    cashCollected: number;
    cashRefunds: number;
    expectedClosing: number;
    actualCashCount: number;
    difference: number;
    status: string;
    notes: string | null;
    closedAt: Date;
    reopenedAt: Date | null;
  }) {
    const diffRupees = rupees(row.difference);
    const recon =
      row.difference === 0
        ? 'BALANCED'
        : row.difference < 0
          ? 'SHORT'
          : 'EXCESS';
    return {
      id: row.id,
      userId: row.userId,
      businessDate: row.businessDate.toISOString().slice(0, 10),
      openingCash: rupees(row.openingCash),
      cashCollected: rupees(row.cashCollected),
      cashRefunds: rupees(row.cashRefunds),
      expectedClosing: rupees(row.expectedClosing),
      actualCashCount: rupees(row.actualCashCount),
      difference: diffRupees,
      reconStatus: recon,
      status: row.status,
      notes: row.notes,
      closedAt: row.closedAt.toISOString(),
      reopenedAt: row.reopenedAt?.toISOString() ?? null,
    };
  }

  /** Excel bytes for user-wise table (PAID receipts only). */
  async userWiseExcel(
    tenantId: string,
    query: UserWiseQuery,
    actor: { userId?: string; canViewAll: boolean; canClose: boolean },
  ) {
    const report = await this.userWiseCollection(
      tenantId,
      { ...query, page: 1, limit: 100 },
      actor,
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('User Wise Collection');
    ws.addRow(['User Wise Collection Report']);
    ws.addRow([`Date: ${report.date}`]);
    ws.addRow([
      `Total Collection: ${report.summary.totalCollection}`,
      `Cash: ${report.summary.totalCash}`,
      `Online: ${report.summary.totalOnline}`,
      `Receipts: ${report.summary.totalTransactions}`,
    ]);
    ws.addRow([]);
    ws.addRow([
      '#',
      'User Name',
      'Role',
      'Cash Collection',
      'Online Collection',
      'Total Collection',
      'No. of Receipts',
      'First Collection Time',
      'Last Collection Time',
    ]);
    report.users.forEach((u, i) => {
      ws.addRow([
        i + 1,
        u.userName,
        u.role,
        u.cashCollection,
        u.onlineCollection,
        u.totalCollection,
        u.receiptCount,
        u.firstCollectionTime,
        u.lastCollectionTime,
      ]);
    });
    ws.addRow([
      '',
      'Total',
      '',
      report.summary.totalCash,
      report.summary.totalOnline,
      report.summary.totalCollection,
      report.summary.totalTransactions,
      '',
      '',
    ]);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
