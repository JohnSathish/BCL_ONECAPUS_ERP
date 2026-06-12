import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AcademicCatalogService } from '../programs-courses/academic-catalog.service';

@Injectable()
export class AdmissionsValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AcademicCatalogService,
  ) {}

  async validateIntakeProgram(tenantId: string, programId: string) {
    return this.catalog.assertProgramReadyForAdmission(tenantId, programId);
  }

  async validateApplication(
    tenantId: string,
    intakeId: string,
    preferredShiftId?: string | null,
  ) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: intakeId, tenantId, deletedAt: null },
      include: { program: { include: { department: true } } },
    });
    if (!intake) {
      throw new BadRequestException('Admission intake not found');
    }
    if (intake.status !== 'open') {
      throw new BadRequestException('Intake is not open for applications');
    }

    const { programVersion, hasStructureRules } =
      await this.catalog.assertProgramReadyForAdmission(
        tenantId,
        intake.programId,
      );

    const activeApplications = await this.prisma.admissionApplication.count({
      where: {
        intakeId,
        deletedAt: null,
        status: { notIn: ['rejected', 'withdrawn'] },
      },
    });

    if (activeApplications >= intake.totalSeats) {
      throw new BadRequestException(
        `Intake "${intake.code}" has no general seats remaining (${intake.totalSeats} total)`,
      );
    }

    if (preferredShiftId) {
      const shiftCap = await this.prisma.admissionIntakeShift.findFirst({
        where: { intakeId, shiftId: preferredShiftId },
      });
      if (!shiftCap) {
        throw new BadRequestException(
          'Selected shift is not open for this intake',
        );
      }
      const shiftAllocated = await this.prisma.seatAllocation.count({
        where: {
          intakeId,
          shiftId: preferredShiftId,
          deletedAt: null,
          status: { not: 'withdrawn' },
        },
      });
      const shiftApplied = await this.prisma.admissionApplication.count({
        where: {
          intakeId,
          preferredShiftId,
          deletedAt: null,
          status: { notIn: ['rejected', 'withdrawn'] },
        },
      });
      const shiftDemand = Math.max(shiftAllocated, shiftApplied);
      if (shiftDemand >= shiftCap.totalSeats) {
        throw new BadRequestException(
          'No seats remaining for the selected shift',
        );
      }
    }

    return {
      intake,
      program: intake.program,
      programVersion,
      hasStructureRules,
      seatsRemaining: intake.totalSeats - activeApplications,
    };
  }
}
