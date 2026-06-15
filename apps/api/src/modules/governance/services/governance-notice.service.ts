import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  CreateNoticeDto,
  ListQueryDto,
  UpdateNoticeDto,
} from '../dto/governance.dto';
import { GovernanceNotificationService } from './governance-notification.service';
import { GovernanceSettingsService } from './governance-settings.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceNoticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GovernanceSettingsService,
    private readonly notifications: GovernanceNotificationService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: ListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.committeeId) where.committeeId = query.committeeId;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { noticeNo: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().governanceNotice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceNotice.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceNotice.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    });
    if (!row) throw new NotFoundException('Notice not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateNoticeDto) {
    return this.db().governanceNotice.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        title: dto.title.trim(),
        body: dto.body,
        audience: dto.audience ?? 'COMMITTEE',
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateNoticeDto) {
    const row = await this.getById(user.tid, id);
    if (row.status === 'PUBLISHED') {
      throw new NotFoundException('Published notice cannot be edited');
    }

    return this.db().governanceNotice.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        body: dto.body,
        audience: dto.audience,
        status: dto.status,
      },
    });
  }

  async publish(user: JwtUser, id: string) {
    const row = await this.getById(user.tid, id);
    if (row.status === 'PUBLISHED') return row;

    const cfg = await this.settings.get(user.tid);
    const seq = await this.db().governanceNotice.count({
      where: { tenantId: user.tid, status: 'PUBLISHED' },
    });
    const noticeNo = `${cfg.noticePrefix}/${new Date().getFullYear()}/${String(seq + 1).padStart(3, '0')}`;

    const published = await this.db().governanceNotice.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        noticeNo,
      },
      include: { committee: { select: { name: true, shortCode: true } } },
    });

    await this.notifications.notifyNoticePublished(user.tid, published);
    return published;
  }
}
