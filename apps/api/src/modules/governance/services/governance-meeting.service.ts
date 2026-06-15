import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  CalendarQueryDto,
  CreateMeetingDto,
  ListQueryDto,
  UpdateMeetingDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceMeetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly committees: GovernanceCommitteeService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: ListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.committeeId) where.committeeId = query.committeeId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.meetingDate = {};
      if (query.from)
        (where.meetingDate as Record<string, Date>).gte = new Date(query.from);
      if (query.to)
        (where.meetingDate as Record<string, Date>).lte = new Date(query.to);
    }
    if (query.q) {
      where.OR = [{ title: { contains: query.q, mode: 'insensitive' } }];
    }

    const [items, total] = await Promise.all([
      this.db().governanceMeeting.findMany({
        where,
        skip,
        take,
        orderBy: { meetingDate: 'desc' },
        include: {
          committee: { select: { name: true, shortCode: true } },
          _count: { select: { attendances: true, agendaItems: true } },
        },
      }),
      this.db().governanceMeeting.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceMeeting.findFirst({
      where: { id, tenantId },
      include: {
        committee: { select: { name: true, shortCode: true } },
        agendaItems: { orderBy: { sortOrder: 'asc' } },
        attendances: true,
        minutes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!row) throw new NotFoundException('Meeting not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateMeetingDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    const qrToken = randomBytes(16).toString('hex');

    const meeting = await this.db().governanceMeeting.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        title: dto.title.trim(),
        meetingDate: new Date(dto.meetingDate),
        meetingTime: dto.meetingTime,
        venue: dto.venue,
        meetingMode: dto.meetingMode ?? 'PHYSICAL',
        agenda: dto.agenda,
        priority: dto.priority ?? 'NORMAL',
        qrToken,
        createdById: user.sub,
      },
    });

    if (dto.agendaItems?.length) {
      await this.db().governanceMeetingAgendaItem.createMany({
        data: dto.agendaItems.map((item, index) => ({
          tenantId: user.tid,
          meetingId: meeting.id,
          title: item.title,
          description: item.description,
          sortOrder: item.sortOrder ?? index,
        })),
      });
    }

    return this.getById(user.tid, meeting.id);
  }

  async update(user: JwtUser, id: string, dto: UpdateMeetingDto) {
    await this.getById(user.tid, id);

    await this.db().governanceMeeting.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        meetingDate: dto.meetingDate ? new Date(dto.meetingDate) : undefined,
        meetingTime: dto.meetingTime,
        venue: dto.venue,
        meetingMode: dto.meetingMode,
        agenda: dto.agenda,
        priority: dto.priority,
        status: dto.status,
      },
    });

    if (dto.agendaItems) {
      await this.db().governanceMeetingAgendaItem.deleteMany({
        where: { meetingId: id },
      });
      if (dto.agendaItems.length) {
        await this.db().governanceMeetingAgendaItem.createMany({
          data: dto.agendaItems.map((item, index) => ({
            tenantId: user.tid,
            meetingId: id,
            title: item.title,
            description: item.description,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }
    }

    return this.getById(user.tid, id);
  }

  async calendarFeed(tenantId: string, query: CalendarQueryDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = query.to
      ? new Date(query.to)
      : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    const where: Record<string, unknown> = {
      tenantId,
      meetingDate: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    };
    if (query.committeeId) where.committeeId = query.committeeId;

    const meetings = await this.db().governanceMeeting.findMany({
      where,
      orderBy: { meetingDate: 'asc' },
      include: {
        committee: { select: { name: true, shortCode: true, category: true } },
      },
    });

    return meetings.map((m: Record<string, unknown>) => ({
      id: m.id,
      title: m.title,
      start: m.meetingDate,
      end: m.meetingDate,
      meetingTime: m.meetingTime,
      venue: m.venue,
      status: m.status,
      mode: m.meetingMode,
      committee: m.committee,
    }));
  }

  async regenerateQrToken(user: JwtUser, id: string) {
    await this.getById(user.tid, id);
    const qrToken = randomBytes(16).toString('hex');
    return this.db().governanceMeeting.update({
      where: { id },
      data: { qrToken },
      select: { id: true, qrToken: true },
    });
  }
}
