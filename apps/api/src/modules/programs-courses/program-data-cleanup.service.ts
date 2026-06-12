import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { looksLikeCourseCode } from '../../common/validation/program-code.validation';
import { PrismaService } from '../../database/prisma.service';
import {
  ProgramVersionLifecycleService,
  type ProgramVersionUsage,
} from './program-version-lifecycle.service';

export type CleanupVersionRow = {
  id: string;
  version: number;
  status: string;
  programId: string;
  programCode: string;
  programName: string;
  programDeleted: boolean;
  usage: ProgramVersionUsage;
  safeToPurge: boolean;
  blockers: string[];
};

export type CleanupProgramRow = {
  id: string;
  code: string;
  name: string;
  departmentCode: string | null;
  looksLikeCourseCode: boolean;
  versions: CleanupVersionRow[];
  safeToRemove: boolean;
  blockers: string[];
};

export type ProgramDataCleanupReport = {
  unusedProgrammes: CleanupProgramRow[];
  orphanVersions: CleanupVersionRow[];
  emptyCurriculumVersions: CleanupVersionRow[];
};

@Injectable()
export class ProgramDataCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ProgramVersionLifecycleService,
  ) {}

  async getReport(tenantId: string): Promise<ProgramDataCleanupReport> {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        program: {
          select: {
            id: true,
            code: true,
            name: true,
            deletedAt: true,
            department: { select: { code: true } },
          },
        },
      },
      orderBy: [{ program: { code: 'asc' } }, { version: 'asc' }],
    });

    const versionRows: CleanupVersionRow[] = [];
    for (const v of versions) {
      const usage = await this.lifecycle.getUsageCountsForVersion(
        tenantId,
        v.id,
      );
      const hardBlockers = this.lifecycle.getHardUsageBlockers(usage);
      const safeToPurge = hardBlockers.length === 0;
      versionRows.push({
        id: v.id,
        version: v.version,
        status: v.status,
        programId: v.programId,
        programCode: v.program.code,
        programName: v.program.name,
        programDeleted: v.program.deletedAt !== null,
        usage,
        safeToPurge,
        blockers: hardBlockers,
      });
    }

    const byProgram = new Map<string, CleanupVersionRow[]>();
    for (const row of versionRows) {
      const list = byProgram.get(row.programId) ?? [];
      list.push(row);
      byProgram.set(row.programId, list);
    }

    const unusedProgrammes: CleanupProgramRow[] = [];
    for (const [programId, programVersions] of byProgram) {
      const first = programVersions[0]!;
      if (first.programDeleted) continue;

      const programBlockers = this.collectProgramBlockers(programVersions);
      const program = versions.find((v) => v.programId === programId)!.program;

      unusedProgrammes.push({
        id: programId,
        code: program.code,
        name: program.name,
        departmentCode: program.department?.code ?? null,
        looksLikeCourseCode: looksLikeCourseCode(program.code),
        versions: programVersions,
        safeToRemove: programBlockers.length === 0,
        blockers: programBlockers,
      });
    }

    const orphanVersions = versionRows.filter((v) => v.programDeleted);
    const emptyCurriculumVersions = versionRows.filter(
      (v) =>
        !v.programDeleted &&
        v.usage.offerings === 0 &&
        v.usage.poolAssignments === 0 &&
        v.usage.semesterRules === 0 &&
        v.usage.deliverySections === 0 &&
        v.usage.staffAssignments === 0 &&
        v.usage.programOutcomes === 0,
    );

    return {
      unusedProgrammes: unusedProgrammes.filter(
        (p) => p.safeToRemove || p.looksLikeCourseCode,
      ),
      orphanVersions,
      emptyCurriculumVersions,
    };
  }

  async purgeVersion(tenantId: string, versionId: string) {
    return this.lifecycle.forcePurgeUnusedVersion(tenantId, versionId);
  }

  async removeUnusedProgram(tenantId: string, programId: string) {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, tenantId, deletedAt: null },
    });
    if (!program) throw new NotFoundException('Program not found');

    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, programId, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    const purged: string[] = [];
    for (const version of versions) {
      await this.lifecycle.forcePurgeUnusedVersion(tenantId, version.id);
      purged.push(version.id);
    }

    await this.prisma.program.updateMany({
      where: { id: programId, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { programId, purgedVersionIds: purged, deleted: true };
  }

  async purgeOrphanVersions(tenantId: string, programCode: string) {
    const program = await this.prisma.program.findFirst({
      where: { tenantId, code: programCode },
    });
    if (!program)
      throw new NotFoundException(`Program "${programCode}" not found`);
    if (program.deletedAt === null) {
      throw new BadRequestException(
        'Program is still active. Use remove-unused-program instead.',
      );
    }

    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, programId: program.id, deletedAt: null },
    });

    const purged: string[] = [];
    for (const version of versions) {
      await this.lifecycle.forcePurgeUnusedVersion(tenantId, version.id);
      purged.push(version.id);
    }

    return { programCode, purgedVersionIds: purged, deleted: true };
  }

  private collectProgramBlockers(versions: CleanupVersionRow[]): string[] {
    const blockers = new Set<string>();
    for (const v of versions) {
      for (const b of v.blockers) blockers.add(b);
    }
    return [...blockers];
  }
}
