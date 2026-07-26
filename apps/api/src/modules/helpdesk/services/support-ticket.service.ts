import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { SUPPORT_TICKET_FLOW } from '../constants/support-centre.constants';
import { SupportRoutingService } from './support-routing.service';
import { SupportSettingsService } from './support-settings.service';

@Injectable()
export class SupportTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: SupportRoutingService,
    private readonly settings: SupportSettingsService,
    @Optional() private readonly notifications?: UserNotificationsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async nextTicketNo(tenantId: string) {
    const year = new Date().getFullYear();
    const seq = await this.db().supportTicketSequence.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { id: randomUUID(), tenantId, year, currentNo: 1 },
      update: { currentNo: { increment: 1 } },
    });
    const n = seq.currentNo as number;
    return `SUP-${year}-${String(n).padStart(6, '0')}`;
  }

  async create(
    user: JwtUser,
    dto: {
      category?: string;
      subject: string;
      description?: string;
      priority?: string;
      attachmentUrl?: string;
      requesterType?: 'STUDENT' | 'STAFF';
      requesterUserId?: string;
      assigneeUserId?: string;
      chatThreadId?: string;
    },
  ) {
    await this.settings.ensureBootstrap(user.tid);
    const category = (dto.category ?? 'GENERAL').toUpperCase();
    const departmentId = await this.routing.resolveDepartmentId(
      user.tid,
      category,
    );
    const ticketNo = await this.nextTicketNo(user.tid);
    const ticket = await this.db().supportTicket.create({
      data: {
        tenantId: user.tid,
        ticketNo,
        category,
        subject: dto.subject.trim(),
        description: dto.description ?? '',
        priority: dto.priority ?? 'MEDIUM',
        status: dto.assigneeUserId ? 'ASSIGNED' : 'OPEN',
        requesterUserId: dto.requesterUserId ?? user.sub,
        requesterType: dto.requesterType ?? 'STAFF',
        assigneeUserId: dto.assigneeUserId ?? null,
        departmentId,
        attachmentUrl: dto.attachmentUrl ?? null,
      },
      include: { department: true, comments: true },
    });

    if (dto.chatThreadId) {
      await this.db().supportChatThread.update({
        where: { id: dto.chatThreadId },
        data: { ticketId: ticket.id, status: 'WAITING' },
      });
    }

    return ticket;
  }

  async createFromChat(
    user: JwtUser,
    threadId: string,
    dto: {
      category?: string;
      subject?: string;
      description?: string;
      priority?: string;
      assigneeUserId?: string;
    } = {},
  ) {
    const thread = await this.db().supportChatThread.findFirst({
      where: { id: threadId, tenantId: user.tid },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
          select: {
            senderRole: true,
            bodyOriginal: true,
            bodyTranslated: true,
            createdAt: true,
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');
    if (thread.ticketId) {
      return this.get(user.tid, thread.ticketId as string, { staff: true });
    }

    const transcript = (thread.messages ?? [])
      .map(
        (m: {
          senderRole: string;
          bodyOriginal: string;
          bodyTranslated?: string | null;
          createdAt: Date;
        }) =>
          `[${new Date(m.createdAt).toISOString()}] ${m.senderRole}: ${
            m.bodyTranslated || m.bodyOriginal
          }`,
      )
      .join('\n');

    const ticket = await this.create(user, {
      category: dto.category ?? thread.category,
      subject:
        dto.subject?.trim() ||
        thread.subject ||
        `Chat ${thread.category} — ${new Date().toLocaleDateString()}`,
      description:
        dto.description?.trim() ||
        `Converted from live chat.\n\nTranscript:\n${transcript}`,
      priority: dto.priority ?? 'MEDIUM',
      requesterType: 'STUDENT',
      requesterUserId: thread.studentUserId as string,
      assigneeUserId: dto.assigneeUserId,
      chatThreadId: threadId,
    });

    await this.db().supportTicketComment.create({
      data: {
        tenantId: user.tid,
        ticketId: ticket.id,
        authorUserId: user.sub,
        body: 'Ticket created from live chat.',
        isInternal: true,
      },
    });

    return this.get(user.tid, ticket.id, { staff: true });
  }

  async list(
    tenantId: string,
    query: {
      status?: string;
      assigneeUserId?: string;
      requesterUserId?: string;
      category?: string;
      q?: string;
    } = {},
  ) {
    return this.db().supportTicket.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.assigneeUserId
          ? { assigneeUserId: query.assigneeUserId }
          : {}),
        ...(query.requesterUserId
          ? { requesterUserId: query.requesterUserId }
          : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.q
          ? {
              OR: [
                { subject: { contains: query.q, mode: 'insensitive' } },
                { ticketNo: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        department: true,
        comments: { orderBy: { createdAt: 'asc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async get(
    tenantId: string,
    id: string,
    opts?: { forUserId?: string; staff?: boolean },
  ) {
    const row = await this.db().supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        comments: {
          where: opts?.staff ? undefined : { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
        chatThread: true,
      },
    });
    if (!row) throw new NotFoundException('Ticket not found');
    if (
      opts?.forUserId &&
      !opts.staff &&
      row.requesterUserId !== opts.forUserId
    ) {
      throw new ForbiddenException('Not your ticket');
    }
    return row;
  }

  async assign(user: JwtUser, id: string, assigneeUserId: string) {
    const ticket = await this.get(user.tid, id, { staff: true });
    const updated = await this.db().supportTicket.update({
      where: { id },
      data: {
        assigneeUserId,
        status: ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status,
      },
      include: { department: true },
    });
    await this.notifyRequester(
      user.tid,
      updated,
      'Ticket assigned',
      `Your ticket ${updated.ticketNo} has been assigned to a support agent.`,
    );
    return updated;
  }

  async comment(
    user: JwtUser,
    id: string,
    body: string,
    isInternal = false,
    attachmentUrl?: string,
  ) {
    await this.get(user.tid, id, { staff: true });
    return this.db().supportTicketComment.create({
      data: {
        tenantId: user.tid,
        ticketId: id,
        authorUserId: user.sub,
        body: body.trim(),
        isInternal,
        attachmentUrl: attachmentUrl ?? null,
      },
    });
  }

  async studentComment(user: JwtUser, id: string, body: string) {
    await this.get(user.tid, id, { forUserId: user.sub });
    return this.db().supportTicketComment.create({
      data: {
        tenantId: user.tid,
        ticketId: id,
        authorUserId: user.sub,
        body: body.trim(),
        isInternal: false,
      },
    });
  }

  async transition(user: JwtUser, id: string, status: string) {
    const ticket = await this.get(user.tid, id, { staff: true });
    const allowed = SUPPORT_TICKET_FLOW[ticket.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${status}`,
      );
    }
    const now = new Date();
    const updated = await this.db().supportTicket.update({
      where: { id },
      data: {
        status,
        resolvedAt:
          status === 'RESOLVED' ? now : (ticket.resolvedAt as Date | null),
        closedAt: status === 'CLOSED' ? now : (ticket.closedAt as Date | null),
      },
    });
    await this.notifyRequester(
      user.tid,
      updated,
      'Ticket status updated',
      `Ticket ${updated.ticketNo} is now ${status.replace(/_/g, ' ')}.`,
    );
    return updated;
  }

  async rate(user: JwtUser, id: string, score: number, note?: string) {
    if (score < 1 || score > 5) {
      throw new BadRequestException('Score must be 1–5');
    }
    const ticket = await this.get(user.tid, id, { forUserId: user.sub });
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new BadRequestException('Rate only after resolution');
    }
    return this.db().supportTicket.update({
      where: { id },
      data: {
        satisfactionScore: score,
        satisfactionNote: note?.trim() || null,
      },
    });
  }

  private async notifyRequester(
    tenantId: string,
    ticket: {
      requesterUserId?: string | null;
      ticketNo: string;
      id: string;
    },
    title: string,
    body: string,
  ) {
    if (!ticket.requesterUserId || !this.notifications) return;
    try {
      await this.notifications.createInApp({
        tenantId,
        userId: ticket.requesterUserId,
        type: 'SUPPORT_TICKET',
        title,
        body,
        link: `/student/support/tickets/${ticket.id}`,
      });
    } catch {
      // soft-fail
    }
  }
}
