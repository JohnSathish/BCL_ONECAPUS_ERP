import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

const STATUS_FLOW: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED', 'OPEN'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

@Injectable()
export class HelpdeskService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async nextTicketNo(tenantId: string) {
    const count = await this.db().supportTicket.count({ where: { tenantId } });
    return `HD-${String(count + 1).padStart(5, '0')}`;
  }

  async create(
    user: JwtUser,
    dto: {
      category?: string;
      subject: string;
      description?: string;
      priority?: string;
    },
  ) {
    const ticketNo = await this.nextTicketNo(user.tid);
    return this.db().supportTicket.create({
      data: {
        tenantId: user.tid,
        ticketNo,
        category: dto.category ?? 'GENERAL',
        subject: dto.subject.trim(),
        description: dto.description ?? '',
        priority: dto.priority ?? 'MEDIUM',
        status: 'OPEN',
        requesterUserId: user.sub,
        requesterType: 'STAFF',
      },
    });
  }

  async list(
    tenantId: string,
    query: { status?: string; assigneeUserId?: string } = {},
  ) {
    return this.db().supportTicket.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.assigneeUserId
          ? { assigneeUserId: query.assigneeUserId }
          : {}),
      },
      include: { comments: { orderBy: { createdAt: 'asc' }, take: 3 } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.db().supportTicket.findFirst({
      where: { id, tenantId },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    return row;
  }

  async assign(user: JwtUser, id: string, assigneeUserId: string) {
    await this.get(user.tid, id);
    return this.db().supportTicket.update({
      where: { id },
      data: {
        assigneeUserId,
        status: 'IN_PROGRESS',
      },
    });
  }

  async comment(user: JwtUser, id: string, body: string, isInternal = false) {
    await this.get(user.tid, id);
    return this.db().supportTicketComment.create({
      data: {
        tenantId: user.tid,
        ticketId: id,
        authorUserId: user.sub,
        body: body.trim(),
        isInternal,
      },
    });
  }

  async transition(user: JwtUser, id: string, status: string) {
    const ticket = await this.get(user.tid, id);
    const allowed = STATUS_FLOW[ticket.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${status}`,
      );
    }
    const now = new Date();
    return this.db().supportTicket.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? now : ticket.resolvedAt,
        closedAt: status === 'CLOSED' ? now : ticket.closedAt,
      },
    });
  }
}
