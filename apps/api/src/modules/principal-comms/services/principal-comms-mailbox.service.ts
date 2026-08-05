import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PrincipalCommsAuditService } from './principal-comms-audit.service';
import { PrincipalCommsAuthService } from './principal-comms-auth.service';
import { PrincipalCommsGmailClient } from './principal-comms-gmail.client';

const FOLDER_MAP: Record<string, Prisma.PrincipalMailMessageWhereInput> = {
  INBOX: { folder: 'INBOX' },
  SENT: { folder: 'SENT' },
  DRAFTS: { folder: 'DRAFTS' },
  STARRED: { starred: true, folder: { not: 'TRASH' } },
  ARCHIVE: { folder: 'ARCHIVE' },
  SPAM: { folder: 'SPAM' },
  TRASH: { folder: 'TRASH' },
};

@Injectable()
export class PrincipalCommsMailboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PrincipalCommsAuthService,
    private readonly gmail: PrincipalCommsGmailClient,
    private readonly audit: PrincipalCommsAuditService,
  ) {}

  async listAccounts(tenantId: string, ownerUserId: string) {
    const accounts = await this.auth.listAccounts(tenantId, ownerUserId);
    return Promise.all(
      accounts.map(async (account) => {
        const unread = await this.prisma.principalMailMessage.count({
          where: {
            accountId: account.id,
            deletedAt: null,
            folder: 'INBOX',
            isRead: false,
          },
        });
        return { ...account, unread };
      }),
    );
  }

  async stats(tenantId: string, ownerUserId: string, accountId?: string) {
    const account = accountId
      ? await this.auth.requireOwnedAccount(tenantId, ownerUserId, accountId)
      : await this.prisma.principalMailboxAccount.findFirst({
          where: { tenantId, ownerUserId, deletedAt: null, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        });
    if (!account) {
      return {
        connected: false,
        unread: 0,
        starred: 0,
        today: 0,
        university: 0,
        government: 0,
      };
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [unread, starred, today, university, government] = await Promise.all([
      this.prisma.principalMailMessage.count({
        where: {
          accountId: account.id,
          deletedAt: null,
          folder: 'INBOX',
          isRead: false,
        },
      }),
      this.prisma.principalMailMessage.count({
        where: { accountId: account.id, deletedAt: null, starred: true },
      }),
      this.prisma.principalMailMessage.count({
        where: {
          accountId: account.id,
          deletedAt: null,
          receivedAt: { gte: startOfDay },
        },
      }),
      this.prisma.principalMailMessage.count({
        where: {
          accountId: account.id,
          deletedAt: null,
          category: 'University',
        },
      }),
      this.prisma.principalMailMessage.count({
        where: {
          accountId: account.id,
          deletedAt: null,
          category: 'Government',
        },
      }),
    ]);
    return {
      connected: true,
      accountId: account.id,
      googleEmail: account.googleEmail,
      unread,
      starred,
      today,
      university,
      government,
    };
  }

  async listMessages(
    tenantId: string,
    ownerUserId: string,
    input: {
      folder: string;
      accountId?: string;
      q?: string;
      cursor?: string;
      take?: number;
      unreadOnly?: boolean;
      starredOnly?: boolean;
    },
  ) {
    const account = input.accountId
      ? await this.auth.requireOwnedAccount(
          tenantId,
          ownerUserId,
          input.accountId,
        )
      : await this.prisma.principalMailboxAccount.findFirst({
          where: { tenantId, ownerUserId, deletedAt: null, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        });
    if (!account) {
      return { items: [], nextCursor: null, account: null };
    }

    const folderKey = (input.folder || 'INBOX').toUpperCase();
    const folderWhere = FOLDER_MAP[folderKey] ?? FOLDER_MAP.INBOX;
    const take = Math.min(Math.max(input.take ?? 30, 1), 100);

    const where: Prisma.PrincipalMailMessageWhereInput = {
      tenantId,
      accountId: account.id,
      deletedAt: null,
      ...folderWhere,
      ...(input.unreadOnly ? { isRead: false } : {}),
      ...(input.starredOnly ? { starred: true } : {}),
      ...(input.q
        ? {
            OR: [
              { subject: { contains: input.q, mode: 'insensitive' } },
              { snippet: { contains: input.q, mode: 'insensitive' } },
              { fromAddress: { contains: input.q, mode: 'insensitive' } },
              { fromName: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(input.cursor ? { receivedAt: { lt: new Date(input.cursor) } } : {}),
    };

    const items = await this.prisma.principalMailMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: take + 1,
      select: {
        id: true,
        subject: true,
        snippet: true,
        fromAddress: true,
        fromName: true,
        receivedAt: true,
        starred: true,
        isRead: true,
        hasAttachment: true,
        importance: true,
        category: true,
        folder: true,
      },
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore
      ? (page[page.length - 1]?.receivedAt.toISOString() ?? null)
      : null;

    return {
      account: {
        id: account.id,
        googleEmail: account.googleEmail,
        accountLabel: account.accountLabel,
      },
      items: page,
      nextCursor,
    };
  }

  async getMessage(
    tenantId: string,
    ownerUserId: string,
    messageId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const message = await this.prisma.principalMailMessage.findFirst({
      where: { id: messageId, tenantId, deletedAt: null },
      include: {
        attachments: true,
        account: { select: { id: true, ownerUserId: true, googleEmail: true } },
      },
    });
    if (!message || message.account.ownerUserId !== ownerUserId) {
      throw new NotFoundException('Message not found');
    }

    if (!message.isRead) {
      await this.prisma.principalMailMessage.update({
        where: { id: message.id },
        data: { isRead: true },
      });
      try {
        const access = await this.auth.getValidAccessToken(
          await this.auth.requireOwnedAccount(
            tenantId,
            ownerUserId,
            message.accountId,
          ),
        );
        await this.gmail.modifyLabels(
          access,
          message.gmailMessageId,
          [],
          ['UNREAD'],
        );
      } catch {
        /* local read still applies */
      }
    }

    await this.audit.log({
      tenantId,
      actorId: ownerUserId,
      accountId: message.accountId,
      action: 'OPENED_EMAIL',
      entityType: 'message',
      entityId: message.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { ...message, isRead: true };
  }

  async applyAction(
    tenantId: string,
    ownerUserId: string,
    messageId: string,
    action: 'star' | 'unstar' | 'archive' | 'trash' | 'markRead' | 'markUnread',
    meta?: { ip?: string; userAgent?: string },
  ) {
    const message = await this.prisma.principalMailMessage.findFirst({
      where: { id: messageId, tenantId, deletedAt: null },
      include: { account: true },
    });
    if (!message || message.account.ownerUserId !== ownerUserId) {
      throw new NotFoundException('Message not found');
    }

    const account = message.account;
    const access = await this.auth.getValidAccessToken(account);
    const data: Prisma.PrincipalMailMessageUpdateInput = {};
    let add: string[] = [];
    let remove: string[] = [];

    switch (action) {
      case 'star':
        data.starred = true;
        add = ['STARRED'];
        break;
      case 'unstar':
        data.starred = false;
        remove = ['STARRED'];
        break;
      case 'archive':
        data.folder = 'ARCHIVE';
        remove = ['INBOX'];
        break;
      case 'trash':
        data.folder = 'TRASH';
        add = ['TRASH'];
        remove = ['INBOX'];
        break;
      case 'markRead':
        data.isRead = true;
        remove = ['UNREAD'];
        break;
      case 'markUnread':
        data.isRead = false;
        add = ['UNREAD'];
        break;
      default:
        break;
    }

    await this.gmail.modifyLabels(access, message.gmailMessageId, add, remove);
    const updated = await this.prisma.principalMailMessage.update({
      where: { id: message.id },
      data,
    });

    await this.audit.log({
      tenantId,
      actorId: ownerUserId,
      accountId: account.id,
      action: `ACTION_${action.toUpperCase()}`,
      entityType: 'message',
      entityId: message.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async downloadAttachment(
    tenantId: string,
    ownerUserId: string,
    attachmentId: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const attachment = await this.prisma.principalMailAttachment.findFirst({
      where: { id: attachmentId, tenantId },
      include: {
        message: { include: { account: true } },
      },
    });
    if (!attachment || attachment.message.account.ownerUserId !== ownerUserId) {
      throw new NotFoundException('Attachment not found');
    }
    const access = await this.auth.getValidAccessToken(
      attachment.message.account,
    );
    const blob = await this.gmail.getAttachment(
      access,
      attachment.message.gmailMessageId,
      attachment.gmailAttachmentId,
    );

    await this.audit.log({
      tenantId,
      actorId: ownerUserId,
      accountId: attachment.message.accountId,
      action: 'DOWNLOADED_ATTACHMENT',
      entityType: 'attachment',
      entityId: attachment.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { filename: attachment.filename },
    });

    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      dataBase64Url: blob.data,
      size: blob.size,
    };
  }
}
