import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { verifyMetaSignature } from './school-sis-whatsapp.provider';
import { SchoolSisWhatsappService } from './school-sis-whatsapp.service';

type MetaChange = {
  field?: string;
  value?: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    statuses?: Array<{
      id: string;
      status: string;
      timestamp?: string;
      errors?: Array<{ code?: number; title?: string; message?: string }>;
    }>;
    messages?: Array<{
      id: string;
      from: string;
      timestamp?: string;
      type?: string;
      text?: { body?: string };
      button?: { text?: string };
    }>;
    contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
    message_template_id?: string;
    event?: string;
    message_template_name?: string;
    message_template_language?: string;
  };
};

@Injectable()
export class SchoolSisWhatsappWebhookService {
  private readonly logger = new Logger(SchoolSisWhatsappWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly wa: SchoolSisWhatsappService,
  ) {}

  async verifyChallenge(mode: string, token: string, challenge: string) {
    if (mode !== 'subscribe')
      throw new UnauthorizedException('Webhook verification failed');
    const hash = createHash('sha256').update(token).digest('hex');
    const account = await this.prisma.schoolWhatsappAccount.findFirst({
      where: { webhookVerifyHash: hash, deletedAt: null },
    });
    if (!account)
      throw new UnauthorizedException('Webhook verification failed');
    return challenge;
  }

  async handle(rawBody: string, signature: string | undefined) {
    const payload = JSON.parse(rawBody || '{}') as {
      object?: string;
      entry?: Array<{ id?: string; changes?: MetaChange[] }>;
    };
    const phoneNumberId =
      payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const number = phoneNumberId
      ? await this.prisma.schoolWhatsappPhoneNumber.findFirst({
          where: { phoneNumberId, deletedAt: null },
          include: { account: true },
        })
      : null;
    const appSecret = number
      ? this.crypto.decrypt(number.account.appSecretEnc)
      : null;
    if (appSecret && !verifyMetaSignature(appSecret, rawBody, signature)) {
      throw new UnauthorizedException('Webhook verification failed');
    }
    const eventId = createHash('sha256').update(rawBody).digest('hex');
    try {
      await this.prisma.schoolWhatsappWebhookEvent.create({
        data: {
          tenantId: number?.tenantId,
          eventId,
          eventType: payload.entry?.[0]?.changes?.[0]?.field ?? 'unknown',
          phoneNumberId,
          payloadJson: payload as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { duplicate: true };
      }
      throw err;
    }
    if (number) {
      await this.prisma.schoolWhatsappAccount.update({
        where: { id: number.accountId },
        data: { lastWebhookAt: new Date() },
      });
    }
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        await this.applyChange(
          number?.tenantId ?? null,
          number?.id ?? null,
          change,
        );
      }
    }
    await this.prisma.schoolWhatsappWebhookEvent.update({
      where: { eventId },
      data: { processed: true },
    });
    return { ok: true };
  }

  private async applyChange(
    tenantId: string | null,
    phoneRowId: string | null,
    change: MetaChange,
  ) {
    const value = change.value;
    if (!value || !tenantId) return;
    for (const st of value.statuses ?? []) {
      const message = await this.prisma.schoolWhatsappMessage.findFirst({
        where: { tenantId, providerMessageId: st.id },
      });
      if (!message) continue;
      const status = st.status.toUpperCase();
      const mapped =
        status === 'DELIVERED'
          ? 'DELIVERED'
          : status === 'READ'
            ? 'READ'
            : status === 'FAILED'
              ? 'FAILED'
              : status === 'SENT'
                ? 'SENT'
                : message.status;
      const extra: Prisma.SchoolWhatsappMessageUpdateInput = { status: mapped };
      if (mapped === 'DELIVERED') extra.deliveredAt = new Date();
      if (mapped === 'READ') {
        extra.readAt = extra.readAt ?? new Date();
        extra.deliveredAt = message.deliveredAt ?? new Date();
      }
      if (mapped === 'FAILED') {
        extra.failedAt = new Date();
        extra.failureReason =
          st.errors?.[0]?.title || st.errors?.[0]?.message || 'Failed';
        extra.failureCode = st.errors?.[0]?.code
          ? String(st.errors[0].code)
          : 'PROVIDER';
      }
      await this.prisma.schoolWhatsappMessage.update({
        where: { id: message.id },
        data: extra,
      });
      await this.prisma.schoolWhatsappMessageStatus.upsert({
        where: { messageId_status: { messageId: message.id, status: mapped } },
        create: {
          tenantId,
          messageId: message.id,
          status: mapped,
          rawJson: st as Prisma.InputJsonValue,
        },
        update: {},
      });
      if (message.campaignId && mapped === 'DELIVERED') {
        await this.prisma.schoolWhatsappCampaign.update({
          where: { id: message.campaignId },
          data: { deliveredCount: { increment: 1 } },
        });
      }
      if (message.campaignId && mapped === 'READ') {
        await this.prisma.schoolWhatsappCampaign.update({
          where: { id: message.campaignId },
          data: { readCount: { increment: 1 } },
        });
      }
    }
    for (const inbound of value.messages ?? []) {
      const phone = inbound.from.replace(/\D/g, '');
      const name = value.contacts?.[0]?.profile?.name;
      const contact = await this.prisma.schoolWhatsappContact.upsert({
        where: { tenantId_phoneE164: { tenantId, phoneE164: phone } },
        create: {
          tenantId,
          phoneE164: phone,
          displayName: name || phone,
          lastInboundAt: new Date(),
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {
          lastInboundAt: new Date(),
          windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          displayName: name || undefined,
        },
      });
      let conversation = await this.prisma.schoolWhatsappConversation.findFirst(
        {
          where: { tenantId, contactId: contact.id },
        },
      );
      if (!conversation) {
        conversation = await this.prisma.schoolWhatsappConversation.create({
          data: {
            tenantId,
            contactId: contact.id,
            phoneNumberId: phoneRowId,
            status: 'OPEN',
          },
        });
      }
      const body =
        inbound.text?.body || inbound.button?.text || inbound.type || '';
      try {
        await this.prisma.schoolWhatsappMessage.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            contactId: contact.id,
            phoneNumberId: phoneRowId,
            direction: 'IN',
            type: (inbound.type || 'TEXT').toUpperCase(),
            body,
            status: 'RECEIVED',
            providerMessageId: inbound.id,
            idempotencyKey: `in:${inbound.id}`,
          },
        });
      } catch (err) {
        if (
          !(
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          )
        ) {
          throw err;
        }
      }
      await this.prisma.schoolWhatsappConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastPreview: body.slice(0, 160),
          unreadCount: { increment: 1 },
          status: 'OPEN',
        },
      });
      const text = body.trim().toLowerCase();
      if (text === 'stop' || text === 'unsubscribe') {
        await this.prisma.schoolWhatsappOptIn.updateMany({
          where: { contactId: contact.id },
          data: {
            status: 'OPTED_OUT',
            optedOutAt: new Date(),
            source: 'WHATSAPP_STOP',
          },
        });
        for (const category of ['MARKETING', 'EVENTS', 'GENERAL']) {
          await this.prisma.schoolWhatsappOptIn.upsert({
            where: { contactId_category: { contactId: contact.id, category } },
            create: {
              tenantId,
              contactId: contact.id,
              category,
              status: 'OPTED_OUT',
              source: 'WHATSAPP_STOP',
              optedOutAt: new Date(),
            },
            update: { status: 'OPTED_OUT', optedOutAt: new Date() },
          });
        }
      }
      const automation = await this.prisma.schoolWhatsappAutomation.findFirst({
        where: {
          tenantId,
          active: true,
          deletedAt: null,
          trigger: 'KEYWORD',
          matchValue: text,
        },
      });
      if (automation?.replyText) {
        try {
          await this.wa.sendText(
            tenantId,
            { to: phone, body: automation.replyText, contactId: contact.id },
            {
              userId: '00000000-0000-0000-0000-000000000000',
              manage: true,
              send: true,
              campaigns: false,
              settings: false,
            },
          );
        } catch (err) {
          this.logger.warn(
            `Automation reply skipped: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
    if (
      change.field === 'message_template_status_update' &&
      value.message_template_name
    ) {
      await this.prisma.schoolWhatsappTemplate.updateMany({
        where: {
          tenantId,
          name: value.message_template_name,
          language: value.message_template_language ?? undefined,
        },
        data: {
          metaStatus: value.event ?? undefined,
          status: (value.event || '').toUpperCase().includes('APPROVED')
            ? 'APPROVED'
            : (value.event || '').toUpperCase().includes('REJECT')
              ? 'REJECTED'
              : undefined,
        },
      });
    }
  }
}
