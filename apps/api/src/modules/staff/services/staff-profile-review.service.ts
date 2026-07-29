import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StaffDocumentsService } from './staff-documents.service';

const APPROVAL = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

type ReviewKind = 'QUALIFICATION' | 'EXPERIENCE' | 'CERTIFICATION' | 'DOCUMENT';

@Injectable()
export class StaffProfileReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: StaffDocumentsService,
  ) {}

  async listPending(tenantId: string) {
    const [qualifications, experiences, certifications, documents] =
      await Promise.all([
        this.prisma.staffQualification.findMany({
          where: { tenantId, approvalStatus: APPROVAL.PENDING },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.staffExperience.findMany({
          where: { tenantId, approvalStatus: APPROVAL.PENDING },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.staffCertification.findMany({
          where: { tenantId, approvalStatus: APPROVAL.PENDING },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.staffDocument.findMany({
          where: { tenantId, verificationStatus: 'PENDING' },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const items = [
      ...qualifications.map((q) => ({
        kind: 'QUALIFICATION' as const,
        id: q.id,
        title: q.qualification,
        subtitle: [q.institution, q.university].filter(Boolean).join(' · '),
        submittedAt: q.submittedAt ?? q.createdAt,
        staff: q.staffProfile,
        payload: q,
      })),
      ...experiences.map((e) => ({
        kind: 'EXPERIENCE' as const,
        id: e.id,
        title: e.institutionName,
        subtitle: e.designation,
        submittedAt: e.submittedAt ?? e.createdAt,
        staff: e.staffProfile,
        payload: e,
      })),
      ...certifications.map((c) => ({
        kind: 'CERTIFICATION' as const,
        id: c.id,
        title: c.title,
        subtitle: c.certificationType,
        submittedAt: c.submittedAt ?? c.createdAt,
        staff: c.staffProfile,
        payload: c,
      })),
      ...documents.map((d) => ({
        kind: 'DOCUMENT' as const,
        id: d.id,
        title: d.documentType,
        subtitle: d.fileName ?? d.mimeType ?? '',
        submittedAt: d.createdAt,
        staff: d.staffProfile,
        payload: d,
      })),
    ].sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

    return {
      total: items.length,
      items,
      counts: {
        qualifications: qualifications.length,
        experiences: experiences.length,
        certifications: certifications.length,
        documents: documents.length,
      },
    };
  }

  async review(
    user: JwtUser,
    kind: ReviewKind,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    remarks?: string,
  ) {
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw new BadRequestException('Invalid decision');
    }
    if (decision === 'REJECTED' && !remarks?.trim()) {
      throw new BadRequestException('Remarks are required when rejecting');
    }

    if (kind === 'DOCUMENT') {
      const doc = await this.prisma.staffDocument.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (!doc) throw new NotFoundException('Document not found');
      await this.documents.verifyDocument(
        user.tid,
        doc.staffProfileId,
        id,
        {
          verificationStatus: decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
          verificationRemarks: remarks,
        },
        user.sub,
      );
      await this.prisma.staffProfileAuditLog.create({
        data: {
          tenantId: user.tid,
          staffProfileId: doc.staffProfileId,
          actorUserId: user.sub,
          action: 'PROFILE_UPDATED',
          section: 'documents',
          summary:
            decision === 'APPROVED'
              ? `Document approved: ${doc.documentType}`
              : `Document rejected: ${doc.documentType}`,
          metaJson: { id, decision, remarks: remarks ?? null },
        },
      });
      return { ok: true, kind, id, decision };
    }

    const now = new Date();
    const data = {
      approvalStatus: decision,
      reviewRemarks: remarks?.trim() || null,
      reviewedAt: now,
      reviewedById: user.sub,
    };

    if (kind === 'QUALIFICATION') {
      const existing = await this.prisma.staffQualification.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (!existing) throw new NotFoundException('Qualification not found');
      await this.prisma.staffQualification.update({ where: { id }, data });
      await this.prisma.staffProfileAuditLog.create({
        data: {
          tenantId: user.tid,
          staffProfileId: existing.staffProfileId,
          actorUserId: user.sub,
          action: 'PROFILE_UPDATED',
          section: 'qualifications',
          summary:
            decision === 'APPROVED'
              ? `Qualification approved: ${existing.qualification}`
              : `Qualification rejected: ${existing.qualification}`,
          metaJson: { id, decision, remarks: remarks ?? null },
        },
      });
    } else if (kind === 'EXPERIENCE') {
      const existing = await this.prisma.staffExperience.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (!existing) throw new NotFoundException('Experience not found');
      await this.prisma.staffExperience.update({ where: { id }, data });
      await this.prisma.staffProfileAuditLog.create({
        data: {
          tenantId: user.tid,
          staffProfileId: existing.staffProfileId,
          actorUserId: user.sub,
          action: 'PROFILE_UPDATED',
          section: 'experience',
          summary:
            decision === 'APPROVED'
              ? `Experience approved: ${existing.institutionName}`
              : `Experience rejected: ${existing.institutionName}`,
          metaJson: { id, decision, remarks: remarks ?? null },
        },
      });
    } else if (kind === 'CERTIFICATION') {
      const existing = await this.prisma.staffCertification.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (!existing) throw new NotFoundException('Certification not found');
      await this.prisma.staffCertification.update({ where: { id }, data });
      await this.prisma.staffProfileAuditLog.create({
        data: {
          tenantId: user.tid,
          staffProfileId: existing.staffProfileId,
          actorUserId: user.sub,
          action: 'PROFILE_UPDATED',
          section: 'certifications',
          summary:
            decision === 'APPROVED'
              ? `Certification approved: ${existing.title}`
              : `Certification rejected: ${existing.title}`,
          metaJson: { id, decision, remarks: remarks ?? null },
        },
      });
    } else {
      throw new BadRequestException('Unknown review kind');
    }

    return { ok: true, kind, id, decision };
  }
}
