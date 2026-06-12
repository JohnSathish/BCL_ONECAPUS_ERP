import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, extname, join, normalize, resolve } from 'path';
import { randomUUID } from 'crypto';

export const DEFAULT_LIBRARY_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/epub+zip',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

@Injectable()
export class LibraryAssetsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads', 'tenants');

  assertAllowedMime(mime: string, allowed: string[]) {
    const list = allowed.length ? allowed : DEFAULT_LIBRARY_MIME_TYPES;
    if (!list.includes(mime)) {
      throw new BadRequestException(`File type ${mime} is not allowed`);
    }
  }

  assertFileSize(size: number, maxUploadMb: number) {
    if (size > maxUploadMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds ${maxUploadMb} MB limit`);
    }
  }

  async saveFile(
    tenantId: string,
    file: Express.Multer.File,
    opts: {
      segment: 'digital-assets' | 'research';
      assetId?: string;
      maxUploadMb: number;
      allowedMimeTypes: string[];
    },
  ) {
    this.assertAllowedMime(file.mimetype, opts.allowedMimeTypes);
    this.assertFileSize(file.size, opts.maxUploadMb);

    const assetId = opts.assetId ?? randomUUID();
    const ext = extname(file.originalname) || '';
    const dir = join(
      this.uploadRoot,
      tenantId,
      'library',
      opts.segment,
      assetId,
    );
    await mkdir(dir, { recursive: true });
    const storedName = `${basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
    const absPath = join(dir, storedName);
    await writeFile(absPath, file.buffer);

    return {
      filePath: `/uploads/tenants/${tenantId}/library/${opts.segment}/${assetId}/${storedName}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  resolveAbsolutePath(
    tenantId: string,
    filePath: string,
    segment: 'digital-assets' | 'research',
  ) {
    const prefix = `/uploads/tenants/${tenantId}/library/${segment}/`;
    if (!filePath?.startsWith(prefix)) {
      throw new BadRequestException('Invalid file path');
    }
    const abs = normalize(resolve(process.cwd(), filePath.slice(1)));
    const expectedRoot = normalize(
      resolve(this.uploadRoot, tenantId, 'library', segment),
    );
    if (!abs.startsWith(expectedRoot)) {
      throw new BadRequestException('Path traversal blocked');
    }
    if (!existsSync(abs)) throw new NotFoundException('File not found');
    return abs;
  }

  openDownloadStream(
    tenantId: string,
    filePath: string,
    segment: 'digital-assets' | 'research',
    fileName?: string,
  ) {
    const abs = this.resolveAbsolutePath(tenantId, filePath, segment);
    return {
      stream: createReadStream(abs),
      fileName: fileName ?? basename(abs),
    };
  }

  openStreamByPath(tenantId: string, filePath: string, fileName?: string) {
    if (!filePath?.startsWith(`/uploads/tenants/${tenantId}/`)) {
      throw new BadRequestException('Invalid file path');
    }
    const abs = normalize(resolve(process.cwd(), filePath.slice(1)));
    const expectedRoot = normalize(resolve(this.uploadRoot, tenantId));
    if (!abs.startsWith(expectedRoot)) {
      throw new BadRequestException('Path traversal blocked');
    }
    if (!existsSync(abs)) throw new NotFoundException('File not found');
    return {
      stream: createReadStream(abs),
      fileName: fileName ?? basename(abs),
    };
  }

  segmentFromPath(filePath: string): 'digital-assets' | 'research' {
    if (filePath.includes('/library/digital-assets/')) return 'digital-assets';
    if (filePath.includes('/library/research/')) return 'research';
    throw new BadRequestException('Unknown library file path');
  }
}
