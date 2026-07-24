import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { WebsiteService } from './website.service';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

export type PlannerDayDto = {
  id: string;
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  statusLabel: string;
  description: string;
  isWorkingDay: boolean;
  isHighlighted: boolean;
};

export type PlannerMonthDto = {
  key: string;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  days: PlannerDayDto[];
};

@Injectable()
export class WebsiteAcademicPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
  ) {}

  async listYears(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteAcademicPlannerYear.findMany({
      where: { tenantId, siteId: site.id, deletedAt: null },
      orderBy: [{ startDate: 'desc' }],
      include: { _count: { select: { days: true } } },
    });
    return rows.map((row) => this.mapYear(row, row._count.days));
  }

  async createYear(
    user: JwtUser,
    dto: {
      title: string;
      slug?: string;
      startDate: string;
      endDate: string;
      status?: string;
    },
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Title is required');
    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const slug = (dto.slug?.trim() || this.slugify(title)).toLowerCase();
    const status = (dto.status ?? 'DRAFT').toUpperCase();
    if (!['DRAFT', 'PUBLISHED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const row = await this.prisma.websiteAcademicPlannerYear.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        title,
        slug,
        startDate,
        endDate,
        status,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    return this.mapYear(row, 0);
  }

  async updateYear(
    user: JwtUser,
    yearId: string,
    dto: Partial<{
      title: string;
      slug: string;
      startDate: string;
      endDate: string;
      status: string;
      isVisible: boolean;
    }>,
  ) {
    const existing = await this.requireYear(user.tid, yearId);
    if (dto.status !== undefined) {
      const status = dto.status.toUpperCase();
      if (!['DRAFT', 'PUBLISHED'].includes(status)) {
        throw new BadRequestException('Invalid status');
      }
    }
    const startDate =
      dto.startDate !== undefined
        ? this.parseDate(dto.startDate, 'startDate')
        : existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? this.parseDate(dto.endDate, 'endDate')
        : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const row = await this.prisma.websiteAcademicPlannerYear.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined
          ? { slug: dto.slug.trim().toLowerCase() }
          : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.status !== undefined
          ? { status: dto.status.toUpperCase() }
          : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
        updatedById: user.sub,
      },
      include: { _count: { select: { days: true } } },
    });
    return this.mapYear(row, row._count.days);
  }

  async trashYear(user: JwtUser, yearId: string) {
    const existing = await this.requireYear(user.tid, yearId);
    await this.prisma.websiteAcademicPlannerYear.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedById: user.sub,
        updatedById: user.sub,
      },
    });
    return { ok: true };
  }

  async getYearDetail(tenantId: string, yearId: string, monthKey?: string) {
    const year = await this.requireYear(tenantId, yearId);
    const days = await this.prisma.websiteAcademicPlannerDay.findMany({
      where: { yearId: year.id, tenantId, deletedAt: null },
      orderBy: { date: 'asc' },
    });
    const months = this.groupMonths(days);
    const selected =
      monthKey && months.some((m) => m.key === monthKey)
        ? monthKey
        : (months[0]?.key ?? this.defaultMonthKey(year.startDate));
    return {
      ...this.mapYear(year, days.length),
      months,
      selectedMonthKey: selected,
      selectedMonth: months.find((m) => m.key === selected) ?? null,
    };
  }

  /**
   * Create missing day rows for a calendar month inside the planner year range.
   * Sundays default to highlighted non-working rows; weekdays default to Class.
   */
  async ensureMonth(
    user: JwtUser,
    yearId: string,
    year: number,
    month: number,
  ) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('month must be 1–12');
    }
    const planner = await this.requireYear(user.tid, yearId);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const existing = await this.prisma.websiteAcademicPlannerDay.findMany({
      where: {
        yearId: planner.id,
        deletedAt: null,
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month - 1, daysInMonth)),
        },
      },
      select: { date: true },
    });
    const have = new Set(
      existing.map((row) => row.date.toISOString().slice(0, 10)),
    );
    const toCreate: Array<{
      tenantId: string;
      siteId: string;
      yearId: string;
      date: Date;
      statusLabel: string;
      description: string;
      isWorkingDay: boolean;
      isHighlighted: boolean;
      createdById: string;
      updatedById: string;
    }> = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const iso = date.toISOString().slice(0, 10);
      if (have.has(iso)) continue;
      if (date < planner.startDate || date > planner.endDate) continue;
      const dow = date.getUTCDay();
      const isSunday = dow === 0;
      toCreate.push({
        tenantId: user.tid,
        siteId: planner.siteId,
        yearId: planner.id,
        date,
        statusLabel: isSunday ? '' : 'Class',
        description: '',
        isWorkingDay: !isSunday,
        isHighlighted: isSunday,
        createdById: user.sub,
        updatedById: user.sub,
      });
    }

    if (toCreate.length) {
      await this.prisma.websiteAcademicPlannerDay.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return this.getYearDetail(
      user.tid,
      planner.id,
      `${year}-${String(month).padStart(2, '0')}`,
    );
  }

  /** Generate day rows for every month in the planner year range. */
  async ensureAllMonths(user: JwtUser, yearId: string) {
    const planner = await this.requireYear(user.tid, yearId);
    const cursor = new Date(
      Date.UTC(
        planner.startDate.getUTCFullYear(),
        planner.startDate.getUTCMonth(),
        1,
      ),
    );
    const last = new Date(
      Date.UTC(
        planner.endDate.getUTCFullYear(),
        planner.endDate.getUTCMonth(),
        1,
      ),
    );
    while (cursor <= last) {
      await this.ensureMonth(
        user,
        planner.id,
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return this.getYearDetail(user.tid, planner.id);
  }

  async updateDay(
    user: JwtUser,
    dayId: string,
    dto: Partial<{
      statusLabel: string;
      description: string;
      isWorkingDay: boolean;
      isHighlighted: boolean;
    }>,
  ) {
    const existing = await this.prisma.websiteAcademicPlannerDay.findFirst({
      where: { id: dayId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Planner day not found');
    const row = await this.prisma.websiteAcademicPlannerDay.update({
      where: { id: existing.id },
      data: {
        ...(dto.statusLabel !== undefined
          ? { statusLabel: dto.statusLabel.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.isWorkingDay !== undefined
          ? { isWorkingDay: dto.isWorkingDay }
          : {}),
        ...(dto.isHighlighted !== undefined
          ? { isHighlighted: dto.isHighlighted }
          : {}),
        updatedById: user.sub,
      },
    });
    return this.mapDay(row);
  }

  async updateMonthDays(
    user: JwtUser,
    yearId: string,
    monthKey: string,
    days: Array<{
      id?: string;
      date: string;
      statusLabel?: string;
      description?: string;
      isWorkingDay?: boolean;
      isHighlighted?: boolean;
    }>,
  ) {
    const planner = await this.requireYear(user.tid, yearId);
    const parsed = this.parseMonthKey(monthKey);
    await this.ensureMonth(user, planner.id, parsed.year, parsed.month);

    const existing = await this.prisma.websiteAcademicPlannerDay.findMany({
      where: {
        yearId: planner.id,
        deletedAt: null,
        date: {
          gte: new Date(Date.UTC(parsed.year, parsed.month - 1, 1)),
          lte: new Date(
            Date.UTC(
              parsed.year,
              parsed.month - 1,
              new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate(),
            ),
          ),
        },
      },
    });
    const byDate = new Map(
      existing.map((row) => [row.date.toISOString().slice(0, 10), row]),
    );

    for (const item of days) {
      const dateKey = item.date.slice(0, 10);
      const row = byDate.get(dateKey);
      if (!row) continue;
      await this.prisma.websiteAcademicPlannerDay.update({
        where: { id: row.id },
        data: {
          ...(item.statusLabel !== undefined
            ? { statusLabel: item.statusLabel.trim() }
            : {}),
          ...(item.description !== undefined
            ? { description: item.description.trim() }
            : {}),
          ...(item.isWorkingDay !== undefined
            ? { isWorkingDay: item.isWorkingDay }
            : {}),
          ...(item.isHighlighted !== undefined
            ? { isHighlighted: item.isHighlighted }
            : {}),
          updatedById: user.sub,
        },
      });
    }

    return this.getYearDetail(user.tid, planner.id, monthKey);
  }

  async getPublicPlanner(tenantId: string, slug?: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return null;

    const year = await this.prisma.websiteAcademicPlannerYear.findFirst({
      where: {
        tenantId,
        siteId: site.id,
        deletedAt: null,
        status: 'PUBLISHED',
        isVisible: true,
        ...(slug ? { slug } : {}),
      },
      orderBy: [{ startDate: 'desc' }],
    });
    if (!year) return null;

    const days = await this.prisma.websiteAcademicPlannerDay.findMany({
      where: { yearId: year.id, deletedAt: null },
      orderBy: { date: 'asc' },
    });

    return {
      ...this.mapYear(year, days.length),
      months: this.groupMonths(days),
    };
  }

  private async requireYear(tenantId: string, yearId: string) {
    const row = await this.prisma.websiteAcademicPlannerYear.findFirst({
      where: { id: yearId, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Academic planner year not found');
    return row;
  }

  private groupMonths(
    days: Array<{
      id: string;
      date: Date;
      statusLabel: string;
      description: string;
      isWorkingDay: boolean;
      isHighlighted: boolean;
    }>,
  ): PlannerMonthDto[] {
    const map = new Map<string, PlannerMonthDto>();
    for (const day of days) {
      const y = day.date.getUTCFullYear();
      const m = day.date.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      let month = map.get(key);
      if (!month) {
        month = {
          key,
          year: y,
          month: m,
          title: `${MONTH_NAMES[m - 1]} ${y}`,
          workingDays: 0,
          days: [],
        };
        map.set(key, month);
      }
      const mapped = this.mapDay(day);
      month.days.push(mapped);
      if (mapped.isWorkingDay) month.workingDays += 1;
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  private mapYear(
    row: {
      id: string;
      title: string;
      slug: string;
      startDate: Date;
      endDate: Date;
      status: string;
      isVisible: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    dayCount: number,
  ) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      status: row.status,
      isVisible: row.isVisible,
      dayCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapDay(row: {
    id: string;
    date: Date;
    statusLabel: string;
    description: string;
    isWorkingDay: boolean;
    isHighlighted: boolean;
  }): PlannerDayDto {
    const dow = row.date.getUTCDay();
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      dayOfWeek: DAY_NAMES[dow],
      dayOfMonth: row.date.getUTCDate(),
      statusLabel: row.statusLabel,
      description: row.description,
      isWorkingDay: row.isWorkingDay,
      isHighlighted: row.isHighlighted,
    };
  }

  private parseDate(value: string, field: string) {
    const raw = value.trim().slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }

  private parseMonthKey(monthKey: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match) {
      throw new BadRequestException('monthKey must be YYYY-MM');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      throw new BadRequestException('monthKey month must be 01–12');
    }
    return { year, month };
  }

  private defaultMonthKey(startDate: Date) {
    const y = startDate.getUTCFullYear();
    const m = startDate.getUTCMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }
}
