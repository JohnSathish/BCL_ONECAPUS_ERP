import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { DataScopeService } from '../../common/permissions/data-scope.service';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { PrismaService } from '../../database/prisma.service';
import { AcademicEngineService } from '../academic-engine/academic-engine.service';
import { OrganizationService } from '../organization/organization.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import {
  AdmitStudentDto,
  CreateShiftTransferDto,
  CreateStudentDto,
  EnrollFromApplicationDto,
  UpdateStudentDto,
} from './dto/students.dto';
import type {
  AdmitFullStudentDto,
  AdmitWithRegistrationDto,
} from './dto/students.dto';
import { StudentDirectoryEnrichmentService } from './services/student-directory-enrichment.service';
import { StudentDisplaySettingsService } from '../administration/services/student-display-settings.service';
import { StudentProfileService } from './services/student-profile.service';
import { StudentSemesterResolverService } from './services/student-semester-resolver.service';
import { StudentProfileSectionsService } from './services/student-profile-sections.service';
import { AdminRegistrationService } from '../academic-engine/services/admin-registration.service';
import { AdmissionPoolsService } from '../academic-engine/services/admission-pools.service';
import { SubjectRegistrationEngineService } from '../academic-engine/services/subject-registration-engine.service';
import { MajorMinorEligibilityService } from '../academic-engine/services/major-minor-eligibility.service';
import { UserProvisioningService } from '../administration/services/user-provisioning.service';
import { RollNumberService } from './services/roll-number.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';
import { LicenseEnforcementService } from '../licensing/services/license-enforcement.service';
import { FeeCycleEngineService } from '../fees/services/fee-cycle-engine.service';
import { createWorkbookWithSheets } from '../../common/import/excel.util';
import { StudentAbcService } from './services/student-abc.service';

const directoryInclude = {
  user: { select: { id: true, email: true, isActive: true } },
  masterProfile: true,
  programVersion: {
    include: {
      program: { select: { id: true, code: true, name: true, level: true } },
    },
  },
  primaryShift: { select: { id: true, code: true, name: true } },
  academicProfile: {
    include: {
      stream: { select: { id: true, code: true, name: true } },
      admissionBatch: {
        include: { entrySession: { select: { id: true, name: true } } },
      },
    },
  },
  academicStanding: true,
  programChoices: {
    where: { choiceType: 'MAJOR', deletedAt: null, status: 'active' },
    take: 1,
    select: { subjectSlug: true },
  },
  semesterRegistrations: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { status: true, semesterSequence: true },
  },
  abcAccount: {
    select: {
      abcId: true,
      status: true,
      abcVerified: true,
      verificationStatus: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.StudentInclude;

const studentInclude = {
  ...directoryInclude,
  _count: {
    select: {
      semesterRegistrations: { where: { status: 'completed' } },
    },
  },
} satisfies Prisma.StudentInclude;

export type StudentListQuery = PaginationQueryDto & {
  programVersionId?: string;
  shiftId?: string;
  sessionId?: string;
  batchId?: string;
  semester?: string;
  streamId?: string;
  departmentId?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  differentlyAbled?: string;
  studentStatus?: string;
  admissionType?: string;
  admissionStatus?: string;
  academicStatus?: string;
  gender?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  ids?: string[];
  feeDue?: string;
  hostel?: string;
  attendanceShortage?: string;
  subjectPending?: string;
  rfidAssigned?: string;
  noPhoto?: string;
  noMobile?: string;
  recentlyAdded?: string;
  abcStatus?: string;
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicEngine: AcademicEngineService,
    private readonly shiftScope: ShiftScopeService,
    private readonly dataScope: DataScopeService,
    private readonly profileService: StudentProfileService,
    private readonly semesterResolver: StudentSemesterResolverService,
    private readonly sectionsService: StudentProfileSectionsService,
    private readonly adminRegistration: AdminRegistrationService,
    private readonly admissionPools: AdmissionPoolsService,
    private readonly registrationEngine: SubjectRegistrationEngineService,
    private readonly eligibility: MajorMinorEligibilityService,
    private readonly provisioning: UserProvisioningService,
    private readonly organization: OrganizationService,
    private readonly rollNumbers: RollNumberService,
    private readonly communication: CommunicationTriggerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly directoryEnrichment: StudentDirectoryEnrichmentService,
    private readonly displaySettings: StudentDisplaySettingsService,
    private readonly feeCycleEngine: FeeCycleEngineService,
    private readonly abcService: StudentAbcService,
  ) {}

  async getSummary(tenantId: string) {
    const [total, activeUsers, withProgram, registrations] =
      await this.prisma.$transaction([
        this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.student.count({
          where: { tenantId, deletedAt: null, user: { isActive: true } },
        }),
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null,
            programVersionId: { not: null },
          },
        }),
        this.prisma.semesterRegistration.count({
          where: { tenantId, status: 'completed' },
        }),
      ]);

    const [allottedApps, enrolledStudents] = await Promise.all([
      this.prisma.admissionApplication.findMany({
        where: { tenantId, deletedAt: null, status: 'allotted' },
        select: { email: true },
      }),
      this.prisma.student.findMany({
        where: { tenantId, deletedAt: null },
        select: { user: { select: { email: true } } },
      }),
    ]);
    const enrolledEmails = new Set(enrolledStudents.map((s) => s.user.email));
    const pendingEnrollment = allottedApps.filter(
      (a) => !enrolledEmails.has(a.email),
    ).length;

    return {
      total,
      activeUsers,
      withProgram,
      registrations,
      pendingEnrollment,
    };
  }

  async getEnhancedSummary(tenantId: string) {
    const base = await this.getSummary(tenantId);
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        primaryShift: { select: { name: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        department: { select: { name: true } },
        academicProfile: {
          include: { stream: { select: { name: true } } },
        },
        academicStanding: { select: { currentSemesterSequence: true } },
        masterProfile: {
          select: {
            gender: true,
            photoPath: true,
            mobileNumber: true,
            studentStatus: true,
          },
        },
        semesterRegistrations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, semesterSequence: true },
        },
      },
    });

    const bySemester: Record<string, number> = {};
    const byShift: Record<string, number> = {};
    const byStream: Record<string, number> = {};
    const byGender: Record<string, number> = {};
    const byProgramme: Record<string, number> = {};
    let rfidAssigned = 0;
    let subjectRegistrationPending = 0;
    let noPhoto = 0;
    let noMobile = 0;
    let newThisYear = 0;
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    for (const s of students) {
      const sem = String(s.academicStanding?.currentSemesterSequence ?? 1);
      bySemester[sem] = (bySemester[sem] ?? 0) + 1;
      const shift = s.primaryShift?.name ?? 'Unassigned';
      byShift[shift] = (byShift[shift] ?? 0) + 1;
      const stream = s.academicProfile?.stream?.name ?? 'Unassigned';
      byStream[stream] = (byStream[stream] ?? 0) + 1;
      const genderKey = this.normalizeGender(s.masterProfile?.gender);
      byGender[genderKey] = (byGender[genderKey] ?? 0) + 1;
      const programme =
        s.programVersion?.program?.name ?? s.department?.name ?? 'Unassigned';
      byProgramme[programme] = (byProgramme[programme] ?? 0) + 1;
      if (s.rfidNumber) rfidAssigned += 1;
      if (!s.masterProfile?.photoPath) noPhoto += 1;
      if (!s.masterProfile?.mobileNumber) noMobile += 1;
      if (s.admissionDate && s.admissionDate >= yearStart) newThisYear += 1;
      const latestReg = s.semesterRegistrations?.[0];
      const currentSem = s.academicStanding?.currentSemesterSequence ?? 1;
      if (
        !latestReg ||
        latestReg.semesterSequence !== currentSem ||
        latestReg.status !== 'completed'
      ) {
        subjectRegistrationPending += 1;
      }
    }

    const topProgrammes = Object.entries(byProgramme)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .reduce<Record<string, number>>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    const operational =
      await this.directoryEnrichment.tenantOperationalCounts(tenantId);

    return {
      ...base,
      bySemester,
      byShift,
      byStream,
      byGender,
      byProgramme: topProgrammes,
      rfidAssigned,
      subjectRegistrationPending,
      noPhoto,
      noMobile,
      newThisYear,
      feeDefaulters: operational.feeDefaulters,
      hostelResidents: operational.hostelResidents,
      attendanceShortage: operational.attendanceShortage,
    };
  }

  private normalizeGender(gender?: string | null): string {
    if (!gender?.trim()) return 'Unknown';
    const g = gender.trim().toUpperCase();
    if (g.startsWith('M')) return 'Male';
    if (g.startsWith('F')) return 'Female';
    if (g === 'OTHER' || g === 'O') return 'Other';
    return gender.trim();
  }

  async getStudentHealth(user: JwtUser, studentId: string) {
    const tenantId = user.tid;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: directoryInclude,
    });
    if (!student) throw new NotFoundException('Student not found');

    const resolved = await this.semesterResolver.resolveForStudent(
      tenantId,
      studentId,
    );
    const academicStatus = this.semesterResolver.mapAcademicStatus(
      student.academicStanding,
    );
    const directoryRow = this.profileService.toDirectoryRow(
      student,
      resolved,
      academicStatus,
    );

    return this.directoryEnrichment.getStudentHealth(tenantId, studentId, {
      registrationStatus: directoryRow.registrationStatus,
      rfidNumber: directoryRow.rfidNumber,
      mobileNumber: directoryRow.mobileNumber,
      photoPath: directoryRow.photoPath,
      rollNumber: directoryRow.rollNumber,
    });
  }

  async list(user: JwtUser, query: StudentListQuery) {
    const tenantId = user.tid;
    const scope = this.shiftScope.resolveScope(user, query.shiftId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    let where: Prisma.StudentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
      ...(query.programVersionId
        ? { programVersionId: query.programVersionId }
        : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.streamId
        ? { academicProfile: { streamId: query.streamId } }
        : {}),
      ...(query.batchId
        ? { academicProfile: { admissionBatchId: query.batchId } }
        : {}),
      ...(query.sessionId
        ? {
            academicProfile: {
              admissionBatch: { entrySessionId: query.sessionId },
            },
          }
        : {}),
      ...(query.semester
        ? {
            academicStanding: {
              currentSemesterSequence: Number.parseInt(query.semester, 10),
            },
          }
        : {}),
    };

    const masterProfileWhere: Prisma.StudentProfileWhereInput = {};
    if (query.admissionStatus) {
      masterProfileWhere.admissionStatus = query.admissionStatus;
    }
    if (query.categoryLookupId) {
      masterProfileWhere.categoryLookupId = query.categoryLookupId;
    }
    if (query.studentStatus) {
      masterProfileWhere.studentStatus = query.studentStatus;
    }
    if (query.admissionType) {
      masterProfileWhere.admissionType = query.admissionType;
    }
    if (query.gender) {
      masterProfileWhere.gender = query.gender;
    }
    if (query.religionLookupId) {
      masterProfileWhere.religionLookupId = query.religionLookupId;
    }
    if (query.differentlyAbled === 'true') {
      masterProfileWhere.differentlyAbled = true;
    } else if (query.differentlyAbled === 'false') {
      masterProfileWhere.differentlyAbled = false;
    }
    if (query.noPhoto === 'true') {
      masterProfileWhere.OR = [{ photoPath: null }, { photoPath: '' }];
    }
    if (query.noMobile === 'true') {
      masterProfileWhere.AND = [
        ...(Array.isArray(masterProfileWhere.AND)
          ? masterProfileWhere.AND
          : masterProfileWhere.AND
            ? [masterProfileWhere.AND]
            : []),
        { OR: [{ mobileNumber: null }, { mobileNumber: '' }] },
      ];
    }
    if (Object.keys(masterProfileWhere).length > 0) {
      where = { ...where, masterProfile: masterProfileWhere };
    }

    if (query.rfidAssigned === 'true') {
      where = {
        ...where,
        AND: [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          { rfidNumber: { not: null } },
          { NOT: { rfidNumber: '' } },
        ],
      };
    } else if (query.rfidAssigned === 'false') {
      where = {
        ...where,
        AND: [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          { OR: [{ rfidNumber: null }, { rfidNumber: '' }] },
        ],
      };
    }

    if (query.recentlyAdded === 'true') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      where = { ...where, admissionDate: { gte: cutoff } };
    }

    if (query.majorSubjectSlug || query.minorSubjectSlug) {
      const choiceFilters: Prisma.StudentProgramChoiceWhereInput[] = [];
      if (query.majorSubjectSlug) {
        choiceFilters.push({
          choiceType: 'MAJOR',
          subjectSlug: query.majorSubjectSlug,
        });
      }
      if (query.minorSubjectSlug) {
        choiceFilters.push({
          choiceType: 'MINOR',
          subjectSlug: query.minorSubjectSlug,
        });
      }
      where = {
        ...where,
        AND: [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          ...choiceFilters.map((c) => ({ programChoices: { some: c } })),
        ],
      };
    }

    if (query.search) {
      where = {
        ...where,
        OR: [
          {
            enrollmentNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          { rollNumber: { contains: query.search, mode: 'insensitive' } },
          {
            user: {
              email: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            masterProfile: {
              fullName: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            masterProfile: {
              mobileNumber: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            masterProfile: {
              nationalId: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            applicationNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            admissionNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            rfidNumber: { contains: query.search, mode: 'insensitive' },
          },
          {
            abcAccount: {
              abcId: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            programVersion: {
              program: {
                name: { contains: query.search, mode: 'insensitive' },
              },
            },
          },
        ],
      };
    }

    if (query.academicStatus) {
      where = {
        ...where,
        ...this.academicStatusWhere(query.academicStatus),
      };
    }

    if (query.abcStatus === 'available') {
      where = {
        ...where,
        abcAccount: { abcId: { not: null } },
      };
    } else if (query.abcStatus === 'missing') {
      where = {
        ...where,
        OR: [{ abcAccount: null }, { abcAccount: { abcId: null } }],
      };
    }

    where = this.shiftScope.applyPrimaryShiftWhere(where, scope);
    where = this.dataScope.applyStudentListScope(where, user);

    const operationalIds =
      await this.directoryEnrichment.studentIdsMatchingFilters(tenantId, {
        feeDue: query.feeDue,
        hostel: query.hostel,
        attendanceShortage: query.attendanceShortage,
        subjectPending: query.subjectPending,
      });
    if (operationalIds) {
      where = {
        ...where,
        id: operationalIds.length
          ? { in: operationalIds }
          : { in: ['00000000-0000-0000-0000-000000000000'] },
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: directoryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const resolvedByStudent = await this.semesterResolver.resolveForStudents(
      tenantId,
      rows.map((student) => student.id),
    );
    const defaultResolved = {
      semester: 1,
      batchSemester: null,
      cycle: null,
      calendarSemesterId: null,
    };
    const data = rows.map((student) => {
      const resolved = resolvedByStudent.get(student.id) ?? defaultResolved;
      const academicStatus = this.semesterResolver.mapAcademicStatus(
        student.academicStanding,
      );
      return this.profileService.toDirectoryRow(
        student,
        resolved,
        academicStatus,
      );
    });

    const enrichment = await this.directoryEnrichment.loadForStudents(
      tenantId,
      data.map((row) => row.id),
    );

    const nameFormat = await this.displaySettings.getFormat(tenantId);

    const enrichedData = data.map((row) => ({
      ...row,
      ...(enrichment.get(row.id) ?? this.directoryEnrichment.emptySnapshot()),
      displayFullName: this.displaySettings.formatName(
        row.fullName,
        nameFormat,
      ),
    }));

    return paginate(enrichedData, total, page, limit);
  }

  async exportCsv(user: JwtUser, query: StudentListQuery) {
    const result = await this.list(user, { ...query, page: 1, limit: 10_000 });
    const header = [
      'ID',
      'Application',
      'Admission',
      'Registration',
      'Roll',
      'ABC ID',
      'Name',
      'Email',
      'Mobile',
      'Programme',
      'Semester',
      'Stream',
      'Shift',
      'Batch',
      'Admission Status',
      'Academic Status',
    ];
    const lines = [header.join(',')];
    for (const row of result.data) {
      lines.push(
        [
          row.id,
          row.applicationNumber ?? '',
          row.admissionNumber ?? '',
          row.enrollmentNumber,
          row.rollNumber ?? '',
          (row as { abcId?: string | null }).abcId ?? '',
          `"${((row as { displayFullName?: string }).displayFullName ?? row.fullName ?? '').replace(/"/g, '""')}"`,
          row.email,
          row.mobileNumber ?? '',
          row.programme ?? '',
          row.semester,
          row.stream ?? '',
          row.shift ?? '',
          row.batch ?? '',
          row.admissionStatus,
          row.academicStatus,
        ].join(','),
      );
    }
    const truncated = result.meta.total > 10_000;
    return {
      csv: lines.join('\n'),
      rowCount: result.data.length,
      total: result.meta.total,
      truncated,
    };
  }

  async exportProfileXlsx(user: JwtUser, query: StudentListQuery) {
    const result = await this.list(user, { ...query, page: 1, limit: 10_000 });
    const buffer = await createWorkbookWithSheets([
      {
        name: 'Profiles',
        headers: [
          'Application',
          'Admission',
          'Registration',
          'Roll',
          'Name',
          'Email',
          'Mobile',
          'Programme',
          'Semester',
          'Stream',
          'Shift',
          'Batch',
          'Admission Status',
          'Academic Status',
        ],
        rows: result.data.map((row) => [
          row.applicationNumber ?? '',
          row.admissionNumber ?? '',
          row.enrollmentNumber,
          row.rollNumber ?? '',
          row.fullName,
          row.email,
          row.mobileNumber ?? '',
          row.programme ?? '',
          row.semester,
          row.stream ?? '',
          row.shift ?? '',
          row.batch ?? '',
          row.admissionStatus,
          row.academicStatus,
        ]),
      },
    ]);
    return {
      buffer,
      rowCount: result.data.length,
      total: result.meta.total,
      truncated: result.meta.total > 10_000,
    };
  }

  async exportSubjectAllocationsXlsx(user: JwtUser, query: StudentListQuery) {
    const tenantId = user.tid;
    const scope = this.shiftScope.resolveScope(user);
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        registration: {
          student: {
            deletedAt: null,
            tenantId,
            ...(query.programVersionId
              ? { programVersionId: query.programVersionId }
              : {}),
            ...(query.batchId || query.streamId
              ? {
                  academicProfile: {
                    ...(query.batchId
                      ? { admissionBatchId: query.batchId }
                      : {}),
                    ...(query.streamId ? { streamId: query.streamId } : {}),
                  },
                }
              : {}),
            ...(query.semester
              ? {
                  academicStanding: {
                    currentSemesterSequence: Number.parseInt(
                      query.semester,
                      10,
                    ),
                  },
                }
              : {}),
          },
        },
      },
      include: {
        registration: {
          include: {
            student: {
              include: {
                masterProfile: { select: { fullName: true } },
                academicProfile: {
                  include: { admissionBatch: { select: { batchCode: true } } },
                },
              },
            },
            semester: { select: { semesterNumber: true } },
          },
        },
        offering: {
          include: { course: { select: { code: true, title: true } } },
        },
        offeringSection: { select: { sectionCode: true } },
      },
      orderBy: [
        { registration: { student: { enrollmentNumber: 'asc' } } },
        { registration: { semester: { semesterNumber: 'asc' } } },
        { category: 'asc' },
      ],
      take: 50_000,
    });

    const filtered = lines.filter((line) => {
      const student = line.registration.student;
      if (
        !scope.allShifts &&
        student.primaryShiftId &&
        !scope.shiftIds.includes(student.primaryShiftId) &&
        scope.activeShiftId !== student.primaryShiftId
      ) {
        return false;
      }
      if (query.shiftId && student.primaryShiftId !== query.shiftId)
        return false;
      return true;
    });

    const buffer = await createWorkbookWithSheets([
      {
        name: 'Subject Allocations',
        headers: [
          'Registration',
          'Name',
          'Batch',
          'Semester',
          'Category',
          'Course Code',
          'Course Title',
          'Section',
          'Status',
          'Assignment Source',
        ],
        rows: filtered.map((line) => [
          line.registration.student.enrollmentNumber,
          line.registration.student.masterProfile?.fullName ?? '',
          line.registration.student.academicProfile?.admissionBatch
            ?.batchCode ?? '',
          line.registration.semester.semesterNumber,
          line.category,
          line.offering.course.code,
          line.offering.course.title,
          line.offeringSection?.sectionCode ?? '',
          line.status,
          line.assignmentSource ?? '',
        ]),
      },
    ]);

    return {
      buffer,
      rowCount: filtered.length,
      truncated: lines.length >= 50_000,
    };
  }

  async getOne(user: JwtUser, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
      include: {
        ...studentInclude,
        registrations: {
          where: { deletedAt: null },
          include: {
            offering: {
              include: { course: true, semester: true },
            },
          },
        },
        abcAccount: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const scope = this.shiftScope.resolveScope(user);
    if (
      !scope.allShifts &&
      student.primaryShiftId &&
      !scope.shiftIds.includes(student.primaryShiftId) &&
      scope.activeShiftId !== student.primaryShiftId
    ) {
      throw new ForbiddenException('Shift access denied');
    }
    return student;
  }

  async admit(tenantId: string, dto: AdmitStudentDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      tenantId,
      'student.create',
    );
    if (!dto.streamId) {
      throw new BadRequestException('Stream is mandatory for admission');
    }

    await this.assertProgramVersion(tenantId, dto.programVersionId);

    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: dto.admissionBatchId, tenantId, deletedAt: null },
      include: { entrySession: true },
    });
    if (!batch) throw new BadRequestException('Invalid admission batch');

    const shift = await this.prisma.shift.findFirst({
      where: {
        id: dto.primaryShiftId,
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!shift) throw new BadRequestException('Invalid shift');

    const departmentId = await this.resolveStudentDepartmentId(
      tenantId,
      dto.departmentId,
      dto.programVersionId,
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
      include: { student: true },
    });
    if (existingUser?.student && !existingUser.student.deletedAt) {
      throw new ConflictException(
        'A student record already exists for this email',
      );
    }
    if (existingUser?.student?.deletedAt) {
      await this.purgeAdmissionAttempt(tenantId, existingUser.student.id);
    }

    const enrollmentTaken = await this.prisma.student.findFirst({
      where: {
        tenantId,
        enrollmentNumber: dto.enrollmentNumber,
        deletedAt: null,
      },
    });
    if (enrollmentTaken) {
      throw new ConflictException('Registration number already in use');
    }

    if (dto.rollNumber?.trim()) {
      const institutionId = batch.entrySession?.institutionId;
      if (institutionId) {
        await this.rollNumbers.validateRollNumberUnique(
          tenantId,
          institutionId,
          dto.rollNumber.trim(),
        );
      } else {
        const rollTaken = await this.prisma.student.findFirst({
          where: {
            tenantId,
            rollNumber: dto.rollNumber.trim(),
            deletedAt: null,
          },
        });
        if (rollTaken)
          throw new ConflictException('Roll number already in use');
      }
    }

    if (dto.rfidNumber?.trim()) {
      const rfidTaken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          rfidNumber: dto.rfidNumber.trim(),
          deletedAt: null,
        },
      });
      if (rfidTaken) throw new ConflictException('RFID number already in use');
    }

    const { user: portalUser } = await this.provisioning.ensureUserWithRoles(
      tenantId,
      dto.email,
      ['student'],
      {
        password: dto.password ?? 'Student@123',
        userTypeForUsername: 'STUDENT',
        mustResetPassword: true,
        displayName: dto.fullName,
        phone: dto.mobileNumber,
        shiftId: dto.primaryShiftId,
        campusId: dto.campusId ?? shift.campusId,
      },
    );

    const student = await this.prisma.$transaction(async (tx) => {
      return tx.student.create({
        data: {
          tenantId,
          userId: portalUser.id,
          enrollmentNumber: dto.enrollmentNumber,
          applicationNumber: dto.applicationNumber?.trim() || undefined,
          admissionNumber: dto.admissionNumber?.trim() || undefined,
          rollNumber: dto.rollNumber,
          rfidNumber: dto.rfidNumber?.trim() || undefined,
          programVersionId: dto.programVersionId,
          primaryShiftId: dto.primaryShiftId,
          campusId: dto.campusId ?? shift.campusId,
          departmentId,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : new Date(),
        },
      });
    });

    await this.profileService.createMasterProfile(tenantId, student.id, {
      fullName: dto.fullName,
      email: dto.email,
      gender: dto.gender,
      maritalStatus: dto.maritalStatus,
      dateOfBirth: dto.dateOfBirth,
      mobileNumber: dto.mobileNumber,
      nationalId: dto.nationalId,
      nationalityLookupId: dto.nationalityLookupId,
      bloodGroupLookupId: dto.bloodGroupLookupId,
      religionLookupId: dto.religionLookupId,
      categoryLookupId: dto.categoryLookupId,
      tribeLookupId: dto.tribeLookupId,
      denominationLookupId: dto.denominationLookupId,
      differentlyAbled: dto.differentlyAbled,
      ews: dto.ews,
      admissionType: dto.admissionType,
      address: dto.address,
      guardianName: dto.guardianName,
      guardianMobile: dto.guardianMobile,
    });

    await this.academicEngine.bootstrapStudentAcademic(tenantId, student.id, {
      streamId: dto.streamId,
      departmentId,
      admissionBatchId: dto.admissionBatchId,
      admissionYearId: batch.entrySessionId,
      institutionId: batch.entrySession?.institutionId ?? undefined,
      majorSubjectSlug: dto.majorSubjectSlug ?? 'computer-science',
      minorSubjectSlug: dto.minorSubjectSlug ?? 'mathematics',
    });

    await this.semesterResolver.syncStandingToBatch(
      tenantId,
      student.id,
      dto.admissionBatchId,
    );

    if (dto.abcId !== undefined) {
      await this.abcService.upsertForStudent(tenantId, student.id, dto.abcId);
    }

    if (dto.currentSemester != null && dto.currentSemester >= 1) {
      await this.prisma.studentAcademicStanding.update({
        where: { studentId: student.id },
        data: { currentSemesterSequence: dto.currentSemester },
      });
    }

    return this.profileService.getFullProfile(tenantId, student.id);
  }

  async admitFull(tenantId: string, actorId: string, dto: AdmitFullStudentDto) {
    const { sections, ...admitDto } = dto;
    const profile = await this.admit(tenantId, admitDto);
    const studentId = profile.id;

    await this.prisma.student.update({
      where: { id: studentId },
      data: { admissionSource: 'MANUAL', createdById: actorId },
    });

    await this.saveAdmissionSections(tenantId, studentId, sections, actorId);

    return this.profileService.getFullProfile(tenantId, studentId);
  }

  async admitWithRegistration(
    tenantId: string,
    actorId: string,
    dto: AdmitWithRegistrationDto,
  ) {
    const {
      subjectSelections,
      registrationAction = 'NONE',
      generateRollNumber,
      semesterSequence: dtoSemesterSequence,
      sections,
      ...admitDto
    } = dto;

    const semesterSequence =
      dtoSemesterSequence ?? admitDto.currentSemester ?? 1;

    if (admitDto.majorSubjectSlug && admitDto.minorSubjectSlug) {
      await this.eligibility.assertValidMajorMinorPair(
        tenantId,
        admitDto.majorSubjectSlug,
        admitDto.minorSubjectSlug,
      );
    }

    if (
      subjectSelections &&
      Object.keys(subjectSelections).length > 0 &&
      registrationAction !== 'NONE'
    ) {
      const class12Subjects = this.extractClass12SubjectsFromSections(sections);
      const validation = await this.admissionPools.validateSubjectBasket(
        tenantId,
        {
          programVersionId: admitDto.programVersionId,
          semesterSequence,
          shiftId: admitDto.primaryShiftId,
          streamId: admitDto.streamId,
          majorSubjectSlug: admitDto.majorSubjectSlug,
          minorSubjectSlug: admitDto.minorSubjectSlug,
          class12Subjects,
          selections: subjectSelections,
        },
      );
      if (!validation.ok) {
        throw new BadRequestException({
          message: 'Subject basket validation failed',
          issues: validation.issues,
        });
      }
    }

    const profile = await this.admit(tenantId, admitDto);
    const studentId = profile.id;

    await this.prisma.student.update({
      where: { id: studentId },
      data: { admissionSource: 'MANUAL', createdById: actorId },
    });

    await this.applyRollNumberOnAdmit(tenantId, studentId, actorId, {
      streamId: admitDto.streamId,
      admissionBatchId: admitDto.admissionBatchId,
      manualRollNumber: admitDto.rollNumber?.trim(),
      generateRollNumber,
      rollNumberAutoGenerated: dto.rollNumberAutoGenerated,
    });

    try {
      if (
        registrationAction !== 'NONE' &&
        admitDto.programVersionId &&
        (admitDto.majorSubjectSlug ||
          (subjectSelections && Object.keys(subjectSelections).length > 0))
      ) {
        const semesterId = await this.resolveRegistrationSemesterId(
          tenantId,
          admitDto.admissionBatchId,
          semesterSequence,
        );
        if (!semesterId) {
          throw new BadRequestException(
            'No open calendar semester found for subject registration',
          );
        }

        let registration = await this.prisma.semesterRegistration.findFirst({
          where: { tenantId, studentId, semesterId },
        });
        if (!registration) {
          registration = await this.academicEngine.createRegistration(
            tenantId,
            studentId,
            {
              semesterId,
              semesterSequence,
            },
          );
        }

        await this.syncAdmissionLanguageEligibility(
          tenantId,
          studentId,
          subjectSelections ?? {},
        );

        const lines = await this.registrationEngine.buildAdmitRegistrationLines(
          {
            tenantId,
            studentId,
            programVersionId: admitDto.programVersionId,
            semesterSequence,
            shiftId: admitDto.primaryShiftId,
            streamId: admitDto.streamId,
            subjectSelections: subjectSelections ?? {},
            assignedById: actorId,
          },
        );

        await this.academicEngine.updateRegistrationLines(
          tenantId,
          registration.id,
          lines,
          {
            registrationSource: 'ADMIN_ASSIGNED',
            assignedById: actorId,
            generatedBy: 'AUTO_ENGINE',
          },
        );

        const postValidate = await this.academicEngine.validateRegistration(
          tenantId,
          registration.id,
        );
        if (!postValidate.ok) {
          const blocking = postValidate.issues.filter(
            (i: { severity?: string }) => i.severity !== 'warning',
          );
          throw new BadRequestException({
            message:
              'Registration validation failed — student was not admitted. Adjust subject selections and try again.',
            issues: blocking.length > 0 ? blocking : postValidate.issues,
          });
        }

        if (registrationAction === 'SUBMIT') {
          await this.academicEngine.submitRegistration(
            tenantId,
            registration.id,
            actorId,
          );
        }
      }

      await this.saveAdmissionSections(tenantId, studentId, sections, actorId);

      await this.academicEngine.syncStudentTracks(tenantId, studentId);

      return this.profileService.getFullProfile(tenantId, studentId);
    } catch (error) {
      await this.purgeAdmissionAttempt(tenantId, studentId);
      throw error;
    }
  }

  private extractClass12SubjectsFromSections(
    sections: Record<string, Record<string, unknown>> | undefined,
  ): { name: string; code?: string; marks?: number }[] | undefined {
    const raw = sections?.academic?.class12Subjects;
    if (!Array.isArray(raw)) return undefined;
    return raw
      .filter(
        (item): item is { name: string; code?: string; marks?: number } => {
          return (
            typeof item === 'object' &&
            item != null &&
            typeof (item as { name?: unknown }).name === 'string'
          );
        },
      )
      .map((item) => ({
        name: item.name,
        code: item.code,
        marks: item.marks,
      }));
  }

  private async saveAdmissionSections(
    tenantId: string,
    studentId: string,
    sections: Record<string, Record<string, unknown>> | undefined,
    actorId?: string,
  ) {
    if (!sections) return;
    for (const [sectionKey, payload] of Object.entries(sections)) {
      if (payload && Object.keys(payload).length > 0) {
        await this.sectionsService.updateSection(
          tenantId,
          studentId,
          sectionKey,
          payload,
          actorId,
        );
      }
    }
  }

  private async resolveRegistrationSemesterId(
    tenantId: string,
    admissionBatchId: string,
    semesterSequence: number,
  ): Promise<string | null> {
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: admissionBatchId, tenantId },
      include: { entrySession: true },
    });
    const institutionId = batch?.entrySession?.institutionId;
    if (!institutionId) return null;

    const semester = await this.prisma.semester.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        semesterNumber: semesterSequence,
        registrationOpen: true,
        isActive: true,
        academicYear: { institutionId, deletedAt: null },
      },
      orderBy: { startDate: 'desc' },
    });
    return semester?.id ?? null;
  }

  /** Remove a failed or abandoned admission attempt so the email/enrollment can be reused. */
  private async purgeAdmissionAttempt(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });
    if (!student) return;
    await this.prisma.student.delete({ where: { id: studentId } });
  }

  /** Extend student MIL/AEC eligibility from admin-selected pool courses during admission. */
  private async syncAdmissionLanguageEligibility(
    tenantId: string,
    studentId: string,
    selections: Record<string, string>,
  ) {
    const profile = await this.prisma.studentAcademicProfile.findUnique({
      where: { studentId },
    });
    const merged =
      await this.admissionPools.resolveAdmissionLanguageEligibility(
        tenantId,
        selections,
        profile?.languageEligibility as { allowedSlugs?: string[] } | null,
      );
    await this.prisma.studentAcademicProfile.update({
      where: { studentId },
      data: { languageEligibility: merged as Prisma.InputJsonValue },
    });
  }

  private async buildRegistrationLinesFromSelections(
    tenantId: string,
    selections: Record<string, string>,
  ) {
    const lines: {
      category: string;
      offeringId: string;
      offeringSectionId: string;
    }[] = [];

    for (const [slotKey, sectionId] of Object.entries(selections)) {
      if (!sectionId) continue;
      const category = slotKey.startsWith('MAJOR')
        ? 'MAJOR'
        : slotKey.split('-')[0]!;
      const section = await this.prisma.offeringSection.findFirst({
        where: { id: sectionId, tenantId, deletedAt: null },
        include: { courseOffering: true },
      });
      if (!section) continue;
      lines.push({
        category,
        offeringId: section.courseOfferingId,
        offeringSectionId: sectionId,
      });
    }
    return lines;
  }

  async previewRollNumber(
    tenantId: string,
    input: { streamId: string; admissionBatchId: string },
    actorId?: string,
  ) {
    const preview = await this.rollNumbers.previewNextRollNumber(
      tenantId,
      input,
    );
    const ctx = await this.rollNumbers.resolveContext(tenantId, input);
    await this.rollNumbers.writeAuditLog(tenantId, {
      action: 'PREVIEW',
      rollNumber: preview.rollNumber,
      institutionId: ctx.institutionId,
      manualOverride: false,
      createdById: actorId,
      metadata: preview as unknown as Record<string, unknown>,
    });
    return preview;
  }

  async generateRollNumber(
    tenantId: string,
    input: {
      streamId: string;
      admissionBatchId: string;
      preview?: boolean;
      studentId?: string;
    },
    actorId?: string,
  ) {
    if (input.preview !== false) {
      return this.previewRollNumber(tenantId, input, actorId);
    }

    const allocated = await this.rollNumbers.allocateNextRollNumber(
      tenantId,
      input,
    );
    if (input.studentId) {
      const ctx = await this.rollNumbers.resolveContext(tenantId, input);
      await this.rollNumbers.assignRollNumber(
        tenantId,
        input.studentId,
        allocated.rollNumber,
        {
          manualOverride: false,
          actorId,
          institutionId: ctx.institutionId,
          action: 'REGENERATE',
          metadata: allocated as unknown as Record<string, unknown>,
        },
      );
    }
    return allocated;
  }

  async bulkGenerateRollNumbers(
    tenantId: string,
    options: {
      dryRun?: boolean;
      institutionId?: string;
      admissionYear?: number;
    },
    actorId?: string,
  ) {
    return this.rollNumbers.bulkGenerateMissing(tenantId, {
      ...options,
      actorId,
    });
  }

  async syncRollNumberSequences(tenantId: string, institutionId?: string) {
    return this.rollNumbers.syncSequencesFromExistingRolls(
      tenantId,
      institutionId,
    );
  }

  async regenerateStudentRollNumber(
    tenantId: string,
    studentId: string,
    actorId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        academicProfile: {
          select: { streamId: true, admissionBatchId: true },
        },
      },
    });
    if (
      !student?.academicProfile?.streamId ||
      !student.academicProfile.admissionBatchId
    ) {
      throw new BadRequestException(
        'Student academic profile incomplete for roll regeneration',
      );
    }

    return this.generateRollNumber(
      tenantId,
      {
        streamId: student.academicProfile.streamId,
        admissionBatchId: student.academicProfile.admissionBatchId,
        preview: false,
        studentId,
      },
      actorId,
    );
  }

  private async applyRollNumberOnAdmit(
    tenantId: string,
    studentId: string,
    actorId: string,
    input: {
      streamId: string;
      admissionBatchId: string;
      manualRollNumber?: string;
      generateRollNumber?: boolean;
      rollNumberAutoGenerated?: boolean;
    },
  ) {
    const settings = await this.rollNumbers.getSettings(tenantId);
    const ctx = await this.rollNumbers.resolveContext(tenantId, {
      streamId: input.streamId,
      admissionBatchId: input.admissionBatchId,
    });

    if (input.manualRollNumber) {
      await this.rollNumbers.assignRollNumber(
        tenantId,
        studentId,
        input.manualRollNumber,
        {
          manualOverride: true,
          actorId,
          institutionId: ctx.institutionId,
          action: 'MANUAL_ASSIGN',
        },
      );
      return;
    }

    const shouldAuto =
      input.generateRollNumber === true ||
      (input.generateRollNumber !== false &&
        settings.autoGenerateOnAdmit &&
        input.rollNumberAutoGenerated !== false);

    if (!shouldAuto) return;

    const allocated = await this.rollNumbers.allocateNextRollNumber(tenantId, {
      streamId: input.streamId,
      admissionBatchId: input.admissionBatchId,
    });

    await this.rollNumbers.assignRollNumber(
      tenantId,
      studentId,
      allocated.rollNumber,
      {
        manualOverride: false,
        actorId,
        institutionId: ctx.institutionId,
        action: 'GENERATE',
        metadata: allocated as unknown as Record<string, unknown>,
      },
    );
  }

  async bulkAssignRfid(
    tenantId: string,
    actorId: string,
    assignments: Record<string, string>,
  ) {
    const results: { studentId: string; rfidNumber: string }[] = [];
    for (const [studentId, rfidNumber] of Object.entries(assignments)) {
      const trimmed = rfidNumber.trim();
      if (!trimmed) continue;
      const existing = await this.prisma.student.findFirst({
        where: {
          tenantId,
          rfidNumber: trimmed,
          deletedAt: null,
          NOT: { id: studentId },
        },
      });
      if (existing) {
        throw new ConflictException(`RFID ${trimmed} already assigned`);
      }
      await this.prisma.student.update({
        where: { id: studentId },
        data: { rfidNumber: trimmed, lastModifiedById: actorId },
      });
      results.push({ studentId, rfidNumber: trimmed });
    }
    return { updated: results.length, assignments: results };
  }

  async create(tenantId: string, dto: CreateStudentDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      tenantId,
      'student.create',
    );
    const existingUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
      include: { student: true },
    });
    if (existingUser?.student && !existingUser.student.deletedAt) {
      throw new ConflictException(
        'A student record already exists for this email',
      );
    }

    const enrollmentTaken = await this.prisma.student.findFirst({
      where: {
        tenantId,
        enrollmentNumber: dto.enrollmentNumber,
        deletedAt: null,
      },
    });
    if (enrollmentTaken) {
      throw new ConflictException('Enrollment number already in use');
    }

    if (dto.programVersionId) {
      await this.assertProgramVersion(tenantId, dto.programVersionId);
    }

    const passwordHash = await bcrypt.hash(dto.password ?? 'Student@123', 12);
    const studentRole = await this.prisma.role.findFirst({
      where: { tenantId, slug: 'student' },
    });

    return this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              isActive: true,
              deletedAt: null,
            },
          })
        : await tx.user.create({
            data: {
              tenantId,
              email: dto.email,
              passwordHash,
              emailVerifiedAt: new Date(),
              isActive: true,
            },
          });

      if (studentRole) {
        const hasRole = await tx.userRole.findFirst({
          where: { userId: user.id, roleId: studentRole.id, deletedAt: null },
        });
        if (!hasRole) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: studentRole.id },
          });
        }
      }

      return tx.student.create({
        data: {
          tenantId,
          userId: user.id,
          enrollmentNumber: dto.enrollmentNumber,
          programVersionId: dto.programVersionId,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : new Date(),
        },
        include: studentInclude,
      });
    });
  }

  async update(tenantId: string, id: string, dto: UpdateStudentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (
      dto.enrollmentNumber &&
      dto.enrollmentNumber !== student.enrollmentNumber
    ) {
      const taken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          enrollmentNumber: dto.enrollmentNumber,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (taken)
        throw new ConflictException('Enrollment number already in use');
    }

    if (dto.programVersionId) {
      await this.assertProgramVersion(tenantId, dto.programVersionId);
    }

    return this.prisma.student.update({
      where: { id },
      data: {
        enrollmentNumber: dto.enrollmentNumber,
        programVersionId: dto.programVersionId,
        admissionDate:
          dto.admissionDate === null
            ? null
            : dto.admissionDate
              ? new Date(dto.admissionDate)
              : undefined,
      },
      include: studentInclude,
    });
  }

  async remove(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async enrollFromApplication(
    user: JwtUser,
    applicationId: string,
    dto: EnrollFromApplicationDto,
  ) {
    const tenantId = user.tid;
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, tenantId, deletedAt: null },
      include: {
        intake: { include: { program: true, academicYear: true } },
        cycle: { include: { academicYear: true } },
        program: true,
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (application.status !== 'allotted') {
      throw new BadRequestException(
        'Only allotted applications can be enrolled as students',
      );
    }

    const existingStudent = await this.prisma.student.findFirst({
      where: { admissionApplicationId: applicationId, deletedAt: null },
    });
    if (existingStudent) {
      return this.getOne(user, existingStudent.id);
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: application.email },
      include: { student: true },
    });
    if (existingUser?.student && !existingUser.student.deletedAt) {
      throw new ConflictException(
        'Student already enrolled for this application email',
      );
    }

    const programId =
      application.programId ?? application.intake?.programId ?? null;
    if (!programId) {
      throw new BadRequestException(
        'Program could not be resolved from application',
      );
    }

    let programVersionId = dto.programVersionId;
    if (!programVersionId) {
      const version = await this.prisma.programVersion.findFirst({
        where: {
          tenantId,
          programId,
          status: 'PUBLISHED',
          deletedAt: null,
        },
      });
      if (!version) {
        throw new BadRequestException(
          'No program version found for this intake program',
        );
      }
      programVersionId = version.id;
    } else {
      await this.assertProgramVersion(tenantId, programVersionId);
    }

    const intakeCode =
      application.intake?.code ?? application.cycle?.code ?? 'ADM';
    const enrollmentNumber =
      dto.enrollmentNumber ??
      (await this.generateEnrollmentNumber(tenantId, intakeCode));

    const student = await this.create(tenantId, {
      email: application.email,
      enrollmentNumber,
      programVersionId,
      admissionDate: dto.admissionDate ?? new Date().toISOString().slice(0, 10),
    });

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        admissionApplicationId: applicationId,
        applicationNumber: application.applicationNumber,
        admissionSource: 'ONLINE_ADMISSION',
        createdById: user.sub,
      },
    });

    const formData = (application.formData as Record<string, unknown>) ?? {};
    const personal = (formData.personal as Record<string, string>) ?? {};
    const addresses = (formData.addresses as Record<string, string>) ?? {};
    const family = (formData.family as Record<string, unknown>) ?? {};
    const academic = (formData.academic as Record<string, unknown>) ?? {};
    const prefs = (formData.coursePreferences as Record<string, string>) ?? {};

    const categoryLookup = await this.prisma.masterLookup.findFirst({
      where: {
        tenantId,
        lookupType: 'CATEGORY',
        code: application.category,
        isActive: true,
      },
    });

    const fullName =
      personal.fullName ??
      `${application.firstName} ${application.lastName}`.trim();

    await this.profileService.createMasterProfile(tenantId, student.id, {
      fullName,
      mobileNumber: application.phone ?? personal.phone,
      categoryLookupId: categoryLookup?.id,
      admissionStatus: 'ACTIVE',
      dateOfBirth: personal.dateOfBirth,
      gender: personal.gender,
    });

    await this.prisma.studentProfile.update({
      where: { studentId: student.id },
      data: {
        email: application.email,
      },
    });

    await this.prisma.studentCuetDetail
      .create({
        data: {
          tenantId,
          studentId: student.id,
          cuetApplied: !!academic.cuetScore,
        },
      })
      .catch(() => undefined);

    const department = await this.prisma.department.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const majorSlug = (application.majorSubjectCode ?? prefs.majorCode ?? '')
      .toLowerCase()
      .replace(/_/g, '-');
    const minorSlug = (application.minorSubjectCode ?? prefs.minorCode ?? '')
      .toLowerCase()
      .replace(/_/g, '-');

    const academicYearId =
      application.cycle?.academicYearId ?? application.intake?.academicYearId;

    await this.academicEngine.bootstrapStudentAcademic(tenantId, student.id, {
      streamId: application.academicStreamId ?? undefined,
      admissionYearId: academicYearId ?? undefined,
      admissionBatchId: dto.admissionBatchId,
      institutionId:
        application.cycle?.academicYear?.institutionId ??
        application.intake?.academicYear?.institutionId,
      departmentId: department?.id ?? undefined,
      majorSubjectSlug: majorSlug || 'computer-science',
      minorSubjectSlug: minorSlug || 'mathematics',
    });

    const academicProfile = await this.prisma.studentAcademicProfile.findUnique(
      {
        where: { studentId: student.id },
      },
    );
    if (academicProfile?.admissionBatchId) {
      await this.semesterResolver.syncStandingToBatch(
        tenantId,
        student.id,
        academicProfile.admissionBatchId,
      );
    }

    const allocation = await this.prisma.seatAllocation.findFirst({
      where: {
        tenantId,
        applicationId,
        deletedAt: null,
        status: { not: 'withdrawn' },
      },
    });
    const shiftId = dto.primaryShiftId ?? allocation?.shiftId;
    if (shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { id: shiftId, tenantId, deletedAt: null },
      });
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          primaryShiftId: shiftId,
          ...(shift ? { campusId: shift.campusId } : {}),
        },
      });
      await this.prisma.studentAcademicProfile.update({
        where: { studentId: student.id },
        data: {
          preferredShiftId: shiftId,
          ...(application.academicStreamId
            ? { streamId: application.academicStreamId }
            : {}),
        },
      });
    }

    void this.notifyEnrolledFromApplication(tenantId, student, application);
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId: student.id },
      select: { currentSemesterSequence: true },
    });
    void this.feeCycleEngine.onStudentSemesterEntry(
      tenantId,
      student.id,
      standing?.currentSemesterSequence ?? 1,
      user.sub,
    );
    return this.getOne(user, student.id);
  }

  private async notifyEnrolledFromApplication(
    tenantId: string,
    student: { id: string; userId: string },
    application: {
      id: string;
      applicationNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      intake: { program: { name: string } } | null;
      program?: { name: string } | null;
    },
  ) {
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const programName =
      application.intake?.program.name ??
      application.program?.name ??
      'FYUP Programme';
    await this.communication.trigger({
      tenantId,
      templateCode: 'ADMISSION_CONFIRMATION',
      triggerKey: 'admission.enrolled',
      entityType: 'admission_application',
      entityId: application.id,
      recipient: {
        recipientType: 'STUDENT',
        userId: student.userId,
        studentId: student.id,
        displayName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
      },
      variables: {
        student_name: `${application.firstName} ${application.lastName}`.trim(),
        application_number: application.applicationNumber,
        program_name: programName,
        institution_name: institutionName,
      },
    });
  }

  async requestShiftTransfer(
    tenantId: string,
    studentId: string,
    dto: CreateShiftTransferDto,
    actorId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.primaryShiftId) {
      throw new BadRequestException('Student has no primary shift assigned');
    }
    if (student.primaryShiftId === dto.toShiftId) {
      throw new BadRequestException('Student is already on this shift');
    }

    const toShift = await this.prisma.shift.findFirst({
      where: { id: dto.toShiftId, tenantId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!toShift) throw new NotFoundException('Target shift not found');

    return this.prisma.studentShiftTransfer.create({
      data: {
        tenantId,
        studentId,
        fromShiftId: student.primaryShiftId,
        toShiftId: dto.toShiftId,
        reason: dto.reason,
        status: 'pending',
        approvedById: actorId,
      },
    });
  }

  async approveShiftTransfer(
    tenantId: string,
    transferId: string,
    actorId: string,
  ) {
    const transfer = await this.prisma.studentShiftTransfer.findFirst({
      where: { id: transferId, tenantId },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not pending');
    }

    await this.prisma.$transaction([
      this.prisma.studentShiftTransfer.update({
        where: { id: transferId },
        data: {
          status: 'approved',
          approvedById: actorId,
          approvedAt: new Date(),
        },
      }),
      this.prisma.student.update({
        where: { id: transfer.studentId },
        data: { primaryShiftId: transfer.toShiftId },
      }),
      this.prisma.studentAcademicProfile.updateMany({
        where: { studentId: transfer.studentId },
        data: { preferredShiftId: transfer.toShiftId },
      }),
    ]);

    return this.prisma.studentShiftTransfer.findFirst({
      where: { id: transferId },
    });
  }

  private academicStatusWhere(status: string): Prisma.StudentWhereInput {
    switch (status) {
      case 'Alumni':
        return {
          academicStanding: {
            OR: [{ programmeStatus: 'COMPLETED' }, { alumniEligible: true }],
          },
        };
      case 'Dropped':
        return { academicStanding: { lifecycleState: 'DETAINED' } };
      case 'Promoted':
        return {
          academicStanding: {
            lastPromotedAt: {
              gte: new Date(Date.now() - 180 * 86400000),
            },
          },
        };
      case 'Studying':
        return {
          academicStanding: {
            programmeStatus: 'IN_PROGRESS',
            lifecycleState: { not: 'DETAINED' },
            alumniEligible: false,
          },
        };
      default:
        return {};
    }
  }

  private async resolveStudentDepartmentId(
    tenantId: string,
    departmentId?: string,
    programVersionId?: string,
  ): Promise<string | undefined> {
    if (departmentId) {
      await this.organization.assertAcademicDepartment(tenantId, departmentId);
      return departmentId;
    }
    if (!programVersionId) return undefined;

    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
      include: {
        program: { select: { departmentId: true } },
      },
    });
    const linkedDepartmentId = version?.program?.departmentId ?? undefined;
    if (linkedDepartmentId) {
      await this.organization.assertAcademicDepartment(
        tenantId,
        linkedDepartmentId,
      );
      return linkedDepartmentId;
    }
    return undefined;
  }

  private async generateEnrollmentNumber(tenantId: string, intakeCode: string) {
    const prefix = intakeCode
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8);
    const count = await this.prisma.student.count({ where: { tenantId } });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertProgramVersion(
    tenantId: string,
    programVersionId: string,
  ) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: programVersionId, tenantId, deletedAt: null },
    });
    if (!version) throw new BadRequestException('Invalid program version');
  }

  getAbcCoverage(tenantId: string) {
    return this.abcService.getCoverage(tenantId);
  }

  bulkUploadAbcIds(
    tenantId: string,
    rows: Array<{ rollNumber: string; abcId: string }>,
  ) {
    return this.abcService.bulkUploadByRollNumber(tenantId, rows);
  }

  async buildAbcUploadTemplate() {
    return createWorkbookWithSheets([
      {
        name: 'ABC IDs',
        headers: ['Roll Number', 'ABC ID'],
        rows: [['BA26-001', 'ABC123456789']],
      },
    ]);
  }
}
