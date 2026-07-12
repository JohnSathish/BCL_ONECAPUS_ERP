import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';
import type { AuthSessionResponse } from '../auth.types';

const QR_TTL_MS = 5 * 60 * 1000;

export type QrLoginPayload = {
  type: 'onecampus.auth.qr';
  v: 1;
  token: string;
  expiresAt: string;
};

@Injectable()
export class AuthQrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async assertQrAllowed(tenantId: string) {
    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
      select: { allowQrLogin: true },
    });
    if (!settings?.allowQrLogin) {
      throw new ForbiddenException(
        'QR login is not enabled for this institution',
      );
    }
  }

  async issue(
    tenantId: string,
    userId: string,
    opts?: { deviceHint?: string; createdById?: string },
  ) {
    await this.assertQrAllowed(tenantId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + QR_TTL_MS);
    const jti = randomUUID();
    const payload: QrLoginPayload = {
      type: 'onecampus.auth.qr',
      v: 1,
      token,
      expiresAt: expiresAt.toISOString(),
    };

    await this.prisma.authQrChallenge.create({
      data: {
        tenantId,
        userId,
        jti,
        tokenHash: this.hashToken(token),
        expiresAt,
        createdById: opts?.createdById ?? userId,
        deviceHint: opts?.deviceHint?.trim() || null,
        metadata: { v: 1 },
      },
    });

    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrDataUrl = null;
    }

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      payload,
      qrDataUrl,
    };
  }

  /**
   * Accept raw token or pasted QR JSON payload string.
   */
  extractToken(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { token?: string };
        if (typeof parsed.token === 'string' && parsed.token.length >= 16) {
          return parsed.token.trim();
        }
      } catch {
        /* fall through */
      }
    }
    return trimmed;
  }

  async redeem(
    tenantId: string,
    rawToken: string,
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
    await this.assertQrAllowed(tenantId);

    const token = this.extractToken(rawToken);
    if (token.length < 16) {
      throw new UnauthorizedException('Invalid or expired QR login code');
    }

    const tokenHash = this.hashToken(token);
    const challenge = await this.prisma.authQrChallenge.findFirst({
      where: {
        tenantId,
        tokenHash,
        redeemedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!challenge) {
      throw new UnauthorizedException('Invalid or expired QR login code');
    }

    const claimed = await this.prisma.authQrChallenge.updateMany({
      where: { id: challenge.id, redeemedAt: null },
      data: { redeemedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException('QR login code already used');
    }

    return this.auth.loginWithAlternateMethod(
      tenantId,
      challenge.userId,
      'qr',
      meta,
    );
  }
}
