import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { resolveTenantUploadRoot } from '../../common/uploads/upload-paths';
import {
  SCHOOL_ADMISSION_NUMBER_PREFIX,
  SCHOOL_SIS_PRODUCT,
} from './school-sis.constants';
import type {
  AddPreviousSchoolDto,
  AddStudentDocumentDto,
  AssignClassTeacherDto,
  AssignSubjectTeacherDto,
  CreateSchoolSectionDto,
  CreateSchoolStaffDto,
  CreateSchoolStudentDto,
  EnrollStudentDto,
  PromoteStudentDto,
  SaveSchoolStaffDto,
} from './dto/school-sis.dto';

type BrandingExtras = {
  institutionType?: string;
  schoolProduct?: string;
};

const STAFF_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);
const STAFF_DOC_MIME = new Set([...STAFF_IMAGE_MIME, 'application/pdf']);

@Injectable()
export class SchoolSisService {
  constructor(private readonly prisma: PrismaService) {}

  async assertSecondarySisTenant(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { portalExtrasJson: true },
    });
    const extras = (branding?.portalExtrasJson ?? {}) as BrandingExtras;
    if (extras.schoolProduct !== SCHOOL_SIS_PRODUCT) {
      throw new ForbiddenException(
        'This school SIS is not enabled for the current tenant',
      );
    }
  }

  async currentYear(tenantId: string) {
    const year = await this.prisma.schoolAcademicYear.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'CURRENT',
      },
      orderBy: { startDate: 'desc' },
    });
    if (!year)
      throw new NotFoundException('No school academic year configured');
    return year;
  }

  async nextFormattedNumber(
    tenantId: string,
    academicYearId: string,
    kind: 'ADMISSION' | 'APPLICATION',
    prefix: string,
    yearCode: string,
  ) {
    const seq = await this.prisma.$transaction(async (tx) => {
      const row = await tx.schoolIdSequence.upsert({
        where: {
          tenantId_academicYearId_kind: { tenantId, academicYearId, kind },
        },
        update: { lastValue: { increment: 1 } },
        create: { tenantId, academicYearId, kind, lastValue: 1 },
      });
      return row.lastValue;
    });
    return `${prefix}/${yearCode}/${String(seq).padStart(4, '0')}`;
  }

  async overview(tenantId: string) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const now = new Date();
    const [
      students,
      teachingStaff,
      nonTeachingStaff,
      sections,
      enrollments,
      grades,
      applications,
      users,
      newEnquiries,
      upcomingEventCount,
      genderGroups,
      enrollmentRows,
      recentApplications,
      notices,
      events,
    ] = await Promise.all([
      this.prisma.schoolStudent.count({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.schoolStaff.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          staffType: 'TEACHING',
        },
      }),
      this.prisma.schoolStaff.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          staffType: { not: 'TEACHING' },
        },
      }),
      this.prisma.schoolSection.count({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
      }),
      this.prisma.schoolEnrollment.count({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
      this.prisma.schoolGrade.count({
        where: { tenantId, deletedAt: null, active: true },
      }),
      this.prisma.schoolApplication.count({
        where: {
          tenantId,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'WAITLIST'] },
        },
      }),
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, isActive: true },
      }),
      this.prisma.schoolWebEnquiry.count({
        where: { tenantId, status: 'NEW' },
      }),
      this.prisma.schoolWebEvent.count({
        where: { tenantId, status: 'PUBLISHED', startsAt: { gte: now } },
      }),
      this.prisma.schoolStudent.groupBy({
        by: ['gender'],
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.schoolEnrollment.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: {
          section: {
            select: {
              grade: {
                select: { id: true, name: true, code: true, sortOrder: true },
              },
            },
          },
        },
      }),
      this.prisma.schoolApplication.findMany({
        where: { tenantId },
        include: { cycle: { select: { name: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 8,
      }),
      this.prisma.schoolWebNotice.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          title: true,
          category: true,
          publishedAt: true,
          featured: true,
          slug: true,
        },
      }),
      this.prisma.schoolWebEvent.findMany({
        where: { tenantId, status: 'PUBLISHED', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 6,
        select: {
          id: true,
          title: true,
          venue: true,
          startsAt: true,
          endsAt: true,
          slug: true,
        },
      }),
    ]);

    const classMap = new Map<
      string,
      {
        id: string;
        name: string;
        code: string;
        sortOrder: number;
        count: number;
      }
    >();
    for (const row of enrollmentRows) {
      const grade = row.section.grade;
      const current = classMap.get(grade.id);
      if (current) current.count += 1;
      else {
        classMap.set(grade.id, {
          id: grade.id,
          name: grade.name,
          code: grade.code,
          sortOrder: grade.sortOrder,
          count: 1,
        });
      }
    }
    const byClass = [...classMap.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const gender = { male: 0, female: 0, other: 0, unspecified: 0 };
    for (const row of genderGroups) {
      const key = (row.gender ?? '').toUpperCase();
      const n = row._count._all;
      if (key === 'MALE' || key === 'M' || key === 'BOY') gender.male += n;
      else if (key === 'FEMALE' || key === 'F' || key === 'GIRL')
        gender.female += n;
      else if (!key) gender.unspecified += n;
      else gender.other += n;
    }

    return {
      academicYear: {
        id: year.id,
        name: year.name,
        startDate: year.startDate,
        endDate: year.endDate,
        status: year.status,
      },
      counts: {
        students,
        staff: teachingStaff + nonTeachingStaff,
        teachingStaff,
        nonTeachingStaff,
        sections,
        enrollments,
        grades,
        openApplications: applications,
        users,
        newEnquiries,
        eventsUpcoming: upcomingEventCount,
      },
      gender,
      byClass,
      recentApplications: recentApplications.map((row) => ({
        id: row.id,
        applicant: row.fullName,
        classLabel: row.cycle.name,
        applicationNumber: row.applicationNumber,
        submittedAt: row.submittedAt,
        status: row.status,
      })),
      notices,
      events,
      system: {
        status: 'ONLINE' as const,
        storageConfigured: false,
        backupConfigured: false,
      },
      modules: {
        admission: true,
        enrollment: true,
        timetable: true,
        attendance: false,
        fees: true,
        exams: false,
        library: false,
        stationery: false,
        transport: false,
        website: true,
      },
    };
  }

  async listMasters(tenantId: string) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const [grades, subjects, sections, academicYears] = await Promise.all([
      this.prisma.schoolGrade.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSubject.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolSection.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          grade: true,
          academicYear: true,
          _count: { select: { enrollments: true } },
          classTeachers: {
            where: { deletedAt: null },
            include: { staff: true },
          },
        },
        orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.schoolAcademicYear.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return {
      academicYear: year,
      academicYears,
      grades,
      subjects,
      sections: sections.filter((s) => s.academicYearId === year.id),
      allSections: sections,
    };
  }

  async createSection(tenantId: string, dto: CreateSchoolSectionDto) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const grade = await this.prisma.schoolGrade.findFirst({
      where: { id: dto.gradeId, tenantId, deletedAt: null },
    });
    if (!grade) throw new NotFoundException('Class not found');
    try {
      return await this.prisma.schoolSection.create({
        data: {
          tenantId,
          academicYearId: year.id,
          gradeId: dto.gradeId,
          name: dto.name.trim().toUpperCase(),
          capacity: dto.capacity,
        },
        include: { grade: true },
      });
    } catch {
      throw new ConflictException('That section already exists for this class');
    }
  }

  async listStudents(
    tenantId: string,
    q?: string,
    gradeId?: string,
    sectionId?: string,
    status?: string,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const query = q?.trim();
    const rows = await this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { admissionNumber: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
                {
                  guardians: {
                    some: {
                      guardian: {
                        OR: [
                          {
                            fullName: { contains: query, mode: 'insensitive' },
                          },
                          { phone: { contains: query } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(gradeId || sectionId
          ? {
              enrollments: {
                some: {
                  academicYearId: year.id,
                  deletedAt: null,
                  ...(sectionId ? { sectionId } : {}),
                  ...(gradeId ? { section: { gradeId } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        enrollments: {
          where: { academicYearId: year.id, deletedAt: null },
          include: { section: { include: { grade: true } } },
        },
        guardians: { include: { guardian: true } },
      },
      take: 2500,
    });

    const rollKey = (value?: string | null) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 9999;
    };
    rows.sort((a, b) => {
      const ea = a.enrollments[0];
      const eb = b.enrollments[0];
      const ga = ea?.section.grade.sortOrder ?? 999;
      const gb = eb?.section.grade.sortOrder ?? 999;
      if (ga !== gb) return ga - gb;
      const sa = ea?.section.name ?? '';
      const sb = eb?.section.name ?? '';
      if (sa !== sb) return sa.localeCompare(sb);
      const ra = rollKey(ea?.rollNumber);
      const rb = rollKey(eb?.rollNumber);
      if (ra !== rb) return ra - rb;
      return a.fullName.localeCompare(b.fullName, 'en', {
        sensitivity: 'base',
      });
    });
    return rows;
  }

  async createStudent(
    tenantId: string,
    dto: CreateSchoolStudentDto,
    actorUserId?: string,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const admissionNumber = dto.admissionNumber?.trim()
      ? dto.admissionNumber.trim().toUpperCase()
      : await this.nextFormattedNumber(
          tenantId,
          year.id,
          'ADMISSION',
          SCHOOL_ADMISSION_NUMBER_PREFIX,
          year.code,
        );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const student = await tx.schoolStudent.create({
          data: {
            tenantId,
            admissionNumber,
            fullName: dto.fullName.trim(),
            gender: dto.gender?.trim() || null,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            phone: dto.phone?.trim() || null,
            email: dto.email?.trim() || null,
            address: dto.address?.trim() || null,
          },
        });
        if (dto.guardianName?.trim()) {
          const guardian = await tx.schoolGuardian.create({
            data: {
              tenantId,
              fullName: dto.guardianName.trim(),
              relation: dto.guardianRelation?.trim() || 'Parent',
              phone: dto.guardianPhone?.trim() || null,
            },
          });
          await tx.schoolStudentGuardian.create({
            data: {
              studentId: student.id,
              guardianId: guardian.id,
              relationship: dto.guardianRelation?.trim() || 'GUARDIAN',
            },
          });
        }
        if (dto.previousSchoolName?.trim()) {
          await tx.schoolStudentPreviousSchool.create({
            data: {
              tenantId,
              studentId: student.id,
              schoolName: dto.previousSchoolName.trim(),
              lastClass: dto.previousClass?.trim() || null,
            },
          });
        }
        await tx.schoolEnrollmentEvent.create({
          data: {
            tenantId,
            studentId: student.id,
            type: 'CREATED',
            actorUserId: actorUserId ?? null,
          },
        });
        return student;
      });
    } catch {
      throw new ConflictException('Admission number already exists');
    }
  }

  async getStudent(tenantId: string, studentId: string) {
    await this.assertSecondarySisTenant(tenantId);
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        guardians: { include: { guardian: true } },
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: { include: { grade: true } },
            academicYear: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        previousSchools: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        enrollmentEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async addPreviousSchool(
    tenantId: string,
    studentId: string,
    dto: AddPreviousSchoolDto,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    await this.getStudent(tenantId, studentId);
    return this.prisma.schoolStudentPreviousSchool.create({
      data: {
        tenantId,
        studentId,
        schoolName: dto.schoolName.trim(),
        lastClass: dto.lastClass?.trim() || null,
        board: dto.board?.trim() || null,
        yearOfLeaving: dto.yearOfLeaving?.trim() || null,
        tcNumber: dto.tcNumber?.trim() || null,
      },
    });
  }

  async addDocument(
    tenantId: string,
    studentId: string,
    dto: AddStudentDocumentDto,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    await this.getStudent(tenantId, studentId);
    return this.prisma.schoolStudentDocument.create({
      data: {
        tenantId,
        studentId,
        slot: dto.slot.trim().toUpperCase(),
        fileName: dto.fileName.trim(),
        mimeType: dto.mimeType?.trim() || null,
      },
    });
  }

  async promote(
    tenantId: string,
    dto: PromoteStudentDto,
    actorUserId?: string,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: dto.studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    const toSection = await this.prisma.schoolSection.findFirst({
      where: { id: dto.toSectionId, tenantId, deletedAt: null },
    });
    if (!toSection) throw new NotFoundException('Target section not found');
    const current = await this.prisma.schoolEnrollment.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.prisma.$transaction(async (tx) => {
      if (current && current.academicYearId === toSection.academicYearId) {
        const updated = await tx.schoolEnrollment.update({
          where: { id: current.id },
          data: {
            sectionId: toSection.id,
            rollNumber: dto.rollNumber?.trim() || current.rollNumber,
          },
        });
        await tx.schoolEnrollmentEvent.create({
          data: {
            tenantId,
            studentId: student.id,
            enrollmentId: updated.id,
            type: 'SECTION_CHANGE',
            fromSectionId: current.sectionId,
            toSectionId: toSection.id,
            note: dto.note?.trim() || null,
            actorUserId: actorUserId ?? null,
          },
        });
        return updated;
      }
      if (current) {
        await tx.schoolEnrollment.update({
          where: { id: current.id },
          data: { status: 'PROMOTED' },
        });
      }
      const created = await tx.schoolEnrollment.create({
        data: {
          tenantId,
          studentId: student.id,
          academicYearId: toSection.academicYearId,
          sectionId: toSection.id,
          rollNumber: dto.rollNumber?.trim() || null,
          status: 'ACTIVE',
          source: 'PROMOTE',
        },
      });
      await tx.schoolEnrollmentEvent.create({
        data: {
          tenantId,
          studentId: student.id,
          enrollmentId: created.id,
          type: 'PROMOTED',
          fromSectionId: current?.sectionId ?? null,
          toSectionId: toSection.id,
          note: dto.note?.trim() || null,
          actorUserId: actorUserId ?? null,
        },
      });
      return created;
    });
  }

  async listStaff(tenantId: string) {
    await this.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolStaff.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
  }

  async getStaff(tenantId: string, staffId: string) {
    await this.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolStaff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Staff not found');
    return row;
  }

  async updateStaff(
    tenantId: string,
    staffId: string,
    dto: SaveSchoolStaffDto,
  ) {
    await this.assertSecondarySisTenant(tenantId);
    await this.getStaff(tenantId, staffId);
    const empty = (v?: string) => {
      const t = v?.trim();
      return t ? t : null;
    };
    try {
      return await this.prisma.schoolStaff.update({
        where: { id: staffId },
        data: {
          ...(dto.employeeCode !== undefined
            ? { employeeCode: dto.employeeCode.trim().toUpperCase() }
            : {}),
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.staffType !== undefined ? { staffType: dto.staffType } : {}),
          ...(dto.designation !== undefined
            ? { designation: empty(dto.designation) }
            : {}),
          ...(dto.department !== undefined
            ? { department: empty(dto.department) }
            : {}),
          ...(dto.phone !== undefined ? { phone: empty(dto.phone) } : {}),
          ...(dto.email !== undefined ? { email: empty(dto.email) } : {}),
          ...(dto.status !== undefined
            ? { status: dto.status.trim() || 'ACTIVE' }
            : {}),
          ...(dto.photoUrl !== undefined
            ? { photoUrl: empty(dto.photoUrl) }
            : {}),
          ...(dto.gender !== undefined ? { gender: empty(dto.gender) } : {}),
          ...(dto.bloodGroup !== undefined
            ? { bloodGroup: empty(dto.bloodGroup) }
            : {}),
          ...(dto.fatherSpouseName !== undefined
            ? { fatherSpouseName: empty(dto.fatherSpouseName) }
            : {}),
          ...(dto.academicQualification !== undefined
            ? { academicQualification: empty(dto.academicQualification) }
            : {}),
          ...(dto.professionalQualification !== undefined
            ? {
                professionalQualification: empty(dto.professionalQualification),
              }
            : {}),
          ...(dto.teachingExperience !== undefined
            ? { teachingExperience: empty(dto.teachingExperience) }
            : {}),
          ...(dto.classAssigned !== undefined
            ? { classAssigned: empty(dto.classAssigned) }
            : {}),
          ...(dto.trainingStatus !== undefined
            ? { trainingStatus: empty(dto.trainingStatus) }
            : {}),
          ...(dto.address !== undefined ? { address: empty(dto.address) } : {}),
          ...(dto.remarks !== undefined ? { remarks: empty(dto.remarks) } : {}),
          ...(dto.joiningDate !== undefined
            ? {
                joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
              }
            : {}),
          ...(dto.dateOfBirth !== undefined
            ? {
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
              }
            : {}),
          ...(dto.extrasJson !== undefined
            ? { extrasJson: dto.extrasJson as Prisma.InputJsonValue }
            : {}),
        },
      });
    } catch {
      throw new ConflictException('Employee code already exists');
    }
  }

  async createStaff(tenantId: string, dto: CreateSchoolStaffDto) {
    await this.assertSecondarySisTenant(tenantId);
    try {
      return await this.prisma.schoolStaff.create({
        data: {
          tenantId,
          employeeCode: dto.employeeCode.trim().toUpperCase(),
          fullName: dto.fullName.trim(),
          staffType: dto.staffType ?? 'TEACHING',
          designation: dto.designation?.trim() || null,
          department: dto.department?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          extrasJson: {},
        },
      });
    } catch {
      throw new ConflictException('Employee code already exists');
    }
  }

  async enroll(tenantId: string, dto: EnrollStudentDto) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const [student, section] = await Promise.all([
      this.prisma.schoolStudent.findFirst({
        where: { id: dto.studentId, tenantId, deletedAt: null },
      }),
      this.prisma.schoolSection.findFirst({
        where: {
          id: dto.sectionId,
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
        },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!section) throw new NotFoundException('Section not found');
    return this.prisma.schoolEnrollment.upsert({
      where: {
        tenantId_studentId_academicYearId: {
          tenantId,
          studentId: student.id,
          academicYearId: year.id,
        },
      },
      update: {
        sectionId: section.id,
        rollNumber: dto.rollNumber?.trim() || null,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        tenantId,
        studentId: student.id,
        academicYearId: year.id,
        sectionId: section.id,
        rollNumber: dto.rollNumber?.trim() || null,
        source: 'OFFICE',
      },
    });
  }

  async listAllocations(tenantId: string) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const [classTeachers, subjectTeachers] = await Promise.all([
      this.prisma.schoolClassTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: { staff: true, section: { include: { grade: true } } },
      }),
      this.prisma.schoolSubjectTeacherAssignment.findMany({
        where: { tenantId, academicYearId: year.id, deletedAt: null },
        include: {
          staff: true,
          subject: true,
          section: { include: { grade: true } },
        },
      }),
    ]);
    return { academicYear: year, classTeachers, subjectTeachers };
  }

  async assignClassTeacher(tenantId: string, dto: AssignClassTeacherDto) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const [section, staff] = await Promise.all([
      this.prisma.schoolSection.findFirst({
        where: {
          id: dto.sectionId,
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
        },
      }),
      this.prisma.schoolStaff.findFirst({
        where: { id: dto.staffId, tenantId, deletedAt: null },
      }),
    ]);
    if (!section) throw new NotFoundException('Section not found');
    if (!staff) throw new NotFoundException('Staff not found');
    return this.prisma.schoolClassTeacherAssignment.upsert({
      where: {
        tenantId_academicYearId_sectionId_role: {
          tenantId,
          academicYearId: year.id,
          sectionId: section.id,
          role: 'PRIMARY',
        },
      },
      update: { staffId: staff.id, deletedAt: null },
      create: {
        tenantId,
        academicYearId: year.id,
        sectionId: section.id,
        staffId: staff.id,
        role: 'PRIMARY',
      },
    });
  }

  async assignSubjectTeacher(tenantId: string, dto: AssignSubjectTeacherDto) {
    await this.assertSecondarySisTenant(tenantId);
    const year = await this.currentYear(tenantId);
    const [section, subject, staff] = await Promise.all([
      this.prisma.schoolSection.findFirst({
        where: {
          id: dto.sectionId,
          tenantId,
          academicYearId: year.id,
          deletedAt: null,
        },
      }),
      this.prisma.schoolSubject.findFirst({
        where: { id: dto.subjectId, tenantId, deletedAt: null },
      }),
      this.prisma.schoolStaff.findFirst({
        where: { id: dto.staffId, tenantId, deletedAt: null },
      }),
    ]);
    if (!section) throw new NotFoundException('Section not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (!staff) throw new NotFoundException('Staff not found');
    return this.prisma.schoolSubjectTeacherAssignment.upsert({
      where: {
        tenantId_academicYearId_sectionId_subjectId: {
          tenantId,
          academicYearId: year.id,
          sectionId: section.id,
          subjectId: subject.id,
        },
      },
      update: {
        staffId: staff.id,
        periodsPerWeek: dto.periodsPerWeek ?? 0,
        deletedAt: null,
      },
      create: {
        tenantId,
        academicYearId: year.id,
        sectionId: section.id,
        subjectId: subject.id,
        staffId: staff.id,
        periodsPerWeek: dto.periodsPerWeek ?? 0,
      },
    });
  }

  async saveStaffPhoto(
    tenantId: string,
    staffId: string,
    file: Express.Multer.File,
  ) {
    this.assertStaffUpload(file, STAFF_IMAGE_MIME);
    await this.getStaff(tenantId, staffId);
    const stored = await this.writeStaffFile(tenantId, staffId, 'photos', file);
    await this.prisma.schoolStaff.update({
      where: { id: staffId },
      data: { photoUrl: stored.publicPath },
    });
    return { url: stored.publicPath };
  }

  async removeStaffPhoto(tenantId: string, staffId: string) {
    await this.getStaff(tenantId, staffId);
    await this.prisma.schoolStaff.update({
      where: { id: staffId },
      data: { photoUrl: null },
    });
    return { ok: true };
  }

  async saveStaffDocument(
    tenantId: string,
    staffId: string,
    slot: string,
    file: Express.Multer.File,
  ) {
    this.assertStaffUpload(file, STAFF_DOC_MIME);
    const staff = await this.getStaff(tenantId, staffId);
    const stored = await this.writeStaffFile(
      tenantId,
      staffId,
      'documents',
      file,
    );
    const extras =
      staff.extrasJson &&
      typeof staff.extrasJson === 'object' &&
      !Array.isArray(staff.extrasJson)
        ? { ...(staff.extrasJson as Record<string, unknown>) }
        : {};
    const documents =
      extras.documents &&
      typeof extras.documents === 'object' &&
      !Array.isArray(extras.documents)
        ? { ...(extras.documents as Record<string, unknown>) }
        : {};
    const key =
      slot.trim().toUpperCase() === 'JOINING_LETTER'
        ? 'joiningLetter'
        : 'resume';
    documents[key] = { fileName: stored.fileName, url: stored.publicPath };
    extras.documents = documents;
    await this.prisma.schoolStaff.update({
      where: { id: staffId },
      data: { extrasJson: extras as Prisma.InputJsonValue },
    });
    return documents[key];
  }

  private assertStaffUpload(
    file: Express.Multer.File | undefined,
    allowed: Set<string>,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('File is required');
    if (file.size > 4 * 1024 * 1024)
      throw new BadRequestException('File must be 4MB or smaller');
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private async writeStaffFile(
    tenantId: string,
    staffId: string,
    folder: string,
    file: Express.Multer.File,
  ) {
    const ext =
      extname(file.originalname || '').toLowerCase() ||
      (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf'].includes(
      ext,
    )
      ? ext
      : '.bin';
    const filename = `${randomUUID()}${safeExt}`;
    const dir = join(
      resolveTenantUploadRoot(),
      tenantId,
      'school-sis',
      'staff',
      staffId,
      folder,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);
    return {
      fileName: file.originalname || filename,
      mimeType: file.mimetype,
      publicPath: `/uploads/tenants/${tenantId}/school-sis/staff/${staffId}/${folder}/${filename}`,
    };
  }
}
