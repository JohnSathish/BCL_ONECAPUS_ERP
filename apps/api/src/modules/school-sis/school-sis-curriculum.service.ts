import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import type {
  SaveSchoolClassSubjectsDto,
  SaveSchoolSubjectDto,
  SaveSchoolSubjectTypeDto,
} from './dto/school-sis.dto';

const DEFAULT_TYPES: Array<{ code: string; name: string; sortOrder: number }> =
  [
    { code: 'MAIN', name: 'Main Subject', sortOrder: 1 },
    { code: 'LANGUAGE', name: 'Language', sortOrder: 2 },
    { code: 'ELECTIVE', name: 'Elective', sortOrder: 3 },
    { code: 'PRACTICAL', name: 'Practical', sortOrder: 4 },
    { code: 'CO_CURRICULAR', name: 'Co-curricular', sortOrder: 5 },
    { code: 'SKILL', name: 'Skill-based', sortOrder: 6 },
    { code: 'OPTIONAL', name: 'Optional Subject', sortOrder: 7 },
    { code: 'OTHER', name: 'Other', sortOrder: 8 },
  ];

function slugCode(name: string, fallback: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
  return slug || fallback;
}

@Injectable()
export class SchoolSisCurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async listBundle(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    await this.ensureDefaultTypes(tenantId);
    const [types, subjects, mappings, grades, teachers] = await Promise.all([
      this.prisma.schoolSubjectType.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.schoolSubject.findMany({
        where: { tenantId, deletedAt: null },
        include: { subjectType: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.schoolGradeSubject.findMany({
        where: { tenantId, academicYearId: year.id },
        include: { subject: true, grade: true },
      }),
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null, active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSubjectTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        select: {
          subjectId: true,
          staff: { select: { fullName: true } },
        },
      }),
    ]);
    const teachersBySubject = new Map<string, string[]>();
    for (const row of teachers) {
      const list = teachersBySubject.get(row.subjectId) ?? [];
      if (row.staff.fullName && !list.includes(row.staff.fullName)) {
        list.push(row.staff.fullName);
      }
      teachersBySubject.set(row.subjectId, list);
    }
    return {
      academicYear: year,
      types,
      subjects: subjects.map((row) => {
        const classRows = mappings.filter((m) => m.subjectId === row.id);
        return {
          ...row,
          classCount: classRows.length,
          classIds: classRows.map((m) => m.gradeId),
          classNames: classRows.map((m) => m.grade.name),
          teacherNames: teachersBySubject.get(row.id) ?? [],
        };
      }),
      grades,
      mappings: mappings.map((row) => ({
        id: row.id,
        gradeId: row.gradeId,
        subjectId: row.subjectId,
        gradeName: row.grade.name,
        subjectName: row.subject.name,
      })),
    };
  }

  async createType(tenantId: string, dto: SaveSchoolSubjectTypeDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.ensureDefaultTypes(tenantId);
    const code = slugCode(dto.code || dto.name, 'TYPE');
    try {
      return await this.prisma.schoolSubjectType.create({
        data: {
          tenantId,
          code,
          name: dto.name.trim(),
          sortOrder: dto.sortOrder ?? 10,
          active: dto.active ?? true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That subject type code already exists');
      }
      throw err;
    }
  }

  async updateType(
    tenantId: string,
    id: string,
    dto: SaveSchoolSubjectTypeDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSubjectType.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Subject type not found');
    try {
      return await this.prisma.schoolSubjectType.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          ...(dto.code ? { code: slugCode(dto.code, row.code) } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That subject type code already exists');
      }
      throw err;
    }
  }

  async deleteType(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSubjectType.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { subjects: true } } },
    });
    if (!row) throw new NotFoundException('Subject type not found');
    if (row._count.subjects > 0) {
      throw new BadRequestException(
        'Move or delete subjects in this type before removing it.',
      );
    }
    await this.prisma.schoolSubjectType.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { ok: true };
  }

  async createSubject(tenantId: string, dto: SaveSchoolSubjectDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.ensureDefaultTypes(tenantId);
    const typeId = await this.resolveTypeId(tenantId, dto.subjectTypeId);
    const code = slugCode(dto.code || dto.name, 'SUB');
    try {
      return await this.prisma.schoolSubject.create({
        data: {
          tenantId,
          code,
          name: dto.name.trim(),
          subjectTypeId: typeId,
          sortOrder: dto.sortOrder ?? 10,
          active: dto.active ?? true,
          isOptional: dto.isOptional ?? false,
          maxMarks: dto.maxMarks ?? null,
          passMarks: dto.passMarks ?? null,
          hasTheory: dto.hasTheory ?? true,
          hasPractical: dto.hasPractical ?? false,
        },
        include: { subjectType: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That subject code already exists');
      }
      throw err;
    }
  }

  async updateSubject(tenantId: string, id: string, dto: SaveSchoolSubjectDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSubject.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Subject not found');
    const typeId =
      dto.subjectTypeId !== undefined
        ? await this.resolveTypeId(tenantId, dto.subjectTypeId)
        : row.subjectTypeId;
    try {
      return await this.prisma.schoolSubject.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          ...(dto.code ? { code: slugCode(dto.code, row.code) } : {}),
          subjectTypeId: typeId,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.isOptional !== undefined
            ? { isOptional: dto.isOptional }
            : {}),
          ...(dto.maxMarks !== undefined ? { maxMarks: dto.maxMarks } : {}),
          ...(dto.passMarks !== undefined ? { passMarks: dto.passMarks } : {}),
          ...(dto.hasTheory !== undefined ? { hasTheory: dto.hasTheory } : {}),
          ...(dto.hasPractical !== undefined
            ? { hasPractical: dto.hasPractical }
            : {}),
        },
        include: { subjectType: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That subject code already exists');
      }
      throw err;
    }
  }

  async deleteSubject(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSubject.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Subject not found');
    const usage = await this.subjectUsage(tenantId, id);
    const blockers = Object.entries(usage)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count} ${key}`);
    if (blockers.length) {
      throw new ConflictException(
        `Cannot delete ${row.name} because it is used in ${blockers.join(', ')}. Deactivate it instead so timetable, exams and marks stay intact.`,
      );
    }
    await this.prisma.schoolSubject.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { ok: true };
  }

  async assignSubjectGrades(
    tenantId: string,
    subjectId: string,
    gradeIds: string[],
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const subject = await this.prisma.schoolSubject.findFirst({
      where: { id: subjectId, tenantId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    const unique = [...new Set(gradeIds)];
    if (unique.length) {
      const found = await this.prisma.schoolGrade.count({
        where: { tenantId, deletedAt: null, id: { in: unique } },
      });
      if (found !== unique.length) {
        throw new BadRequestException('One or more classes were not found');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolGradeSubject.deleteMany({
        where: {
          tenantId,
          academicYearId: year.id,
          subjectId,
          ...(unique.length ? { gradeId: { notIn: unique } } : {}),
        },
      });
      if (unique.length) {
        await tx.schoolGradeSubject.createMany({
          data: unique.map((gradeId) => ({
            tenantId,
            academicYearId: year.id,
            gradeId,
            subjectId,
          })),
          skipDuplicates: true,
        });
      }
    });
    return this.listBundle(tenantId);
  }

  private async subjectUsage(tenantId: string, subjectId: string) {
    const [classes, timetable, exams, schedules, marks, homework] =
      await Promise.all([
        this.prisma.schoolGradeSubject.count({
          where: { tenantId, subjectId },
        }),
        this.prisma.schoolTimetableSlot.count({
          where: { tenantId, subjectId },
        }),
        this.prisma.schoolExamSubject.count({
          where: { tenantId, subjectId },
        }),
        this.prisma.schoolExamSchedule.count({
          where: { tenantId, subjectId },
        }),
        this.prisma.schoolExamResultSubject.count({
          where: { tenantId, subjectId },
        }),
        this.prisma.schoolHomework.count({
          where: { tenantId, subjectId, deletedAt: null },
        }),
      ]);
    return {
      classes,
      timetable,
      examinations: exams + schedules,
      marks,
      homework,
    };
  }

  async saveClassSubjects(tenantId: string, dto: SaveSchoolClassSubjectsDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = dto.academicYearId
      ? await this.prisma.schoolAcademicYear.findFirst({
          where: { id: dto.academicYearId, tenantId, deletedAt: null },
        })
      : await this.sis.currentYear(tenantId);
    if (!year) throw new NotFoundException('Academic year not found');
    const grade = await this.prisma.schoolGrade.findFirst({
      where: { id: dto.gradeId, tenantId, deletedAt: null },
    });
    if (!grade) throw new NotFoundException('Class not found');
    const uniqueIds = [...new Set(dto.subjectIds)];
    if (uniqueIds.length) {
      const found = await this.prisma.schoolSubject.count({
        where: {
          tenantId,
          deletedAt: null,
          id: { in: uniqueIds },
        },
      });
      if (found !== uniqueIds.length) {
        throw new BadRequestException('One or more subjects were not found');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolGradeSubject.deleteMany({
        where: {
          tenantId,
          academicYearId: year.id,
          gradeId: grade.id,
        },
      });
      if (uniqueIds.length) {
        await tx.schoolGradeSubject.createMany({
          data: uniqueIds.map((subjectId) => ({
            tenantId,
            academicYearId: year.id,
            gradeId: grade.id,
            subjectId,
          })),
        });
      }
    });
    return this.listBundle(tenantId);
  }

  private async resolveTypeId(tenantId: string, requested?: string) {
    if (requested) {
      const row = await this.prisma.schoolSubjectType.findFirst({
        where: { id: requested, tenantId, deletedAt: null },
      });
      if (!row) throw new BadRequestException('Subject type not found');
      return row.id;
    }
    const main = await this.prisma.schoolSubjectType.findFirst({
      where: { tenantId, code: 'MAIN', deletedAt: null },
    });
    return main?.id ?? null;
  }

  private async ensureDefaultTypes(tenantId: string) {
    for (const type of DEFAULT_TYPES) {
      const existing = await this.prisma.schoolSubjectType.findFirst({
        where: { tenantId, code: type.code },
      });
      if (existing) {
        if (existing.deletedAt) {
          await this.prisma.schoolSubjectType.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              active: true,
              name: type.name,
              sortOrder: type.sortOrder,
            },
          });
        }
        continue;
      }
      await this.prisma.schoolSubjectType.create({
        data: {
          tenantId,
          code: type.code,
          name: type.name,
          sortOrder: type.sortOrder,
        },
      });
    }
  }
}
