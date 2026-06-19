import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { validateBrandingImage } from '../../common/uploads/image-upload.validator';

@Injectable()
export class CertificateAssetsService {
  private uploadRoot = resolveTenantUploadRoot();

  async saveSignatureAsset(
    tenantId: string,
    roleSlug: string,
    file: Express.Multer.File,
    kind: 'signature' | 'seal',
  ) {
    validateBrandingImage(file, 'logo');
    const ext = extname(file.originalname).toLowerCase() || '.png';
    const dir = join(this.uploadRoot, tenantId, 'certificates', 'assets');
    await mkdir(dir, { recursive: true });
    const filename = `${roleSlug}-${kind}-${randomUUID()}${ext}`;
    const absolutePath = join(dir, filename);
    await writeFile(absolutePath, file.buffer);
    return `/uploads/tenants/${tenantId}/certificates/assets/${filename}`;
  }
}
