import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateCalendarEventDto } from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';
import { NaacCalendarNotifyService } from './naac-calendar-notify.service';

@Injectable()
export class NaacCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NaacCalendarNotifyService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async list(tenantId: string) {
    return this.db().naacCalendarEvent.findMany({
      where: { tenantId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async create(user: JwtUser, dto: CreateCalendarEventDto) {
    const event = await this.db().naacCalendarEvent.create({
      data: {
        tenantId: user.tid,
        title: dto.title,
        eventType: dto.eventType,
        dueDate: new Date(dto.dueDate),
        description: dto.description,
      },
    });
    void this.notify.notifyEventCreated(user.tid, event);
    return event;
  }

  async remove(user: JwtUser, id: string) {
    const row = await this.db().naacCalendarEvent.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Calendar event not found');
    return this.db().naacCalendarEvent.delete({ where: { id } });
  }
}

@Injectable()
export class NaacSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async get(tenantId: string) {
    return this.db().naacSettings.findUnique({ where: { tenantId } });
  }

  async update(
    tenantId: string,
    dto: {
      activeAqarYear?: string;
      institutionProfile?: Record<string, unknown>;
    },
  ) {
    return this.db().naacSettings.upsert({
      where: { tenantId },
      update: dto,
      create: { tenantId, ...dto },
    });
  }
}
