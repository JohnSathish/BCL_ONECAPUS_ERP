import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';

@Injectable()
export class LmsDiscussionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly audit: LmsAuditService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private canManage(user: JwtUser): boolean {
    return (
      user.permissions.includes('lms:assignments:manage') ||
      this.access.hasAdminLms(user)
    );
  }

  async list(user: JwtUser, workspaceId: string) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    return this.db().lmsDiscussion.findMany({
      where: { tenantId: user.tid, workspaceId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    user: JwtUser,
    workspaceId: string,
    payload: { title: string; body: string; pinned?: boolean },
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    if (!this.canManage(user) && !user.roles.includes('student')) {
      throw new ForbiddenException('Not allowed to create discussions');
    }

    const discussion = await this.db().lmsDiscussion.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        title: payload.title.trim(),
        body: payload.body.trim(),
        pinned: payload.pinned ?? false,
        createdById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId,
      entityType: 'DISCUSSION',
      entityId: discussion.id,
      action: 'CREATE',
      actorId: user.sub,
    });

    return discussion;
  }

  async reply(user: JwtUser, discussionId: string, body: string) {
    const discussion = await this.db().lmsDiscussion.findFirst({
      where: { tenantId: user.tid, id: discussionId, deletedAt: null },
    });
    if (!discussion) throw new NotFoundException('Discussion not found');
    await this.access.assertWorkspaceAccess(
      user,
      discussion.workspaceId,
      'read',
    );

    return this.db().lmsDiscussionReply.create({
      data: {
        tenantId: user.tid,
        discussionId,
        body: body.trim(),
        createdById: user.sub,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async listReplies(user: JwtUser, discussionId: string) {
    const discussion = await this.db().lmsDiscussion.findFirst({
      where: { tenantId: user.tid, id: discussionId, deletedAt: null },
    });
    if (!discussion) throw new NotFoundException('Discussion not found');
    await this.access.assertWorkspaceAccess(
      user,
      discussion.workspaceId,
      'read',
    );

    return this.db().lmsDiscussionReply.findMany({
      where: { tenantId: user.tid, discussionId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
