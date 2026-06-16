import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const MAX_ABC_LENGTH = 50;

@Injectable()
export class StudentAbcService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeAbcId(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_ABC_LENGTH) {
      throw new BadRequestException(
        `ABC ID must be at most ${MAX_ABC_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  async assertUnique(
    tenantId: string,
    abcId: string,
    excludeStudentId?: string,
  ) {
    const existing = await this.prisma.abcAccount.findFirst({
      where: {
        tenantId,
        abcId,
        deletedAt: null,
        ...(excludeStudentId ? { studentId: { not: excludeStudentId } } : {}),
      },
      select: { studentId: true },
    });
    if (existing) {
      throw new ConflictException(
        'ABC ID is already assigned to another student',
      );
    }
  }

  async upsertForStudent(
    tenantId: string,
    studentId: string,
    abcIdInput?: string | null,
  ) {
    const abcId = this.normalizeAbcId(abcIdInput);
    if (abcId) {
      await this.assertUnique(tenantId, abcId, studentId);
    }

    return this.prisma.abcAccount.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        abcId,
        status: abcId ? 'linked' : 'pending',
        verificationStatus: 'pending',
        abcVerified: false,
        lastSyncedAt: abcId ? new Date() : null,
      },
      update: {
        abcId,
        status: abcId ? 'linked' : 'pending',
        lastSyncedAt: abcId ? new Date() : null,
        ...(abcId ? {} : { abcVerified: false, verificationStatus: 'pending' }),
      },
    });
  }

  async getCoverage(tenantId: string) {
    const [totalStudents, withAbc] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.abcAccount.count({
        where: {
          tenantId,
          deletedAt: null,
          abcId: { not: null },
          student: { deletedAt: null },
        },
      }),
    ]);
    const missing = Math.max(totalStudents - withAbc, 0);
    const coveragePct =
      totalStudents > 0 ? Math.round((withAbc / totalStudents) * 1000) / 10 : 0;
    return {
      totalStudents,
      withAbcId: withAbc,
      missingAbcId: missing,
      coveragePct,
    };
  }

  async bulkUploadByRollNumber(
    tenantId: string,
    rows: Array<{ rollNumber: string; abcId: string }>,
  ) {
    let updated = 0;
    const errors: Array<{ rollNumber: string; message: string }> = [];

    for (const row of rows) {
      const rollNumber = row.rollNumber?.trim();
      const abcId = this.normalizeAbcId(row.abcId);
      if (!rollNumber || !abcId) {
        errors.push({
          rollNumber: row.rollNumber ?? '',
          message: 'Roll number and ABC ID are required',
        });
        continue;
      }

      try {
        const student = await this.prisma.student.findFirst({
          where: { tenantId, rollNumber, deletedAt: null },
          select: { id: true },
        });
        if (!student) {
          errors.push({ rollNumber, message: 'Student not found' });
          continue;
        }
        await this.upsertForStudent(tenantId, student.id, abcId);
        updated += 1;
      } catch (err) {
        errors.push({
          rollNumber,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { updated, errors, total: rows.length };
  }
}
