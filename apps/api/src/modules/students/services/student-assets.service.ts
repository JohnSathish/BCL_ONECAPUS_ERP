import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import {
  extensionForMime,
  validateProfileImage,
} from '../../../common/uploads/image-upload.validator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';

const DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class StudentAssetsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(private readonly prisma: PrismaService) {}

  async uploadPhoto(
    tenantId: string,
    studentId: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    const student = await this.assertStudent(tenantId, studentId);
    validateProfileImage(file);

    const dir = join(this.uploadRoot, tenantId, 'students', studentId);
    await mkdir(dir, { recursive: true });
    const ext = extensionForMime(file.mimetype);
    const filename = `photo-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), file.buffer);
    const publicPath = `/uploads/tenants/${tenantId}/students/${studentId}/${filename}`;

    const fullName =
      student.masterProfile?.fullName ??
      student.user?.displayName ??
      student.enrollmentNumber;

    await this.prisma.studentProfile.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        fullName,
        photoPath: publicPath,
      },
      update: { photoPath: publicPath },
    });

    if (actorId) {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { lastModifiedById: actorId },
      });
    }

    return { photoPath: publicPath };
  }

  async uploadDocument(
    tenantId: string,
    studentId: string,
    documentType: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    await this.assertStudent(tenantId, studentId);
    if (!DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported document type');
    }

    const dir = join(this.uploadRoot, tenantId, 'students', studentId, 'docs');
    await mkdir(dir, { recursive: true });
    const ext = extensionForMime(file.mimetype) || '';
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName}${ext && !safeName.includes('.') ? ext : ''}`;
    await writeFile(join(dir, filename), file.buffer);
    const publicPath = `/uploads/tenants/${tenantId}/students/${studentId}/docs/${filename}`;

    return this.prisma.studentDocument.create({
      data: {
        tenantId,
        studentId,
        documentType,
        fileName: file.originalname,
        filePath: publicPath,
        mimeType: file.mimetype,
        uploadedById: actorId ?? null,
      },
    });
  }

  async deleteDocument(
    tenantId: string,
    studentId: string,
    documentId: string,
  ) {
    const doc = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, tenantId, studentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.studentDocument.delete({ where: { id: documentId } });
    return { ok: true };
  }

  private async assertStudent(tenantId: string, studentId: string) {
    const s = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        masterProfile: { select: { fullName: true } },
        user: { select: { displayName: true } },
      },
    });
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }
}
