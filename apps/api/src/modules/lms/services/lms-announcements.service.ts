import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateLmsAnnouncementDto } from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';
import { LmsNotificationService } from './lms-notification.service';

@Injectable()
export class LmsAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly audit: LmsAuditService,
    private readonly notifications: LmsNotificationService,
  ) {}

  listForWorkspace(user: JwtUser, workspaceId: string) {
    return this.list(user, workspaceId);
  }

  async list(user: JwtUser, workspaceId?: string) {
    if (workspaceId) {
      await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    }

    return this.prisma.lmsAnnouncement.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        ...(workspaceId ? { workspaceId } : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        workspace: { select: { id: true, title: true } },
      },
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }],
    });
  }

  async createForWorkspace(
    user: JwtUser,
    workspaceId: string,
    dto: CreateLmsAnnouncementDto,
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'announce');
    return this.create(user, { ...dto, workspaceId });
  }

  async createInstitution(user: JwtUser, dto: CreateLmsAnnouncementDto) {
    if (
      !this.access.hasAdminLms(user) &&
      !user.permissions.includes('lms:announcements:publish')
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.create(user, dto);
  }

  private async create(
    user: JwtUser,
    dto: CreateLmsAnnouncementDto & { workspaceId?: string },
  ) {
    const announcement = await this.prisma.lmsAnnouncement.create({
      data: {
        tenantId: user.tid,
        workspaceId: dto.workspaceId,
        title: dto.title,
        body: dto.body,
        type: dto.type ?? 'NOTICE',
        audience:
          dto.audience ?? (dto.workspaceId ? 'WORKSPACE' : 'INSTITUTION'),
        pinned: dto.pinned ?? false,
        createdById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: dto.workspaceId,
      entityType: 'ANNOUNCEMENT',
      entityId: announcement.id,
      action: 'PUBLISH',
      actorId: user.sub,
    });

    void this.notifications.notify({
      tenantId: user.tid,
      type: 'LMS_ANNOUNCEMENT',
      title: announcement.title,
      body: announcement.body,
      workspaceId: dto.workspaceId,
    });

    return announcement;
  }

  async remove(user: JwtUser, id: string) {
    const row = await this.prisma.lmsAnnouncement.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    if (row.workspaceId) {
      await this.access.assertWorkspaceAccess(
        user,
        row.workspaceId,
        'announce',
      );
    }
    return this.prisma.lmsAnnouncement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
