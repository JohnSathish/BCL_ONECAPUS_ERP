import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from '../dto/academic-lifecycle.dto';

@Injectable()
export class AcademicSessionService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, institutionId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId, institutionId, deletedAt: null },
      orderBy: [{ academicYearIndex: 'asc' }, { startDate: 'asc' }],
      include: {
        semesters: {
          where: { deletedAt: null },
          orderBy: { progressionOrder: 'asc' },
        },
      },
    });
  }

  async create(
    tenantId: string,
    institutionId: string,
    dto: CreateAcademicSessionDto,
  ) {
    if (dto.endDate <= dto.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (dto.isPrimarySession) {
      await this.prisma.academicYear.updateMany({
        where: { tenantId, institutionId, deletedAt: null },
        data: { isPrimarySession: false },
      });
    }

    return this.prisma.academicYear.create({
      data: {
        tenantId,
        institutionId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: dto.status ?? 'UPCOMING',
        academicYearIndex: dto.academicYearIndex,
        isPrimarySession: dto.isPrimarySession ?? false,
      },
    });
  }

  async update(
    tenantId: string,
    sessionId: string,
    dto: UpdateAcademicSessionDto,
  ) {
    const session = await this.get(tenantId, sessionId);

    if (dto.startDate && dto.endDate && dto.endDate <= dto.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (dto.isPrimarySession) {
      await this.prisma.academicYear.updateMany({
        where: {
          tenantId,
          institutionId: session.institutionId,
          deletedAt: null,
          id: { not: sessionId },
        },
        data: { isPrimarySession: false },
      });
    }

    return this.prisma.academicYear.update({
      where: { id: sessionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.academicYearIndex !== undefined
          ? { academicYearIndex: dto.academicYearIndex }
          : {}),
        ...(dto.isPrimarySession !== undefined
          ? { isPrimarySession: dto.isPrimarySession }
          : {}),
      },
    });
  }

  async get(tenantId: string, sessionId: string) {
    const session = await this.prisma.academicYear.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Academic session not found');
    return session;
  }
}
