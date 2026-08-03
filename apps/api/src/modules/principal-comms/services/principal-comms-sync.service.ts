import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PrincipalCommsAuthService } from './principal-comms-auth.service';
import {
  PrincipalCommsGmailClient,
  type GmailMessage,
  type GmailMessagePart,
} from './principal-comms-gmail.client';
import { PrincipalCommsNotifyService } from './principal-comms-notify.service';

function decodeBase64Url(data?: string) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function headerValue(msg: GmailMessage, name: string) {
  const headers = msg.payload?.headers ?? [];
  const hit = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? '';
}

function parseAddressList(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractBodies(part?: GmailMessagePart): {
  html?: string;
  text?: string;
} {
  if (!part) return {};
  const mime = part.mimeType ?? '';
  if (mime === 'text/html' && part.body?.data) {
    return { html: decodeBase64Url(part.body.data) };
  }
  if (mime === 'text/plain' && part.body?.data) {
    return { text: decodeBase64Url(part.body.data) };
  }
  let html: string | undefined;
  let text: string | undefined;
  for (const child of part.parts ?? []) {
    const nested = extractBodies(child);
    html = html ?? nested.html;
    text = text ?? nested.text;
  }
  return { html, text };
}

function collectAttachments(part?: GmailMessagePart): {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  gmailAttachmentId: string;
}[] {
  if (!part) return [];
  const out: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    gmailAttachmentId: string;
  }[] = [];
  if (part.filename && part.body?.attachmentId) {
    out.push({
      filename: part.filename,
      mimeType: part.mimeType ?? 'application/octet-stream',
      sizeBytes: part.body.size ?? 0,
      gmailAttachmentId: part.body.attachmentId,
    });
  }
  for (const child of part.parts ?? []) {
    out.push(...collectAttachments(child));
  }
  return out;
}

function mapFolder(labelIds: string[] = []): string {
  if (labelIds.includes('TRASH')) return 'TRASH';
  if (labelIds.includes('SPAM')) return 'SPAM';
  if (labelIds.includes('DRAFT')) return 'DRAFTS';
  if (labelIds.includes('SENT')) return 'SENT';
  if (labelIds.includes('INBOX')) return 'INBOX';
  return 'ARCHIVE';
}

function inferCategory(from: string, subject: string): string {
  const hay = `${from} ${subject}`.toLowerCase();
  if (hay.includes('nehu')) return 'NEHU';
  if (hay.includes('ugc')) return 'UGC';
  if (hay.includes('gov') || hay.includes('nic.in')) return 'Government';
  if (hay.includes('bank')) return 'Banks';
  if (hay.includes('admission')) return 'Admission';
  if (hay.includes('exam') || hay.includes('examination')) return 'Meetings';
  if (
    hay.includes('fee') ||
    hay.includes('finance') ||
    hay.includes('razorpay')
  )
    return 'Finance';
  if (hay.includes('university') || hay.includes('edu')) return 'University';
  return 'Others';
}

@Injectable()
export class PrincipalCommsSyncService {
  private readonly logger = new Logger(PrincipalCommsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PrincipalCommsAuthService,
    private readonly gmail: PrincipalCommsGmailClient,
    private readonly notify: PrincipalCommsNotifyService,
  ) {}

  async syncAccount(
    tenantId: string,
    ownerUserId: string,
    accountId: string,
    opts: { full?: boolean } = {},
  ) {
    const account = await this.auth.requireOwnedAccount(
      tenantId,
      ownerUserId,
      accountId,
    );
    const accessToken = await this.auth.getValidAccessToken(account);
    const queries = opts.full
      ? ['in:inbox newer_than:90d', 'in:sent newer_than:90d']
      : ['in:inbox newer_than:7d', 'in:sent newer_than:7d'];

    let imported = 0;
    let newCount = 0;
    for (const q of queries) {
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const list = await this.gmail.listMessageIds(accessToken, {
          q,
          maxResults: 50,
          pageToken,
        });
        for (const row of list.messages ?? []) {
          const created = await this.upsertMessage(
            tenantId,
            account.id,
            ownerUserId,
            accessToken,
            row.id,
          );
          imported += 1;
          if (created) newCount += 1;
        }
        pageToken = list.nextPageToken;
        pages += 1;
      } while (pageToken && pages < (opts.full ? 10 : 3));
    }

    await this.prisma.principalMailboxAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });

    return { imported, newMessages: newCount };
  }

  private async upsertMessage(
    tenantId: string,
    accountId: string,
    ownerUserId: string,
    accessToken: string,
    gmailMessageId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.principalMailMessage.findUnique({
      where: {
        accountId_gmailMessageId: { accountId, gmailMessageId },
      },
      select: { id: true },
    });

    const msg = await this.gmail.getMessage(
      accessToken,
      gmailMessageId,
      'full',
    );
    const labelIds = msg.labelIds ?? [];
    const fromRaw = headerValue(msg, 'From');
    const subject = headerValue(msg, 'Subject');
    const fromMatch = fromRaw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    const fromName = fromMatch?.[1]?.trim() || null;
    const fromAddress = (fromMatch?.[2] ?? fromRaw).trim();
    const bodies = extractBodies(msg.payload);
    const attachments = collectAttachments(msg.payload);
    const receivedAt = new Date(Number(msg.internalDate ?? Date.now()));
    const folder = mapFolder(labelIds);

    const data = {
      tenantId,
      accountId,
      gmailMessageId: msg.id,
      gmailThreadId: msg.threadId,
      folder,
      subject,
      snippet: msg.snippet ?? '',
      fromAddress,
      fromName,
      toAddresses: parseAddressList(
        headerValue(msg, 'To'),
      ) as Prisma.InputJsonValue,
      ccAddresses: parseAddressList(
        headerValue(msg, 'Cc'),
      ) as Prisma.InputJsonValue,
      bccAddresses: parseAddressList(
        headerValue(msg, 'Bcc'),
      ) as Prisma.InputJsonValue,
      bodyHtml: bodies.html ?? null,
      bodyText: bodies.text ?? null,
      labelIds: labelIds as Prisma.InputJsonValue,
      starred: labelIds.includes('STARRED'),
      isRead: !labelIds.includes('UNREAD'),
      hasAttachment: attachments.length > 0,
      category: inferCategory(fromAddress, subject),
      receivedAt,
      sentAt: labelIds.includes('SENT') ? receivedAt : null,
      internalDateMs: msg.internalDate ?? null,
      deletedAt: null,
    };

    const saved = await this.prisma.principalMailMessage.upsert({
      where: {
        accountId_gmailMessageId: { accountId, gmailMessageId: msg.id },
      },
      create: data,
      update: {
        folder: data.folder,
        subject: data.subject,
        snippet: data.snippet,
        fromAddress: data.fromAddress,
        fromName: data.fromName,
        toAddresses: data.toAddresses,
        ccAddresses: data.ccAddresses,
        bccAddresses: data.bccAddresses,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        labelIds: data.labelIds,
        starred: data.starred,
        hasAttachment: data.hasAttachment,
        category: data.category,
        receivedAt: data.receivedAt,
        sentAt: data.sentAt,
        internalDateMs: data.internalDateMs,
        deletedAt: null,
        ...(existing ? {} : { isRead: data.isRead }),
      },
    });

    await this.prisma.principalMailAttachment.deleteMany({
      where: { messageId: saved.id },
    });
    if (attachments.length) {
      await this.prisma.principalMailAttachment.createMany({
        data: attachments.map((a) => ({
          tenantId,
          messageId: saved.id,
          gmailAttachmentId: a.gmailAttachmentId,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      });
    }

    if (!existing && folder === 'INBOX' && !data.isRead) {
      void this.notify
        .notifyNewMail({
          tenantId,
          userId: ownerUserId,
          messageId: saved.id,
          subject: saved.subject,
          from: saved.fromName || saved.fromAddress,
          category: saved.category,
        })
        .catch((err) =>
          this.logger.warn(`notify failed: ${(err as Error).message}`),
        );
      return true;
    }
    return !existing;
  }

  async syncAllActiveAccounts() {
    const accounts = await this.prisma.principalMailboxAccount.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, tenantId: true, ownerUserId: true },
      take: 50,
    });
    for (const account of accounts) {
      try {
        await this.syncAccount(
          account.tenantId,
          account.ownerUserId,
          account.id,
          { full: false },
        );
      } catch (err) {
        this.logger.warn(
          `Sync failed for ${account.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
