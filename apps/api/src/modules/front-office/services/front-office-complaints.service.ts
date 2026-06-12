import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateComplaintDto,
  ListQueryDto,
  UpdateComplaintDto,
} from '../dto/front-office.dto';
import { nextFrontOfficeNumber } from '../utils/front-office-numbers';

@Injectable()
export class FrontOfficeComplaintsService {
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
              { subject: { contains: query.q, mode: 'insensitive' as const } },
              {
                complainantName: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
              { ticketNo: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.frontOfficeComplaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.frontOfficeComplaint.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(user: JwtUser, dto: CreateComplaintDto) {
    const ticketNo = await nextFrontOfficeNumber(
      this.prisma,
      user.tid,
      'FO-C',
      'complaint',
    );
    return this.prisma.frontOfficeComplaint.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        ticketNo,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        complainantName: dto.complainantName.trim(),
        complainantMobile: dto.complainantMobile?.trim(),
        complainantEmail: dto.complainantEmail?.trim(),
        studentId: dto.studentId,
        staffProfileId: dto.staffProfileId,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        createdById: user.sub,
        status: 'OPEN',
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateComplaintDto) {
    const row = await this.prisma.frontOfficeComplaint.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Complaint not found');

    const resolvedAt =
      dto.status === 'RESOLVED' || dto.status === 'CLOSED'
        ? new Date()
        : undefined;

    return this.prisma.frontOfficeComplaint.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedToId:
          dto.assignedToId === undefined ? undefined : dto.assignedToId,
        resolution: dto.resolution,
        resolvedAt:
          resolvedAt ??
          (dto.status === 'OPEN' ||
          dto.status === 'ASSIGNED' ||
          dto.status === 'IN_PROGRESS'
            ? null
            : undefined),
      },
    });
  }
}
