import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';
import type { AuthSessionResponse } from '../auth.types';

@Injectable()
export class AuthRfidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private async assertRfidAllowed(tenantId: string) {
    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
      select: { allowRfidLogin: true },
    });
    if (!settings?.allowRfidLogin) {
      throw new ForbiddenException(
        'RFID login is not enabled for this institution',
      );
    }
  }

  private normalizeUid(cardUid: string) {
    return cardUid.trim().replace(/\s+/g, '').toUpperCase();
  }

  async resolveUserIdForCard(
    tenantId: string,
    cardUid: string,
  ): Promise<string | null> {
    const uid = this.normalizeUid(cardUid);
    if (uid.length < 4) return null;

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        rfidNumber: { equals: uid, mode: 'insensitive' },
      },
      select: { userId: true },
    });
    if (student?.userId) return student.userId;

    // Also try original trimmed value (case-preserving college encodings)
    if (uid !== cardUid.trim()) {
      const studentRaw = await this.prisma.student.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          rfidNumber: cardUid.trim(),
        },
        select: { userId: true },
      });
      if (studentRaw?.userId) return studentRaw.userId;
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rfidNo: { equals: uid, mode: 'insensitive' } },
          { rfidNo: cardUid.trim() },
        ],
        portalUserId: { not: null },
      },
      select: { portalUserId: true },
    });
    return staff?.portalUserId ?? null;
  }

  async redeem(
    tenantId: string,
    cardUid: string,
    meta?: {
      userAgent?: string;
      ipAddress?: string;
      clientType?: string;
      appType?: string;
      appVersion?: string;
      deviceId?: string;
      deviceLabel?: string;
      country?: string;
    },
  ): Promise<AuthSessionResponse> {
    await this.assertRfidAllowed(tenantId);

    const userId = await this.resolveUserIdForCard(tenantId, cardUid);
    if (!userId) {
      await this.prisma.authLoginEvent.create({
        data: {
          tenantId,
          identifier: this.normalizeUid(cardUid),
          method: 'rfid',
          outcome: 'failure',
          reason: 'unknown_card',
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          metadata: {},
        },
      });
      throw new UnauthorizedException('Unknown RFID card');
    }

    return this.auth.loginWithAlternateMethod(tenantId, userId, 'rfid', meta);
  }
}
