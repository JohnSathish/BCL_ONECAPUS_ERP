import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_APPLICATION_NUMBER_PREFIX } from './school-sis.constants';
import type {
  ConvertApplicationDto,
  CreateAdmissionCycleDto,
  PatchApplicationStatusDto,
  SubmitSchoolApplicationDto,
} from './dto/school-sis.dto';
import { SchoolSisService } from './school-sis.service';

@Injectable()
export class SchoolSisAdmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async listOpenCycles(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const now = new Date();
    return this.prisma.schoolAdmissionCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'OPEN',
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
      orderBy: { opensAt: 'desc' },
    });
  }

  async listCycles(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolAdmissionCycle.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { opensAt: 'desc' },
    });
  }

  async createCycle(tenantId: string, dto: CreateAdmissionCycleDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    if (dto.gradeId) {
      const grade = await this.prisma.schoolGrade.findFirst({
        where: { id: dto.gradeId, tenantId, deletedAt: null },
      });
      if (!grade) throw new NotFoundException('Class not found');
    }
    return this.prisma.schoolAdmissionCycle.create({
      data: {
        tenantId,
        academicYearId: year.id,
        gradeId: dto.gradeId ?? null,
        name: dto.name.trim(),
        opensAt: new Date(dto.opensAt),
        closesAt: new Date(dto.closesAt),
        status: 'OPEN',
        seatCap: dto.seatCap ?? null,
      },
    });
  }

  async submitApplication(tenantId: string, dto: SubmitSchoolApplicationDto) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const cycle = await this.prisma.schoolAdmissionCycle.findFirst({
      where: { id: dto.cycleId, tenantId, deletedAt: null },
    });
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    const now = new Date();
    if (
      cycle.status !== 'OPEN' ||
      cycle.opensAt > now ||
      cycle.closesAt < now
    ) {
      throw new BadRequestException('This admission cycle is not open');
    }
    const year = await this.prisma.schoolAcademicYear.findFirst({
      where: { id: cycle.academicYearId, tenantId, deletedAt: null },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    const applicationNumber = await this.sis.nextFormattedNumber(
      tenantId,
      year.id,
      'APPLICATION',
      SCHOOL_APPLICATION_NUMBER_PREFIX,
      year.code,
    );
    return this.prisma.schoolApplication.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        applicationNumber,
        status: 'SUBMITTED',
        fullName: dto.fullName.trim(),
        gender: dto.gender?.trim() || null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        address: dto.address?.trim() || null,
        previousSchoolName: dto.previousSchoolName?.trim() || null,
        previousClass: dto.previousClass?.trim() || null,
        guardianName: dto.guardianName.trim(),
        guardianRelation: dto.guardianRelation?.trim() || 'Parent',
        guardianPhone: dto.guardianPhone?.trim() || null,
        guardianEmail: dto.guardianEmail?.trim().toLowerCase() || null,
      },
    });
  }

  async listApplications(tenantId: string, status?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolApplication.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: { cycle: true, student: true },
      orderBy: { submittedAt: 'desc' },
      take: 300,
    });
  }

  async patchStatus(
    tenantId: string,
    applicationId: string,
    dto: PatchApplicationStatusDto,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!row) throw new NotFoundException('Application not found');
    if (row.status === 'ENROLLED') {
      throw new BadRequestException(
        'Converted applications cannot change status',
      );
    }
    return this.prisma.schoolApplication.update({
      where: { id: row.id },
      data: { status: dto.status },
    });
  }

  async convert(
    tenantId: string,
    applicationId: string,
    dto: ConvertApplicationDto,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const application = await this.prisma.schoolApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.studentId) {
      throw new ConflictException('Application already converted');
    }
    if (
      !['OFFERED', 'SUBMITTED', 'UNDER_REVIEW'].includes(application.status)
    ) {
      throw new BadRequestException('Application is not eligible to convert');
    }
    const student = await this.sis.createStudent(
      tenantId,
      {
        fullName: application.fullName,
        gender: application.gender ?? undefined,
        dateOfBirth: application.dateOfBirth
          ? application.dateOfBirth.toISOString().slice(0, 10)
          : undefined,
        phone: application.phone ?? undefined,
        email: application.email ?? undefined,
        address: application.address ?? undefined,
        guardianName: application.guardianName,
        guardianPhone: application.guardianPhone ?? undefined,
        guardianRelation: application.guardianRelation,
        previousSchoolName: application.previousSchoolName ?? undefined,
        previousClass: application.previousClass ?? undefined,
      },
      actorUserId,
    );
    await this.sis.enroll(tenantId, {
      studentId: student.id,
      sectionId: dto.sectionId,
    });
    await this.prisma.schoolEnrollment.updateMany({
      where: { tenantId, studentId: student.id, sectionId: dto.sectionId },
      data: { source: 'APPLICATION' },
    });
    await this.prisma.schoolEnrollmentEvent.create({
      data: {
        tenantId,
        studentId: student.id,
        type: 'ADMITTED',
        toSectionId: dto.sectionId,
        note: `Converted from ${application.applicationNumber}`,
        actorUserId: actorUserId ?? null,
      },
    });
    return this.prisma.schoolApplication.update({
      where: { id: application.id },
      data: {
        status: 'ENROLLED',
        studentId: student.id,
        convertedAt: new Date(),
      },
      include: { student: true },
    });
  }
}
