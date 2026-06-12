import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseTimeToDate } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';

type SlotRuleDto = {
  dayOfWeek: number;
  periodNo?: number;
  startTime: string;
  endTime: string;
  label?: string;
  allowedCategories?: string[];
  isBreak?: boolean;
  isLunch?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class TimetableSlotRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules(tenantId: string, planId: string) {
    await this.assertPlan(tenantId, planId);
    return this.prisma.timetableSlotTemplate.findMany({
      where: { tenantId, planId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async upsertRule(tenantId: string, planId: string, dto: SlotRuleDto) {
    const plan = await this.assertPlan(tenantId, planId);
    if (!dto.dayOfWeek || dto.dayOfWeek < 1 || dto.dayOfWeek > 6) {
      throw new BadRequestException(
        'Day of week must be between Monday and Saturday',
      );
    }
    const startTime = parseTimeToDate(dto.startTime);
    const endTime = parseTimeToDate(dto.endTime);
    if (startTime >= endTime) {
      throw new BadRequestException('Slot start time must be before end time');
    }
    const periodNo = dto.periodNo ?? 1;
    const existing = await this.prisma.timetableSlotTemplate.findFirst({
      where: { tenantId, planId, dayOfWeek: dto.dayOfWeek, periodNo },
    });
    const data = {
      tenantId,
      planId,
      shiftId: plan.shiftId,
      dayOfWeek: dto.dayOfWeek,
      periodNo,
      label: dto.label ?? `P${periodNo}`,
      startTime,
      endTime,
      durationMinutes: Math.max(
        1,
        Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      ),
      isBreak: Boolean(dto.isBreak),
      isLunch: Boolean(dto.isLunch),
      isSaturdayHalfDay: dto.dayOfWeek === 6,
      allowedCategories: this.normalizeCategories(dto.allowedCategories) as any,
      metadata: (dto.metadata ?? {}) as any,
    };
    return existing
      ? this.prisma.timetableSlotTemplate.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.timetableSlotTemplate.create({ data });
  }

  async configureCategoryRules(
    tenantId: string,
    planId: string,
    rules: SlotRuleDto[],
  ) {
    await this.assertPlan(tenantId, planId);
    const saved = [];
    for (const rule of rules) {
      saved.push(await this.upsertRule(tenantId, planId, rule));
    }
    return { saved: saved.length, rules: saved };
  }

  private async assertPlan(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { tenantId, id: planId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Published timetable rules cannot be modified',
      );
    }
    return plan;
  }

  private normalizeCategories(values?: string[]) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => String(value).trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }
}
