import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolveUploadRoot } from '../../../common/uploads/upload-paths';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { JournalResolutionService } from './journal-resolution.service';

const MAX_BYTES = 40 * 1024 * 1024;

@Injectable()
export class JournalContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly resolution: JournalResolutionService,
  ) {}

  listDownloads(
    tenantId: string,
    journalId: string,
    opts: { publishedOnly?: boolean; category?: string } = {},
  ) {
    return this.prisma.journalDownload.findMany({
      where: {
        tenantId,
        journalId,
        ...(opts.publishedOnly ? { isPublished: true } : {}),
        ...(opts.category ? { category: opts.category } : {}),
      },
      include: {
        volume: {
          select: { id: true, volumeNumber: true, year: true, label: true },
        },
        issue: { select: { id: true, issueNumber: true, title: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createDownload(
    user: JwtUser,
    journalId: string,
    dto: {
      title: string;
      category?: string;
      volumeId?: string;
      issueId?: string;
      fileUrl: string;
      fileName?: string;
      sortOrder?: number;
      isPublished?: boolean;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    if (!dto.title?.trim() || !dto.fileUrl?.trim()) {
      throw new BadRequestException('title and fileUrl are required');
    }
    return this.prisma.journalDownload.create({
      data: {
        tenantId: user.tid,
        journalId,
        title: dto.title.trim(),
        category: dto.category || 'OTHER',
        volumeId: dto.volumeId || null,
        issueId: dto.issueId || null,
        fileUrl: dto.fileUrl.trim(),
        fileName: dto.fileName,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      },
    });
  }

  async updateDownload(
    user: JwtUser,
    journalId: string,
    downloadId: string,
    dto: Partial<{
      title: string;
      category: string;
      volumeId: string | null;
      issueId: string | null;
      fileUrl: string;
      fileName: string | null;
      sortOrder: number;
      isPublished: boolean;
    }>,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalDownload.findFirst({
      where: { id: downloadId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Download not found');
    return this.prisma.journalDownload.update({
      where: { id: downloadId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.volumeId !== undefined ? { volumeId: dto.volumeId } : {}),
        ...(dto.issueId !== undefined ? { issueId: dto.issueId } : {}),
        ...(dto.fileUrl !== undefined ? { fileUrl: dto.fileUrl.trim() } : {}),
        ...(dto.fileName !== undefined ? { fileName: dto.fileName } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished }
          : {}),
      },
    });
  }

  async deleteDownload(user: JwtUser, journalId: string, downloadId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalDownload.findFirst({
      where: { id: downloadId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Download not found');
    await this.prisma.journalDownload.delete({ where: { id: downloadId } });
    return { ok: true };
  }

  listMedia(tenantId: string, journalId: string, kind?: string) {
    return this.prisma.journalMediaAsset.findMany({
      where: {
        tenantId,
        journalId,
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadMedia(
    user: JwtUser,
    journalId: string,
    file: Express.Multer.File,
    opts: { kind?: string; originalUrl?: string } = {},
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    if (!file?.buffer?.length)
      throw new BadRequestException('File is required');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File too large (max 40MB)');
    }
    const kind = opts.kind || 'OTHER';
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `journals/${user.tid}/${journalId}/media/${randomUUID()}-${safeName}`;
    await this.persistPublicAsset(storageKey, file.buffer, file.mimetype);
    return this.prisma.journalMediaAsset.create({
      data: {
        tenantId: user.tid,
        journalId,
        kind,
        storageKey,
        publicUrl: `/uploads/${storageKey}`,
        originalUrl: opts.originalUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        bytes: file.size,
      },
    });
  }

  async createMediaFromUrl(
    user: JwtUser,
    journalId: string,
    dto: {
      kind?: string;
      publicUrl: string;
      storageKey?: string;
      originalUrl?: string;
      fileName?: string;
      mimeType?: string;
      bytes?: number;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    return this.prisma.journalMediaAsset.create({
      data: {
        tenantId: user.tid,
        journalId,
        kind: dto.kind || 'OTHER',
        storageKey: dto.storageKey || dto.publicUrl,
        publicUrl: dto.publicUrl,
        originalUrl: dto.originalUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        bytes: dto.bytes,
      },
    });
  }

  async deleteMedia(user: JwtUser, journalId: string, mediaId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalMediaAsset.findFirst({
      where: { id: mediaId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Media not found');
    await this.prisma.journalMediaAsset.delete({ where: { id: mediaId } });
    return { ok: true };
  }

  listRedirects(tenantId: string, journalId: string) {
    return this.prisma.journalRedirect.findMany({
      where: { tenantId, journalId },
      orderBy: { fromPath: 'asc' },
    });
  }

  async upsertRedirect(
    user: JwtUser,
    journalId: string,
    dto: { fromPath: string; toPath: string; statusCode?: number },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const fromPath = this.normalizePath(dto.fromPath);
    const toPath = dto.toPath.trim();
    if (!fromPath || !toPath) {
      throw new BadRequestException('fromPath and toPath are required');
    }
    const existing = await this.prisma.journalRedirect.findFirst({
      where: { journalId, fromPath },
    });
    if (existing) {
      return this.prisma.journalRedirect.update({
        where: { id: existing.id },
        data: {
          toPath,
          statusCode: dto.statusCode ?? existing.statusCode,
        },
      });
    }
    return this.prisma.journalRedirect.create({
      data: {
        tenantId: user.tid,
        journalId,
        fromPath,
        toPath,
        statusCode: dto.statusCode ?? 301,
      },
    });
  }

  async deleteRedirect(user: JwtUser, journalId: string, redirectId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalRedirect.findFirst({
      where: { id: redirectId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Redirect not found');
    await this.prisma.journalRedirect.delete({ where: { id: redirectId } });
    return { ok: true };
  }

  async findRedirect(tenantId: string, journalId: string, fromPath: string) {
    return this.prisma.journalRedirect.findFirst({
      where: {
        tenantId,
        journalId,
        fromPath: this.normalizePath(fromPath),
      },
    });
  }

  /** Persist under uploads (public) and StorageService (canonical store). */
  async persistPublicAsset(
    storageKey: string,
    data: Buffer,
    contentType?: string,
  ) {
    await this.storage.put(storageKey, data, { contentType });
    const uploadPath = join(
      resolveUploadRoot(),
      storageKey.replace(/^\/+/, ''),
    );
    await mkdir(dirname(uploadPath), { recursive: true });
    await writeFile(uploadPath, data);
    return { storageKey, publicUrl: `/uploads/${storageKey}` };
  }

  private normalizePath(path: string) {
    const raw = path.trim();
    if (!raw) return '';
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withSlash.replace(/\/+$/, '') || '/';
  }
}
