import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { DEFAULT_EXAM_FEE_HEADS } from '../constants/exam-fee.constants';
import type {
  CreateExamFeeMasterDto,
  UpdateExamFeeMasterDto,
} from '../dto/examination-fees.dto';
import {
  requireExamFeeDelegate,
  rethrowExamFeeError,
} from '../utils/exam-fee-prisma.util';

@Injectable()
export class ExamFeeMasterService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private masters() {
    return requireExamFeeDelegate(this.db().examFeeMaster, 'examFeeMaster');
  }

  private lines() {
    return requireExamFeeDelegate(
      this.db().examFeeMasterLine,
      'examFeeMasterLine',
    );
  }

  async list(tenantId: string) {
    try {
      return await this.masters().findMany({
        where: { tenantId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      });
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }

  async get(tenantId: string, id: string) {
    try {
      const row = await this.masters().findFirst({
        where: { id, tenantId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!row) throw new NotFoundException('Exam fee master not found');
      return row;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      rethrowExamFeeError(error);
    }
  }

  async create(user: JwtUser, dto: CreateExamFeeMasterDto) {
    try {
      const lines = dto.lines?.length
        ? dto.lines
        : DEFAULT_EXAM_FEE_HEADS.map((h) => ({
            headCode: h.headCode,
            headName: h.headName,
            amount: h.amount,
            unit: h.unit,
            sortOrder: h.sortOrder,
            isActive: true,
          }));

      if (dto.isActive !== false) {
        await this.masters().updateMany({
          where: { tenantId: user.tid, isActive: true },
          data: { isActive: false },
        });
      }

      return await this.masters().create({
        data: {
          tenantId: user.tid,
          name: dto.name,
          academicYearId: dto.academicYearId ?? null,
          academicYearLabel: dto.academicYearLabel ?? null,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          isActive: dto.isActive ?? true,
          createdById: user.sub,
          lines: {
            create: lines.map((line, index) => ({
              tenantId: user.tid,
              headCode: line.headCode,
              headName: line.headName,
              amount: line.amount,
              unit: line.unit,
              sortOrder: line.sortOrder ?? index * 10,
              isActive: line.isActive ?? true,
            })),
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }

  async update(user: JwtUser, id: string, dto: UpdateExamFeeMasterDto) {
    try {
      await this.get(user.tid, id);
      if (dto.isActive === true) {
        await this.masters().updateMany({
          where: { tenantId: user.tid, isActive: true, NOT: { id } },
          data: { isActive: false },
        });
      }

      if (dto.lines) {
        await this.lines().deleteMany({
          where: { masterId: id, tenantId: user.tid },
        });
      }

      return await this.masters().update({
        where: { id },
        data: {
          ...(dto.name != null ? { name: dto.name } : {}),
          ...(dto.academicYearId !== undefined
            ? { academicYearId: dto.academicYearId ?? null }
            : {}),
          ...(dto.academicYearLabel !== undefined
            ? { academicYearLabel: dto.academicYearLabel ?? null }
            : {}),
          ...(dto.effectiveFrom !== undefined
            ? {
                effectiveFrom: dto.effectiveFrom
                  ? new Date(dto.effectiveFrom)
                  : null,
              }
            : {}),
          ...(dto.effectiveTo !== undefined
            ? {
                effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
              }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line, index) => ({
                    tenantId: user.tid,
                    headCode: line.headCode,
                    headName: line.headName,
                    amount: line.amount,
                    unit: line.unit,
                    sortOrder: line.sortOrder ?? index * 10,
                    isActive: line.isActive ?? true,
                  })),
                },
              }
            : {}),
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      rethrowExamFeeError(error);
    }
  }

  async getActiveMaster(tenantId: string) {
    try {
      const master = await this.masters().findFirst({
        where: { tenantId, isActive: true },
        include: {
          lines: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (!master) {
        throw new BadRequestException(
          'No active Examination Fee Master configured. Set up fees under Examination Fee Setup.',
        );
      }
      return master;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      rethrowExamFeeError(error);
    }
  }

  async seedDefaults(user: JwtUser) {
    try {
      const existing = await this.masters().count({
        where: { tenantId: user.tid },
      });
      if (existing > 0) {
        return this.list(user.tid);
      }
      return [
        await this.create(user, {
          name: 'NEHU Semester Examination Fee Schedule',
          isActive: true,
        }),
      ];
    } catch (error) {
      rethrowExamFeeError(error);
    }
  }
}
