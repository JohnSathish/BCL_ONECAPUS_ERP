import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { SupportRealtimePublisher } from './support-realtime.publisher';
import { SupportRoutingService } from './support-routing.service';
import { SupportSettingsService } from './support-settings.service';
import { SupportTranslationService } from './support-translation.service';

@Injectable()
export class SupportChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: SupportRoutingService,
    private readonly settings: SupportSettingsService,
    private readonly translation: SupportTranslationService,
    private readonly realtime: SupportRealtimePublisher,
    @Optional() private readonly notifications?: UserNotificationsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async resolveAgentTargetLang(
    tenantId: string,
    thread: {
      agentId?: string | null;
      agent?: { preferredLang?: string } | null;
    },
  ) {
    const settings = await this.settings.getSettings(tenantId);
    if (thread.agent?.preferredLang) return thread.agent.preferredLang;
    if (thread.agentId) {
      const agent = await this.db().supportAgent.findFirst({
        where: { id: thread.agentId, tenantId },
      });
      if (agent?.preferredLang) return agent.preferredLang as string;
    }
    // Prefer any online agent's language (e.g. Tamil admin)
    const online = await this.db().supportAgent.findFirst({
      where: { tenantId, isOnline: true, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (online?.preferredLang) return online.preferredLang as string;
    return (settings?.defaultAgentLang as string) || 'en';
  }

  async openThread(
    user: JwtUser,
    dto: {
      category?: string;
      subject?: string;
      studentLang?: string;
      initialMessage?: string;
    },
  ) {
    await this.settings.ensureBootstrap(user.tid);
    const category = (dto.category ?? 'GENERAL').toUpperCase();
    const departmentId = await this.routing.resolveDepartmentId(
      user.tid,
      category,
    );
    const agent = await this.routing.pickAgentForDepartment(
      user.tid,
      departmentId,
    );

    const thread = await this.db().supportChatThread.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        studentUserId: user.sub,
        departmentId,
        agentId: agent?.id ?? null,
        category,
        subject: dto.subject?.trim() || null,
        status: agent ? 'ASSIGNED' : 'OPEN',
        studentLang: dto.studentLang ?? 'en',
      },
      include: { department: true, agent: true },
    });

    this.realtime.emitToTenant(user.tid, 'support.thread.created', {
      threadId: thread.id,
      category,
      departmentId,
    });

    if (dto.initialMessage?.trim()) {
      await this.sendMessage(user, thread.id, {
        body: dto.initialMessage.trim(),
        asStudent: true,
      });
    }

    return this.getThread(user.tid, thread.id);
  }

  async listThreads(
    tenantId: string,
    query: {
      studentUserId?: string;
      status?: string;
      departmentId?: string;
      q?: string;
      bucket?: string;
      agentUserId?: string;
    } = {},
  ) {
    const bucket = (query.bucket || '').toLowerCase();
    const statusFilter =
      query.status ||
      (bucket === 'live' || bucket === 'assigned'
        ? 'ASSIGNED'
        : bucket === 'waiting'
          ? 'WAITING'
          : bucket === 'resolved' || bucket === 'closed'
            ? 'CLOSED'
            : undefined);

    let agentId: string | undefined;
    if (bucket === 'mine' && query.agentUserId) {
      const me = await this.db().supportAgent.findFirst({
        where: { tenantId, userId: query.agentUserId },
        select: { id: true },
      });
      agentId = me?.id as string | undefined;
    }

    const threads = await this.db().supportChatThread.findMany({
      where: {
        tenantId,
        ...(query.studentUserId ? { studentUserId: query.studentUserId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(agentId ? { agentId } : {}),
        ...(bucket === 'tickets' ? { ticketId: { not: null } } : {}),
        ...(bucket === 'new' ? { unreadAgent: { gt: 0 } } : {}),
        ...(query.q
          ? {
              OR: [
                { subject: { contains: query.q, mode: 'insensitive' } },
                {
                  lastMessagePreview: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: { department: true, agent: true, ticket: true },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    return this.enrichInbox(tenantId, threads);
  }

  private async enrichInbox(tenantId: string, threads: any[]) {
    if (!threads.length) return [];
    const userIds = [...new Set(threads.map((t) => t.studentUserId as string))];
    const students = await this.prisma.student.findMany({
      where: { tenantId, userId: { in: userIds }, deletedAt: null },
      include: {
        masterProfile: {
          select: { fullName: true, photoPath: true },
        },
        department: { select: { name: true } },
        user: { select: { displayName: true } },
      },
    });
    const byUser = new Map(students.map((s) => [s.userId, s]));
    const now = Date.now();

    return threads.map((t) => {
      const student = byUser.get(t.studentUserId as string);
      const waitMs = t.lastMessageAt
        ? Math.max(0, now - new Date(t.lastMessageAt).getTime())
        : Math.max(0, now - new Date(t.createdAt).getTime());
      const waitMinutes = Math.floor(waitMs / 60_000);
      const priority =
        waitMinutes >= 60
          ? 'URGENT'
          : waitMinutes >= 20
            ? 'HIGH'
            : (t.ticket?.priority as string) || 'MEDIUM';
      return {
        ...t,
        student: student
          ? {
              id: student.id,
              fullName:
                student.masterProfile?.fullName ||
                student.user.displayName ||
                'Student',
              photoPath: student.masterProfile?.photoPath ?? null,
              departmentName: student.department?.name ?? null,
              rollNumber: student.rollNumber,
              enrollmentNumber: student.enrollmentNumber,
            }
          : {
              id: null,
              fullName: 'Student',
              photoPath: null,
              departmentName: t.department?.name ?? null,
              rollNumber: null,
              enrollmentNumber: null,
            },
        waitMinutes,
        priority,
        language: t.studentLang || 'en',
      };
    });
  }

  async getThread(tenantId: string, id: string) {
    const thread = await this.db().supportChatThread.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        agent: true,
        ticket: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: true },
          take: 200,
        },
      },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');
    return thread;
  }

  async assertParticipant(user: JwtUser, threadId: string, staff = false) {
    const thread = await this.getThread(user.tid, threadId);
    if (staff) return thread;
    if (thread.studentUserId !== user.sub) {
      throw new ForbiddenException('Not your chat');
    }
    return thread;
  }

  async sendMessage(
    user: JwtUser,
    threadId: string,
    dto: {
      body: string;
      asStudent?: boolean;
      replyToId?: string;
      attachments?: Array<{
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        storageUrl: string;
      }>;
    },
  ) {
    const staff = !dto.asStudent;
    const thread = await this.assertParticipant(user, threadId, staff);
    if (thread.status === 'CLOSED') {
      throw new ForbiddenException(
        'This chat has ended. Start a new chat to continue.',
      );
    }
    const settings = await this.settings.getSettings(user.tid);
    const agentTargetLang = await this.resolveAgentTargetLang(user.tid, thread);
    const targetLang = staff
      ? (thread.studentLang as string) || 'en'
      : agentTargetLang;

    const xlate = await this.translation.detectAndTranslate({
      text: dto.body,
      targetLang,
      translationEnabled: settings?.translationEnabled !== false,
    });

    if (!staff && xlate.langDetected && xlate.langDetected !== 'en') {
      await this.db().supportChatThread.update({
        where: { id: threadId },
        data: { studentLang: xlate.langDetected },
      });
    }

    const message = await this.db().supportChatMessage.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        threadId,
        senderUserId: user.sub,
        senderRole: staff ? 'AGENT' : 'STUDENT',
        bodyOriginal: dto.body.trim(),
        bodyTranslated: xlate.bodyTranslated,
        langDetected: xlate.langDetected,
        langTarget: xlate.langTarget,
        deliveryStatus: 'SENT',
        replyToId: dto.replyToId ?? null,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((a) => ({
                id: randomUUID(),
                tenantId: user.tid,
                fileName: a.fileName,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                storageUrl: a.storageUrl,
              })),
            }
          : undefined,
      },
      include: { attachments: true },
    });

    const previewSource = xlate.bodyTranslated || dto.body.trim();
    const preview = previewSource.slice(0, 200);
    await this.db().supportChatThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        unreadStudent: staff ? { increment: 1 } : undefined,
        unreadAgent: staff ? undefined : { increment: 1 },
        status:
          thread.status === 'CLOSED'
            ? 'OPEN'
            : staff
              ? thread.status
              : thread.agentId
                ? 'ASSIGNED'
                : 'OPEN',
      },
    });

    const payload = {
      threadId,
      message: {
        ...message,
        translationStatus: xlate.status,
        translationNote: xlate.note,
      },
    };
    this.realtime.emitToThread(threadId, 'support.message', payload);
    if (staff) {
      this.realtime.emitToUser(
        thread.studentUserId,
        'support.message',
        payload,
      );
    } else {
      await this.notifyStaffNewMessage(user.tid, thread, preview);
      if (thread.agent?.userId) {
        this.realtime.emitToUser(
          thread.agent.userId,
          'support.message',
          payload,
        );
      } else {
        this.realtime.emitToTenant(user.tid, 'support.message', payload);
      }
    }

    return payload.message;
  }

  async retranslateMessage(
    user: JwtUser,
    threadId: string,
    messageId: string,
    targetLang?: string,
  ) {
    const thread = await this.assertParticipant(user, threadId, true);
    const message = await this.db().supportChatMessage.findFirst({
      where: { id: messageId, threadId, tenantId: user.tid },
    });
    if (!message) throw new NotFoundException('Message not found');

    const settings = await this.settings.getSettings(user.tid);
    const agentTarget =
      targetLang ||
      (message.senderRole === 'STUDENT'
        ? await this.resolveAgentTargetLang(user.tid, thread)
        : (thread.studentLang as string) || 'en');

    const xlate = await this.translation.detectAndTranslate({
      text: message.bodyOriginal,
      targetLang: agentTarget,
      translationEnabled: settings?.translationEnabled !== false,
    });

    const updated = await this.db().supportChatMessage.update({
      where: { id: messageId },
      data: {
        bodyTranslated: xlate.bodyTranslated,
        langDetected: xlate.langDetected,
        langTarget: xlate.langTarget,
      },
      include: { attachments: true },
    });

    if (
      message.senderRole === 'STUDENT' &&
      xlate.langDetected &&
      xlate.langDetected !== 'en'
    ) {
      await this.db().supportChatThread.update({
        where: { id: threadId },
        data: { studentLang: xlate.langDetected },
      });
    }

    const payload = {
      threadId,
      message: {
        ...updated,
        translationStatus: xlate.status,
        translationNote: xlate.note,
      },
    };
    this.realtime.emitToThread(threadId, 'support.message.updated', payload);
    return payload.message;
  }

  private async notifyStaffNewMessage(
    tenantId: string,
    thread: {
      id: string;
      category?: string;
      agent?: { userId?: string } | null;
      department?: { name?: string } | null;
    },
    preview: string,
  ) {
    this.realtime.emitToTenant(tenantId, 'support.inbox.ping', {
      threadId: thread.id,
      category: thread.category,
      preview,
    });

    if (!this.notifications) return;
    const recipients = new Set<string>();
    if (thread.agent?.userId) recipients.add(thread.agent.userId);
    const online = await this.db().supportAgent.findMany({
      where: { tenantId, isOnline: true, isActive: true },
      select: { userId: true },
      take: 30,
    });
    for (const a of online) recipients.add(a.userId as string);

    const title = 'New Support Centre message';
    const body = `${thread.department?.name ?? thread.category ?? 'Chat'}: ${preview}`;
    for (const userId of recipients) {
      try {
        await this.notifications.createInApp({
          tenantId,
          userId,
          type: 'SUPPORT_CHAT',
          title,
          body,
          link: `/admin/helpdesk?chat=${thread.id}`,
        });
      } catch {
        // soft-fail
      }
    }
  }

  async markRead(user: JwtUser, threadId: string, staff: boolean) {
    const thread = await this.assertParticipant(user, threadId, staff);
    await this.db().supportChatThread.update({
      where: { id: threadId },
      data: staff ? { unreadAgent: 0 } : { unreadStudent: 0 },
    });
    await this.db().supportChatMessage.updateMany({
      where: {
        tenantId: user.tid,
        threadId,
        senderUserId: { not: user.sub },
        readAt: null,
      },
      data: { readAt: new Date(), deliveryStatus: 'READ' },
    });
    this.realtime.emitToThread(threadId, 'support.read', {
      threadId,
      userId: user.sub,
      staff,
    });
    return { ok: true, threadId: thread.id };
  }

  async assignAgent(user: JwtUser, threadId: string, agentId: string) {
    await this.assertParticipant(user, threadId, true);
    const agent = await this.db().supportAgent.findFirst({
      where: { id: agentId, tenantId: user.tid },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    const updated = await this.db().supportChatThread.update({
      where: { id: threadId },
      data: {
        agentId,
        departmentId: agent.departmentId ?? undefined,
        status: 'ASSIGNED',
      },
      include: { agent: true, department: true },
    });
    this.realtime.emitToThread(threadId, 'support.thread.assigned', {
      threadId,
      agentId,
    });
    this.realtime.emitToUser(agent.userId, 'support.thread.assigned', {
      threadId,
      agentId,
    });
    return updated;
  }

  async closeThread(user: JwtUser, threadId: string, staff: boolean) {
    const thread = await this.assertParticipant(user, threadId, staff);
    if (thread.status === 'CLOSED') {
      return thread;
    }
    const updated = await this.db().supportChatThread.update({
      where: { id: threadId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        lastMessageAt: new Date(),
        lastMessagePreview: staff
          ? 'Chat ended by support agent'
          : 'Chat ended by student',
      },
      include: { department: true, agent: true },
    });
    this.realtime.emitToThread(threadId, 'support.thread.closed', {
      threadId,
      closedBy: staff ? 'AGENT' : 'STUDENT',
    });
    if (staff) {
      this.realtime.emitToUser(thread.studentUserId, 'support.thread.closed', {
        threadId,
        closedBy: 'AGENT',
      });
    } else if (thread.agent?.userId) {
      this.realtime.emitToUser(thread.agent.userId, 'support.thread.closed', {
        threadId,
        closedBy: 'STUDENT',
      });
    } else {
      this.realtime.emitToTenant(user.tid, 'support.thread.closed', {
        threadId,
        closedBy: 'STUDENT',
      });
    }
    return updated;
  }

  typing(user: JwtUser, threadId: string, isTyping: boolean) {
    this.realtime.emitToThread(threadId, 'support.typing', {
      threadId,
      userId: user.sub,
      isTyping,
    });
    return { ok: true };
  }

  async persistUpload(
    tenantId: string,
    threadId: string,
    file: Express.Multer.File,
  ) {
    const settings = await this.settings.getSettings(tenantId);
    const maxBytes = (settings?.maxUploadMb ?? 10) * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new ForbiddenException(
        `File exceeds ${settings?.maxUploadMb ?? 10} MB`,
      );
    }
    const allowed = (settings?.allowedMimeJson as string[] | undefined) ?? [];
    if (allowed.length && !allowed.includes(file.mimetype)) {
      throw new ForbiddenException('File type not allowed');
    }
    const ext = extname(file.originalname) || '.bin';
    const filename = `${randomUUID()}${ext}`;
    const abs = join(
      resolveTenantUploadRoot(),
      tenantId,
      'support',
      threadId,
      filename,
    );
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.buffer);
    const storageUrl = `/uploads/tenants/${tenantId}/support/${threadId}/${filename}`;
    return {
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageUrl,
    };
  }
}
