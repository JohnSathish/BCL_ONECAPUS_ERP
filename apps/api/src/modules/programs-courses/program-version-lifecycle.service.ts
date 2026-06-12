import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';

const versionUserSelect = {
  id: true,
  email: true,
} as const;

export const programVersionDetailInclude = {
  program: { select: { id: true, code: true, name: true } },
  createdBy: { select: versionUserSelect },
  archivedBy: { select: versionUserSelect },
} satisfies Prisma.ProgramVersionInclude;

export type ProgramVersionUsage = {
  offerings: number;
  students: number;
  registrations: number;
  outcomeRuns: number;
  approvalPolicies: number;
  poolAssignments: number;
  semesterRules: number;
  deliverySections: number;
  staffAssignments: number;
  programOutcomes: number;
};

@Injectable()
export class ProgramVersionLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProgram(tenantId: string, programId: string) {
    await this.assertProgram(tenantId, programId);
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, programId, deletedAt: null },
      orderBy: { version: 'desc' },
      include: programVersionDetailInclude,
    });
    return Promise.all(
      versions.map(async (v) => ({
        ...v,
        usage: await this.getUsageCounts(tenantId, v.id),
      })),
    );
  }

  async getVersion(tenantId: string, id: string) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: programVersionDetailInclude,
    });
    if (!version) throw new NotFoundException('Program version not found');
    const usage = await this.getUsageCounts(tenantId, id);
    return { ...version, usage };
  }

  async createDraft(
    tenantId: string,
    userId: string,
    dto: { programId: string; cbcsEnabled?: boolean; sourceVersionId?: string },
  ) {
    await this.assertProgram(tenantId, dto.programId);

    const existingDraft = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        programId: dto.programId,
        status: 'DRAFT',
        deletedAt: null,
      },
    });
    if (existingDraft) {
      throw new ConflictException(
        'This programme already has an unpublished draft version. Publish or remove it before creating another.',
      );
    }

    const latest = await this.prisma.programVersion.findFirst({
      where: { programId: dto.programId, tenantId, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    if (dto.sourceVersionId) {
      return this.duplicateFromSource(
        tenantId,
        userId,
        dto.programId,
        dto.sourceVersionId,
        {
          version: nextVersion,
          cbcsEnabled: dto.cbcsEnabled,
        },
      );
    }

    return this.prisma.programVersion.create({
      data: {
        tenantId,
        programId: dto.programId,
        version: nextVersion,
        status: 'DRAFT',
        cbcsEnabled: dto.cbcsEnabled ?? true,
        nepProfile: { multipleEntryExit: true, abcEnabled: true },
        createdById: userId,
      },
      include: programVersionDetailInclude,
    });
  }

  async publish(tenantId: string, userId: string, versionId: string) {
    const version = await this.getVersionOrThrow(tenantId, versionId);
    if (version.status === 'PUBLISHED') {
      throw new BadRequestException('Version is already published');
    }
    if (version.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Archived versions cannot be published. Duplicate to a new draft instead.',
      );
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.programVersion.updateMany({
        where: {
          tenantId,
          programId: version.programId,
          status: 'PUBLISHED',
          deletedAt: null,
          id: { not: versionId },
        },
        data: {
          status: 'ARCHIVED',
          archivedAt: now,
          archivedById: userId,
        },
      });

      return tx.programVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          archivedAt: null,
          archivedById: null,
        },
        include: programVersionDetailInclude,
      });
    });
  }

  async archive(tenantId: string, userId: string, versionId: string) {
    const version = await this.getVersionOrThrow(tenantId, versionId);
    if (version.status === 'ARCHIVED') {
      throw new BadRequestException('Version is already archived');
    }

    return this.prisma.programVersion.update({
      where: { id: versionId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedById: userId,
      },
      include: programVersionDetailInclude,
    });
  }

  async deleteIfSafe(tenantId: string, versionId: string) {
    const version = await this.getVersionOrThrow(tenantId, versionId);
    const usage = await this.getUsageCounts(tenantId, versionId);
    const blockers = this.buildDeleteBlockers(version.status, usage);

    if (blockers.length > 0) {
      throw new ConflictException(
        `Cannot delete this version: ${blockers.join('; ')}. Archive it instead.`,
      );
    }

    await this.softDeleteVersionRow(tenantId, versionId, version.version);
    return { deleted: true };
  }

  /** Delete a version that only has curriculum setup (no students/registrations). Purges mappings first. */
  async purgeAndDeleteUnusedVersion(tenantId: string, versionId: string) {
    const version = await this.getVersionOrThrow(tenantId, versionId);
    if (version.status === 'PUBLISHED') {
      throw new ConflictException(
        'Cannot delete a published version. Archive it first, then remove unused drafts.',
      );
    }

    return this.forcePurgeUnusedVersion(tenantId, versionId);
  }

  /**
   * Purge curriculum artifacts and soft-delete a version when it has no student/registrations.
   * Allows published versions (e.g. orphan versions on soft-deleted programmes).
   */
  async forcePurgeUnusedVersion(tenantId: string, versionId: string) {
    const version = await this.getVersionOrThrow(tenantId, versionId);
    const usage = await this.getUsageCounts(tenantId, versionId);
    const hardBlockers = this.buildHardUsageBlockers(usage);
    if (hardBlockers.length > 0) {
      throw new ConflictException(
        `Cannot delete this version: ${hardBlockers.join('; ')}. Archive it instead.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.purgeCurriculumArtifacts(tx, tenantId, versionId);
      await this.softDeleteVersionRowTx(
        tx,
        tenantId,
        versionId,
        version.version,
      );
    });
    return { deleted: true, purgedCurriculum: true };
  }

  getUsageCountsForVersion(tenantId: string, programVersionId: string) {
    return this.getUsageCounts(tenantId, programVersionId);
  }

  getHardUsageBlockers(usage: ProgramVersionUsage): string[] {
    return this.buildHardUsageBlockers(usage);
  }

  /** Relabel version number in place — keeps the same database ID and all references. */
  async relabelVersion(
    tenantId: string,
    versionId: string,
    targetVersion: number,
  ) {
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      throw new BadRequestException(
        'Target version must be a positive integer',
      );
    }

    const version = await this.getVersionOrThrow(tenantId, versionId);
    if (version.version === targetVersion) {
      return this.getVersion(tenantId, versionId);
    }

    const conflict = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        programId: version.programId,
        version: targetVersion,
        deletedAt: null,
        id: { not: versionId },
      },
    });
    if (conflict) {
      throw new ConflictException(
        `Version number ${targetVersion} is already in use. Remove or relabel the other version first.`,
      );
    }

    return this.prisma.programVersion.update({
      where: { id: versionId },
      data: { version: targetVersion },
      include: programVersionDetailInclude,
    });
  }

  /**
   * Normalize mistaken duplicate versions: remove unused v1/v2, relabel configured v3 → v1.
   * Keeps the configured version's internal ID unchanged.
   */
  async normalizeMistakenProgramVersions(
    tenantId: string,
    userId: string,
    programCode: string,
    opts: { keepVersionNumber: number; removeVersionNumbers: number[] },
  ) {
    const program = await this.prisma.program.findFirst({
      where: { tenantId, code: programCode, deletedAt: null },
    });
    if (!program)
      throw new NotFoundException(`Program "${programCode}" not found`);

    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, programId: program.id, deletedAt: null },
      orderBy: { version: 'asc' },
    });

    const keep = versions.find((v) => v.version === opts.keepVersionNumber);
    if (!keep) {
      throw new NotFoundException(
        `Configured version v${opts.keepVersionNumber} not found for ${programCode}`,
      );
    }

    const toRemove = opts.removeVersionNumbers.map((n) => {
      const row = versions.find((v) => v.version === n);
      if (!row) {
        throw new NotFoundException(
          `Version v${n} not found for ${programCode}`,
        );
      }
      return row;
    });

    if (toRemove.some((v) => v.id === keep.id)) {
      throw new BadRequestException(
        'Cannot remove the version that will be kept',
      );
    }

    const keepUsage = await this.getUsageCounts(tenantId, keep.id);
    const removedReports: Array<{
      version: number;
      id: string;
      action: string;
    }> = [];

    for (const row of toRemove) {
      const usage = await this.getUsageCounts(tenantId, row.id);
      const hardBlockers = this.buildHardUsageBlockers(usage);
      if (hardBlockers.length > 0) {
        await this.archive(tenantId, userId, row.id);
        removedReports.push({
          version: row.version,
          id: row.id,
          action: 'archived',
        });
      } else {
        await this.purgeAndDeleteUnusedVersion(tenantId, row.id);
        removedReports.push({
          version: row.version,
          id: row.id,
          action: 'deleted',
        });
      }
    }

    const relabeled = await this.relabelVersion(tenantId, keep.id, 1);

    return {
      programCode,
      keptVersionId: keep.id,
      previousKeepVersion: opts.keepVersionNumber,
      relabeledTo: relabeled.version,
      removed: removedReports,
      keepUsage,
    };
  }

  async duplicate(tenantId: string, userId: string, sourceVersionId: string) {
    const source = await this.getVersionOrThrow(tenantId, sourceVersionId);

    const existingDraft = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        programId: source.programId,
        status: 'DRAFT',
        deletedAt: null,
      },
    });
    if (existingDraft) {
      throw new ConflictException(
        'This programme already has an unpublished draft version. Publish or remove it before duplicating.',
      );
    }

    const latest = await this.prisma.programVersion.findFirst({
      where: { programId: source.programId, tenantId, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    return this.duplicateFromSource(
      tenantId,
      userId,
      source.programId,
      sourceVersionId,
      {
        version: (latest?.version ?? 0) + 1,
        cbcsEnabled: source.cbcsEnabled,
      },
    );
  }

  async getPublishedVersionId(tenantId: string, programId: string) {
    const published = await this.prisma.programVersion.findFirst({
      where: {
        tenantId,
        programId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
    });
    return published?.id ?? null;
  }

  async assertHasPublishedVersion(tenantId: string, programId: string) {
    const id = await this.getPublishedVersionId(tenantId, programId);
    if (!id) {
      const program = await this.assertProgram(tenantId, programId);
      throw new BadRequestException(
        `Program "${program.code}" has no published curriculum version. Publish a version before admissions.`,
      );
    }
    return id;
  }

  private async duplicateFromSource(
    tenantId: string,
    userId: string,
    programId: string,
    sourceVersionId: string,
    opts: { version: number; cbcsEnabled?: boolean },
  ) {
    const source = await this.prisma.programVersion.findFirst({
      where: { id: sourceVersionId, tenantId, programId, deletedAt: null },
      include: {
        offerings: { where: { deletedAt: null } },
        structureTemplate: true,
        semesterRules: true,
      },
    });
    if (!source) throw new NotFoundException('Source version not found');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.programVersion.create({
        data: {
          tenantId,
          programId,
          version: opts.version,
          status: 'DRAFT',
          cbcsEnabled: opts.cbcsEnabled ?? source.cbcsEnabled,
          nepProfile: source.nepProfile ?? {
            multipleEntryExit: true,
            abcEnabled: true,
          },
          createdById: userId,
          duplicatedFromVersionId: source.id,
        },
      });

      if (source.offerings.length > 0) {
        await tx.courseOffering.createMany({
          data: source.offerings.map((o) => ({
            tenantId,
            programVersionId: created.id,
            courseId: o.courseId,
            semesterId: o.semesterId,
            category: o.category,
            semesterSequence: o.semesterSequence,
            displayOrder: o.displayOrder,
            majorPaperIndex: o.majorPaperIndex,
            capacity: o.capacity,
            waitlistCapacity: o.waitlistCapacity,
            isElective: o.isElective,
            registrationOpensAt: o.registrationOpensAt,
            registrationClosesAt: o.registrationClosesAt,
            prerequisiteOfferingIds: o.prerequisiteOfferingIds ?? undefined,
          })),
        });
      }

      if (source.structureTemplate) {
        const t = source.structureTemplate;
        await tx.programStructureTemplate.create({
          data: {
            tenantId,
            programVersionId: created.id,
            streamId: t.streamId,
            structureType: t.structureType,
            totalSemesters: t.totalSemesters,
          },
        });
      }

      if (source.semesterRules.length > 0) {
        await tx.semesterStructureRule.createMany({
          data: source.semesterRules.map((r) => ({
            tenantId,
            programVersionId: created.id,
            semesterSequence: r.semesterSequence,
            categoryCounts: r.categoryCounts as Prisma.InputJsonValue,
            continuityRules: r.continuityRules as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.programVersion.findUniqueOrThrow({
        where: { id: created.id },
        include: programVersionDetailInclude,
      });
    });
  }

  private async getUsageCounts(
    tenantId: string,
    programVersionId: string,
  ): Promise<ProgramVersionUsage> {
    const offeringWhere = { tenantId, programVersionId, deletedAt: null };

    const [
      offerings,
      students,
      registrations,
      outcomeRuns,
      approvalPolicies,
      poolAssignments,
      semesterRules,
      deliverySections,
      staffAssignments,
      programOutcomes,
    ] = await Promise.all([
      this.prisma.courseOffering.count({ where: offeringWhere }),
      this.prisma.student.count({
        where: { tenantId, programVersionId, deletedAt: null },
      }),
      this.prisma.registration.count({
        where: {
          tenantId,
          deletedAt: null,
          offering: { programVersionId, deletedAt: null },
        },
      }),
      this.prisma.outcomeAttainmentRun.count({
        where: { tenantId, programVersionId },
      }),
      this.prisma.registrationApprovalPolicy.count({
        where: { tenantId, programVersionId },
      }),
      this.prisma.programmePoolAssignment.count({
        where: { tenantId, programVersionId, active: true },
      }),
      this.prisma.semesterStructureRule.count({
        where: { tenantId, programVersionId },
      }),
      this.prisma.offeringSection.count({
        where: {
          tenantId,
          deletedAt: null,
          courseOffering: offeringWhere,
        },
      }),
      this.prisma.staffSubjectAssignment.count({
        where: { tenantId, programVersionId },
      }),
      this.prisma.programOutcome.count({
        where: { tenantId, programVersionId, deletedAt: null },
      }),
    ]);

    return {
      offerings,
      students,
      registrations,
      outcomeRuns,
      approvalPolicies,
      poolAssignments,
      semesterRules,
      deliverySections,
      staffAssignments,
      programOutcomes,
    };
  }

  private buildHardUsageBlockers(usage: ProgramVersionUsage): string[] {
    const blockers: string[] = [];
    if (usage.students > 0) blockers.push(`${usage.students} student(s)`);
    if (usage.registrations > 0)
      blockers.push(`${usage.registrations} registration(s)`);
    if (usage.outcomeRuns > 0)
      blockers.push(`${usage.outcomeRuns} outcome run(s)`);
    if (usage.approvalPolicies > 0) {
      blockers.push(`${usage.approvalPolicies} approval polic(ies)`);
    }
    return blockers;
  }

  private buildDeleteBlockers(
    status: string,
    usage: ProgramVersionUsage,
  ): string[] {
    const blockers = this.buildHardUsageBlockers(usage);
    if (status === 'PUBLISHED') {
      blockers.unshift('version is currently published');
    }
    if (usage.offerings > 0)
      blockers.push(`${usage.offerings} curriculum mapping(s)`);
    if (usage.deliverySections > 0) {
      blockers.push(`${usage.deliverySections} delivery section(s)`);
    }
    if (usage.poolAssignments > 0) {
      blockers.push(`${usage.poolAssignments} pool assignment(s)`);
    }
    if (usage.semesterRules > 0)
      blockers.push(`${usage.semesterRules} semester rule(s)`);
    if (usage.staffAssignments > 0) {
      blockers.push(`${usage.staffAssignments} faculty assignment(s)`);
    }
    if (usage.programOutcomes > 0) {
      blockers.push(`${usage.programOutcomes} program outcome(s)`);
    }
    return blockers;
  }

  private async softDeleteVersionRow(
    tenantId: string,
    versionId: string,
    versionNumber: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.softDeleteVersionRowTx(tx, tenantId, versionId, versionNumber);
    });
  }

  private async softDeleteVersionRowTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    versionId: string,
    versionNumber: number,
  ) {
    const bumpedVersion = 800000 + versionNumber;
    await tx.programVersion.update({
      where: { id: versionId, tenantId },
      data: { deletedAt: new Date(), version: bumpedVersion },
    });
  }

  private async purgeCurriculumArtifacts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    programVersionId: string,
  ) {
    const now = new Date();
    const offerings = await tx.courseOffering.findMany({
      where: { tenantId, programVersionId, deletedAt: null },
      select: { id: true },
    });
    const offeringIds = offerings.map((o) => o.id);

    if (offeringIds.length > 0) {
      await tx.offeringSection.updateMany({
        where: {
          tenantId,
          courseOfferingId: { in: offeringIds },
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      await tx.courseOffering.updateMany({
        where: { tenantId, id: { in: offeringIds } },
        data: { deletedAt: now },
      });
    }

    await tx.programmePoolCourseExclusion.deleteMany({
      where: { tenantId, programVersionId },
    });
    await tx.programmePoolAssignment.deleteMany({
      where: { tenantId, programVersionId },
    });
    await tx.semesterStructureRule.deleteMany({
      where: { tenantId, programVersionId },
    });
    await tx.programStructureTemplate.deleteMany({
      where: { tenantId, programVersionId },
    });
    await tx.programOutcome.updateMany({
      where: { tenantId, programVersionId, deletedAt: null },
      data: { deletedAt: now },
    });
  }

  private async getVersionOrThrow(tenantId: string, id: string) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!version) throw new NotFoundException('Program version not found');
    return version;
  }

  private async assertProgram(tenantId: string, programId: string) {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, tenantId, deletedAt: null },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }
}
