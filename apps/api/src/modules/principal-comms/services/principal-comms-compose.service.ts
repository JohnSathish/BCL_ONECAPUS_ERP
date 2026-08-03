import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PrincipalCommsAuditService } from './principal-comms-audit.service';
import { PrincipalCommsAuthService } from './principal-comms-auth.service';
import { PrincipalCommsGmailClient } from './principal-comms-gmail.client';
import { PrincipalCommsSyncService } from './principal-comms-sync.service';

function toRawBase64Url(mime: string) {
  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMime(input: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  references?: string;
}) {
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(', ')}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${input.bcc.join(', ')}`] : []),
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`] : []),
    ...(input.references ? [`References: ${input.references}`] : []),
  ];
  return `${headers.join('\r\n')}\r\n\r\n${input.bodyHtml}`;
}

@Injectable()
export class PrincipalCommsComposeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PrincipalCommsAuthService,
    private readonly gmail: PrincipalCommsGmailClient,
    private readonly audit: PrincipalCommsAuditService,
    private readonly sync: PrincipalCommsSyncService,
  ) {}

  listDrafts(tenantId: string, ownerUserId: string, accountId: string) {
    return this.prisma.principalMailDraft.findMany({
      where: {
        tenantId,
        accountId,
        deletedAt: null,
        account: { ownerUserId, deletedAt: null },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveDraft(
    tenantId: string,
    ownerUserId: string,
    input: {
      accountId: string;
      draftId?: string;
      toAddresses: string[];
      ccAddresses?: string[];
      bccAddresses?: string[];
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      replyToMessageId?: string;
      priority?: string;
    },
  ) {
    await this.auth.requireOwnedAccount(tenantId, ownerUserId, input.accountId);
    const data = {
      toAddresses: input.toAddresses as Prisma.InputJsonValue,
      ccAddresses: (input.ccAddresses ?? []) as Prisma.InputJsonValue,
      bccAddresses: (input.bccAddresses ?? []) as Prisma.InputJsonValue,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText ?? null,
      replyToMessageId: input.replyToMessageId ?? null,
      priority: input.priority ?? 'NORMAL',
    };

    if (input.draftId) {
      const existing = await this.prisma.principalMailDraft.findFirst({
        where: {
          id: input.draftId,
          tenantId,
          accountId: input.accountId,
          deletedAt: null,
        },
      });
      if (!existing) throw new NotFoundException('Draft not found');
      return this.prisma.principalMailDraft.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.principalMailDraft.create({
      data: {
        tenantId,
        accountId: input.accountId,
        ...data,
      },
    });
  }

  async send(
    tenantId: string,
    ownerUserId: string,
    input: {
      accountId: string;
      toAddresses: string[];
      ccAddresses?: string[];
      bccAddresses?: string[];
      subject: string;
      bodyHtml: string;
      replyToMessageId?: string;
      draftId?: string;
    },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const account = await this.auth.requireOwnedAccount(
      tenantId,
      ownerUserId,
      input.accountId,
    );
    if (!input.toAddresses?.length) {
      throw new NotFoundException('At least one recipient is required');
    }
    const access = await this.auth.getValidAccessToken(account);
    const mime = buildMime({
      from: account.googleEmail,
      to: input.toAddresses,
      cc: input.ccAddresses,
      bcc: input.bccAddresses,
      subject: input.subject || '(no subject)',
      bodyHtml: input.bodyHtml || '<p></p>',
    });
    const sent = await this.gmail.sendRaw(access, toRawBase64Url(mime));

    if (input.draftId) {
      await this.prisma.principalMailDraft.updateMany({
        where: { id: input.draftId, tenantId, accountId: account.id },
        data: { deletedAt: new Date() },
      });
    }

    await this.audit.log({
      tenantId,
      actorId: ownerUserId,
      accountId: account.id,
      action: input.replyToMessageId ? 'SENT_REPLY' : 'SENT_EMAIL',
      entityType: 'message',
      entityId: sent.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
      metadata: { subject: input.subject, to: input.toAddresses },
    });

    // Pull the sent copy into local store
    try {
      await this.sync.syncAccount(tenantId, ownerUserId, account.id, {
        full: false,
      });
    } catch {
      /* non-fatal */
    }

    return { gmailMessageId: sent.id, threadId: sent.threadId };
  }
}
