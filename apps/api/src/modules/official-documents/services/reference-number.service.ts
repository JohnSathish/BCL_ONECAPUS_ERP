import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { DOCUMENT_TYPE_REF_CODES } from '../constants/official-documents.constants';
import { officialDb } from '../utils/official-documents-prisma.util';

@Injectable()
export class ReferenceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return officialDb(this.prisma);
  }

  async getSettings(tenantId: string) {
    let settings = await this.db().officialDocumentSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.db().officialDocumentSettings.create({
        data: { tenantId },
      });
    }
    return settings;
  }

  async nextReferenceNo(
    tenantId: string,
    documentType: string,
    issuerRefPrefix?: string | null,
  ) {
    const settings = await this.getSettings(tenantId);
    const year = new Date().getFullYear();
    const typeCode = DOCUMENT_TYPE_REF_CODES[documentType] ?? documentType;

    const seqRow = await this.prisma.$transaction(async (tx) => {
      const db = tx as unknown as Record<string, any>;
      const existing = await db.officialDocumentSequence.findUnique({
        where: {
          tenantId_documentType_year: { tenantId, documentType, year },
        },
      });
      if (existing) {
        return db.officialDocumentSequence.update({
          where: { id: existing.id },
          data: { lastSequence: { increment: 1 } },
        });
      }
      return db.officialDocumentSequence.create({
        data: { tenantId, documentType, year, lastSequence: 1 },
      });
    });

    const seq = String(seqRow.lastSequence).padStart(4, '0');
    const pattern = settings.referencePattern;
    const prefix = issuerRefPrefix?.trim() || settings.defaultPrefix;

    if (issuerRefPrefix?.trim()) {
      return `${prefix}/${year}/${seq}`;
    }

    return pattern
      .replace('{PREFIX}', prefix)
      .replace('{TYPE}', typeCode)
      .replace('{YEAR}', String(year))
      .replace('{SEQ:4}', seq)
      .replace('{SEQ}', seq);
  }
}
