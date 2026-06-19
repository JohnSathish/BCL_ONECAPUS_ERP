import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { access, mkdir, writeFile } from 'fs/promises';
import JSZip from 'jszip';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import {
  extensionForMime,
  validateBrandingImage,
} from '../../../common/uploads/image-upload.validator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import {
  STAFF_DOCUMENT_SLOTS,
  STAFF_DOCUMENT_SLOT_CODES,
  STAFF_SELF_UPLOAD_DOC_TYPES,
  staffDocumentLabel,
  slotSupportsExpiry,
} from '../constants/staff-document-catalog';

const DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const EXPIRY_SOON_DAYS = 30;

type DocRow = {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  verificationStatus: string;
  verificationRemarks: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
  verifiedAt: Date | null;
  verifiedBy: { displayName: string | null; email: string } | null;
  uploadedBy: { displayName: string | null; email: string } | null;
};

@Injectable()
export class StaffDocumentsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(private readonly prisma: PrismaService) {}

  private docInclude = {
    verifiedBy: { select: { displayName: true, email: true } },
    uploadedBy: { select: { displayName: true, email: true } },
  };

  private userLabel(
    user: { displayName: string | null; email: string } | null | undefined,
  ) {
    return user?.displayName ?? user?.email ?? 'Admin';
  }

  private isExpired(expiryDate: Date | null | undefined) {
    if (!expiryDate) return false;
    return expiryDate.getTime() < Date.now();
  }

  private isExpiringSoon(expiryDate: Date | null | undefined) {
    if (!expiryDate) return false;
    const soon = Date.now() + EXPIRY_SOON_DAYS * 24 * 60 * 60 * 1000;
    return expiryDate.getTime() >= Date.now() && expiryDate.getTime() <= soon;
  }

  private slotStatus(
    doc: DocRow | undefined,
  ): 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' | 'EXPIRED' {
    if (!doc) return 'MISSING';
    if (this.isExpired(doc.expiryDate)) return 'EXPIRED';
    if (doc.verificationStatus === 'VERIFIED') return 'VERIFIED';
    if (doc.verificationStatus === 'REJECTED') return 'REJECTED';
    return 'PENDING';
  }

  private latestByType(docs: DocRow[]) {
    const map = new Map<string, DocRow>();
    for (const doc of docs) {
      const existing = map.get(doc.documentType);
      if (!existing || doc.createdAt > existing.createdAt) {
        map.set(doc.documentType, doc);
      }
    }
    return map;
  }

  computeCompliance(docs: DocRow[]) {
    const latest = this.latestByType(docs);
    const totalSlots = STAFF_DOCUMENT_SLOTS.length;
    let uploaded = 0;
    let pending = 0;
    let verified = 0;
    let expiredSoon = 0;
    const missing: string[] = [];

    for (const slot of STAFF_DOCUMENT_SLOTS) {
      const doc = latest.get(slot.code);
      const status = this.slotStatus(doc);
      if (status === 'MISSING') {
        missing.push(slot.label);
      } else {
        uploaded += 1;
        if (status === 'VERIFIED') verified += 1;
        if (status === 'PENDING' || status === 'REJECTED') pending += 1;
        if (doc && this.isExpiringSoon(doc.expiryDate)) expiredSoon += 1;
      }
    }

    const completionPercent = Math.round((uploaded / totalSlots) * 100);
    const complianceScore = Math.round((verified / totalSlots) * 100);

    return {
      totalSlots,
      uploaded,
      pending,
      verified,
      expiredSoon,
      missing,
      completionPercent,
      complianceScore,
    };
  }

  async getCompliance(tenantId: string, staffProfileId: string) {
    await this.assertStaff(tenantId, staffProfileId);
    const docs = await this.prisma.staffDocument.findMany({
      where: { tenantId, staffProfileId },
      include: this.docInclude,
      orderBy: { createdAt: 'desc' },
    });
    const latest = this.latestByType(docs as DocRow[]);
    const slots = STAFF_DOCUMENT_SLOTS.map((slot) => {
      const doc = latest.get(slot.code);
      return {
        ...slot,
        status: this.slotStatus(doc),
        document: doc
          ? {
              id: doc.id,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              mimeType: doc.mimeType,
              verificationStatus: doc.verificationStatus,
              verificationRemarks: doc.verificationRemarks,
              issueDate: doc.issueDate,
              expiryDate: doc.expiryDate,
              createdAt: doc.createdAt,
              verifiedAt: doc.verifiedAt,
              verifiedByName: this.userLabel(doc.verifiedBy),
              uploadedByName: this.userLabel(doc.uploadedBy),
            }
          : null,
      };
    });
    return {
      ...this.computeCompliance(docs as DocRow[]),
      slots,
    };
  }

  async uploadDocument(
    tenantId: string,
    staffProfileId: string,
    documentType: string,
    file: Express.Multer.File,
    actorId?: string,
    opts?: { selfService?: boolean },
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    const normalizedType = documentType.toUpperCase();
    if (!STAFF_DOCUMENT_SLOT_CODES.has(normalizedType)) {
      throw new BadRequestException(`Unknown document type: ${documentType}`);
    }
    if (
      opts?.selfService &&
      !STAFF_SELF_UPLOAD_DOC_TYPES.includes(normalizedType)
    ) {
      throw new BadRequestException(
        'This document type cannot be self-uploaded',
      );
    }
    if (!DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Use PDF, JPG, PNG, or DOCX.',
      );
    }

    const dir = join(
      this.uploadRoot,
      tenantId,
      'staff',
      staffProfileId,
      'docs',
    );
    await mkdir(dir, { recursive: true });
    const ext = extensionForMime(file.mimetype) || '';
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName}${ext && !safeName.includes('.') ? ext : ''}`;
    await writeFile(join(dir, filename), file.buffer);
    const publicPath = `/uploads/tenants/${tenantId}/staff/${staffProfileId}/docs/${filename}`;

    const doc = await this.prisma.staffDocument.create({
      data: {
        tenantId,
        staffProfileId,
        documentType: normalizedType,
        fileName: file.originalname,
        fileUrl: publicPath,
        mimeType: file.mimetype,
        uploadedById: actorId ?? null,
        verificationStatus: 'PENDING',
      },
      include: this.docInclude,
    });

    await this.writeAudit(
      tenantId,
      actorId,
      staffProfileId,
      doc.id,
      'staff.document_uploaded',
      {
        documentType: normalizedType,
        fileName: file.originalname,
      },
    );

    return doc;
  }

  async verifyDocument(
    tenantId: string,
    staffProfileId: string,
    docId: string,
    dto: { verificationStatus: string; verificationRemarks?: string },
    actorId: string,
  ) {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: docId, tenantId, staffProfileId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(dto.verificationStatus)) {
      throw new BadRequestException('Invalid verification status');
    }

    const updated = await this.prisma.staffDocument.update({
      where: { id: docId },
      data: {
        verificationStatus: dto.verificationStatus,
        verificationRemarks: dto.verificationRemarks ?? null,
        verifiedById: dto.verificationStatus === 'PENDING' ? null : actorId,
        verifiedAt: dto.verificationStatus === 'PENDING' ? null : new Date(),
      },
      include: this.docInclude,
    });

    const action =
      dto.verificationStatus === 'VERIFIED'
        ? 'staff.document_verified'
        : dto.verificationStatus === 'REJECTED'
          ? 'staff.document_rejected'
          : 'staff.document_pending';

    await this.writeAudit(tenantId, actorId, staffProfileId, docId, action, {
      documentType: doc.documentType,
      remarks: dto.verificationRemarks,
    });

    return updated;
  }

  async updateDocumentMeta(
    tenantId: string,
    staffProfileId: string,
    docId: string,
    dto: { issueDate?: string; expiryDate?: string },
    actorId: string,
  ) {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: docId, tenantId, staffProfileId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (
      !slotSupportsExpiry(doc.documentType) &&
      (dto.issueDate || dto.expiryDate)
    ) {
      throw new BadRequestException(
        'This document type does not support expiry dates',
      );
    }

    const updated = await this.prisma.staffDocument.update({
      where: { id: docId },
      data: {
        ...(dto.issueDate !== undefined
          ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
          : {}),
        ...(dto.expiryDate !== undefined
          ? { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }
          : {}),
      },
      include: this.docInclude,
    });

    await this.writeAudit(
      tenantId,
      actorId,
      staffProfileId,
      docId,
      'staff.document_updated',
      {
        documentType: doc.documentType,
        issueDate: dto.issueDate,
        expiryDate: dto.expiryDate,
      },
    );

    return updated;
  }

  async deleteDocument(
    tenantId: string,
    staffProfileId: string,
    documentId: string,
    actorId?: string,
  ) {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, tenantId, staffProfileId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.staffDocument.delete({ where: { id: documentId } });
    await this.writeAudit(
      tenantId,
      actorId,
      staffProfileId,
      documentId,
      'staff.document_deleted',
      {
        documentType: doc.documentType,
        fileName: doc.fileName,
      },
    );
    return { ok: true };
  }

  async getAuditTrail(tenantId: string, staffProfileId: string, limit = 50) {
    await this.assertStaff(tenantId, staffProfileId);
    const docIds = await this.prisma.staffDocument.findMany({
      where: { tenantId, staffProfileId },
      select: { id: true },
    });
    if (!docIds.length) return [];
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        module: 'staff',
        entityType: 'staff_document',
        entityId: { in: docIds.map((d) => d.id) },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { displayName: true, email: true } } },
    });
  }

  async downloadZip(
    tenantId: string,
    staffProfileId: string,
    verifiedOnly = false,
  ): Promise<Buffer> {
    await this.assertStaff(tenantId, staffProfileId);
    const docs = await this.prisma.staffDocument.findMany({
      where: {
        tenantId,
        staffProfileId,
        ...(verifiedOnly ? { verificationStatus: 'VERIFIED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!docs.length) throw new NotFoundException('No documents to download');

    const zip = new JSZip();
    const usedNames = new Set<string>();
    for (const doc of docs) {
      const relative = doc.fileUrl.replace(/^\//, '');
      const absolute = join(process.cwd(), relative);
      try {
        await access(absolute);
        const stream = createReadStream(absolute);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (c) => chunks.push(Buffer.from(c)));
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
        const base = `${staffDocumentLabel(doc.documentType).replace(/[^\w.-]+/g, '_')}_${doc.fileName ?? 'file'}`;
        let name = base;
        let i = 1;
        while (usedNames.has(name)) {
          name = `${i++}_${base}`;
        }
        usedNames.add(name);
        zip.file(name, Buffer.concat(chunks));
      } catch {
        // skip missing files on disk
      }
    }

    return zip.generateAsync({ type: 'nodebuffer' });
  }

  async reportMissing(tenantId: string) {
    const staff = await this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        documents: { include: this.docInclude },
      },
    });
    return staff
      .map((s) => {
        const compliance = this.computeCompliance(
          s.documents as unknown as DocRow[],
        );
        return {
          staffProfileId: s.id,
          fullName: s.fullName,
          employeeCode: s.employeeCode,
          missingDocuments: compliance.missing,
          missingCount: compliance.missing.length,
          complianceScore: compliance.complianceScore,
        };
      })
      .filter((r) => r.missingCount > 0)
      .sort((a, b) => b.missingCount - a.missingCount);
  }

  async reportExpiring(tenantId: string, withinDays = EXPIRY_SOON_DAYS) {
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
    const docs = await this.prisma.staffDocument.findMany({
      where: {
        tenantId,
        expiryDate: { gte: new Date(), lte: cutoff },
      },
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
    return docs.map((d) => ({
      staffProfileId: d.staffProfileId,
      fullName: d.staffProfile.fullName,
      employeeCode: d.staffProfile.employeeCode,
      documentType: d.documentType,
      documentLabel: staffDocumentLabel(d.documentType),
      expiryDate: d.expiryDate,
    }));
  }

  async reportPendingVerification(tenantId: string) {
    const docs = await this.prisma.staffDocument.findMany({
      where: { tenantId, verificationStatus: 'PENDING' },
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({
      staffProfileId: d.staffProfileId,
      fullName: d.staffProfile.fullName,
      employeeCode: d.staffProfile.employeeCode,
      documentId: d.id,
      documentType: d.documentType,
      documentLabel: staffDocumentLabel(d.documentType),
      uploadedOn: d.createdAt,
      fileName: d.fileName,
    }));
  }

  private async writeAudit(
    tenantId: string,
    userId: string | undefined,
    staffProfileId: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        module: 'staff',
        action,
        entityType: 'staff_document',
        entityId,
        metadata: { staffProfileId, ...metadata },
      },
    });
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
}
