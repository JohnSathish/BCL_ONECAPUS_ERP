import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import type {
  CreateFeeStructureDto,
  FeeStructureQueryDto,
} from '../dto/fees.dto';

@Injectable()
export class FeeStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string, query: FeeStructureQueryDto) {
    return this.db().feeStructure.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.programVersionId
          ? { programVersionId: query.programVersionId }
          : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      },
      include: {
        components: {
          where: { deletedAt: null },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async create(user: JwtUser, dto: CreateFeeStructureDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const duplicate = await this.db().feeStructure.findFirst({
      where: {
        tenantId: user.tid,
        code: dto.code,
        version: 1,
        deletedAt: null,
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Fee structure code ${dto.code} already exists.`,
      );
    }

    return this.db().feeStructure.create({
      data: {
        tenantId: user.tid,
        institutionId: dto.institutionId,
        academicYearId: dto.academicYearId,
        semesterId: dto.semesterId,
        streamId: dto.streamId,
        departmentId: dto.departmentId,
        programVersionId: dto.programVersionId,
        shiftId: dto.shiftId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        category: dto.category ?? 'GENERAL',
        billingFrequency: dto.billingFrequency ?? 'YEARLY',
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        status: 'DRAFT',
        createdById: user.sub,
        components: {
          create: (dto.components ?? []).map((component) => ({
            tenantId: user.tid,
            code: component.code,
            name: component.name,
            category: component.category,
            amount: component.amount,
            billingFrequency:
              component.billingFrequency ?? dto.billingFrequency ?? 'YEARLY',
            semesterNumbers: component.semesterNumbers ?? [],
            subjectCategories: component.subjectCategories ?? [],
            practicalDependency: component.practicalDependency ?? false,
            priority: component.priority ?? 100,
          })),
        },
      },
      include: { components: true },
    });
  }

  async publish(user: JwtUser, id: string) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const structure = await this.ensureStructure(user.tid, id);
    const updated = await this.db().feeStructure.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { components: true },
    });
    await this.log(user, {
      action: 'structure.published',
      feeStructureId: id,
      before: structure,
      after: updated,
    });
    return updated;
  }

  async lock(user: JwtUser, id: string) {
    await this.ensureStructure(user.tid, id);
    const updated = await this.db().feeStructure.update({
      where: { id },
      data: { status: 'LOCKED', lockedAt: new Date() },
      include: { components: true },
    });
    await this.log(user, {
      action: 'structure.locked',
      feeStructureId: id,
      after: updated,
    });
    return updated;
  }

  async findApplicable(tenantId: string, context: FeeStudentContext) {
    const structures = await this.db().feeStructure.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['PUBLISHED', 'LOCKED', 'ACTIVE'] },
        OR: [
          { programVersionId: context.programVersionId },
          { departmentId: context.departmentId },
          { streamId: context.streamId },
          { shiftId: context.shiftId },
          {
            programVersionId: null,
            departmentId: null,
            streamId: null,
            shiftId: null,
          },
        ],
      },
      include: {
        components: {
          where: { deletedAt: null, isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });
    return structures.sort(
      (left: any, right: any) =>
        this.scopeRank(right, context) - this.scopeRank(left, context),
    );
  }

  private scopeRank(structure: any, context: FeeStudentContext) {
    if (
      structure.programVersionId &&
      structure.programVersionId === context.programVersionId
    )
      return 60;
    if (
      structure.departmentId &&
      structure.departmentId === context.departmentId
    )
      return 50;
    if (structure.streamId && structure.streamId === context.streamId)
      return 40;
    if (structure.shiftId && structure.shiftId === context.shiftId) return 30;
    return 10;
  }

  private async ensureStructure(tenantId: string, id: string) {
    const structure = await this.db().feeStructure.findFirst({
      where: { tenantId, id, deletedAt: null },
    });
    if (!structure) throw new NotFoundException('Fee structure not found.');
    return structure;
  }

  private log(
    user: JwtUser,
    input: {
      action: string;
      feeStructureId?: string;
      before?: unknown;
      after?: unknown;
    },
  ) {
    return this.db().feeAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action: input.action,
        feeStructureId: input.feeStructureId,
        before: input.before,
        after: input.after,
      },
    });
  }
}

export type FeeStudentContext = {
  studentId: string;
  programVersionId?: string | null;
  departmentId?: string | null;
  streamId?: string | null;
  shiftId?: string | null;
  semesterNumber?: number | null;
  academicYearNo?: number | null;
};
