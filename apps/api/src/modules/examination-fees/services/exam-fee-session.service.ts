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
import {
  requireExamFeeDelegate,
  rethrowExamFeeError,
} from '../utils/exam-fee-prisma.util';

@Injectable()
export class ExamFeeSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private sessions() {
    return requireExamFeeDelegate(this.db().examFeeSession, 'examFeeSession');
  }

  async list(tenantId: string) {
    try {
      return await this.sessions().findMany({
        where: { tenantId },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      });
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }

  async get(tenantId: string, id: string) {
    try {
      const row = await this.sessions().findFirst({
        where: { id, tenantId },
      });
      if (!row)
        throw new NotFoundException('Examination fee session not found');
      return row;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      rethrowExamFeeError(error);
    }
  }

  async getActive(tenantId: string) {
    try {
      return await this.sessions().findFirst({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }

  async create(user: JwtUser, dto: CreateExamFeeSessionDto) {
    try {
      return await this.sessions().create({
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
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }

  async update(user: JwtUser, id: string, dto: UpdateExamFeeSessionDto) {
    try {
      await this.get(user.tid, id);
      if (dto.status === 'ACTIVE') {
        await this.sessions().updateMany({
          where: { tenantId: user.tid, status: 'ACTIVE', NOT: { id } },
          data: { status: 'CLOSED' },
        });
      }
      return await this.sessions().update({
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
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      rethrowExamFeeError(error);
    }
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
