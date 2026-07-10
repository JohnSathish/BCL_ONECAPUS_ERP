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

@Injectable()
export class ExamFeeMasterService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string) {
    return this.db().examFeeMaster.findMany({
      where: { tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().examFeeMaster.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Exam fee master not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateExamFeeMasterDto) {
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
      await this.db().examFeeMaster.updateMany({
        where: { tenantId: user.tid, isActive: true },
        data: { isActive: false },
      });
    }

    return this.db().examFeeMaster.create({
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
  }

  async update(user: JwtUser, id: string, dto: UpdateExamFeeMasterDto) {
    await this.get(user.tid, id);
    if (dto.isActive === true) {
      await this.db().examFeeMaster.updateMany({
        where: { tenantId: user.tid, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    if (dto.lines) {
      await this.db().examFeeMasterLine.deleteMany({
        where: { masterId: id, tenantId: user.tid },
      });
    }

    return this.db().examFeeMaster.update({
      where: { id },
      data: {
        name: dto.name,
        academicYearId: dto.academicYearId ?? null,
        academicYearLabel: dto.academicYearLabel ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isActive: dto.isActive ?? undefined,
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
  }

  async getActiveMaster(tenantId: string) {
    const master = await this.db().examFeeMaster.findFirst({
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
  }

  async seedDefaults(user: JwtUser) {
    const existing = await this.db().examFeeMaster.count({
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
  }
}
