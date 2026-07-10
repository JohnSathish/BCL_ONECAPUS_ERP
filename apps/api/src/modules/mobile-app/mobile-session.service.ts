import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

type SessionMetadata = {
  clientType?: string;
  appType?: string;
  appVersion?: string;
  deviceId?: string;
  deviceLabel?: string;
};

@Injectable()
export class MobileSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private parseMetadata(raw: unknown): SessionMetadata {
    if (!raw || typeof raw !== 'object') return {};
    return raw as SessionMetadata;
  }

  async listSessions(user: JwtUser, currentDeviceId?: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { tenantId: user.tid, userId: user.sub, revokedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const deviceId = currentDeviceId?.trim() || '';
    const matchedIndex = deviceId
      ? sessions.findIndex(
          (s) => this.parseMetadata(s.metadata).deviceId === deviceId,
        )
      : 0;
    const currentIndex = matchedIndex >= 0 ? matchedIndex : 0;
    return {
      sessions: sessions.map((s, index) => {
        const meta = this.parseMetadata(s.metadata);
        const isCurrent = index === currentIndex;
        return {
          id: s.id,
          userAgent: s.userAgent ?? 'Unknown',
          ipAddress: s.ipAddress ?? '—',
          clientType: meta.clientType ?? 'web',
          appType: meta.appType ?? null,
          appVersion: meta.appVersion ?? null,
          deviceLabel:
            meta.deviceLabel ??
            (isCurrent ? 'Current session' : 'Previous session'),
          lastActiveAt: s.updatedAt.toISOString(),
          isCurrent,
        };
      }),
    };
  }

  async revokeSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.refreshSession.findFirst({
      where: { id: sessionId, tenantId, revokedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async revokeAllForUser(tenantId: string, userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
