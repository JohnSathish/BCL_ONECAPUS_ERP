import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { officialDb } from '../utils/official-documents-prisma.util';
import { OfficialDocumentAuditService } from './official-document-audit.service';
import { OfficialDocumentPdfService } from './official-document-pdf.service';
import { ReferenceNumberService } from './reference-number.service';

@Injectable()
export class OfficialDocumentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: OfficialDocumentAuditService,
    private readonly pdf: OfficialDocumentPdfService,
    private readonly referenceNumbers: ReferenceNumberService,
  ) {}

  private db() {
    return officialDb(this.prisma);
  }

  private async load(tenantId: string, id: string) {
    const doc = await this.db().officialDocument.findFirst({
      where: { id, tenantId },
      include: { issuer: { include: { letterhead: true } }, letterhead: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async submit(user: JwtUser, id: string, req?: Request) {
    const doc = await this.load(user.tid, id);
    if (doc.status !== 'DRAFT') {
      throw new BadRequestException('Only draft documents can be submitted');
    }
    const updated = await this.db().officialDocument.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL', rejectionNote: null },
    });
    await this.db().officialDocumentApproval.create({
      data: {
        tenantId: user.tid,
        documentId: id,
        step: 'PRINCIPAL',
        status: 'PENDING',
        actorId: user.sub,
        note: 'Submitted for principal approval',
      },
    });
    await this.audit.log(user.tid, id, 'SUBMIT', user.sub, req);
    return updated;
  }

  async approve(user: JwtUser, id: string, note?: string, req?: Request) {
    const doc = await this.load(user.tid, id);
    if (doc.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Document is not pending approval');
    }

    const issuer = doc.issuer;
    const referenceNo = await this.referenceNumbers.nextReferenceNo(
      user.tid,
      doc.documentType,
      issuer?.refPrefix,
    );
    const publishedAt = new Date();
    const { storageKey, html } = await this.pdf.generateAndStore(
      { ...doc, publishedAt },
      referenceNo,
    );

    const updated = await this.db().officialDocument.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        referenceNo,
        publishedAt,
        approvedById: user.sub,
        pdfPath: storageKey,
        renderedHtml: html,
      },
      include: { issuer: { include: { letterhead: true } }, letterhead: true },
    });

    await this.db().officialDocumentApproval.create({
      data: {
        tenantId: user.tid,
        documentId: id,
        step: 'PRINCIPAL',
        status: 'APPROVED',
        actorId: user.sub,
        note: note ?? 'Approved and published',
      },
    });
    await this.audit.log(user.tid, id, 'APPROVE', user.sub, req, {
      referenceNo,
    });
    await this.audit.log(user.tid, id, 'PUBLISH', user.sub, req, {
      referenceNo,
    });
    return updated;
  }

  async reject(user: JwtUser, id: string, note: string, req?: Request) {
    const doc = await this.load(user.tid, id);
    if (doc.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Document is not pending approval');
    }
    const updated = await this.db().officialDocument.update({
      where: { id },
      data: { status: 'DRAFT', rejectionNote: note },
    });
    await this.db().officialDocumentApproval.create({
      data: {
        tenantId: user.tid,
        documentId: id,
        step: 'PRINCIPAL',
        status: 'REJECTED',
        actorId: user.sub,
        note,
      },
    });
    await this.audit.log(user.tid, id, 'REJECT', user.sub, req, { note });
    return updated;
  }

  async verifyPublishPermission(user: JwtUser) {
    const roles = user.roles ?? [];
    const perms = user.permissions ?? [];
    if (perms.includes('official-documents:approve')) return;
    if (
      roles.some((r) =>
        ['principal', 'college-admin', 'super-admin'].includes(r),
      )
    ) {
      return;
    }
    throw new ForbiddenException('Principal approval permission required');
  }
}
