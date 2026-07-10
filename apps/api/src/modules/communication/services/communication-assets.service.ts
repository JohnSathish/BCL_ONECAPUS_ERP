import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';

const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const PDF_MIME = new Set(['application/pdf']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type CommunicationAttachment = {
  type: 'image' | 'pdf';
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

@Injectable()
export class CommunicationAssetsService {
  private uploadRoot = resolveTenantUploadRoot();

  async saveAttachment(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<CommunicationAttachment> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const mime = (file.mimetype || '').toLowerCase();
    let type: 'image' | 'pdf';
    if (IMAGE_MIME.has(mime)) {
      type = 'image';
      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException('Image must be 5 MB or smaller');
      }
    } else if (
      PDF_MIME.has(mime) ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      type = 'pdf';
      if (file.size > MAX_PDF_BYTES) {
        throw new BadRequestException('PDF must be 10 MB or smaller');
      }
    } else {
      throw new BadRequestException(
        'Only PNG, JPEG, WebP images or PDF files are allowed',
      );
    }

    const ext =
      extname(file.originalname).toLowerCase() ||
      (type === 'pdf' ? '.pdf' : '.png');
    const dir = join(this.uploadRoot, tenantId, 'communication', 'attachments');
    await mkdir(dir, { recursive: true });
    const filename = `${type}-${randomUUID()}${ext}`;
    await writeFile(join(dir, filename), file.buffer);

    return {
      type,
      url: `/uploads/tenants/${tenantId}/communication/attachments/${filename}`,
      name: file.originalname || filename,
      mimeType: type === 'pdf' ? 'application/pdf' : mime,
      size: file.size,
    };
  }
}
