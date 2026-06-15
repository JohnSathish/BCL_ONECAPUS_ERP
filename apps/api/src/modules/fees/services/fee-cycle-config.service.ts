import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  FEE_CYCLE_TRIGGER_SEMESTERS,
  semesterPairLabel,
} from '../constants/fee-cycle.constants';
import type {
  CreateFeeCycleDto,
  FeeCycleQueryDto,
  UpdateFeeCycleDto,
} from '../dto/fee-cycle.dto';

@Injectable()
export class FeeCycleConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async list(tenantId: string, query: FeeCycleQueryDto = {}) {
    return this.db().academicFeeCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.startSemester ? { startSemester: query.startSemester } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      },
      include: {
        lines: {
          include: { feeHead: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ startSemester: 'asc' }, { name: 'asc' }],
    });
  }

  async getOne(tenantId: string, id: string) {
    const cycle = await this.db().academicFeeCycle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        lines: {
          include: { feeHead: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Fee cycle not found');
    return {
      ...cycle,
      applicableSemesters: semesterPairLabel(
        cycle.startSemester,
        cycle.endSemester,
      ),
    };
  }

  async create(user: JwtUser, dto: CreateFeeCycleDto) {
    this.validateCycleSemesters(dto.startSemester, dto.endSemester);
    const existing = await this.db().academicFeeCycle.findFirst({
      where: { tenantId: user.tid, code: dto.code, deletedAt: null },
    });
    if (existing)
      throw new ConflictException(
        `Fee cycle code "${dto.code}" already exists`,
      );

    const cycle = await this.db().academicFeeCycle.create({
      data: {
        tenantId: user.tid,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        academicYearId: dto.academicYearId,
        programId: dto.programId,
        departmentId: dto.departmentId,
        shiftId: dto.shiftId,
        fyugpYear: dto.fyugpYear ?? Math.ceil(dto.startSemester / 2),
        startSemester: dto.startSemester,
        endSemester: dto.endSemester,
        totalAmount: dto.totalAmount,
        description: dto.description,
        status: dto.status ?? 'DRAFT',
        createdById: user.sub,
        ...(dto.lines?.length
          ? {
              lines: {
                create: dto.lines.map((line, index) => ({
                  tenantId: user.tid,
                  feeHeadId: line.feeHeadId,
                  amount: line.amount,
                  sortOrder: line.sortOrder ?? (index + 1) * 10,
                })),
              },
            }
          : {}),
      },
      include: {
        lines: { include: { feeHead: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    await this.audit(user, 'fee_cycle.created', cycle.id, { after: cycle });
    return cycle;
  }

  async update(user: JwtUser, id: string, dto: UpdateFeeCycleDto) {
    const before = await this.ensure(user.tid, id);
    if (dto.startSemester != null && dto.endSemester != null) {
      this.validateCycleSemesters(dto.startSemester, dto.endSemester);
    }

    if (dto.lines) {
      await this.db().academicFeeCycleLine.deleteMany({
        where: { feeCycleId: id, tenantId: user.tid },
      });
      if (dto.lines.length) {
        await this.db().academicFeeCycleLine.createMany({
          data: dto.lines.map((line, index) => ({
            tenantId: user.tid,
            feeCycleId: id,
            feeHeadId: line.feeHeadId,
            amount: line.amount,
            sortOrder: line.sortOrder ?? (index + 1) * 10,
          })),
        });
      }
    }

    const cycle = await this.db().academicFeeCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.academicYearId !== undefined
          ? { academicYearId: dto.academicYearId }
          : {}),
        ...(dto.programId !== undefined ? { programId: dto.programId } : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.shiftId !== undefined ? { shiftId: dto.shiftId } : {}),
        ...(dto.fyugpYear !== undefined ? { fyugpYear: dto.fyugpYear } : {}),
        ...(dto.startSemester !== undefined
          ? { startSemester: dto.startSemester }
          : {}),
        ...(dto.endSemester !== undefined
          ? { endSemester: dto.endSemester }
          : {}),
        ...(dto.totalAmount !== undefined
          ? { totalAmount: dto.totalAmount }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        lines: { include: { feeHead: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    await this.audit(user, 'fee_cycle.updated', id, { before, after: cycle });
    return cycle;
  }

  async activate(user: JwtUser, id: string) {
    return this.update(user, id, { status: 'ACTIVE' });
  }

  async deactivate(user: JwtUser, id: string) {
    return this.update(user, id, { status: 'INACTIVE' });
  }

  async remove(user: JwtUser, id: string) {
    const before = await this.ensure(user.tid, id);
    const demandCount = await this.db().studentFeeDemand.count({
      where: { feeCycleId: id, tenantId: user.tid },
    });
    if (demandCount > 0) {
      const cycle = await this.update(user, id, { status: 'INACTIVE' });
      await this.audit(user, 'fee_cycle.deactivated', id, {
        before,
        after: cycle,
      });
      return cycle;
    }
    const cycle = await this.db().academicFeeCycle.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await this.audit(user, 'fee_cycle.deleted', id, { before, after: cycle });
    return cycle;
  }

  async resolveForStudent(
    tenantId: string,
    semesterNumber: number,
    scope: {
      programId?: string | null;
      departmentId?: string | null;
      shiftId?: string | null;
      academicYearId?: string | null;
    },
  ) {
    const cycles = await this.db().academicFeeCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        startSemester: semesterNumber,
      },
      include: {
        lines: {
          include: { feeHead: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const score = (cycle: {
      programId?: string | null;
      departmentId?: string | null;
      shiftId?: string | null;
      academicYearId?: string | null;
    }) => {
      let points = 0;
      if (scope.programId && cycle.programId === scope.programId) points += 8;
      else if (!cycle.programId) points += 1;
      if (scope.departmentId && cycle.departmentId === scope.departmentId)
        points += 4;
      else if (!cycle.departmentId) points += 1;
      if (scope.shiftId && cycle.shiftId === scope.shiftId) points += 2;
      else if (!cycle.shiftId) points += 1;
      if (scope.academicYearId && cycle.academicYearId === scope.academicYearId)
        points += 16;
      else if (!cycle.academicYearId) points += 1;
      return points;
    };

    return (
      cycles.sort(
        (a: { programId?: string | null }, b: { programId?: string | null }) =>
          score(b) - score(a),
      )[0] ?? null
    );
  }

  private validateCycleSemesters(start: number, end: number) {
    if (!FEE_CYCLE_TRIGGER_SEMESTERS.includes(start as 1 | 3 | 5)) {
      throw new BadRequestException(
        `Fee cycle must start at Semester I, III, or V (got ${start}). Even semesters never generate a new demand.`,
      );
    }
    if (end !== start + 1) {
      throw new BadRequestException(
        'FYUGP fee cycles must cover exactly two consecutive semesters.',
      );
    }
  }

  private async ensure(tenantId: string, id: string) {
    const cycle = await this.db().academicFeeCycle.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!cycle) throw new NotFoundException('Fee cycle not found');
    return cycle;
  }

  private async audit(
    user: JwtUser,
    action: string,
    entityId: string | null,
    payload: Record<string, unknown>,
  ) {
    await this.db().feeAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action,
        metadata: { entityType: 'fee_cycle', entityId, ...payload },
      },
    });
  }
}
