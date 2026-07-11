import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join, normalize, resolve } from 'path';
import { randomUUID } from 'crypto';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import {
  buildCanonicalPaperFileName,
  sha256Buffer,
} from '../utils/question-paper-file.util';

const PDF_MIME = 'application/pdf';

@Injectable()
export class QuestionBankAssetsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  assertAllowedMime(mime: string, allowed: string[], pdfOnly = false) {
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

  async savePaperFile(
    tenantId: string,
    file: Express.Multer.File,
    opts: {
      courseCode?: string;
      examYear?: number | null;
      examCycle?: string | null;
      semesterNo?: number | null;
      paperCode: string;
      paperType?: string | null;
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

    const year = opts.examYear ?? new Date().getFullYear();
    const courseSegment = (
      opts.courseCode ??
      opts.paperCode ??
      'general'
    ).replace(/[^a-zA-Z0-9_-]/g, '_');
    const paperId = randomUUID();
    const dir = join(
      this.uploadRoot,
      tenantId,
      'question-bank',
      String(year),
      courseSegment,
      paperId,
    );
    await mkdir(dir, { recursive: true });

    const storedName = opts.canonicalName
      ? buildCanonicalPaperFileName({
          examYear: opts.examYear,
          examCycle: opts.examCycle,
          semesterNo: opts.semesterNo,
          paperCode: opts.paperCode,
          paperType: opts.paperType,
        })
      : `${basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const absPath = join(dir, storedName);
    await writeFile(absPath, file.buffer);
    const checksumSha256 = sha256Buffer(file.buffer);

    return {
      filePath: `/uploads/tenants/${tenantId}/question-bank/${year}/${courseSegment}/${paperId}/${storedName}`,
      fileName: storedName,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      checksumSha256,
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
      filePath: `/uploads/tenants/${tenantId}/question-bank/bulk/${userId}/${safeName}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }
}
