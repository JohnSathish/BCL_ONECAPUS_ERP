import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { extractClientIp } from '../../../common/utils/request-host';
import { PrismaService } from '../../../database/prisma.service';
import { officialDb } from '../utils/official-documents-prisma.util';

@Injectable()
export class OfficialDocumentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return officialDb(this.prisma);
  }

  async log(
    tenantId: string,
    documentId: string,
    action: string,
    actorId?: string | null,
    req?: Request,
    metadata?: Record<string, unknown>,
  ) {
    await this.db().officialDocumentAuditLog.create({
      data: {
        tenantId,
        documentId,
        action,
        actorId: actorId ?? null,
        ipAddress: req ? extractClientIp(req) : null,
        userAgent: req?.headers['user-agent']?.slice(0, 500) ?? null,
        metadata: metadata ?? undefined,
      },
    });
  }

  async list(tenantId: string, documentId: string, limit = 50) {
    return this.db().officialDocumentAuditLog.findMany({
      where: { tenantId, documentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async recentActivity(tenantId: string, limit = 20) {
    return this.db().officialDocumentAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            referenceNo: true,
            documentType: true,
            status: true,
          },
        },
      },
    });
  }
}
