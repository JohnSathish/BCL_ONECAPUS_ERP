import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MajorMinorEligibilityService } from '../../academic-engine/services/major-minor-eligibility.service';
import { OrganizationService } from '../../organization/organization.service';
import { StudentSemesterResolverService } from './student-semester-resolver.service';
import { StudentDirectoryEnrichmentService } from './student-directory-enrichment.service';
import {
  DEFAULT_PROFILE_SECTIONS,
  flattenDefaultFieldConfigs,
  isProfileSectionKey,
  type ProfileSectionKey,
} from '../domain/profile-sections';
import type {
  UpdateAcademicSectionDto,
  UpdateAddressSectionDto,
  UpdateBasicSectionDto,
  UpdateBoardExamSectionDto,
  UpdateCategorySectionDto,
  UpdateCuetSectionDto,
  UpdateGuardiansSectionDto,
  VerifyDocumentDto,
} from '../dto/profile-section.dto';

const extendedProfileInclude = {
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
  createdBy: { select: { id: true, email: true } },
  lastModifiedBy: { select: { id: true, email: true } },
  semesterRegistrations: {
    orderBy: { semesterSequence: 'desc' as const },
    take: 1,
    include: { lines: true },
  },
};

@Injectable()
export class StudentProfileSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesterResolver: StudentSemesterResolverService,
    private readonly eligibility: MajorMinorEligibilityService,
    private readonly organization: OrganizationService,
    private readonly directoryEnrichment: StudentDirectoryEnrichmentService,
  ) {}

  async getSection(tenantId: string, studentId: string, sectionKey: string) {
    if (!isProfileSectionKey(sectionKey)) {
      throw new BadRequestException(`Unknown profile section: ${sectionKey}`);
    }
    const student = await this.loadStudent(tenantId, studentId);
    const payload = this.buildSectionPayload(student, sectionKey);
    if (sectionKey === 'academic') {
      return this.enrichAcademicPayload(
        tenantId,
        studentId,
        payload as Record<string, unknown>,
      );
    }
    return payload;
  }

  async updateSection(
    tenantId: string,
    studentId: string,
    sectionKey: string,
    dto: Record<string, unknown>,
    actorId?: string,
  ) {
    if (!isProfileSectionKey(sectionKey)) {
      throw new BadRequestException(`Unknown profile section: ${sectionKey}`);
    }
    await this.loadStudent(tenantId, studentId);

    switch (sectionKey) {
      case 'basic':
        await this.updateBasic(
          tenantId,
          studentId,
          dto as UpdateBasicSectionDto,
          actorId,
        );
        break;
      case 'category_reservation':
        await this.updateCategory(
          tenantId,
          studentId,
          dto as UpdateCategorySectionDto,
          actorId,
        );
        break;
      case 'address':
        await this.updateAddress(
          tenantId,
          studentId,
          dto as UpdateAddressSectionDto,
          actorId,
        );
        break;
      case 'guardians':
        await this.updateGuardians(
          tenantId,
          studentId,
          dto as UpdateGuardiansSectionDto,
          actorId,
        );
        break;
      case 'board_exam':
        await this.updateBoardExam(
          tenantId,
          studentId,
          dto as UpdateBoardExamSectionDto,
          actorId,
        );
        break;
      case 'cuet':
        await this.updateCuet(
          tenantId,
          studentId,
          dto as UpdateCuetSectionDto,
          actorId,
        );
        break;
      case 'academic':
        await this.updateAcademic(
          tenantId,
          studentId,
          dto as UpdateAcademicSectionDto,
          actorId,
        );
        break;
      case 'fyugp_registration':
      case 'documents':
      case 'system':
        throw new BadRequestException(
          `Section ${sectionKey} uses dedicated endpoints`,
        );
      default:
        throw new BadRequestException(`Unsupported section: ${sectionKey}`);
    }

    return this.getSection(tenantId, studentId, sectionKey);
  }

  /** Exposed for bulk update — includes latest semester registration lines */
  async loadStudentForBulk(tenantId: string, studentId: string) {
    return this.loadStudent(tenantId, studentId);
  }

  async getCompletion(tenantId: string, studentId: string) {
    const student = await this.loadStudent(tenantId, studentId);
    const sections: Record<
      string,
      { complete: boolean; filled: number; total: number }
    > = {};
    let filledTotal = 0;
    let requiredTotal = 0;

    for (const def of DEFAULT_PROFILE_SECTIONS) {
      const { filled, total } = this.scoreSection(student, def.key);
      sections[def.key] = {
        complete: filled >= total,
        filled,
        total,
      };
      filledTotal += filled;
      requiredTotal += total;
    }

    return {
      completionPercent:
        requiredTotal > 0 ? Math.round((filledTotal / requiredTotal) * 100) : 0,
      sections,
    };
  }

  async getFieldConfig(tenantId: string, institutionId: string) {
    let configs = await this.prisma.studentProfileFieldConfig.findMany({
      where: { tenantId, institutionId },
      orderBy: [{ sectionKey: 'asc' }, { sortOrder: 'asc' }],
    });
    if (configs.length === 0) {
      const rows = flattenDefaultFieldConfigs(institutionId, tenantId);
      await this.prisma.studentProfileFieldConfig.createMany({ data: rows });
      configs = await this.prisma.studentProfileFieldConfig.findMany({
        where: { tenantId, institutionId },
        orderBy: [{ sectionKey: 'asc' }, { sortOrder: 'asc' }],
      });
    }
    return configs;
  }

  async upsertFieldConfig(
    tenantId: string,
    institutionId: string,
    fields: {
      sectionKey: string;
      fieldKey: string;
      visible?: boolean;
      required?: boolean;
      editable?: boolean;
      studentEditable?: boolean;
      sortOrder?: number;
    }[],
  ) {
    for (const f of fields) {
      await this.prisma.studentProfileFieldConfig.upsert({
        where: {
          institutionId_sectionKey_fieldKey: {
            institutionId,
            sectionKey: f.sectionKey,
            fieldKey: f.fieldKey,
          },
        },
        create: {
          tenantId,
          institutionId,
          sectionKey: f.sectionKey,
          fieldKey: f.fieldKey,
          visible: f.visible ?? true,
          required: f.required ?? false,
          editable: f.editable ?? true,
          studentEditable: f.studentEditable ?? false,
          sortOrder: f.sortOrder ?? 0,
        },
        update: {
          ...(f.visible !== undefined ? { visible: f.visible } : {}),
          ...(f.required !== undefined ? { required: f.required } : {}),
          ...(f.editable !== undefined ? { editable: f.editable } : {}),
          ...(f.studentEditable !== undefined
            ? { studentEditable: f.studentEditable }
            : {}),
          ...(f.sortOrder !== undefined ? { sortOrder: f.sortOrder } : {}),
        },
      });
    }
    return this.getFieldConfig(tenantId, institutionId);
  }

  async verifyDocument(
    tenantId: string,
    studentId: string,
    docId: string,
    dto: VerifyDocumentDto,
    actorId: string,
  ) {
    const doc = await this.prisma.studentDocument.findFirst({
      where: { id: docId, studentId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.studentDocument.update({
      where: { id: docId },
      data: {
        verificationStatus: dto.verificationStatus,
        verificationRemarks: dto.verificationRemarks,
        verifiedById: actorId,
        verifiedAt: new Date(),
      },
    });
  }

  private async loadStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: extendedProfileInclude,
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private buildSectionPayload(
    student: Awaited<ReturnType<typeof this.loadStudent>>,
    sectionKey: ProfileSectionKey,
  ) {
    switch (sectionKey) {
      case 'basic':
        return {
          applicationNumber: student.applicationNumber,
          admissionNumber: student.admissionNumber,
          enrollmentNumber: student.enrollmentNumber,
          rollNumber: student.rollNumber,
          fullName: student.masterProfile?.fullName,
          email: student.masterProfile?.email ?? student.user.email,
          mobileNumber: student.masterProfile?.mobileNumber,
          dateOfBirth: student.masterProfile?.dateOfBirth,
          gender: student.masterProfile?.gender,
          maritalStatus: student.masterProfile?.maritalStatus,
          bloodGroupLookupId: student.masterProfile?.bloodGroupLookupId,
          studentStatus: student.masterProfile?.studentStatus ?? 'STUDYING',
          photoPath: student.masterProfile?.photoPath,
          programme: student.programVersion?.program.name,
          programmeCode: student.programVersion?.program.code,
          programVersionId: student.programVersionId,
          department: student.department?.name,
          departmentId: student.departmentId,
          shift: student.primaryShift?.name,
          primaryShiftId: student.primaryShiftId,
          batch: student.academicProfile?.admissionBatch?.batchCode,
          admissionBatchId: student.academicProfile?.admissionBatchId,
          currentSemester: student.academicStanding?.currentSemesterSequence,
          rfidNumber: student.rfidNumber,
        };
      case 'academic':
        return {
          streamId: student.academicProfile?.streamId,
          stream: student.academicProfile?.stream?.name,
          admissionBatchId: student.academicProfile?.admissionBatchId,
          admissionYearId: student.academicProfile?.admissionYearId,
          entrySession:
            student.academicProfile?.admissionBatch?.entrySession?.name,
          programVersionId: student.programVersionId,
          majorSubjectSlug: student.programChoices.find(
            (c) => c.choiceType === 'MAJOR',
          )?.subjectSlug,
          minorSubjectSlug: student.programChoices.find(
            (c) => c.choiceType === 'MINOR',
          )?.subjectSlug,
          admissionType: student.masterProfile?.admissionType,
          admissionCategory: student.masterProfile?.admissionCategory,
          class12Subjects: student.academicProfile?.class12Subjects,
        };
      case 'category_reservation':
        return {
          categoryLookupId: student.masterProfile?.categoryLookupId,
          religionLookupId: student.masterProfile?.religionLookupId,
          tribeLookupId: student.masterProfile?.tribeLookupId,
          denominationLookupId: student.masterProfile?.denominationLookupId,
          differentlyAbled: student.masterProfile?.differentlyAbled ?? false,
          ews: student.masterProfile?.ews ?? false,
          nationalityLookupId: student.masterProfile?.nationalityLookupId,
        };
      case 'address': {
        const tura = student.addresses.find((a) => a.addressType === 'TURA');
        const home = student.addresses.find((a) => a.addressType === 'HOME');
        return {
          homeSameAsTura: student.masterProfile?.homeSameAsTura ?? false,
          tura,
          home,
        };
      }
      case 'guardians':
        return {
          father: student.guardians.find((g) => g.guardianType === 'FATHER'),
          mother: student.guardians.find((g) => g.guardianType === 'MOTHER'),
          localGuardian: student.guardians.find(
            (g) => g.guardianType === 'LOCAL_GUARDIAN',
          ),
        };
      case 'board_exam':
        return student.boardExams[0] ?? null;
      case 'cuet':
        return student.cuetDetail;
      case 'documents':
        return student.documents;
      case 'system':
        return {
          createdAt: student.createdAt,
          updatedAt: student.updatedAt,
          createdBy: student.createdBy,
          lastModifiedBy: student.lastModifiedBy,
          importSource: student.importSource,
          admissionSource: student.admissionSource,
          rfidNumber: student.rfidNumber,
          userId: student.userId,
          userEmail: student.user.email,
          loginEnabled: student.user.isActive,
        };
      case 'fyugp_registration':
        return { note: 'Use GET /students/:id/profile for registration data' };
      default:
        return {};
    }
  }

  private scoreSection(
    student: Awaited<ReturnType<typeof this.loadStudent>>,
    sectionKey: ProfileSectionKey,
  ) {
    const checks: boolean[] = [];
    switch (sectionKey) {
      case 'basic':
        checks.push(
          Boolean(student.enrollmentNumber),
          Boolean(student.masterProfile?.fullName),
          Boolean(student.user.email),
        );
        break;
      case 'academic':
        checks.push(
          Boolean(student.programVersionId),
          Boolean(student.academicProfile?.streamId),
        );
        break;
      case 'category_reservation':
        checks.push(Boolean(student.masterProfile?.categoryLookupId));
        break;
      case 'address':
        checks.push(
          student.addresses.some((a) => a.addressType === 'TURA' && a.line1),
        );
        break;
      case 'guardians':
        checks.push(
          student.guardians.some(
            (g) => g.guardianType === 'FATHER' && g.fullName,
          ),
        );
        break;
      case 'board_exam':
        checks.push(
          student.boardExams.some(
            (b) => b.subjectMarks.length >= 5 || Boolean(b.boardRollNumber),
          ),
        );
        break;
      case 'cuet':
        checks.push(Boolean(student.cuetDetail));
        break;
      default:
        break;
    }
    return { filled: checks.filter(Boolean).length, total: checks.length || 1 };
  }

  private async touchModified(
    tenantId: string,
    studentId: string,
    actorId?: string,
  ) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { lastModifiedById: actorId ?? undefined },
    });
  }

  private async updateBasic(
    tenantId: string,
    studentId: string,
    dto: UpdateBasicSectionDto,
    actorId?: string,
  ) {
    if (dto.enrollmentNumber) {
      const taken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          enrollmentNumber: dto.enrollmentNumber,
          deletedAt: null,
          NOT: { id: studentId },
        },
      });
      if (taken)
        throw new BadRequestException('Registration number already in use');
    }
    if (dto.rollNumber) {
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

    const rfidNumber =
      dto.rfidNumber !== undefined ? dto.rfidNumber.trim() || null : undefined;
    if (rfidNumber) {
      const taken = await this.prisma.student.findFirst({
        where: {
          tenantId,
          rfidNumber,
          deletedAt: null,
          NOT: { id: studentId },
        },
      });
      if (taken) throw new BadRequestException('RFID number already in use');
    }

    if (dto.departmentId) {
      await this.organization.assertAcademicDepartment(
        tenantId,
        dto.departmentId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: studentId },
        data: {
          ...(dto.applicationNumber !== undefined
            ? { applicationNumber: dto.applicationNumber }
            : {}),
          ...(dto.admissionNumber !== undefined
            ? { admissionNumber: dto.admissionNumber }
            : {}),
          ...(dto.enrollmentNumber !== undefined
            ? { enrollmentNumber: dto.enrollmentNumber }
            : {}),
          ...(dto.rollNumber !== undefined
            ? { rollNumber: dto.rollNumber }
            : {}),
          ...(dto.programVersionId !== undefined
            ? { programVersionId: dto.programVersionId }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.primaryShiftId !== undefined
            ? { primaryShiftId: dto.primaryShiftId }
            : {}),
          ...(dto.rfidNumber !== undefined ? { rfidNumber } : {}),
          lastModifiedById: actorId,
        },
      });

      if (dto.email) {
        const student = await tx.student.findUnique({
          where: { id: studentId },
        });
        if (student) {
          await tx.user.update({
            where: { id: student.userId },
            data: { email: dto.email },
          });
        }
      }

      const profile = await tx.studentProfile.findUnique({
        where: { studentId },
      });
      const profileData = {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.mobileNumber !== undefined
          ? { mobileNumber: dto.mobileNumber }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.maritalStatus !== undefined
          ? { maritalStatus: dto.maritalStatus }
          : {}),
        ...(dto.studentStatus !== undefined
          ? { studentStatus: dto.studentStatus }
          : {}),
        ...(dto.bloodGroupLookupId !== undefined
          ? { bloodGroupLookupId: dto.bloodGroupLookupId }
          : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
      };

      if (profile) {
        if (Object.keys(profileData).length > 0) {
          await tx.studentProfile.update({
            where: { studentId },
            data: profileData,
          });
        }
      } else if (dto.fullName) {
        await tx.studentProfile.create({
          data: {
            tenantId,
            studentId,
            fullName: dto.fullName,
            email: dto.email,
            ...profileData,
          },
        });
      }

      if (dto.admissionBatchId) {
        await tx.studentAcademicProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            admissionBatchId: dto.admissionBatchId,
            class12Subjects: [],
          },
          update: { admissionBatchId: dto.admissionBatchId },
        });
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
    });
  }

  private normalizeOptionalUuid(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private hasAddressContent(data?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    district?: string;
    pinCode?: string;
  }) {
    if (!data) return false;
    return Boolean(
      data.line1?.trim() ||
      data.line2?.trim() ||
      data.city?.trim() ||
      data.state?.trim() ||
      data.district?.trim() ||
      data.pinCode?.trim(),
    );
  }

  private hasGuardianContent(data?: {
    fullName?: string;
    age?: number;
    occupation?: string;
    contactNumber?: string;
    email?: string;
  }) {
    if (!data) return false;
    return Boolean(
      data.fullName?.trim() ||
      data.occupation?.trim() ||
      data.contactNumber?.trim() ||
      data.email?.trim() ||
      (data.age != null && data.age > 0),
    );
  }

  private async updateCategory(
    tenantId: string,
    studentId: string,
    dto: UpdateCategorySectionDto,
    actorId?: string,
  ) {
    await this.ensureProfile(tenantId, studentId);
    await this.prisma.studentProfile.update({
      where: { studentId },
      data: {
        ...(dto.categoryLookupId !== undefined
          ? {
              categoryLookupId: this.normalizeOptionalUuid(
                dto.categoryLookupId,
              ),
            }
          : {}),
        ...(dto.religionLookupId !== undefined
          ? {
              religionLookupId: this.normalizeOptionalUuid(
                dto.religionLookupId,
              ),
            }
          : {}),
        ...(dto.tribeLookupId !== undefined
          ? { tribeLookupId: this.normalizeOptionalUuid(dto.tribeLookupId) }
          : {}),
        ...(dto.denominationLookupId !== undefined
          ? {
              denominationLookupId: this.normalizeOptionalUuid(
                dto.denominationLookupId,
              ),
            }
          : {}),
        ...(dto.differentlyAbled !== undefined
          ? { differentlyAbled: dto.differentlyAbled }
          : {}),
        ...(dto.ews !== undefined ? { ews: dto.ews } : {}),
        ...(dto.nationalityLookupId !== undefined
          ? {
              nationalityLookupId: this.normalizeOptionalUuid(
                dto.nationalityLookupId,
              ),
            }
          : {}),
      },
    });
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async updateAddress(
    tenantId: string,
    studentId: string,
    dto: UpdateAddressSectionDto,
    actorId?: string,
  ) {
    const upsertAddr = async (
      type: string,
      data?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        district?: string;
        pinCode?: string;
      },
    ) => {
      if (!data) return;
      await this.prisma.studentAddress.upsert({
        where: { studentId_addressType: { studentId, addressType: type } },
        create: { tenantId, studentId, addressType: type, ...data },
        update: data,
      });
    };

    if (dto.tura && this.hasAddressContent(dto.tura)) {
      await upsertAddr('TURA', dto.tura);
    }

    if (dto.homeSameAsTura && dto.tura && this.hasAddressContent(dto.tura)) {
      await upsertAddr('HOME', dto.tura);
      await this.ensureProfile(tenantId, studentId);
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: { homeSameAsTura: true },
      });
    } else {
      if (dto.home && this.hasAddressContent(dto.home)) {
        await upsertAddr('HOME', dto.home);
      }
      if (dto.homeSameAsTura === false) {
        await this.ensureProfile(tenantId, studentId);
        await this.prisma.studentProfile.update({
          where: { studentId },
          data: { homeSameAsTura: false },
        });
      }
    }
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async updateGuardians(
    tenantId: string,
    studentId: string,
    dto: UpdateGuardiansSectionDto,
    actorId?: string,
  ) {
    const upsert = async (
      type: string,
      data?: {
        fullName?: string;
        age?: number;
        occupation?: string;
        contactNumber?: string;
        email?: string;
      },
    ) => {
      if (!data) return;
      await this.prisma.studentGuardian.upsert({
        where: { studentId_guardianType: { studentId, guardianType: type } },
        create: { tenantId, studentId, guardianType: type, ...data },
        update: data,
      });
    };
    if (dto.father && this.hasGuardianContent(dto.father)) {
      await upsert('FATHER', dto.father);
    }
    if (dto.mother && this.hasGuardianContent(dto.mother)) {
      await upsert('MOTHER', dto.mother);
    }
    if (dto.localGuardian && this.hasGuardianContent(dto.localGuardian)) {
      await upsert('LOCAL_GUARDIAN', dto.localGuardian);
    }
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async updateBoardExam(
    tenantId: string,
    studentId: string,
    dto: UpdateBoardExamSectionDto,
    actorId?: string,
  ) {
    let exam = await this.prisma.studentBoardExam.findFirst({
      where: { tenantId, studentId },
    });
    if (!exam) {
      exam = await this.prisma.studentBoardExam.create({
        data: { tenantId, studentId },
      });
    }
    if (dto.boardName) {
      await this.assertBoardNameExists(tenantId, dto.boardName);
    }
    if (dto.subjectMarks?.length) {
      await this.assertBoardSubjectsExist(
        tenantId,
        dto.subjectMarks.map((mark) => mark.subjectName),
      );
    }

    let percentage: Prisma.Decimal | null = null;
    if (dto.percentage !== undefined) {
      percentage = new Prisma.Decimal(Number(dto.percentage).toFixed(2));
    } else if (dto.subjectMarks?.length) {
      const obtained = dto.subjectMarks.reduce(
        (s, m) => s + (m.marksObtained ?? 0),
        0,
      );
      const max = dto.subjectMarks.reduce((s, m) => s + (m.maxMarks ?? 0), 0);
      if (max > 0)
        percentage = new Prisma.Decimal(((obtained / max) * 100).toFixed(2));
    }

    await this.prisma.studentBoardExam.update({
      where: { id: exam.id },
      data: {
        ...(dto.boardName !== undefined ? { boardName: dto.boardName } : {}),
        ...(dto.schoolName !== undefined ? { schoolName: dto.schoolName } : {}),
        ...(dto.boardRollNumber !== undefined
          ? { boardRollNumber: dto.boardRollNumber }
          : {}),
        ...(dto.examYear !== undefined ? { examYear: dto.examYear } : {}),
        ...(dto.stream !== undefined ? { stream: dto.stream } : {}),
        ...(dto.registrationType !== undefined
          ? { registrationType: dto.registrationType }
          : {}),
        ...(dto.totalMarks !== undefined ? { totalMarks: dto.totalMarks } : {}),
        ...(dto.division !== undefined ? { division: dto.division } : {}),
        ...(dto.marksheetDocumentId !== undefined
          ? { marksheetDocumentId: dto.marksheetDocumentId }
          : {}),
        ...(percentage !== null ? { percentage } : {}),
      },
    });

    if (dto.subjectMarks) {
      await this.prisma.studentBoardSubjectMark.deleteMany({
        where: { boardExamId: exam.id },
      });
      if (dto.subjectMarks.length > 0) {
        await this.prisma.studentBoardSubjectMark.createMany({
          data: dto.subjectMarks.map((m, i) => ({
            tenantId,
            boardExamId: exam!.id,
            subjectName: m.subjectName,
            marksObtained: m.marksObtained,
            maxMarks: m.maxMarks,
            sortOrder: i,
          })),
        });
      }
    }
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async updateCuet(
    tenantId: string,
    studentId: string,
    dto: UpdateCuetSectionDto,
    actorId?: string,
  ) {
    await this.prisma.studentCuetDetail.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        cuetApplied: dto.cuetApplied ?? false,
        cuetRollNumber: dto.cuetRollNumber,
        cuetScore: dto.cuetScore,
        cuetSubjects: dto.cuetSubjects as Prisma.InputJsonValue,
      },
      update: {
        ...(dto.cuetApplied !== undefined
          ? { cuetApplied: dto.cuetApplied }
          : {}),
        ...(dto.cuetRollNumber !== undefined
          ? { cuetRollNumber: dto.cuetRollNumber }
          : {}),
        ...(dto.cuetScore !== undefined ? { cuetScore: dto.cuetScore } : {}),
        ...(dto.cuetSubjects !== undefined
          ? { cuetSubjects: dto.cuetSubjects as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async updateAcademic(
    tenantId: string,
    studentId: string,
    dto: UpdateAcademicSectionDto,
    actorId?: string,
  ) {
    if (dto.class12Subjects !== undefined) {
      await this.assertClass12SubjectsExist(tenantId, dto.class12Subjects);
    }
    if (dto.majorSubjectSlug && dto.minorSubjectSlug) {
      await this.eligibility.assertValidMajorMinorPair(
        tenantId,
        dto.majorSubjectSlug,
        dto.minorSubjectSlug,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.streamId !== undefined ||
        dto.admissionBatchId !== undefined ||
        dto.admissionYearId !== undefined ||
        dto.class12Subjects !== undefined
      ) {
        await tx.studentAcademicProfile.upsert({
          where: { studentId },
          create: {
            tenantId,
            studentId,
            streamId: dto.streamId,
            admissionBatchId: dto.admissionBatchId,
            admissionYearId: dto.admissionYearId,
            class12Subjects:
              (dto.class12Subjects as Prisma.InputJsonValue) ?? [],
          },
          update: {
            ...(dto.streamId !== undefined ? { streamId: dto.streamId } : {}),
            ...(dto.admissionBatchId !== undefined
              ? { admissionBatchId: dto.admissionBatchId }
              : {}),
            ...(dto.admissionYearId !== undefined
              ? { admissionYearId: dto.admissionYearId }
              : {}),
            ...(dto.class12Subjects !== undefined
              ? {
                  class12Subjects: dto.class12Subjects as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
      }

      if (
        dto.admissionType !== undefined ||
        dto.admissionCategory !== undefined
      ) {
        await this.ensureProfileTx(tx, tenantId, studentId);
        await tx.studentProfile.update({
          where: { studentId },
          data: {
            ...(dto.admissionType !== undefined
              ? { admissionType: dto.admissionType }
              : {}),
            ...(dto.admissionCategory !== undefined
              ? { admissionCategory: dto.admissionCategory }
              : {}),
          },
        });
      }

      if (dto.majorSubjectSlug) {
        const existing = await tx.studentProgramChoice.findFirst({
          where: { studentId, choiceType: 'MAJOR', deletedAt: null },
        });
        if (existing) {
          await tx.studentProgramChoice.update({
            where: { id: existing.id },
            data: { subjectSlug: dto.majorSubjectSlug },
          });
        } else {
          await tx.studentProgramChoice.create({
            data: {
              tenantId,
              studentId,
              choiceType: 'MAJOR',
              subjectSlug: dto.majorSubjectSlug,
            },
          });
        }
      }
      if (dto.minorSubjectSlug) {
        const existing = await tx.studentProgramChoice.findFirst({
          where: { studentId, choiceType: 'MINOR', deletedAt: null },
        });
        if (existing) {
          await tx.studentProgramChoice.update({
            where: { id: existing.id },
            data: { subjectSlug: dto.minorSubjectSlug },
          });
        } else {
          await tx.studentProgramChoice.create({
            data: {
              tenantId,
              studentId,
              choiceType: 'MINOR',
              subjectSlug: dto.minorSubjectSlug,
            },
          });
        }
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
    await this.touchModified(tenantId, studentId, actorId);
  }

  private async assertBoardNameExists(tenantId: string, boardName: string) {
    const normalized = this.normalizeBoardValue(boardName);
    if (!normalized) return;
    const board = await this.prisma.masterLookup.findFirst({
      where: {
        tenantId,
        lookupType: 'BOARD_NAME',
        isActive: true,
        archivedAt: null,
        OR: [
          { label: { equals: boardName.trim(), mode: 'insensitive' } },
          { code: { equals: normalized, mode: 'insensitive' } },
        ],
      },
    });
    if (!board) {
      throw new BadRequestException(
        `Unknown board "${boardName}". Add it in Support Data -> Students -> Board Names first.`,
      );
    }
  }

  private async assertClass12SubjectsExist(tenantId: string, value: unknown) {
    const subjects = Array.isArray(value)
      ? value
          .map(
            (item: any) =>
              item?.name ?? item?.subjectName ?? item?.code ?? item,
          )
          .filter(Boolean)
      : [];
    await this.assertBoardSubjectsExist(tenantId, subjects);
  }

  private async assertBoardSubjectsExist(
    tenantId: string,
    subjects: unknown[],
  ) {
    const normalizedInputs = subjects
      .map((subject) => this.normalizeBoardValue(subject))
      .filter(Boolean);
    if (!normalizedInputs.length) return;
    const rows = await this.prisma.supportBoardSubject.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { subjectName: true, subjectCode: true },
    });
    const allowed = new Set(
      rows.flatMap((row) => [
        this.normalizeBoardValue(row.subjectName),
        this.normalizeBoardValue(row.subjectCode),
        this.normalizeBoardValue(`${row.subjectName} (${row.subjectCode})`),
      ]),
    );
    const missing = normalizedInputs.filter((subject) => !allowed.has(subject));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown Class XII subject(s): ${missing.join(
          ', ',
        )}. Add them in Support Data -> Academic -> Board Subjects first.`,
      );
    }
  }

  private normalizeBoardValue(value: unknown) {
    return String(value ?? '')
      .trim()
      .replace(/\s*\(([^)]+)\)\s*$/, ' $1')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toUpperCase();
  }

  private async enrichAcademicPayload(
    tenantId: string,
    studentId: string,
    payload: Record<string, unknown>,
  ) {
    const majorSlug = payload.majorSubjectSlug as string | undefined;
    const minorSlug = payload.minorSubjectSlug as string | undefined;

    const [majorSubject, minorSubject, sem1Reg, residenceRows] =
      await Promise.all([
        majorSlug
          ? this.eligibility.resolveSubjectBySlug(tenantId, majorSlug)
          : null,
        minorSlug
          ? this.eligibility.resolveSubjectBySlug(tenantId, minorSlug)
          : null,
        this.prisma.semesterRegistration.findFirst({
          where: { tenantId, studentId, semesterSequence: 1 },
          select: {
            id: true,
            status: true,
            lines: {
              select: { category: true, generatedBy: true, status: true },
            },
          },
        }),
        this.directoryEnrichment.loadForStudents(tenantId, [studentId]),
      ]);

    const residence = residenceRows.get(studentId);

    return {
      ...payload,
      residenceType: residence?.residenceType ?? null,
      hostelBlock: residence?.hostelBlock ?? null,
      hostelRoom: residence?.hostelRoom ?? null,
      isHosteller: residence?.isHosteller ?? false,
      majorSubjectName: majorSubject?.name ?? null,
      minorSubjectName: minorSubject?.name ?? null,
      semester1Registration: sem1Reg
        ? {
            status: sem1Reg.status,
            lineCount: sem1Reg.lines.length,
            autoGenerated: sem1Reg.lines.some(
              (l) => l.generatedBy === 'AUTO_ENGINE',
            ),
          }
        : null,
    };
  }

  private async ensureProfile(tenantId: string, studentId: string) {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { studentId },
    });
    if (!existing) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      });
      await this.prisma.studentProfile.create({
        data: {
          tenantId,
          studentId,
          fullName: student?.user.email ?? 'Student',
        },
      });
    }
  }

  private async ensureProfileTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentId: string,
  ) {
    const existing = await tx.studentProfile.findUnique({
      where: { studentId },
    });
    if (!existing) {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: { user: true },
      });
      await tx.studentProfile.create({
        data: {
          tenantId,
          studentId,
          fullName: student?.user.email ?? 'Student',
        },
      });
    }
  }
}
