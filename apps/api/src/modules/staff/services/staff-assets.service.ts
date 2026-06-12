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
  validateBrandingImage,
} from '../../../common/uploads/image-upload.validator';

const DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class StaffAssetsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads', 'tenants');

  constructor(private readonly prisma: PrismaService) {}

  async uploadPhoto(
    tenantId: string,
    staffProfileId: string,
    file: Express.Multer.File,
    _actorId?: string,
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    validateBrandingImage(file, 'logo');

    const dir = join(this.uploadRoot, tenantId, 'staff', staffProfileId);
    await mkdir(dir, { recursive: true });
    const ext = extensionForMime(file.mimetype);
    const filename = `photo-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), file.buffer);
    const publicPath = `/uploads/tenants/${tenantId}/staff/${staffProfileId}/${filename}`;

    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: { photoUrl: publicPath },
    });

    return { photoUrl: publicPath };
  }

  async uploadDocument(
    tenantId: string,
    staffProfileId: string,
    documentType: string,
    file: Express.Multer.File,
    _actorId?: string,
  ) {
    await this.assertStaff(tenantId, staffProfileId);
    if (!DOC_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported document type');
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

    return this.prisma.staffDocument.create({
      data: {
        tenantId,
        staffProfileId,
        documentType,
        fileName: file.originalname,
        fileUrl: publicPath,
      },
    });
  }

  async deleteDocument(
    tenantId: string,
    staffProfileId: string,
    documentId: string,
  ) {
    const doc = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, tenantId, staffProfileId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.staffDocument.delete({ where: { id: documentId } });
    return { ok: true };
  }

  private async assertStaff(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }
}
