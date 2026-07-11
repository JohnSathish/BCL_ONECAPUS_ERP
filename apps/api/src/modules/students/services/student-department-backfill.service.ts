import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { isAcademicDepartment } from '../../organization/department-rules';
import { AcademicChangeHistoryService } from '../academic-change-history/academic-change-history.service';
import type { AcademicChangeAuditContext } from '../academic-change-history/academic-change-history.types';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

const SAMPLE_LIMIT = 20;
const CHUNK_SIZE = 100;

type CandidateRow = {
  id: string;
  rollNumber: string | null;
  enrollmentNumber: string;
  fullName: string | null;
  programmeLabel: string | null;
  targetDepartmentId: string;
  targetDepartmentLabel: string;
};

@Injectable()
export class StudentDepartmentBackfillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicChangeHistory: AcademicChangeHistoryService,
  ) {}

  async preview(tenantId: string) {
    const classified = await this.classifyStudents(tenantId);
    return {
      eligible: classified.eligible.length,
      missingProgramme: classified.missingProgramme,
      programmeHasNoDepartment: classified.programmeHasNoDepartment,
      departmentNotAcademic: classified.departmentNotAcademic,
      alreadyHasDepartment: classified.alreadyHasDepartment,
      sample: classified.eligible.slice(0, SAMPLE_LIMIT).map((row) => ({
        studentId: row.id,
        fullName: row.fullName,
        rollNumber: row.rollNumber,
        enrollmentNumber: row.enrollmentNumber,
        programme: row.programmeLabel,
        targetDepartment: row.targetDepartmentLabel,
      })),
    };
  }

  async apply(user: JwtUser, audit?: AcademicChangeAuditContext) {
    const classified = await this.classifyStudents(user.tid);
    const eligible = classified.eligible;
    let updated = 0;
    let errors = 0;
    const errorSamples: { studentId: string; message: string }[] = [];

    const actor = await this.academicChangeHistory.resolveActorContext(
      user.tid,
      user.sub,
      audit?.actorRoles,
    );
    const reason =
      audit?.reason?.trim() ||
      'Backfill department from programme-linked academic department';

    for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
      const chunk = eligible.slice(i, i + CHUNK_SIZE);
      for (const row of chunk) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const current = await tx.student.findFirst({
              where: {
                id: row.id,
                tenantId: user.tid,
                deletedAt: null,
                departmentId: null,
              },
              select: { id: true },
            });
            if (!current) return;

            await tx.student.update({
              where: { id: row.id },
              data: {
                departmentId: row.targetDepartmentId,
                lastModifiedById: user.sub,
              },
            });
          });

          await this.academicChangeHistory.logBasicAcademicChanges(
            user.tid,
            row.id,
            { departmentLabel: null },
            { departmentLabel: row.targetDepartmentLabel },
            {
              ...audit,
              ...actor,
              reason,
            },
          );
          updated += 1;
        } catch (error) {
          errors += 1;
          if (errorSamples.length < 10) {
            errorSamples.push({
              studentId: row.id,
              message:
                error instanceof Error ? error.message : 'Unknown update error',
            });
          }
        }
      }
    }

    return {
      updated,
      eligible: eligible.length,
      skipped:
        classified.missingProgramme +
        classified.programmeHasNoDepartment +
        classified.departmentNotAcademic,
      missingProgramme: classified.missingProgramme,
      programmeHasNoDepartment: classified.programmeHasNoDepartment,
      departmentNotAcademic: classified.departmentNotAcademic,
      alreadyHasDepartment: classified.alreadyHasDepartment,
      errors,
      errorSamples,
    };
  }

  private async classifyStudents(tenantId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        rollNumber: true,
        enrollmentNumber: true,
        programVersionId: true,
        masterProfile: { select: { fullName: true } },
        programVersion: {
          select: {
            program: {
              select: {
                code: true,
                name: true,
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    departmentType: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let missingProgramme = 0;
    let programmeHasNoDepartment = 0;
    let departmentNotAcademic = 0;
    let alreadyHasDepartment = 0;
    const eligible: CandidateRow[] = [];

    for (const student of students) {
      if (student.departmentId) {
        alreadyHasDepartment += 1;
        continue;
      }

      if (!student.programVersionId || !student.programVersion?.program) {
        missingProgramme += 1;
        continue;
      }

      const program = student.programVersion.program;
      const programmeLabel = `${program.code} — ${program.name}`;
      const linked = program.department;

      if (!program.departmentId || !linked || linked.deletedAt) {
        programmeHasNoDepartment += 1;
        continue;
      }

      if (!isAcademicDepartment(linked.departmentType)) {
        departmentNotAcademic += 1;
        continue;
      }

      eligible.push({
        id: student.id,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        fullName: student.masterProfile?.fullName ?? null,
        programmeLabel,
        targetDepartmentId: linked.id,
        targetDepartmentLabel: linked.name ?? linked.code,
      });
    }

    return {
      eligible,
      missingProgramme,
      programmeHasNoDepartment,
      departmentNotAcademic,
      alreadyHasDepartment,
    };
  }
}
