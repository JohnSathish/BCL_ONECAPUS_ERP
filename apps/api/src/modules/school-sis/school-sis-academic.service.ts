import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisTimetableService } from './school-sis-timetable.service';
import type {
  AssignSchoolClubMembersDto,
  AssignSchoolHouseMembersDto,
  BulkSchoolClassSubjectsDto,
  BulkSchoolPromotionDto,
  PatchSchoolSectionDto,
  SaveSchoolAcademicYearDto,
  SaveSchoolClubActivityDto,
  SaveSchoolClubDto,
  SaveSchoolGradeDto,
  SaveSchoolHouseDto,
  SaveSchoolIdCardTemplateDto,
  SaveSchoolOptionalMappingDto,
} from './dto/school-sis.dto';

function yearCodeFromName(name: string, startDate: string) {
  const fromName = name.match(/20\d{2}/)?.[0];
  if (fromName) return fromName;
  return String(new Date(startDate).getFullYear());
}

function slugCode(name: string, fallback: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
  return slug || fallback;
}

const DEFAULT_ID_LAYOUT = {
  showLogo: true,
  showPhoto: true,
  showName: true,
  showAdmission: true,
  showClass: true,
  showYear: true,
  showBloodGroup: true,
  showQr: true,
  contactLine: '',
  accentColor: '#1a365d',
};

@Injectable()
export class SchoolSisAcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly timetable: SchoolSisTimetableService,
  ) {}

  async listYears(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolAcademicYear.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { enrollments: true, sections: true } },
      },
    });
  }

  async saveYear(
    tenantId: string,
    dto: SaveSchoolAcademicYearDto,
    id?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) {
      throw new BadRequestException('End date must be after the start date');
    }
    const code = (dto.code || yearCodeFromName(dto.name, dto.startDate)).slice(
      0,
      8,
    );
    const status = dto.status ?? (id ? undefined : 'UPCOMING');
    const data = {
      name: dto.name.trim(),
      code,
      startDate: start,
      endDate: end,
      ...(status ? { status } : {}),
    };
    const row = await this.prisma.$transaction(async (tx) => {
      if (status === 'CURRENT') {
        await tx.schoolAcademicYear.updateMany({
          where: { tenantId, deletedAt: null, status: 'CURRENT' },
          data: { status: 'UPCOMING' },
        });
      }
      if (id) {
        const existing = await tx.schoolAcademicYear.findFirst({
          where: { id, tenantId, deletedAt: null },
        });
        if (!existing) throw new NotFoundException('Academic year not found');
        return tx.schoolAcademicYear.update({ where: { id }, data });
      }
      return tx.schoolAcademicYear.create({ data: { tenantId, ...data } });
    });
    if (!id && dto.copyTimetableFromYearId) {
      await this.timetable.copyYear(tenantId, {
        mode: 'YEAR',
        fromYearId: dto.copyTimetableFromYearId,
        toYearId: row.id,
      });
    }
    return row;
  }

  async activateYear(tenantId: string, id: string) {
    return this.saveYear(
      tenantId,
      {
        ...(await this.requireYearDto(tenantId, id)),
        status: 'CURRENT',
      },
      id,
    );
  }

  async archiveYear(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.prisma.schoolAcademicYear.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.status === 'CURRENT') {
      throw new BadRequestException(
        'Set another year as current before archiving this one. Records are kept.',
      );
    }
    return this.prisma.schoolAcademicYear.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  private async requireYearDto(tenantId: string, id: string) {
    const year = await this.prisma.schoolAcademicYear.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    return {
      name: year.name,
      code: year.code,
      startDate: year.startDate.toISOString(),
      endDate: year.endDate.toISOString(),
    };
  }

  async listClasses(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const [grades, sections] = await Promise.all([
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSection.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: {
          grade: true,
          _count: { select: { enrollments: true } },
          classTeachers: {
            where: { deletedAt: null },
            include: { staff: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
      }),
    ]);
    return { academicYear: year, grades, sections };
  }

  async saveGrade(tenantId: string, dto: SaveSchoolGradeDto, id?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const code = slugCode(dto.code || dto.name, 'CLASS');
    try {
      if (id) {
        const existing = await this.prisma.schoolGrade.findFirst({
          where: { id, tenantId, deletedAt: null },
        });
        if (!existing) throw new NotFoundException('Class not found');
        return this.prisma.schoolGrade.update({
          where: { id },
          data: {
            name: dto.name.trim(),
            code,
            ...(dto.sortOrder !== undefined
              ? { sortOrder: dto.sortOrder }
              : {}),
            ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
          },
        });
      }
      const maxSort = await this.prisma.schoolGrade.aggregate({
        where: { tenantId, deletedAt: null },
        _max: { sortOrder: true },
      });
      return this.prisma.schoolGrade.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          code,
          sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
          capacity: dto.capacity ?? null,
          active: dto.active ?? true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That class code already exists');
      }
      throw err;
    }
  }

  async patchSection(tenantId: string, id: string, dto: PatchSchoolSectionDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSection.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Section not found');
    try {
      return await this.prisma.schoolSection.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim().toUpperCase() } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.roomLabel !== undefined
            ? { roomLabel: dto.roomLabel.trim() || null }
            : {}),
        },
        include: { grade: true },
      });
    } catch {
      throw new ConflictException('That section already exists for this class');
    }
  }

  async archiveSection(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolSection.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Section not found');
    return this.prisma.schoolSection.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  async classSubjectMatrix(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const [grades, subjects, sections, mappings, teachers] = await Promise.all([
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null, active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSubject.findMany({
        where: { tenantId, deletedAt: null },
        include: { subjectType: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.schoolSection.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          active: true,
        },
        include: { grade: true },
        orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.schoolGradeSubject.findMany({
        where: { tenantId, academicYearId: year.id },
      }),
      this.prisma.schoolSubjectTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: { staff: { select: { id: true, fullName: true } } },
      }),
    ]);
    const mapped = new Map<string, Set<string>>();
    for (const row of mappings) {
      const set = mapped.get(row.gradeId) ?? new Set();
      set.add(row.subjectId);
      mapped.set(row.gradeId, set);
    }
    const teacherKey = (sectionId: string, subjectId: string) =>
      `${sectionId}:${subjectId}`;
    const teacherMap = new Map(
      teachers.map((row) => [
        teacherKey(row.sectionId, row.subjectId),
        row.staff,
      ]),
    );
    type MatrixRow = {
      sectionId: string;
      gradeId: string;
      className: string;
      sectionName: string;
      subjectId: string | null;
      subjectName: string | null;
      subjectCode: string | null;
      subjectType: string | null;
      teacher: { id: string; fullName: string } | null;
    };
    const rows: MatrixRow[] = [];
    for (const section of sections) {
      const subjectIds = [...(mapped.get(section.gradeId) ?? [])];
      if (!subjectIds.length) {
        rows.push({
          sectionId: section.id,
          gradeId: section.gradeId,
          className: section.grade.name,
          sectionName: section.name,
          subjectId: null,
          subjectName: null,
          subjectCode: null,
          subjectType: null,
          teacher: null,
        });
        continue;
      }
      for (const subjectId of subjectIds) {
        const subject = subjects.find((s) => s.id === subjectId);
        rows.push({
          sectionId: section.id,
          gradeId: section.gradeId,
          className: section.grade.name,
          sectionName: section.name,
          subjectId,
          subjectName: subject?.name ?? '—',
          subjectCode: subject?.code ?? null,
          subjectType:
            subject?.subjectType?.name ??
            (subject?.isOptional ? 'Optional' : 'Core'),
          teacher: teacherMap.get(teacherKey(section.id, subjectId)) ?? null,
        });
      }
    }
    return { academicYear: year, grades, subjects, sections, rows };
  }

  async bulkMapClassSubjects(
    tenantId: string,
    dto: BulkSchoolClassSubjectsDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const uniqueGrades = [...new Set(dto.gradeIds)];
    const uniqueSubjects = [...new Set(dto.subjectIds)];
    const [gradeCount, subjectCount] = await Promise.all([
      this.prisma.schoolGrade.count({
        where: { tenantId, deletedAt: null, id: { in: uniqueGrades } },
      }),
      this.prisma.schoolSubject.count({
        where: { tenantId, deletedAt: null, id: { in: uniqueSubjects } },
      }),
    ]);
    if (gradeCount !== uniqueGrades.length) {
      throw new BadRequestException('One or more classes were not found');
    }
    if (subjectCount !== uniqueSubjects.length) {
      throw new BadRequestException('One or more subjects were not found');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolGradeSubject.deleteMany({
        where: {
          tenantId,
          academicYearId: year.id,
          gradeId: { in: uniqueGrades },
        },
      });
      if (uniqueSubjects.length) {
        await tx.schoolGradeSubject.createMany({
          data: uniqueGrades.flatMap((gradeId) =>
            uniqueSubjects.map((subjectId) => ({
              tenantId,
              academicYearId: year.id,
              gradeId,
              subjectId,
            })),
          ),
        });
      }
    });
    return this.classSubjectMatrix(tenantId);
  }

  async staffMap(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const [classTeachers, subjectTeachers, staff] = await Promise.all([
      this.prisma.schoolClassTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: {
          staff: { select: { id: true, fullName: true, employeeCode: true } },
          section: { include: { grade: true } },
        },
      }),
      this.prisma.schoolSubjectTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: {
          staff: { select: { id: true, fullName: true, employeeCode: true } },
          subject: true,
          section: { include: { grade: true } },
        },
      }),
      this.prisma.schoolStaff.findMany({
        where: { tenantId, deletedAt: null, staffType: 'TEACHING' },
        select: { id: true, fullName: true, employeeCode: true },
        orderBy: { fullName: 'asc' },
      }),
    ]);
    const workload = new Map<
      string,
      { classTeacherSections: number; subjects: number; periods: number }
    >();
    const bump = (staffId: string) => {
      const row = workload.get(staffId) ?? {
        classTeacherSections: 0,
        subjects: 0,
        periods: 0,
      };
      workload.set(staffId, row);
      return row;
    };
    for (const row of classTeachers)
      bump(row.staffId).classTeacherSections += 1;
    for (const row of subjectTeachers) {
      const w = bump(row.staffId);
      w.subjects += 1;
      w.periods += row.periodsPerWeek;
    }
    return {
      academicYear: year,
      staff,
      classTeachers,
      subjectTeachers,
      workload: staff.map((person) => ({
        ...person,
        ...(workload.get(person.id) ?? {
          classTeacherSections: 0,
          subjects: 0,
          periods: 0,
        }),
      })),
    };
  }

  async listOptionals(tenantId: string, sectionId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const subjects = await this.prisma.schoolSubject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        OR: [{ isOptional: true }, { subjectType: { code: 'OPTIONAL' } }],
      },
      include: { subjectType: true },
      orderBy: { name: 'asc' },
    });
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        ...(sectionId ? { sectionId } : {}),
      },
      include: {
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
        section: { include: { grade: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
    const mappings = await this.prisma.schoolStudentOptionalSubject.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        studentId: { in: enrollments.map((e) => e.studentId) },
      },
    });
    const byStudent = new Map<string, string[]>();
    for (const row of mappings) {
      const list = byStudent.get(row.studentId) ?? [];
      list.push(row.subjectId);
      byStudent.set(row.studentId, list);
    }
    return {
      academicYear: year,
      subjects,
      students: enrollments.map((row) => ({
        id: row.student.id,
        fullName: row.student.fullName,
        admissionNumber: row.student.admissionNumber,
        className: `${row.section.grade.name} ${row.section.name}`,
        sectionId: row.sectionId,
        subjectIds: byStudent.get(row.studentId) ?? [],
      })),
    };
  }

  async saveOptionalMapping(
    tenantId: string,
    dto: SaveSchoolOptionalMappingDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const unique = [...new Set(dto.subjectIds)];
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolStudentOptionalSubject.deleteMany({
        where: {
          tenantId,
          academicYearId: year.id,
          studentId: dto.studentId,
        },
      });
      if (unique.length) {
        await tx.schoolStudentOptionalSubject.createMany({
          data: unique.map((subjectId) => ({
            tenantId,
            academicYearId: year.id,
            studentId: dto.studentId,
            subjectId,
          })),
        });
      }
    });
    return { ok: true };
  }

  async listHouses(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const houses = await this.prisma.schoolHouse.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        teacher: { select: { id: true, fullName: true } },
        memberships: {
          where: { academicYearId: year.id },
          include: {
            student: {
              select: { id: true, fullName: true, admissionNumber: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { academicYear: year, houses };
  }

  async saveHouse(tenantId: string, dto: SaveSchoolHouseDto, id?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const data = {
      name: dto.name.trim(),
      color: dto.color?.trim() || '#0ea5e9',
      captainName: dto.captainName?.trim() || null,
      teacherStaffId: dto.teacherStaffId || null,
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    try {
      if (id) {
        const existing = await this.prisma.schoolHouse.findFirst({
          where: { id, tenantId, deletedAt: null },
        });
        if (!existing) throw new NotFoundException('House not found');
        return this.prisma.schoolHouse.update({ where: { id }, data });
      }
      return this.prisma.schoolHouse.create({ data: { tenantId, ...data } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A house with that name already exists');
      }
      throw err;
    }
  }

  async assignHouseMembers(tenantId: string, dto: AssignSchoolHouseMembersDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const house = await this.prisma.schoolHouse.findFirst({
      where: { id: dto.houseId, tenantId, deletedAt: null },
    });
    if (!house) throw new NotFoundException('House not found');
    const unique = [...new Set(dto.studentIds)];
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolHouseMembership.deleteMany({
        where: {
          tenantId,
          academicYearId: year.id,
          studentId: { in: unique },
        },
      });
      if (unique.length) {
        await tx.schoolHouseMembership.createMany({
          data: unique.map((studentId) => ({
            tenantId,
            academicYearId: year.id,
            houseId: house.id,
            studentId,
          })),
        });
      }
    });
    return this.listHouses(tenantId);
  }

  async listClubs(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const clubs = await this.prisma.schoolClub.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: {
        coordinator: { select: { id: true, fullName: true } },
        members: {
          include: {
            student: {
              select: { id: true, fullName: true, admissionNumber: true },
            },
          },
        },
        activities: { orderBy: { activityDate: 'desc' } },
      },
      orderBy: { name: 'asc' },
    });
    return { academicYear: year, clubs };
  }

  async saveClub(tenantId: string, dto: SaveSchoolClubDto, id?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const data = {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      coordinatorStaffId: dto.coordinatorStaffId || null,
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    try {
      if (id) {
        const existing = await this.prisma.schoolClub.findFirst({
          where: { id, tenantId, academicYearId: year.id, deletedAt: null },
        });
        if (!existing) throw new NotFoundException('Club not found');
        return this.prisma.schoolClub.update({ where: { id }, data });
      }
      return this.prisma.schoolClub.create({
        data: { tenantId, academicYearId: year.id, ...data },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'A club with that name already exists this year',
        );
      }
      throw err;
    }
  }

  async assignClubMembers(
    tenantId: string,
    clubId: string,
    dto: AssignSchoolClubMembersDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const club = await this.prisma.schoolClub.findFirst({
      where: { id: clubId, tenantId, deletedAt: null },
    });
    if (!club) throw new NotFoundException('Club not found');
    const unique = [...new Set(dto.studentIds)];
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolClubMembership.deleteMany({ where: { clubId } });
      if (unique.length) {
        await tx.schoolClubMembership.createMany({
          data: unique.map((studentId) => ({
            tenantId,
            clubId,
            studentId,
          })),
        });
      }
    });
    return this.listClubs(tenantId);
  }

  async addClubActivity(
    tenantId: string,
    clubId: string,
    dto: SaveSchoolClubActivityDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const club = await this.prisma.schoolClub.findFirst({
      where: { id: clubId, tenantId, deletedAt: null },
    });
    if (!club) throw new NotFoundException('Club not found');
    return this.prisma.schoolClubActivity.create({
      data: {
        tenantId,
        clubId,
        title: dto.title.trim(),
        activityDate: dto.activityDate ? new Date(dto.activityDate) : null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async promotionBoard(tenantId: string, sectionId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const [sections, years, enrollments, history] = await Promise.all([
      this.prisma.schoolSection.findMany({
        where: { tenantId, deletedAt: null, active: true },
        include: { grade: true, academicYear: true },
        orderBy: [
          { academicYear: { startDate: 'desc' } },
          { grade: { sortOrder: 'asc' } },
          { name: 'asc' },
        ],
      }),
      this.prisma.schoolAcademicYear.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          status: 'ACTIVE',
          ...(sectionId ? { sectionId } : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              status: true,
            },
          },
          section: { include: { grade: true } },
        },
        orderBy: { student: { fullName: 'asc' } },
      }),
      this.prisma.schoolEnrollmentEvent.findMany({
        where: {
          tenantId,
          type: {
            in: ['PROMOTED', 'HELD_BACK', 'WITHDRAWN', 'SECTION_CHANGE'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          student: {
            select: { id: true, fullName: true, admissionNumber: true },
          },
        },
      }),
    ]);
    return {
      academicYear: year,
      years,
      sections,
      students: enrollments.map((row) => ({
        enrollmentId: row.id,
        studentId: row.student.id,
        fullName: row.student.fullName,
        admissionNumber: row.student.admissionNumber,
        status: row.status,
        studentStatus: row.student.status,
        className: `${row.section.grade.name} ${row.section.name}`,
        sectionId: row.sectionId,
        rollNumber: row.rollNumber,
      })),
      history: history.map((row) => ({
        id: row.id,
        type: row.type,
        createdAt: row.createdAt,
        note: row.note,
        student: row.student,
        fromSectionId: row.fromSectionId,
        toSectionId: row.toSectionId,
      })),
    };
  }

  async applyPromotion(
    tenantId: string,
    dto: BulkSchoolPromotionDto,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (!dto.studentIds.length) {
      throw new BadRequestException('Select at least one student');
    }
    if (dto.action === 'PROMOTE' && !dto.toSectionId) {
      throw new BadRequestException('Choose the promotion class and section');
    }
    const results: Array<{ studentId: string; action: string }> = [];
    for (const studentId of dto.studentIds) {
      if (dto.action === 'PROMOTE' && dto.toSectionId) {
        await this.sis.promote(
          tenantId,
          { studentId, toSectionId: dto.toSectionId, note: dto.note },
          actorUserId,
        );
        results.push({ studentId, action: 'PROMOTED' });
        continue;
      }
      const current = await this.prisma.schoolEnrollment.findFirst({
        where: {
          tenantId,
          studentId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!current) continue;
      if (dto.action === 'HOLD') {
        await this.prisma.schoolEnrollmentEvent.create({
          data: {
            tenantId,
            studentId,
            enrollmentId: current.id,
            type: 'HELD_BACK',
            fromSectionId: current.sectionId,
            toSectionId: current.sectionId,
            note: dto.note?.trim() || 'Held back in the same class',
            actorUserId: actorUserId ?? null,
          },
        });
        results.push({ studentId, action: 'HELD_BACK' });
      }
      if (dto.action === 'WITHDRAW') {
        await this.prisma.$transaction([
          this.prisma.schoolEnrollment.update({
            where: { id: current.id },
            data: { status: 'WITHDRAWN' },
          }),
          this.prisma.schoolStudent.update({
            where: { id: studentId },
            data: { status: 'WITHDRAWN' },
          }),
          this.prisma.schoolEnrollmentEvent.create({
            data: {
              tenantId,
              studentId,
              enrollmentId: current.id,
              type: 'WITHDRAWN',
              fromSectionId: current.sectionId,
              note: dto.note?.trim() || null,
              actorUserId: actorUserId ?? null,
            },
          }),
        ]);
        results.push({ studentId, action: 'WITHDRAWN' });
      }
    }
    return { ok: true, count: results.length, results };
  }

  async listIdCards(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolIdCardTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async saveIdCard(
    tenantId: string,
    dto: SaveSchoolIdCardTemplateDto,
    id?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const layout = { ...DEFAULT_ID_LAYOUT, ...(dto.layoutJson ?? {}) };
    const data = {
      name: dto.name.trim(),
      status: dto.status ?? 'DRAFT',
      isDefault: dto.isDefault ?? false,
      layoutJson: layout as Prisma.InputJsonValue,
    };
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.schoolIdCardTemplate.updateMany({
          where: { tenantId, deletedAt: null },
          data: { isDefault: false },
        });
      }
      if (id) {
        const existing = await tx.schoolIdCardTemplate.findFirst({
          where: { id, tenantId, deletedAt: null },
        });
        if (!existing) throw new NotFoundException('Template not found');
        return tx.schoolIdCardTemplate.update({ where: { id }, data });
      }
      return tx.schoolIdCardTemplate.create({ data: { tenantId, ...data } });
    });
  }

  async previewIdCard(
    tenantId: string,
    templateId: string,
    studentId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const template = await this.prisma.schoolIdCardTemplate.findFirst({
      where: { id: templateId, tenantId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Template not found');
    const year = await this.sis.currentYear(tenantId);
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const enrollment = studentId
      ? await this.prisma.schoolEnrollment.findFirst({
          where: {
            tenantId,
            studentId,
            academicYearId: year.id,
            deletedAt: null,
          },
          include: {
            student: true,
            section: { include: { grade: true } },
          },
        })
      : await this.prisma.schoolEnrollment.findFirst({
          where: { tenantId, academicYearId: year.id, deletedAt: null },
          include: {
            student: true,
            section: { include: { grade: true } },
          },
        });
    return {
      template,
      school: {
        name: branding?.displayName ?? "St. Luke's Secondary School",
        logoUrl: branding?.logoUrl ?? null,
        phone: null,
        email: null,
        address: branding?.address ?? null,
      },
      academicYear: year,
      student: enrollment
        ? {
            fullName: enrollment.student.fullName,
            admissionNumber: enrollment.student.admissionNumber,
            photoUrl: enrollment.student.photoUrl,
            bloodGroup: enrollment.student.bloodGroup,
            className: `${enrollment.section.grade.name} ${enrollment.section.name}`,
          }
        : {
            fullName: 'Sample Student',
            admissionNumber: 'SLS/2026/0001',
            photoUrl: null,
            bloodGroup: 'O+',
            className: 'Class 5 A',
          },
    };
  }
}
