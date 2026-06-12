import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateEnquiryDto,
  ListQueryDto,
  UpdateEnquiryDto,
} from '../dto/front-office.dto';
import { nextFrontOfficeNumber } from '../utils/front-office-numbers';

@Injectable()
export class FrontOfficeEnquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' as const } },
              { mobile: { contains: query.q, mode: 'insensitive' as const } },
              {
                enquiryNo: { contains: query.q, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.frontOfficeEnquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.frontOfficeEnquiry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(user: JwtUser, dto: CreateEnquiryDto) {
    const enquiryNo = await nextFrontOfficeNumber(
      this.prisma,
      user.tid,
      'FO-E',
      'enquiry',
    );
    return this.prisma.frontOfficeEnquiry.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        enquiryNo,
        enquiryType: dto.enquiryType,
        fullName: dto.fullName.trim(),
        mobile: dto.mobile?.trim(),
        email: dto.email?.trim(),
        programmeInterest: dto.programmeInterest?.trim(),
        source: dto.source?.trim(),
        notes: dto.notes?.trim(),
        admissionApplicationId: dto.admissionApplicationId,
        createdById: user.sub,
        status: 'OPEN',
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateEnquiryDto) {
    const row = await this.prisma.frontOfficeEnquiry.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Enquiry not found');

    const resolvedAt =
      dto.status === 'RESOLVED' || dto.status === 'CLOSED'
        ? new Date()
        : undefined;

    return this.prisma.frontOfficeEnquiry.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes === undefined ? undefined : dto.notes,
        assignedToId:
          dto.assignedToId === undefined ? undefined : dto.assignedToId,
        resolvedAt:
          resolvedAt ??
          (dto.status === 'OPEN' || dto.status === 'IN_PROGRESS'
            ? null
            : undefined),
      },
    });
  }
}
