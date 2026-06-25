import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { validateBrandingImage } from '../../../common/uploads/image-upload.validator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';

@Injectable()
export class OfficialDocumentAssetsService {
  private uploadRoot = resolveTenantUploadRoot();

  async saveIssuerAsset(
    tenantId: string,
    roleCode: string,
    file: Express.Multer.File,
    kind: 'signature' | 'seal',
  ) {
    validateBrandingImage(file, 'logo');
    const ext = extname(file.originalname).toLowerCase() || '.png';
    const dir = join(this.uploadRoot, tenantId, 'official-documents', 'assets');
    await mkdir(dir, { recursive: true });
    const slug = roleCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${slug}-${kind}-${randomUUID()}${ext}`;
    const absolutePath = join(dir, filename);
    await writeFile(absolutePath, file.buffer);
    return `/uploads/tenants/${tenantId}/official-documents/assets/${filename}`;
  }
}
