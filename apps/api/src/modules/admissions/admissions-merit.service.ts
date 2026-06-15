import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AdmissionsCycleService,
  type CycleSettings,
} from './admissions-cycle.service';

@Injectable()
export class AdmissionsMeritService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
  ) {}

  async generateMeritList(
    tenantId: string,
    dto: { intakeId: string; round?: number; name?: string; category?: string },
    actorId?: string,
  ) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: dto.intakeId, tenantId, deletedAt: null },
      include: { cycle: true },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    const round = dto.round ?? 1;
    const existing = await this.prisma.meritList.findFirst({
      where: { intakeId: dto.intakeId, round, deletedAt: null },
    });
    if (existing?.status === 'published') {
      throw new BadRequestException(
        'Published merit list cannot be regenerated',
      );
    }

    const applications = await this.prisma.admissionApplication.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['rejected', 'draft'] },
        OR: [
          { intakeId: dto.intakeId },
          { cycleId: intake.cycleId, programId: intake.programId },
        ],
        ...(dto.category ? { category: dto.category } : {}),
      },
    });

    const settings = (intake.cycle?.settings as CycleSettings) ?? {};
    const scored = applications
      .map((app) => ({
        app,
        score: this.resolveMeritScore(app, settings),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aSubmitted = a.app.submittedAt?.getTime() ?? 0;
        const bSubmitted = b.app.submittedAt?.getTime() ?? 0;
        return aSubmitted - bSubmitted;
      });

    const meritList = existing
      ? await this.prisma.meritList.update({
          where: { id: existing.id },
          data: { name: dto.name ?? existing.name, status: 'draft' },
        })
      : await this.prisma.meritList.create({
          data: {
            tenantId,
            intakeId: dto.intakeId,
            name: dto.name ?? `${intake.name} — Round ${round}`,
            round,
            status: 'draft',
          },
        });

    await this.prisma.meritListEntry.deleteMany({
      where: { meritListId: meritList.id },
    });

    if (scored.length > 0) {
      await this.prisma.meritListEntry.createMany({
        data: scored.map((row, idx) => ({
          tenantId,
          meritListId: meritList.id,
          applicationId: row.app.id,
          rank: idx + 1,
          score: row.score,
        })),
      });

      await this.prisma.$transaction(
        scored.map((row) =>
          this.prisma.admissionApplication.update({
            where: { id: row.app.id },
            data: { meritScore: row.score },
          }),
        ),
      );
    }

    await this.cycles.audit(
      tenantId,
      intake.cycleId,
      'merit_list',
      meritList.id,
      'merit.generated',
      actorId,
      null,
      { round, entries: scored.length },
    );

    return this.getMeritList(tenantId, meritList.id);
  }

  resolveMeritScore(
    app: { meritScore: Prisma.Decimal; formData: unknown },
    settings: CycleSettings,
  ): number {
    const rules = settings.meritRules ?? { class12Weight: 1, cuetWeight: 0 };
    const form = (app.formData as Record<string, unknown>) ?? {};
    const academic = form.academic as
      | { class12Percentage?: number; cuetScore?: number }
      | undefined;

    const class12 = academic?.class12Percentage ?? Number(app.meritScore);
    const cuet = academic?.cuetScore ?? 0;
    return Number(
      (
        class12 * (rules.class12Weight ?? 1) +
        cuet * (rules.cuetWeight ?? 0)
      ).toFixed(2),
    );
  }

  getMeritList(tenantId: string, id: string) {
    return this.prisma.meritList.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        intake: { include: { program: true } },
        entries: {
          orderBy: { rank: 'asc' },
          include: { application: true },
        },
      },
    });
  }

  async publishMeritList(tenantId: string, id: string, actorId?: string) {
    const list = await this.prisma.meritList.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { intake: true },
    });
    if (!list) throw new NotFoundException('Merit list not found');

    const updated = await this.prisma.meritList.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: {
        intake: { include: { program: true } },
        _count: { select: { entries: true } },
      },
    });

    await this.cycles.audit(
      tenantId,
      list.intake.cycleId,
      'merit_list',
      id,
      'merit.published',
      actorId,
    );

    return updated;
  }
}
