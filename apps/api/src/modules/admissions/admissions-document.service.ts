import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionsCycleService } from './admissions-cycle.service';

const ALLOWED_SLOTS = [
  'STD10',
  'STD12',
  'CUET',
  'DISABILITY',
  'EWS',
  'PHOTO',
] as const;

@Injectable()
export class AdmissionsDocumentService {
  private readonly uploadRoot =
    process.env.UPLOAD_ROOT ?? join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: AdmissionsCycleService,
  ) {}

  async upload(
    tenantId: string,
    userId: string,
    slotCode: string,
    file: Express.Multer.File,
  ) {
    if (!ALLOWED_SLOTS.includes(slotCode as (typeof ALLOWED_SLOTS)[number])) {
      throw new BadRequestException(`Invalid document slot: ${slotCode}`);
    }

    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (
      !['draft', 'under_review'].includes(application.status) &&
      application.cycle?.status !== 'ARCHIVED'
    ) {
      throw new BadRequestException(
        'Documents cannot be changed at this stage',
      );
    }

    const ext = file.originalname.split('.').pop() ?? 'bin';
    const filename = `${slotCode}-${randomUUID()}.${ext}`;
    const dir = join(
      this.uploadRoot,
      'tenants',
      tenantId,
      'admissions',
      application.id,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);

    const fileUrl = `/uploads/tenants/${tenantId}/admissions/${application.id}/${filename}`;

    return this.prisma.admissionApplicationDocument.upsert({
      where: {
        applicationId_slotCode: {
          applicationId: application.id,
          slotCode,
        },
      },
      update: {
        fileUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        verificationStatus: 'PENDING',
        verifiedById: null,
        verifiedAt: null,
        remarks: null,
      },
      create: {
        tenantId,
        applicationId: application.id,
        slotCode,
        fileUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async verifyDocument(
    tenantId: string,
    documentId: string,
    actorId: string,
    status: 'VERIFIED' | 'REJECTED',
    remarks?: string,
  ) {
    const doc = await this.prisma.admissionApplicationDocument.findFirst({
      where: { id: documentId, tenantId },
      include: { application: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.prisma.admissionApplicationDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: status,
        verifiedById: actorId,
        verifiedAt: new Date(),
        remarks,
      },
    });

    const pending = await this.prisma.admissionApplicationDocument.count({
      where: {
        applicationId: doc.applicationId,
        verificationStatus: 'PENDING',
      },
    });
    const rejected = await this.prisma.admissionApplicationDocument.count({
      where: {
        applicationId: doc.applicationId,
        verificationStatus: 'REJECTED',
      },
    });

    let docStatus = 'PENDING';
    if (rejected > 0) docStatus = 'REJECTED';
    else if (pending === 0) docStatus = 'VERIFIED';

    await this.prisma.admissionApplication.update({
      where: { id: doc.applicationId },
      data: { documentVerificationStatus: docStatus },
    });

    await this.cycles.audit(
      tenantId,
      doc.application.cycleId,
      'document',
      doc.id,
      `document.${status.toLowerCase()}`,
      actorId,
    );

    return updated;
  }

  listForApplication(tenantId: string, applicationId: string) {
    return this.prisma.admissionApplicationDocument.findMany({
      where: { tenantId, applicationId },
      orderBy: { slotCode: 'asc' },
    });
  }
}
