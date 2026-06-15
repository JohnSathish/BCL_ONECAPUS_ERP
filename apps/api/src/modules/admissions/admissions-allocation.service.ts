import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionsCycleService } from './admissions-cycle.service';
import { resolveAdmissionFeeDue } from './admissions-fee.util';

type ReservedSeats = Record<string, number>;

@Injectable()
export class AdmissionsAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
  ) {}

  async runSeatAllocation(
    tenantId: string,
    dto: { intakeId: string; meritListId: string; round?: number },
    actorId?: string,
  ) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: dto.intakeId, tenantId, deletedAt: null },
      include: {
        cycle: { select: { settings: true } },
        allocations: {
          where: { deletedAt: null, status: { not: 'withdrawn' } },
        },
      },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    const meritList = await this.prisma.meritList.findFirst({
      where: {
        id: dto.meritListId,
        intakeId: dto.intakeId,
        tenantId,
        deletedAt: null,
        status: 'published',
      },
      include: {
        entries: {
          orderBy: { rank: 'asc' },
          include: { application: true },
        },
      },
    });
    if (!meritList) {
      throw new BadRequestException(
        'Merit list must be published before allocation',
      );
    }

    const round = dto.round ?? meritList.round;
    const alreadyAllocated = new Set(
      intake.allocations.map((a) => a.applicationId),
    );

    const shiftCaps = await this.prisma.admissionIntakeShift.findMany({
      where: { intakeId: dto.intakeId },
      include: { shift: true },
    });

    const allocatedByShift = new Map<string, number>();
    const allocatedByShiftCategory = new Map<string, Map<string, number>>();

    for (const a of intake.allocations) {
      if (a.shiftId) {
        allocatedByShift.set(
          a.shiftId,
          (allocatedByShift.get(a.shiftId) ?? 0) + 1,
        );
      }
    }

    const toAllocate: typeof meritList.entries = [];

    for (const entry of meritList.entries) {
      if (alreadyAllocated.has(entry.applicationId)) continue;

      const app = entry.application;
      const category = app.category ?? 'GENERAL';
      const preferredShiftId = app.preferredShiftId;

      if (preferredShiftId && shiftCaps.length > 0) {
        const cap = shiftCaps.find((c) => c.shiftId === preferredShiftId);
        if (!cap) continue;

        const shiftUsed = allocatedByShift.get(preferredShiftId) ?? 0;
        if (shiftUsed >= cap.totalSeats) continue;

        const reserved = (cap.reservedSeats as ReservedSeats) ?? {};
        const categoryCap = reserved[category] ?? cap.totalSeats;
        const catMap =
          allocatedByShiftCategory.get(preferredShiftId) ??
          new Map<string, number>();
        const catUsed = catMap.get(category) ?? 0;

        if (categoryCap > 0 && catUsed >= categoryCap) continue;

        allocatedByShift.set(preferredShiftId, shiftUsed + 1);
        catMap.set(category, catUsed + 1);
        allocatedByShiftCategory.set(preferredShiftId, catMap);
        toAllocate.push(entry);
        continue;
      }

      if (intake.allocations.length + toAllocate.length < intake.totalSeats) {
        toAllocate.push(entry);
      }
    }

    const created = await this.prisma.$transaction(
      toAllocate.map((entry) =>
        this.prisma.seatAllocation.create({
          data: {
            tenantId,
            intakeId: dto.intakeId,
            applicationId: entry.applicationId,
            shiftId: entry.application.preferredShiftId,
            round,
            status: 'provisional',
          },
        }),
      ),
    );

    const defaultAdmissionDue = resolveAdmissionFeeDue(
      (intake.cycle?.settings as Record<string, unknown> | null) ?? null,
    );

    await this.prisma.admissionApplication.updateMany({
      where: {
        id: { in: toAllocate.map((e) => e.applicationId) },
        status: { notIn: ['rejected', 'allotted'] },
      },
      data: {
        status: 'allotted',
        admissionFeeStatus: 'PENDING',
        admissionFeeAmount: defaultAdmissionDue,
      },
    });

    await this.cycles.audit(
      tenantId,
      intake.cycleId,
      'allocation',
      dto.intakeId,
      'allocation.run',
      actorId,
      null,
      { round, allocated: created.length },
    );

    const totalAllocated = intake.allocations.length + created.length;
    return {
      allocated: created.length,
      seatsRemaining: Math.max(0, intake.totalSeats - totalAllocated),
      allocations: await this.listAllocations(tenantId, dto.intakeId),
    };
  }

  listAllocations(tenantId: string, intakeId?: string) {
    return this.prisma.seatAllocation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(intakeId ? { intakeId } : {}),
      },
      include: {
        application: true,
        intake: { include: { program: true } },
        shift: true,
      },
      orderBy: { allocatedAt: 'desc' },
    });
  }
}
