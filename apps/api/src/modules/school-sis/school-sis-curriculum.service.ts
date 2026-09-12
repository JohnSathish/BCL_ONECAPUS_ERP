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
    { code: 'OPTIONAL', name: 'Optional Subject', sortOrder: 2 },
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
    const [types, subjects, mappings, grades] = await Promise.all([
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
    ]);
    return {
      academicYear: year,
      types,
      subjects,
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
    await this.prisma.$transaction([
      this.prisma.schoolGradeSubject.deleteMany({
        where: { tenantId, subjectId: id },
      }),
      this.prisma.schoolSubject.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      }),
    ]);
    return { ok: true };
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
