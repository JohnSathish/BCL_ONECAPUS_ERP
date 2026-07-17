import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { readFile } from 'fs/promises';
import { PrismaService } from '../../database/prisma.service';
import { CertificateDocumentService } from './certificate-document.service';

export type SealIssueInput = {
  tenantId: string;
  issueId: string;
  certificateNo: string;
  verificationToken: string;
  publicPath: string | null;
  actorId?: string | null;
  writeAudit?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CertificateIntegrityService {
  private readonly logger = new Logger(CertificateIntegrityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: CertificateDocumentService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private secret() {
    return (
      process.env.CERTIFICATE_INTEGRITY_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      'dev-certificate-integrity'
    );
  }

  hashBytes(bytes: Buffer | string) {
    return createHash('sha256').update(bytes).digest('hex');
  }

  sign(contentHash: string, certificateNo: string, verificationToken: string) {
    const payload = `${contentHash}|${certificateNo}|${verificationToken}`;
    return createHmac('sha256', this.secret()).update(payload).digest('hex');
  }

  checkIntegrity(issue: {
    contentHash: string | null;
    integritySignature: string | null;
    certificateNo: string;
    verificationToken: string;
  }): boolean | null {
    if (!issue.contentHash || !issue.integritySignature) return null;
    const expected = this.sign(
      issue.contentHash,
      issue.certificateNo,
      issue.verificationToken,
    );
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(issue.integritySignature, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async sealIssuedDocument(input: SealIssueInput) {
    let contentHash: string | null = null;
    let integritySignature: string | null = null;

    if (input.publicPath) {
      try {
        const absolute = this.documents.resolveAbsolutePath(input.publicPath);
        const bytes = await readFile(absolute);
        contentHash = this.hashBytes(bytes);
        integritySignature = this.sign(
          contentHash,
          input.certificateNo,
          input.verificationToken,
        );
      } catch (error) {
        this.logger.warn(
          `Integrity seal skipped for issue ${input.issueId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    const updated = await this.db().certificateIssue.update({
      where: { id: input.issueId },
      data: { contentHash, integritySignature },
    });

    if (input.writeAudit) {
      await this.db().certificateAuditLog.create({
        data: {
          tenantId: input.tenantId,
          actorId: input.actorId ?? null,
          issueId: input.issueId,
          action: 'certificate.issued',
          after: {
            certificateNo: input.certificateNo,
            contentHash,
            integritySignature: integritySignature
              ? `${integritySignature.slice(0, 12)}…`
              : null,
          },
          metadata: input.metadata ?? {},
        },
      });
    }

    return updated;
  }
}
