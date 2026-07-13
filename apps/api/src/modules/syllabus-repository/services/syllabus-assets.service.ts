import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, normalize, resolve } from 'path';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import {
  buildCanonicalSyllabusFileName,
  sha256Buffer,
} from '../utils/syllabus-file.util';

const PDF_MIME = 'application/pdf';

@Injectable()
export class SyllabusAssetsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  assertAllowedMime(mime: string, allowed: string[], pdfOnly = true) {
    if (pdfOnly) {
      if (mime !== PDF_MIME) {
        throw new BadRequestException('Only PDF files are allowed');
      }
      return;
    }
    const list = allowed.length ? allowed : [PDF_MIME];
    if (!list.includes(mime)) {
      throw new BadRequestException(`File type ${mime} is not allowed`);
    }
  }

  assertFileSize(size: number, maxUploadMb: number) {
    if (size > maxUploadMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds ${maxUploadMb} MB limit`);
    }
  }

  async saveSyllabusFile(
    tenantId: string,
    file: Express.Multer.File,
    opts: {
      academicYear?: string | number | null;
      semesterNo?: number | null;
      paperCode: string;
      category?: string | null;
      maxUploadMb: number;
      allowedMimeTypes: string[];
      pdfOnly?: boolean;
      canonicalName?: boolean;
    },
  ) {
    this.assertAllowedMime(
      file.mimetype,
      opts.allowedMimeTypes,
      opts.pdfOnly ?? true,
    );
    this.assertFileSize(file.size, opts.maxUploadMb);

    const year = String(opts.academicYear ?? new Date().getFullYear()).replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    const courseSegment = opts.paperCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const documentFileId = randomUUID();
    const dir = join(
      this.uploadRoot,
      tenantId,
      'syllabus-repository',
      year,
      courseSegment,
      documentFileId,
    );
    await mkdir(dir, { recursive: true });

    const storedName = opts.canonicalName
      ? buildCanonicalSyllabusFileName({
          academicYear: opts.academicYear,
          semesterNo: opts.semesterNo,
          paperCode: opts.paperCode,
          category: opts.category,
        })
      : basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');

    const absPath = join(dir, storedName);
    await writeFile(absPath, file.buffer);

    return {
      filePath: `/uploads/tenants/${tenantId}/syllabus-repository/${year}/${courseSegment}/${documentFileId}/${storedName}`,
      fileName: storedName,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      checksumSha256: sha256Buffer(file.buffer),
    };
  }

  resolveAbsolutePath(tenantId: string, filePath: string) {
    if (
      !filePath?.startsWith(`/uploads/tenants/${tenantId}/syllabus-repository/`)
    ) {
      throw new BadRequestException('Invalid file path');
    }
    const abs = normalize(resolve(process.cwd(), filePath.slice(1)));
    const expectedRoot = normalize(
      resolve(this.uploadRoot, tenantId, 'syllabus-repository'),
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
}
