import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveTenantUploadRoot } from '../../common/uploads/upload-paths';
import { randomUUID } from 'crypto';

import {
  extensionForBackgroundMime,
  readImageDimensions,
  validateIdCardBackgroundImage,
} from '../../common/uploads/id-card-background.validator';

export type IdCardBackgroundUploadResult = {
  imageUrl: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
  fileSizeBytes: number;
  mimeType: string;
};

@Injectable()
export class IdCardAssetsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  async uploadBackground(
    tenantId: string,
    file: Express.Multer.File,
    opts?: { templateId?: string; side?: 'front' | 'back' },
  ): Promise<IdCardBackgroundUploadResult> {
    const valid = validateIdCardBackgroundImage(file);
    const side = opts?.side ?? 'front';
    const segment = opts?.templateId ?? randomUUID();
    const dir = join(
      this.uploadRoot,
      tenantId,
      'id-cards',
      'backgrounds',
      segment,
    );
    await mkdir(dir, { recursive: true });

    const ext = extensionForBackgroundMime(valid.mimetype);
    const filename = `${side}-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), valid.buffer);

    const dims = readImageDimensions(valid.buffer, valid.mimetype);
    const publicPath = `/uploads/tenants/${tenantId}/id-cards/backgrounds/${segment}/${filename}`;

    return {
      imageUrl: publicPath,
      naturalWidth: dims?.width ?? null,
      naturalHeight: dims?.height ?? null,
      fileSizeBytes: valid.size,
      mimeType: valid.mimetype,
    };
  }
}
