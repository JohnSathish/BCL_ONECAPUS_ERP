import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { PrismaService } from '../../database/prisma.service';
import { AdmissionsCycleService } from '../admissions/admissions-cycle.service';
import {
  SCHOOL_ALLOWED_SLOT_CODES,
  isSchoolCycleSettings,
} from './school-admission.constants';
import {
  SCHOOL_UPLOAD_MAX_BYTES,
  SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT,
  SCHOOL_UPLOAD_PDF_REJECTED,
  SCHOOL_UPLOAD_TOO_LARGE,
  SCHOOL_UPLOAD_UNSUPPORTED,
  detectSchoolUploadImageKind,
  isSchoolMultiPageEligibleSlot,
  parseSchoolDocumentSlotCode,
  schoolUploadExtension,
  schoolUploadMime,
} from './school-upload-image';

function assertAllowedSchoolSlot(slotCode: string): {
  baseCode: string;
  page: number;
} {
  const parsed = parseSchoolDocumentSlotCode(slotCode);
  if (!parsed) {
    throw new BadRequestException(`Invalid document slot: ${slotCode}`);
  }
  if (!SCHOOL_ALLOWED_SLOT_CODES.includes(parsed.baseCode as never)) {
    throw new BadRequestException(`Invalid document slot: ${slotCode}`);
  }
  if (parsed.page > 1 && !isSchoolMultiPageEligibleSlot(parsed.baseCode)) {
    throw new BadRequestException(
      'Additional pages are not supported for this document type. Upload a single JPG, JPEG, or PNG.',
    );
  }
  if (parsed.page > SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT) {
    throw new BadRequestException(
      `Maximum ${SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT} images per document.`,
    );
  }
  return parsed;
}

@Injectable()
export class SchoolAdmissionsDocumentService {
  private readonly uploadRoot = resolveUploadRoot();

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
    const { baseCode } = assertAllowedSchoolSlot(slotCode);

    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size <= 0) {
      throw new BadRequestException('The uploaded file is empty');
    }
    if (file.size > SCHOOL_UPLOAD_MAX_BYTES) {
      throw new BadRequestException(SCHOOL_UPLOAD_TOO_LARGE);
    }

    const detected = detectSchoolUploadImageKind(file.buffer);
    if (detected === 'pdf') {
      throw new BadRequestException(SCHOOL_UPLOAD_PDF_REJECTED);
    }
    if (detected !== 'jpeg' && detected !== 'png') {
      throw new BadRequestException(SCHOOL_UPLOAD_UNSUPPORTED);
    }

    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true, documents: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (!isSchoolCycleSettings(application.cycle?.settings)) {
      throw new BadRequestException('School admission cycle is not active');
    }
    if (application.cycle?.status === 'ARCHIVED') {
      throw new BadRequestException('This admission cycle is read-only');
    }

    this.assertCanMutateDocuments(
      application.status,
      baseCode,
      application.documents.find((d) => d.slotCode === 'PAYMENT_RECEIPT')
        ?.verificationStatus,
    );

    if (baseCode === 'PAYMENT_RECEIPT') {
      const txn = (application.paymentReference ?? '').trim();
      if (!txn) {
        throw new BadRequestException(
          'Enter your bank transaction / UTR / reference number before uploading the payment receipt',
        );
      }
    }

    const ext = schoolUploadExtension(detected);
    const mimeType = schoolUploadMime(detected);
    const filename = `${slotCode}-${randomUUID()}.${ext}`;
    const dir = join(
      this.uploadRoot,
      'tenants',
      tenantId,
      'school-admissions',
      application.id,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);

    const fileUrl = `/uploads/tenants/${tenantId}/school-admissions/${application.id}/${filename}`;

    const saved = await this.prisma.admissionApplicationDocument.upsert({
      where: {
        applicationId_slotCode: {
          applicationId: application.id,
          slotCode,
        },
      },
      update: {
        fileUrl,
        mimeType,
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
        mimeType,
        sizeBytes: file.size,
      },
    });

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'document',
      saved.id,
      'school.document.uploaded',
      userId,
      null,
      { slotCode },
    );

    return saved;
  }

  async remove(tenantId: string, userId: string, slotCode: string) {
    const { baseCode } = assertAllowedSchoolSlot(slotCode);

    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true, documents: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (!isSchoolCycleSettings(application.cycle?.settings)) {
      throw new BadRequestException('School admission cycle is not active');
    }
    if (application.cycle?.status === 'ARCHIVED') {
      throw new BadRequestException('This admission cycle is read-only');
    }
    this.assertCanMutateDocuments(
      application.status,
      baseCode,
      application.documents.find((d) => d.slotCode === 'PAYMENT_RECEIPT')
        ?.verificationStatus,
    );

    const existing = await this.prisma.admissionApplicationDocument.findUnique({
      where: {
        applicationId_slotCode: {
          applicationId: application.id,
          slotCode,
        },
      },
    });
    if (!existing) throw new NotFoundException('Document not found');

    await this.prisma.admissionApplicationDocument.delete({
      where: { id: existing.id },
    });

    // Removing page 1 also clears extra pages for that document.
    if (slotCode === baseCode && isSchoolMultiPageEligibleSlot(baseCode)) {
      const extras = application.documents.filter((d) => {
        const parsed = parseSchoolDocumentSlotCode(d.slotCode);
        return (
          parsed &&
          parsed.baseCode === baseCode &&
          parsed.page > 1 &&
          d.slotCode !== slotCode
        );
      });
      if (extras.length) {
        await this.prisma.admissionApplicationDocument.deleteMany({
          where: { id: { in: extras.map((d) => d.id) } },
        });
      }
    }

    await this.cycles.audit(
      tenantId,
      application.cycleId,
      'document',
      existing.id,
      'school.document.removed',
      userId,
      null,
      { slotCode },
    );

    return { ok: true, slotCode };
  }

  async streamOwnDocument(tenantId: string, userId: string, slotCode: string) {
    assertAllowedSchoolSlot(slotCode);
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      select: { id: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return this.streamDocumentFile(tenantId, application.id, slotCode);
  }

  async streamOfficeDocument(
    tenantId: string,
    applicationId: string,
    slotCode: string,
  ) {
    assertAllowedSchoolSlot(slotCode);
    return this.streamDocumentFile(tenantId, applicationId, slotCode);
  }

  private async streamDocumentFile(
    tenantId: string,
    applicationId: string,
    slotCode: string,
  ) {
    const doc = await this.prisma.admissionApplicationDocument.findUnique({
      where: {
        applicationId_slotCode: {
          applicationId,
          slotCode,
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const absolute = resolve(this.absoluteFromPublicUrl(doc.fileUrl));
    if (!existsSync(absolute)) {
      throw new NotFoundException('Document file is missing');
    }
    const expectedPrefix = resolve(
      join(
        this.uploadRoot,
        'tenants',
        tenantId,
        'school-admissions',
        applicationId,
      ),
    );
    if (
      absolute !== expectedPrefix &&
      !absolute.startsWith(expectedPrefix + sep)
    ) {
      throw new NotFoundException('Document file is missing');
    }

    const stream = createReadStream(absolute);
    return {
      stream: new StreamableFile(stream),
      mimeType: doc.mimeType || 'application/octet-stream',
      filename: absolute.split(/[/\\]/).pop() || `${slotCode}.bin`,
    };
  }

  private absoluteFromPublicUrl(publicUrl: string): string {
    const relative = publicUrl.replace(/^\//, '').replace(/^uploads\//, '');
    return join(this.uploadRoot, relative);
  }

  private assertCanMutateDocuments(
    status: string,
    slotCode: string,
    paymentReceiptStatus?: string | null,
  ) {
    if (status === 'draft') return;

    if (
      slotCode === 'PAYMENT_RECEIPT' &&
      ['submitted', 'under_review'].includes(status) &&
      paymentReceiptStatus === 'REJECTED'
    ) {
      return;
    }

    throw new BadRequestException(
      'This application has already been submitted and documents can no longer be changed.',
    );
  }
}
