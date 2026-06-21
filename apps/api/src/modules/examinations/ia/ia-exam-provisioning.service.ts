import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import { isIaExamType, IA_EXAM_TYPES } from './ia.constants';
import { IaAuditService } from './ia-audit.service';
import type {
  CreateIaExamDto,
  GenerateIaTimetableDto,
} from './dto/create-ia-exam.dto';

@Injectable()
export class IaExamProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private timeDate(value: string) {
    return new Date(`1970-01-01T${value}`);
  }

  private addMinutes(time: string, minutes: number) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  async createExam(user: JwtUser, dto: CreateIaExamDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    if (!isIaExamType(dto.examType)) {
      throw new BadRequestException('Invalid IA exam type');
    }

    const programVersion = await this.prisma.programVersion.findFirst({
      where: {
        id: dto.programVersionId,
        tenantId: user.tid,
        deletedAt: null,
        status: { in: ['ACTIVE', 'DRAFT', 'PUBLISHED', 'active', 'published'] },
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            code: true,
            departmentId: true,
          },
        },
      },
    });
    if (!programVersion) {
      throw new NotFoundException('Programme version not found');
    }

    let academicYearId = dto.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          status: 'ACTIVE',
        },
        orderBy: { startDate: 'desc' },
      });
      academicYearId = activeYear?.id;
    }

    const departmentId =
      dto.departmentId ?? programVersion.program?.departmentId;

    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        programVersionId: dto.programVersionId,
        semesterSequence: dto.semesterNo,
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });

    if (!offerings.length) {
      throw new BadRequestException(
        `No curriculum subjects found for Semester ${dto.semesterNo} in this programme. Map subjects in Curriculum first.`,
      );
    }

    const examDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const passMark = Math.ceil(dto.maxMarks * 0.4);

    const session = await (this.prisma as any).examSession.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        examType: dto.examType,
        academicYearId,
        semesterNo: dto.semesterNo,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        instructions: dto.remarks,
        status: 'DRAFT',
        createdById: user.sub,
        metadata: {
          module: 'ia',
          simplified: true,
          programVersionId: dto.programVersionId,
          programmeCode: programVersion.program?.code,
          programmeName: programVersion.program?.name,
          departmentId,
          maxMarks: dto.maxMarks,
        },
      },
    });

    const registeredStudentIds = new Set<string>();
    let papersCreated = 0;
    let schemesCreated = 0;

    for (const offering of offerings) {
      const studentCount = await this.countStudentsForOffering(
        user.tid,
        offering.id,
        dto.semesterNo,
        departmentId,
      );

      const scheme = await (this.prisma as any).iaAssessmentScheme.create({
        data: {
          tenantId: user.tid,
          name: `${dto.name} — ${offering.course?.title ?? offering.course?.code}`,
          academicYearId,
          departmentId,
          programmeId: programVersion.program?.id,
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo: dto.semesterNo,
          totalMaxMarks: dto.maxMarks,
          passMark,
          status: 'ACTIVE',
          createdById: user.sub,
          components: {
            create: [
              {
                tenantId: user.tid,
                code: dto.examType,
                label: dto.name.trim(),
                maxMarks: dto.maxMarks,
                isMandatory: true,
                sortOrder: 1,
              },
            ],
          },
        },
      });
      schemesCreated += 1;

      await (this.prisma as any).examPaperSchedule.create({
        data: {
          tenantId: user.tid,
          sessionId: session.id,
          paperCode: (offering.course?.code ?? 'SUB').trim().toUpperCase(),
          paperName:
            offering.course?.title ?? offering.course?.code ?? 'Subject',
          examDate,
          startTime: this.timeDate('10:00'),
          endTime: this.timeDate('12:00'),
          courseId: offering.courseId,
          offeringId: offering.id,
          semesterNo: dto.semesterNo,
          expectedCount: studentCount,
          metadata: {
            module: 'ia',
            schemeId: scheme.id,
            category: offering.category,
            maxMarks: dto.maxMarks,
          },
        },
      });
      papersCreated += 1;

      const lines = await this.prisma.semesterRegistrationLine.findMany({
        where: {
          tenantId: user.tid,
          offeringId: offering.id,
          status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
          registration: {
            semesterSequence: dto.semesterNo,
            ...(departmentId ? { student: { departmentId } } : {}),
          },
        },
        select: { registration: { select: { studentId: true } } },
      });
      for (const line of lines) {
        registeredStudentIds.add(line.registration.studentId);
      }
    }

    await this.audit.log(user, 'IA_EXAM', session.id, 'CREATE', null, {
      session,
      papersCreated,
      schemesCreated,
      studentsRegistered: registeredStudentIds.size,
      subjectsLoaded: offerings.length,
    });

    return {
      session,
      summary: {
        subjectsLoaded: offerings.length,
        papersCreated,
        schemesCreated,
        studentsRegistered: registeredStudentIds.size,
        programme: programVersion.program?.name,
        semesterNo: dto.semesterNo,
        maxMarks: dto.maxMarks,
      },
    };
  }

  private async countStudentsForOffering(
    tenantId: string,
    offeringId: string,
    semesterNo: number,
    departmentId?: string | null,
  ) {
    return this.prisma.semesterRegistrationLine.count({
      where: {
        tenantId,
        offeringId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: {
          semesterSequence: semesterNo,
          ...(departmentId ? { student: { departmentId } } : {}),
        },
      },
    });
  }

  async listExamsWithSummary(tenantId: string) {
    const sessions = await (this.prisma as any).examSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        examType: { in: [...IA_EXAM_TYPES] },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    const enriched = [];
    for (const session of sessions) {
      const papers = await (this.prisma as any).examPaperSchedule.count({
        where: { tenantId, sessionId: session.id, deletedAt: null },
      });
      const expectedStudents = await (
        this.prisma as any
      ).examPaperSchedule.aggregate({
        where: { tenantId, sessionId: session.id, deletedAt: null },
        _sum: { expectedCount: true },
      });
      enriched.push({
        ...session,
        stats: {
          subjectsScheduled: papers,
          expectedRegistrations: expectedStudents._sum?.expectedCount ?? 0,
        },
      });
    }
    return enriched;
  }

  async generateTimetable(user: JwtUser, dto: GenerateIaTimetableDto) {
    await this.licenseEnforcement.assertWriteAllowed(
      user.tid,
      'examination.write',
    );
    const session = await (this.prisma as any).examSession.findFirst({
      where: { id: dto.sessionId, tenantId: user.tid, deletedAt: null },
    });
    if (!session) throw new NotFoundException('IA exam not found');

    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: { tenantId: user.tid, sessionId: dto.sessionId, deletedAt: null },
      orderBy: [{ paperCode: 'asc' }],
    });
    if (!papers.length) {
      throw new BadRequestException('No subjects scheduled for this exam');
    }

    const duration = dto.durationMinutes ?? 120;
    const startTime = dto.defaultStartTime ?? '10:00';
    let dayOffset = 0;
    let slotIndex = 0;
    const maxPerDay = 3;

    for (const paper of papers) {
      const examDate = new Date(dto.startDate);
      examDate.setDate(examDate.getDate() + dayOffset);
      const slotStart = this.addMinutes(startTime, slotIndex * (duration + 30));

      await (this.prisma as any).examPaperSchedule.update({
        where: { id: paper.id },
        data: {
          examDate,
          startTime: this.timeDate(slotStart),
          endTime: this.timeDate(this.addMinutes(slotStart, duration)),
        },
      });

      slotIndex += 1;
      if (slotIndex >= maxPerDay) {
        slotIndex = 0;
        dayOffset += 1;
      }
    }

    await this.audit.log(
      user,
      'IA_TIMETABLE',
      dto.sessionId,
      'GENERATE',
      null,
      {
        papers: papers.length,
        startDate: dto.startDate,
      },
    );

    return { updated: papers.length };
  }
}
