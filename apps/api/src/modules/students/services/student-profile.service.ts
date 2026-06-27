import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StudentSemesterResolverService } from './student-semester-resolver.service';
import { StudentProfileSectionsService } from './student-profile-sections.service';
import { StudentDirectoryEnrichmentService } from './student-directory-enrichment.service';
import { StudentDisplaySettingsService } from '../../administration/services/student-display-settings.service';
import type { UpdateStudentProfileDto } from '../dto/students.dto';

const profileInclude = {
  masterProfile: true,
  academicProfile: {
    include: {
      stream: true,
      admissionBatch: {
        include: { entrySession: true, semesterMapping: true },
      },
    },
  },
  academicStanding: true,
  programVersion: {
    include: { program: { select: { id: true, code: true, name: true } } },
  },
  primaryShift: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  documents: { orderBy: { createdAt: 'desc' as const } },
  user: { select: { id: true, email: true, isActive: true } },
  programChoices: true,
  addresses: true,
  guardians: true,
  boardExams: {
    include: { subjectMarks: { orderBy: { sortOrder: 'asc' as const } } },
  },
  cuetDetail: true,
  abcAccount: {
    select: {
      abcId: true,
      abcVerified: true,
      verificationStatus: true,
      lastSyncedAt: true,
      status: true,
    },
  },
  createdBy: { select: { id: true, email: true } },
  lastModifiedBy: { select: { id: true, email: true } },
};

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesterResolver: StudentSemesterResolverService,
    private readonly sections: StudentProfileSectionsService,
    private readonly directoryEnrichment: StudentDirectoryEnrichmentService,
    private readonly displaySettings: StudentDisplaySettingsService,
  ) {}

  async getFullProfile(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: profileInclude,
    });
    if (!student) throw new NotFoundException('Student not found');

    const resolved = await this.semesterResolver.resolveForStudent(
      tenantId,
      studentId,
    );
    const academicStatus = this.semesterResolver.mapAcademicStatus(
      student.academicStanding,
    );

    const semesterHistory = await this.prisma.studentSemesterProgress.findMany({
      where: { tenantId, studentId },
      orderBy: { semesterSequence: 'asc' },
    });

    const promotionEntries = await this.prisma.semesterPromotionEntry.findMany({
      where: { tenantId, studentId },
      include: { run: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const registrations = await this.prisma.semesterRegistration.findMany({
      where: { tenantId, studentId },
      include: {
        semester: true,
        lines: {
          include: {
            offering: {
              include: {
                course: true,
                programVersion: { select: { id: true, version: true } },
                categoryPool: { select: { id: true, poolName: true } },
              },
            },
            offeringSection: {
              include: {
                staffProfile: {
                  select: { id: true, fullName: true, employeeCode: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sectionEnrollments = registrations.flatMap((reg) =>
      reg.lines.map((l) => ({
        registrationId: reg.id,
        semesterSequence: reg.semesterSequence,
        semesterId: reg.semesterId,
        registrationStatus: reg.status,
        sectionCode: l.offeringSection?.sectionCode ?? null,
        courseCode: l.offering.course.code,
        courseTitle: l.offering.course.title,
        category: l.category,
        status: l.status,
        credits: Number(l.credits ?? l.offering.course.credits ?? 0),
        assignedById: l.assignedById,
        assignmentSource: l.assignmentSource,
        registrationSource: l.registrationSource,
        generatedBy: l.generatedBy,
        generatedAt: l.createdAt,
        curriculumMappingId: l.offeringId,
        mappingSource: l.offering.mappingSource,
        curriculumVersion: l.offering.programVersion?.version ?? null,
        facultyName: l.offeringSection?.staffProfile?.fullName ?? null,
        facultyId: l.offeringSection?.staffProfile?.id ?? null,
      })),
    );

    const completion = await this.sections.getCompletion(tenantId, studentId);

    const nepCategoryGroups = this.buildNepGroups(
      registrations,
      student.academicStanding?.currentSemesterSequence,
    );

    const programChoices = await this.enrichProgramChoices(
      tenantId,
      student.programChoices,
    );
    const majorChoice = programChoices.find((c) => c.choiceType === 'MAJOR');
    const minorChoice = programChoices.find((c) => c.choiceType === 'MINOR');
    const directoryRow = this.toDirectoryRow(student, resolved, academicStatus);

    const [operationalMap, feeSummary, attendanceSummary, bloodGroupLabel] =
      await Promise.all([
        this.directoryEnrichment.loadForStudents(tenantId, [studentId]),
        this.directoryEnrichment.loadFeeSummary(tenantId, studentId),
        this.directoryEnrichment.loadAttendanceSummary(tenantId, studentId),
        student.masterProfile?.bloodGroupLookupId
          ? this.prisma.masterLookup.findFirst({
              where: { tenantId, id: student.masterProfile.bloodGroupLookupId },
              select: { label: true },
            })
          : Promise.resolve(null),
      ]);
    const operational =
      operationalMap.get(studentId) ?? this.directoryEnrichment.emptySnapshot();
    const nameFormat = await this.displaySettings.getFormat(tenantId);

    return {
      ...directoryRow,
      ...operational,
      displayFullName: this.displaySettings.formatName(
        directoryRow.fullName,
        nameFormat,
      ),
      applicationNumber: student.applicationNumber,
      admissionNumber: student.admissionNumber,
      universityRollNumber: student.universityRollNumber,
      universityRegistrationNumber: student.universityRegistrationNumber,
      rfidNumber: student.rfidNumber,
      abcId: student.abcAccount?.abcId ?? null,
      importSource: student.importSource,
      admissionSource: student.admissionSource,
      photoPath: student.masterProfile?.photoPath,
      gender: student.masterProfile?.gender,
      dateOfBirth: student.masterProfile?.dateOfBirth,
      nationalId: student.masterProfile?.nationalId,
      maritalStatus: student.masterProfile?.maritalStatus,
      studentStatus: student.masterProfile?.studentStatus ?? 'STUDYING',
      email: student.masterProfile?.email ?? student.user.email,
      departmentId: student.departmentId ?? student.department?.id ?? null,
      departmentName: student.department?.name ?? null,
      bloodGroupLookupId: student.masterProfile?.bloodGroupLookupId,
      bloodGroup: bloodGroupLabel?.label ?? null,
      religionLookupId: student.masterProfile?.religionLookupId,
      categoryLookupId: student.masterProfile?.categoryLookupId,
      tribeLookupId: student.masterProfile?.tribeLookupId,
      denominationLookupId: student.masterProfile?.denominationLookupId,
      differentlyAbled: student.masterProfile?.differentlyAbled ?? false,
      ews: student.masterProfile?.ews ?? false,
      addresses: student.addresses,
      guardians: student.guardians,
      boardExam: student.boardExams[0] ?? null,
      cuetDetail: student.cuetDetail,
      programChoices,
      majorSubject: majorChoice?.subjectName ?? directoryRow.majorSubject,
      minorSubjectSlug: minorChoice?.subjectSlug ?? null,
      minorSubject: minorChoice?.subjectName ?? null,
      documents: student.documents,
      semesterHistory,
      promotionEntries,
      registrations,
      sectionEnrollments,
      nepCategoryGroups,
      completion,
      system: {
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
        createdBy: student.createdBy,
        lastModifiedBy: student.lastModifiedBy,
        loginEnabled: student.user.isActive,
      },
      attendanceSummary,
      feeSummary,
      examinationSummary: null,
    };
  }

  private buildNepGroups(
    registrations: {
      semesterSequence: number;
      lines: {
        category: string;
        offering: { course: { code: string; title: string } };
      }[];
    }[],
    currentSem?: number,
  ) {
    const current = registrations.find(
      (r) => r.semesterSequence === currentSem,
    );
    const groups: Record<string, { code: string; title: string }[]> = {
      MAJOR: [],
      MINOR: [],
      MDC: [],
      AEC: [],
      SEC: [],
      VAC: [],
      VTC: [],
    };
    for (const line of current?.lines ?? []) {
      const cat = line.category.toUpperCase();
      if (groups[cat]) {
        groups[cat].push({
          code: line.offering.course.code,
          title: line.offering.course.title,
        });
      }
    }
    return {
      major: groups.MAJOR,
      minor: groups.MINOR,
      mdc: groups.MDC,
      aec: groups.AEC,
      sec: groups.SEC,
      vac: groups.VAC,
      vtc: groups.VTC,
    };
  }

  toDirectoryRow(
    student: {
      id: string;
      enrollmentNumber: string;
      applicationNumber?: string | null;
      admissionNumber?: string | null;
      universityRollNumber?: string | null;
      rollNumber: string | null;
      rfidNumber?: string | null;
      admissionDate: Date | null;
      masterProfile: {
        fullName: string;
        mobileNumber: string | null;
        admissionStatus: string;
        photoPath?: string | null;
        studentStatus?: string;
      } | null;
      user: { email: string; isActive: boolean };
      programVersion: {
        program: { code: string; name: string };
      } | null;
      primaryShift: { code: string; name: string } | null;
      academicProfile: {
        stream: { code: string; name: string } | null;
        admissionBatch: {
          batchCode: string;
          admissionYear: number;
          entrySession: { name: string };
        } | null;
      } | null;
      programChoices?: { choiceType?: string; subjectSlug: string }[];
      semesterRegistrations?: { status: string; semesterSequence: number }[];
      abcAccount?: { abcId: string | null } | null;
    },
    resolved: { semester: number; cycle: string | null },
    academicStatus: string,
  ) {
    const majorSlug =
      student.programChoices?.find((c) => c.choiceType === 'MAJOR')
        ?.subjectSlug ?? student.programChoices?.[0]?.subjectSlug;
    const latestReg = student.semesterRegistrations?.[0];
    let registrationStatus: 'completed' | 'draft' | 'pending' | 'none' = 'none';
    if (latestReg) {
      if (latestReg.semesterSequence === resolved.semester) {
        registrationStatus =
          latestReg.status === 'completed'
            ? 'completed'
            : latestReg.status === 'draft'
              ? 'draft'
              : 'pending';
      } else {
        registrationStatus = 'pending';
      }
    }

    return {
      id: student.id,
      enrollmentNumber: student.enrollmentNumber,
      applicationNumber: student.applicationNumber ?? null,
      admissionNumber: student.admissionNumber ?? null,
      universityRollNumber: student.universityRollNumber ?? null,
      rollNumber: student.rollNumber,
      rfidNumber: student.rfidNumber ?? null,
      abcId: student.abcAccount?.abcId ?? null,
      fullName: student.masterProfile?.fullName ?? student.user.email,
      email: student.user.email,
      mobileNumber: student.masterProfile?.mobileNumber,
      programme: student.programVersion?.program.name,
      programmeCode: student.programVersion?.program.code,
      majorSubjectSlug: majorSlug ?? null,
      majorSubject: majorSlug
        ? majorSlug
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : null,
      semester: resolved.semester,
      cycle: resolved.cycle,
      stream: student.academicProfile?.stream?.name,
      streamCode: student.academicProfile?.stream?.code,
      shift: student.primaryShift?.name,
      shiftCode: student.primaryShift?.code,
      batch: student.academicProfile?.admissionBatch?.batchCode,
      admissionYear: student.academicProfile?.admissionBatch?.admissionYear,
      entrySession: student.academicProfile?.admissionBatch?.entrySession?.name,
      admissionStatus: student.masterProfile?.admissionStatus ?? 'ACTIVE',
      academicStatus,
      registrationStatus,
      isActive: student.user.isActive,
      admissionDate: student.admissionDate,
      photoPath: student.masterProfile?.photoPath ?? null,
      studentStatus: student.masterProfile?.studentStatus ?? 'STUDYING',
    };
  }

  async updateProfile(
    tenantId: string,
    studentId: string,
    dto: UpdateStudentProfileDto,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (dto.rollNumber && dto.rollNumber !== student.rollNumber) {
      const taken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          rollNumber: dto.rollNumber,
          deletedAt: null,
          NOT: { id: studentId },
        },
      });
      if (taken) throw new BadRequestException('Roll number already in use');
    }

    if (
      dto.enrollmentNumber &&
      dto.enrollmentNumber !== student.enrollmentNumber
    ) {
      const taken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          enrollmentNumber: dto.enrollmentNumber,
          deletedAt: null,
          NOT: { id: studentId },
        },
      });
      if (taken) {
        throw new BadRequestException('Registration number already in use');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: studentId },
        data: {
          ...(dto.enrollmentNumber !== undefined
            ? { enrollmentNumber: dto.enrollmentNumber }
            : {}),
          ...(dto.rollNumber !== undefined
            ? { rollNumber: dto.rollNumber }
            : {}),
          ...(dto.programVersionId !== undefined
            ? { programVersionId: dto.programVersionId }
            : {}),
          ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.primaryShiftId !== undefined
            ? { primaryShiftId: dto.primaryShiftId }
            : {}),
          ...(dto.admissionDate !== undefined
            ? {
                admissionDate: dto.admissionDate
                  ? new Date(dto.admissionDate)
                  : null,
              }
            : {}),
        },
      });

      if (dto.streamId || dto.admissionBatchId) {
        await tx.studentAcademicProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            streamId: dto.streamId,
            admissionBatchId: dto.admissionBatchId,
            class12Subjects: [],
          },
          update: {
            ...(dto.streamId !== undefined ? { streamId: dto.streamId } : {}),
            ...(dto.admissionBatchId !== undefined
              ? { admissionBatchId: dto.admissionBatchId }
              : {}),
          },
        });
      }

      if (dto.admissionBatchId) {
        const batch = await tx.admissionBatch.findFirst({
          where: { id: dto.admissionBatchId, tenantId },
        });
        if (batch) {
          await tx.studentAcademicStanding.upsert({
            where: { studentId },
            create: {
              tenantId,
              studentId,
              currentSemesterSequence: batch.currentSemester,
              lifecycleState: 'ACTIVE',
              programmeStatus: 'IN_PROGRESS',
            },
            update: { currentSemesterSequence: batch.currentSemester },
          });
        }
      }

      if (
        dto.fullName ||
        dto.gender !== undefined ||
        dto.mobileNumber !== undefined
      ) {
        await tx.studentProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            fullName: dto.fullName ?? 'Student',
            gender: dto.gender,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            mobileNumber: dto.mobileNumber,
            nationalId: dto.nationalId,
            nationalityLookupId: dto.nationalityLookupId,
            bloodGroupLookupId: dto.bloodGroupLookupId,
            religionLookupId: dto.religionLookupId,
            categoryLookupId: dto.categoryLookupId,
            address: dto.address as Prisma.InputJsonValue,
            guardianName: dto.guardianName,
            guardianMobile: dto.guardianMobile,
            admissionStatus: dto.admissionStatus ?? 'ACTIVE',
          },
          update: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
            ...(dto.dateOfBirth !== undefined
              ? {
                  dateOfBirth: dto.dateOfBirth
                    ? new Date(dto.dateOfBirth)
                    : null,
                }
              : {}),
            ...(dto.mobileNumber !== undefined
              ? { mobileNumber: dto.mobileNumber }
              : {}),
            ...(dto.nationalId !== undefined
              ? { nationalId: dto.nationalId }
              : {}),
            ...(dto.nationalityLookupId !== undefined
              ? { nationalityLookupId: dto.nationalityLookupId }
              : {}),
            ...(dto.bloodGroupLookupId !== undefined
              ? { bloodGroupLookupId: dto.bloodGroupLookupId }
              : {}),
            ...(dto.religionLookupId !== undefined
              ? { religionLookupId: dto.religionLookupId }
              : {}),
            ...(dto.categoryLookupId !== undefined
              ? { categoryLookupId: dto.categoryLookupId }
              : {}),
            ...(dto.address !== undefined
              ? { address: dto.address as Prisma.InputJsonValue }
              : {}),
            ...(dto.guardianName !== undefined
              ? { guardianName: dto.guardianName }
              : {}),
            ...(dto.guardianMobile !== undefined
              ? { guardianMobile: dto.guardianMobile }
              : {}),
            ...(dto.admissionStatus !== undefined
              ? { admissionStatus: dto.admissionStatus }
              : {}),
          },
        });
      }
    });

    if (
      dto.residenceType !== undefined ||
      dto.hostelBlock !== undefined ||
      dto.hostelRoom !== undefined
    ) {
      await this.directoryEnrichment.updateResidence(tenantId, studentId, {
        residenceType: dto.residenceType,
        hostelBlock: dto.hostelBlock,
        hostelRoom: dto.hostelRoom,
      });
    }

    return this.getFullProfile(tenantId, studentId);
  }

  async createMasterProfile(
    tenantId: string,
    studentId: string,
    data: {
      fullName: string;
      email?: string;
      gender?: string;
      maritalStatus?: string;
      dateOfBirth?: string;
      mobileNumber?: string;
      nationalId?: string;
      nationalityLookupId?: string;
      bloodGroupLookupId?: string;
      religionLookupId?: string;
      categoryLookupId?: string;
      tribeLookupId?: string;
      denominationLookupId?: string;
      differentlyAbled?: boolean;
      ews?: boolean;
      address?: Record<string, unknown>;
      guardianName?: string;
      guardianMobile?: string;
      admissionStatus?: string;
      admissionType?: string;
    },
  ) {
    return this.prisma.studentProfile.create({
      data: {
        tenantId,
        studentId,
        fullName: data.fullName,
        email: data.email,
        gender: data.gender,
        maritalStatus: data.maritalStatus,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        mobileNumber: data.mobileNumber,
        nationalId: data.nationalId,
        nationalityLookupId: data.nationalityLookupId,
        bloodGroupLookupId: data.bloodGroupLookupId,
        religionLookupId: data.religionLookupId,
        categoryLookupId: data.categoryLookupId,
        tribeLookupId: data.tribeLookupId,
        denominationLookupId: data.denominationLookupId,
        differentlyAbled: data.differentlyAbled ?? false,
        ews: data.ews ?? false,
        admissionType: data.admissionType,
        address: data.address as Prisma.InputJsonValue,
        guardianName: data.guardianName,
        guardianMobile: data.guardianMobile,
        admissionStatus: data.admissionStatus ?? 'ACTIVE',
      },
    });
  }

  private async enrichProgramChoices(
    tenantId: string,
    choices: {
      id: string;
      choiceType: string;
      subjectSlug: string;
      status?: string;
    }[],
  ): Promise<
    {
      id: string;
      choiceType: string;
      subjectSlug: string;
      status?: string;
      subjectName: string;
    }[]
  > {
    const slugs = [
      ...new Set(choices.map((c) => c.subjectSlug).filter(Boolean)),
    ];
    const formatSlug = (slug: string) =>
      slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    if (slugs.length === 0) {
      return choices.map((c) => ({
        ...c,
        subjectName: formatSlug(c.subjectSlug),
      }));
    }

    const subjects = await this.prisma.academicSubject.findMany({
      where: { tenantId, slug: { in: slugs }, deletedAt: null },
      select: { slug: true, name: true },
    });
    const nameBySlug = new Map(subjects.map((s) => [s.slug, s.name]));

    return choices.map((c) => ({
      ...c,
      subjectName: nameBySlug.get(c.subjectSlug) ?? formatSlug(c.subjectSlug),
    }));
  }

  async getSemesterRegistrations(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const registrations = await this.prisma.semesterRegistration.findMany({
      where: { tenantId, studentId },
      include: {
        semester: { select: { id: true, name: true, sequence: true } },
        lines: {
          include: {
            offering: {
              include: {
                course: true,
                programVersion: { select: { id: true, version: true } },
                categoryPool: { select: { id: true, poolName: true } },
              },
            },
            offeringSection: {
              include: {
                staffProfile: {
                  select: { id: true, fullName: true, employeeCode: true },
                },
              },
            },
          },
          orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ semesterSequence: 'asc' }, { createdAt: 'desc' }],
    });

    return registrations.flatMap((reg) =>
      reg.lines.map((line) => ({
        registrationId: reg.id,
        lineId: line.id,
        semesterSequence: reg.semesterSequence,
        semesterId: reg.semesterId,
        registrationStatus: reg.status,
        category: line.category,
        lineStatus: line.status,
        course: {
          id: line.offering.courseId,
          code: line.offering.course.code,
          title: line.offering.course.title,
          credits: Number(line.credits ?? line.offering.course.credits ?? 0),
        },
        section: line.offeringSection
          ? {
              id: line.offeringSection.id,
              sectionCode: line.offeringSection.sectionCode,
            }
          : null,
        faculty: line.offeringSection?.staffProfile
          ? {
              id: line.offeringSection.staffProfile.id,
              name: line.offeringSection.staffProfile.fullName,
              employeeCode: line.offeringSection.staffProfile.employeeCode,
            }
          : null,
        generatedBy: line.generatedBy,
        generatedAt: line.createdAt,
        registrationSource: line.registrationSource,
        assignmentSource: line.assignmentSource,
        curriculumMappingId: line.offeringId,
        mappingSource: line.offering.mappingSource,
        curriculumVersion: line.offering.programVersion?.version ?? null,
        poolName: line.offering.categoryPool?.poolName ?? null,
      })),
    );
  }
}
