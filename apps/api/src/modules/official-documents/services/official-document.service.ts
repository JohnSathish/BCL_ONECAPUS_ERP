import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/official-documents.constants';
import type {
  CreateOfficialDocumentDto,
  ListOfficialDocumentsQueryDto,
  UpdateOfficialDocumentDto,
} from '../dto/official-documents.dto';
import { officialDb } from '../utils/official-documents-prisma.util';
import { OfficialDocumentAuditService } from './official-document-audit.service';
import { OfficialDocumentPdfService } from './official-document-pdf.service';

@Injectable()
export class OfficialDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: OfficialDocumentAuditService,
    private readonly pdf: OfficialDocumentPdfService,
  ) {}

  private db() {
    return officialDb(this.prisma);
  }

  private include() {
    return {
      issuer: { include: { letterhead: true } },
      letterhead: true,
      approvals: { orderBy: { actedAt: 'desc' as const }, take: 5 },
    };
  }

  private parseDate(value?: string | null) {
    if (!value?.trim()) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  async list(tenantId: string, query: ListOfficialDocumentsQueryDto) {
    const { page, limit, skip, take } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.documentType) where.documentType = query.documentType;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.issuerId) where.issuerId = query.issuerId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.q?.trim()) {
      where.OR = [
        { title: { contains: query.q.trim(), mode: 'insensitive' } },
        { subject: { contains: query.q.trim(), mode: 'insensitive' } },
        { referenceNo: { contains: query.q.trim(), mode: 'insensitive' } },
        { bodyHtml: { contains: query.q.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().officialDocument.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: { issuer: true },
      }),
      this.db().officialDocument.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const doc = await this.db().officialDocument.findFirst({
      where: { id, tenantId },
      include: this.include(),
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async create(user: JwtUser, dto: CreateOfficialDocumentDto, req?: Request) {
    const doc = await this.db().officialDocument.create({
      data: {
        tenantId: user.tid,
        documentType: dto.documentType,
        title: dto.title.trim(),
        subject: dto.subject?.trim(),
        salutation: dto.salutation?.trim(),
        bodyHtml: dto.bodyHtml,
        priority: dto.priority ?? 'NORMAL',
        issuerId: dto.issuerId,
        letterheadId: dto.letterheadId,
        audience: dto.audience ?? {},
        printSettings: dto.printSettings ?? {},
        effectiveDate: this.parseDate(dto.effectiveDate),
        expiryDate: this.parseDate(dto.expiryDate),
        scheduledAt: this.parseDate(dto.scheduledAt),
        verifyToken: randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase(),
        createdById: user.sub,
        modifiedById: user.sub,
        currentVersion: 1,
      },
      include: this.include(),
    });

    await this.db().officialDocumentVersion.create({
      data: {
        tenantId: user.tid,
        documentId: doc.id,
        versionNo: 1,
        title: doc.title,
        subject: doc.subject,
        salutation: doc.salutation,
        bodyHtml: doc.bodyHtml,
        audience: doc.audience,
        snapshot: { priority: doc.priority, documentType: doc.documentType },
        createdById: user.sub,
      },
    });

    await this.audit.log(user.tid, doc.id, 'CREATE', user.sub, req);
    return doc;
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateOfficialDocumentDto,
    req?: Request,
  ) {
    const existing = await this.getById(user.tid, id);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(existing.status)) {
      throw new BadRequestException(
        'Published or archived documents cannot be edited',
      );
    }
    if (existing.status === 'PENDING_APPROVAL') {
      throw new BadRequestException('Withdraw from approval before editing');
    }

    const nextVersion = existing.currentVersion + 1;
    const doc = await this.db().officialDocument.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? existing.title,
        subject: dto.subject?.trim() ?? existing.subject,
        salutation: dto.salutation?.trim() ?? existing.salutation,
        bodyHtml: dto.bodyHtml ?? existing.bodyHtml,
        priority: dto.priority ?? existing.priority,
        issuerId: dto.issuerId ?? existing.issuerId,
        letterheadId: dto.letterheadId ?? existing.letterheadId,
        audience: dto.audience ?? existing.audience,
        printSettings: dto.printSettings ?? existing.printSettings,
        effectiveDate:
          dto.effectiveDate !== undefined
            ? this.parseDate(dto.effectiveDate)
            : existing.effectiveDate,
        expiryDate:
          dto.expiryDate !== undefined
            ? this.parseDate(dto.expiryDate)
            : existing.expiryDate,
        scheduledAt:
          dto.scheduledAt !== undefined
            ? this.parseDate(dto.scheduledAt)
            : existing.scheduledAt,
        modifiedById: user.sub,
        currentVersion: nextVersion,
      },
      include: this.include(),
    });

    await this.db().officialDocumentVersion.create({
      data: {
        tenantId: user.tid,
        documentId: id,
        versionNo: nextVersion,
        title: doc.title,
        subject: doc.subject,
        salutation: doc.salutation,
        bodyHtml: doc.bodyHtml,
        audience: doc.audience,
        snapshot: { priority: doc.priority },
        createdById: user.sub,
      },
    });

    await this.audit.log(user.tid, id, 'EDIT', user.sub, req, {
      version: nextVersion,
    });
    return doc;
  }

  async listVersions(tenantId: string, documentId: string) {
    await this.getById(tenantId, documentId);
    return this.db().officialDocumentVersion.findMany({
      where: { tenantId, documentId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async archive(user: JwtUser, id: string, req?: Request) {
    const doc = await this.getById(user.tid, id);
    if (doc.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published documents can be archived');
    }
    const updated = await this.db().officialDocument.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await this.audit.log(user.tid, id, 'ARCHIVE', user.sub, req);
    return updated;
  }

  async recordPrint(user: JwtUser, id: string, req?: Request) {
    const doc = await this.getById(user.tid, id);
    if (doc.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published documents can be printed');
    }
    const updated = await this.db().officialDocument.update({
      where: { id },
      data: {
        printCount: { increment: 1 },
        printedAt: new Date(),
      },
    });
    await this.audit.log(user.tid, id, 'PRINT', user.sub, req);
    return updated;
  }

  async getPdf(user: JwtUser, id: string, req?: Request) {
    const doc = await this.getById(user.tid, id);
    if (!doc.pdfPath || !doc.referenceNo) {
      throw new NotFoundException('PDF not available');
    }
    const buffer = await this.pdf.getPdfBuffer(doc.pdfPath);
    await this.db().officialDocument.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
    await this.audit.log(user.tid, id, 'DOWNLOAD', user.sub, req);
    return {
      buffer,
      filename: `${doc.referenceNo.replace(/\//g, '-')}.pdf`,
    };
  }

  async verifyPublic(token: string) {
    const doc = await this.db().officialDocument.findFirst({
      where: { verifyToken: token },
      include: { issuer: true },
    });
    if (!doc || doc.status !== 'PUBLISHED') {
      return {
        valid: false,
        message: 'Document not found or not published',
      };
    }
    const settings = await this.db().officialDocumentSettings.findUnique({
      where: { tenantId: doc.tenantId },
    });
    const verifyUrl = this.pdf.buildVerifyUrl(
      doc.tenantId,
      doc.verifyToken,
      settings?.verifyBaseUrl,
    );
    return {
      valid: true,
      referenceNo: doc.referenceNo,
      title: doc.title,
      subject: doc.subject,
      documentType: doc.documentType,
      publishedAt: doc.publishedAt,
      issuerName: doc.issuer?.name,
      designation: doc.issuer?.designation,
      status: doc.status,
      verifyUrl,
      hasPdf: Boolean(doc.pdfPath),
    };
  }

  async getPublicPdf(token: string) {
    const doc = await this.db().officialDocument.findFirst({
      where: { verifyToken: token, status: 'PUBLISHED' },
    });
    if (!doc?.pdfPath) throw new NotFoundException('PDF not available');
    const buffer = await this.pdf.getPdfBuffer(doc.pdfPath);
    return {
      buffer,
      filename: `${doc.referenceNo?.replace(/\//g, '-') ?? token}.pdf`,
    };
  }
}
