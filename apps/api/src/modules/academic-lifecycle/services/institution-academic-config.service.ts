import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { UpsertInstitutionAcademicConfigDto } from '../dto/academic-lifecycle.dto';

@Injectable()
export class InstitutionAcademicConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, institutionId: string) {
    await this.assertInstitution(tenantId, institutionId);
    let row = await this.prisma.institutionAcademicConfig.findUnique({
      where: { institutionId },
    });
    if (!row) {
      row = await this.prisma.institutionAcademicConfig.create({
        data: {
          tenantId,
          institutionId,
        },
      });
    }
    return row;
  }

  async upsert(
    tenantId: string,
    institutionId: string,
    dto: UpsertInstitutionAcademicConfigDto,
  ) {
    await this.assertInstitution(tenantId, institutionId);
    if (dto.maxActiveSemesters !== undefined && dto.maxActiveSemesters > 8) {
      throw new BadRequestException('maxActiveSemesters cannot exceed 8');
    }
    if (
      dto.terminalSemesterNumber !== undefined &&
      dto.maxActiveSemesters !== undefined &&
      dto.terminalSemesterNumber > dto.maxActiveSemesters
    ) {
      throw new BadRequestException(
        'terminalSemesterNumber cannot exceed maxActiveSemesters',
      );
    }

    return this.prisma.institutionAcademicConfig.upsert({
      where: { institutionId },
      create: {
        tenantId,
        institutionId,
        ...dto,
      },
      update: { ...dto },
    });
  }

  async assertSemesterNumberAllowed(
    tenantId: string,
    institutionId: string,
    semesterNumber: number,
  ) {
    const config = await this.get(tenantId, institutionId);
    if (semesterNumber > config.maxActiveSemesters) {
      throw new BadRequestException(
        `Semester ${semesterNumber} exceeds institution maximum (${config.maxActiveSemesters}). ` +
          'Postgraduate or extended semesters are not enabled for this institution.',
      );
    }
    if (
      !config.allowPostgraduateContinuation &&
      semesterNumber > config.terminalSemesterNumber
    ) {
      throw new BadRequestException(
        `Semester ${semesterNumber} is beyond the terminal semester (${config.terminalSemesterNumber}).`,
      );
    }
    return config;
  }

  private async assertInstitution(tenantId: string, institutionId: string) {
    const row = await this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Institution not found');
    return row;
  }
}
