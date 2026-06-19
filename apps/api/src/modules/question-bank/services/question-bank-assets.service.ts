import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, extname, join, normalize, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';

const DEFAULT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
];

@Injectable()
export class QuestionBankAssetsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  assertAllowedMime(mime: string, allowed: string[]) {
    const list = allowed.length ? allowed : DEFAULT_MIME_TYPES;
    if (!list.includes(mime)) {
      throw new BadRequestException(`File type ${mime} is not allowed`);
    }
  }

  assertFileSize(size: number, maxUploadMb: number) {
    if (size > maxUploadMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds ${maxUploadMb} MB limit`);
    }
  }

  async savePaperFile(
    tenantId: string,
    file: Express.Multer.File,
    opts: {
      courseCode?: string;
      examYear?: number;
      maxUploadMb: number;
      allowedMimeTypes: string[];
    },
  ) {
    this.assertAllowedMime(file.mimetype, opts.allowedMimeTypes);
    this.assertFileSize(file.size, opts.maxUploadMb);

    const year = opts.examYear ?? new Date().getFullYear();
    const courseSegment = (opts.courseCode ?? 'general').replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    const paperId = randomUUID();
    const ext = extname(file.originalname) || '';
    const dir = join(
      this.uploadRoot,
      tenantId,
      'question-bank',
      String(year),
      courseSegment,
      paperId,
    );
    await mkdir(dir, { recursive: true });
    const storedName = `${basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;
    const absPath = join(dir, storedName);
    await writeFile(absPath, file.buffer);

    return {
      filePath: `/uploads/tenants/${tenantId}/question-bank/${year}/${courseSegment}/${paperId}/${storedName}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  resolveAbsolutePath(tenantId: string, filePath: string) {
    if (!filePath?.startsWith(`/uploads/tenants/${tenantId}/question-bank/`)) {
      throw new BadRequestException('Invalid file path');
    }
    const abs = normalize(resolve(process.cwd(), filePath.slice(1)));
    const expectedRoot = normalize(
      resolve(this.uploadRoot, tenantId, 'question-bank'),
    );
    if (!abs.startsWith(expectedRoot)) {
      throw new BadRequestException('Path traversal blocked');
    }
    if (!existsSync(abs)) throw new NotFoundException('File not found');
    return abs;
  }

  openDownloadStream(tenantId: string, filePath: string, fileName?: string) {
    const abs = this.resolveAbsolutePath(tenantId, filePath);
    return {
      stream: createReadStream(abs),
      fileName: fileName ?? basename(abs),
    };
  }

  async saveBulkFile(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const dir = join(
      this.uploadRoot,
      tenantId,
      'question-bank',
      'bulk',
      userId,
    );
    await mkdir(dir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const absPath = join(dir, safeName);
    await writeFile(absPath, file.buffer);
    return {
      path: absPath,
      originalName: file.originalname,
      buffer: file.buffer,
    };
  }
}
