import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  CreateExamFeeSessionDto,
  UpdateExamFeeSessionDto,
} from '../dto/examination-fees.dto';

@Injectable()
export class ExamFeeSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string) {
    return this.db().examFeeSession.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().examFeeSession.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Examination fee session not found');
    return row;
  }

  async getActive(tenantId: string) {
    return this.db().examFeeSession.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(user: JwtUser, dto: CreateExamFeeSessionDto) {
    return this.db().examFeeSession.create({
      data: {
        tenantId: user.tid,
        name: dto.name,
        academicYearId: dto.academicYearId ?? null,
        academicYearLabel: dto.academicYearLabel ?? null,
        semesterCycle: dto.semesterCycle,
        applicableSemesters: dto.applicableSemesters,
        applicationStartDate: dto.applicationStartDate
          ? new Date(dto.applicationStartDate)
          : null,
        applicationEndDate: dto.applicationEndDate
          ? new Date(dto.applicationEndDate)
          : null,
        lateFeeDate: dto.lateFeeDate ? new Date(dto.lateFeeDate) : null,
        status: dto.status ?? 'DRAFT',
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateExamFeeSessionDto) {
    await this.get(user.tid, id);
    if (dto.status === 'ACTIVE') {
      await this.db().examFeeSession.updateMany({
        where: { tenantId: user.tid, status: 'ACTIVE', NOT: { id } },
        data: { status: 'CLOSED' },
      });
    }
    return this.db().examFeeSession.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.academicYearId !== undefined
          ? { academicYearId: dto.academicYearId ?? null }
          : {}),
        ...(dto.academicYearLabel !== undefined
          ? { academicYearLabel: dto.academicYearLabel ?? null }
          : {}),
        ...(dto.semesterCycle != null
          ? { semesterCycle: dto.semesterCycle }
          : {}),
        ...(dto.applicableSemesters != null
          ? { applicableSemesters: dto.applicableSemesters }
          : {}),
        ...(dto.applicationStartDate !== undefined
          ? {
              applicationStartDate: dto.applicationStartDate
                ? new Date(dto.applicationStartDate)
                : null,
            }
          : {}),
        ...(dto.applicationEndDate !== undefined
          ? {
              applicationEndDate: dto.applicationEndDate
                ? new Date(dto.applicationEndDate)
                : null,
            }
          : {}),
        ...(dto.lateFeeDate !== undefined
          ? {
              lateFeeDate: dto.lateFeeDate ? new Date(dto.lateFeeDate) : null,
            }
          : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
      },
    });
  }

  async assertOpenForApplications(tenantId: string, sessionId: string) {
    const session = await this.get(tenantId, sessionId);
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Examination fee session is not active for applications.',
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (
      session.applicationStartDate &&
      today < new Date(session.applicationStartDate)
    ) {
      throw new BadRequestException('Application window has not started yet.');
    }
    if (
      session.applicationEndDate &&
      today > new Date(session.applicationEndDate)
    ) {
      throw new BadRequestException('Application window has closed.');
    }
    return session;
  }
}
