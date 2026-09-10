import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { SchoolWebService } from './school-web.service';
import type {
  PatchSchoolWebGalleryItemDto,
  SchoolWebGalleryBulkAlbumsDto,
  SchoolWebGalleryBulkItemsDto,
  SchoolWebGalleryReorderDto,
  UpsertSchoolWebGalleryAlbumDto,
  UpsertSchoolWebGalleryTaxonomyDto,
} from './dto/school-web.dto';
import {
  GALLERY_MAX_FILES,
  galleryFileLooksSafe,
  publicAssetUrl,
  slugifyGallery,
} from './school-web-gallery.util';

type QueryOpts = {
  q?: string;
  status?: string;
  visibility?: string;
  categoryId?: string;
  tagId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class SchoolWebGalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly web: SchoolWebService,
  ) {}

  private async ready(tenantId: string) {
    await this.web.assertSchoolWebTenant(tenantId);
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'school-web-gallery',
        action,
        entityType: 'SchoolWebGalleryAlbum',
        entityId,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  async dashboard(tenantId: string) {
    await this.ready(tenantId);
    const where = { tenantId, deletedAt: null };
    const [
      total,
      published,
      draft,
      archived,
      unpublished,
      images,
      recentAlbums,
      recentImages,
      bytes,
    ] = await Promise.all([
      this.prisma.schoolWebGalleryAlbum.count({ where }),
      this.prisma.schoolWebGalleryAlbum.count({
        where: { ...where, status: 'PUBLISHED' },
      }),
      this.prisma.schoolWebGalleryAlbum.count({
        where: { ...where, status: 'DRAFT' },
      }),
      this.prisma.schoolWebGalleryAlbum.count({
        where: { ...where, status: 'ARCHIVED' },
      }),
      this.prisma.schoolWebGalleryAlbum.count({
        where: { ...where, status: 'UNPUBLISHED' },
      }),
      this.prisma.schoolWebGalleryItem.count({
        where: { album: { tenantId, deletedAt: null } },
      }),
      this.prisma.schoolWebGalleryAlbum.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          _count: { select: { items: true } },
          category: true,
          coverAsset: true,
        },
      }),
      this.prisma.schoolWebGalleryItem.findMany({
        where: { album: { tenantId, deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          album: { select: { id: true, title: true, slug: true } },
          asset: true,
        },
      }),
      this.prisma.schoolWebMediaAsset.aggregate({
        where: {
          tenantId,
          galleryItems: { some: { album: { tenantId, deletedAt: null } } },
        },
        _sum: { bytes: true },
      }),
    ]);
    return {
      total,
      published,
      draft,
      archived,
      unpublished,
      images,
      storageBytes: bytes._sum.bytes ?? 0,
      recentAlbums: recentAlbums.map((album) => this.withCover(album)),
      recentImages: recentImages.map((item) => ({
        id: item.id,
        albumId: item.albumId,
        albumTitle: item.album.title,
        createdAt: item.createdAt,
        urls: publicAssetUrl(item.asset.storageKey, item.asset.variants),
      })),
    };
  }

  async listOffice(tenantId: string, opts: QueryOpts = {}) {
    await this.ready(tenantId);
    const where: Prisma.SchoolWebGalleryAlbumWhereInput = {
      tenantId,
      deletedAt: null,
    };
    if (opts.status) where.status = opts.status;
    if (opts.visibility) where.visibility = opts.visibility;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.tagId) where.tags = { some: { tagId: opts.tagId } };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { eventName: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (opts.from || opts.to) {
      where.eventDate = {};
      if (opts.from) where.eventDate.gte = new Date(opts.from);
      if (opts.to) where.eventDate.lte = new Date(opts.to);
    }
    const rows = await this.prisma.schoolWebGalleryAlbum.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: true,
        tags: { include: { tag: true } },
        coverAsset: true,
        _count: { select: { items: true } },
      },
    });
    return rows.map((album) => ({
      ...this.withCover(album),
      tags: album.tags.map((row) => row.tag),
      photoCount: album._count.items,
    }));
  }

  async getOffice(tenantId: string, id: string, page = 1) {
    await this.ready(tenantId);
    const take = 80;
    const skip = Math.max(0, (Math.max(1, page) - 1) * take);
    const album = await this.prisma.schoolWebGalleryAlbum.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        tags: { include: { tag: true } },
        coverAsset: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { asset: true },
          skip,
          take,
        },
        _count: { select: { items: true } },
      },
    });
    if (!album) throw new NotFoundException('Album not found');
    return {
      ...this.withCover(album),
      tags: album.tags.map((row) => row.tag),
      page: Math.max(1, page),
      pageSize: take,
      photoCount: album._count.items,
      items: album.items.map((item) => ({
        ...item,
        urls: publicAssetUrl(item.asset.storageKey, item.asset.variants),
      })),
    };
  }

  async upsertAlbum(
    tenantId: string,
    userId: string,
    dto: UpsertSchoolWebGalleryAlbumDto,
    id?: string,
  ) {
    await this.ready(tenantId);
    const existing = id
      ? await this.prisma.schoolWebGalleryAlbum.findFirst({
          where: { id, tenantId, deletedAt: null },
        })
      : null;
    if (id && !existing) throw new NotFoundException('Album not found');
    const slug = await this.uniqueSlug(tenantId, dto.slug || dto.title, id);
    const status = dto.status ?? 'DRAFT';
    const published = status === 'PUBLISHED';
    const publishedAt = published
      ? (existing?.publishedAt ?? new Date())
      : null;
    const data = {
      title: dto.title.trim(),
      slug,
      description: dto.description?.trim() || null,
      categoryId: dto.categoryId || null,
      eventName: dto.eventName?.trim() || null,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
      location: dto.location?.trim() || null,
      status,
      visibility: dto.visibility ?? 'PUBLIC',
      published,
      publishedAt,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      allowDownload: dto.allowDownload ?? false,
      sortOrder: dto.sortOrder ?? 0,
      academicYear: dto.academicYear?.trim() || null,
      seoJson: (dto.seoJson ?? {}) as Prisma.InputJsonValue,
      updatedById: userId,
    };
    let album;
    if (id) {
      album = await this.prisma.schoolWebGalleryAlbum.update({
        where: { id },
        data,
      });
    } else {
      album = await this.prisma.schoolWebGalleryAlbum.create({
        data: { ...data, tenantId, createdById: userId },
      });
    }
    if (dto.tagIds) {
      await this.prisma.schoolWebGalleryAlbumTag.deleteMany({
        where: { albumId: album.id },
      });
      if (dto.tagIds.length) {
        await this.prisma.schoolWebGalleryAlbumTag.createMany({
          data: dto.tagIds.map((tagId) => ({ albumId: album.id, tagId })),
          skipDuplicates: true,
        });
      }
    }
    await this.audit(
      tenantId,
      userId,
      id ? 'album.updated' : 'album.created',
      album.id,
      { status },
    );
    return this.getOffice(tenantId, album.id);
  }

  async bulkAlbums(
    tenantId: string,
    userId: string,
    dto: SchoolWebGalleryBulkAlbumsDto,
  ) {
    await this.ready(tenantId);
    if (dto.action === 'DELETE') {
      await this.prisma.schoolWebGalleryAlbum.updateMany({
        where: { tenantId, id: { in: dto.ids } },
        data: { deletedAt: new Date(), updatedById: userId },
      });
      await this.audit(
        tenantId,
        userId,
        'album.bulk_deleted',
        dto.ids[0] ?? tenantId,
        { ids: dto.ids },
      );
      return { ok: true };
    }
    const status =
      dto.action === 'PUBLISHED' ||
      dto.action === 'UNPUBLISHED' ||
      dto.action === 'ARCHIVED'
        ? dto.action
        : undefined;
    await this.prisma.schoolWebGalleryAlbum.updateMany({
      where: { tenantId, id: { in: dto.ids }, deletedAt: null },
      data: {
        ...(status
          ? {
              status,
              published: status === 'PUBLISHED',
              publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
            }
          : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        updatedById: userId,
      },
    });
    await this.audit(
      tenantId,
      userId,
      'album.bulk_updated',
      dto.ids[0] ?? tenantId,
      { action: dto.action, ids: dto.ids },
    );
    return { ok: true };
  }

  async uploadImages(
    tenantId: string,
    userId: string,
    albumId: string,
    files: Express.Multer.File[],
  ) {
    await this.ready(tenantId);
    const album = await this.prisma.schoolWebGalleryAlbum.findFirst({
      where: { id: albumId, tenantId, deletedAt: null },
    });
    if (!album) throw new NotFoundException('Album not found');
    if (!files?.length)
      throw new BadRequestException('Select one or more images');
    if (files.length > GALLERY_MAX_FILES) {
      throw new BadRequestException(
        `Upload at most ${GALLERY_MAX_FILES} images at a time`,
      );
    }
    const last = await this.prisma.schoolWebGalleryItem.aggregate({
      where: { albumId },
      _max: { sortOrder: true },
    });
    let order = (last._max.sortOrder ?? -1) + 1;
    const created: Array<{ id: string; assetId: string }> = [];
    for (const file of files) {
      if (!galleryFileLooksSafe(file)) {
        throw new BadRequestException(
          `Unsupported or oversized image: ${file.originalname}`,
        );
      }
      const processed = await this.optimize(file.buffer);
      const id = randomUUID();
      const base = `school-web/${tenantId}/gallery/${albumId}/${id}`;
      const originalKey = `${base}.jpg`;
      const cardKey = `${base}-card.jpg`;
      const thumbKey = `${base}-thumb.webp`;
      await this.writePublic(originalKey, processed.original);
      await this.writePublic(cardKey, processed.card);
      await this.writePublic(thumbKey, processed.thumb);
      const asset = await this.prisma.schoolWebMediaAsset.create({
        data: {
          tenantId,
          fileName: file.originalname,
          storageKey: originalKey,
          mimeType: 'image/jpeg',
          bytes: processed.original.length,
          alt: file.originalname.replace(/\.[^.]+$/, ''),
          variants: {
            original: originalKey,
            card: cardKey,
            thumb: thumbKey,
            width: processed.width,
            height: processed.height,
          },
        },
      });
      const item = await this.prisma.schoolWebGalleryItem.create({
        data: {
          albumId,
          assetId: asset.id,
          altText: asset.alt,
          sortOrder: order++,
          uploadedById: userId,
        },
      });
      created.push(item);
    }
    if (!album.coverAssetId && created[0]) {
      await this.prisma.schoolWebGalleryAlbum.update({
        where: { id: albumId },
        data: { coverAssetId: created[0].assetId },
      });
    }
    await this.audit(tenantId, userId, 'image.uploaded', albumId, {
      count: created.length,
    });
    return this.getOffice(tenantId, albumId, Math.ceil((order || 1) / 80) || 1);
  }

  async replaceImage(
    tenantId: string,
    userId: string,
    albumId: string,
    itemId: string,
    file: Express.Multer.File,
  ) {
    await this.ready(tenantId);
    if (!galleryFileLooksSafe(file)) {
      throw new BadRequestException('Unsupported or oversized image');
    }
    const item = await this.prisma.schoolWebGalleryItem.findFirst({
      where: { id: itemId, albumId, album: { tenantId, deletedAt: null } },
      include: { asset: true },
    });
    if (!item) throw new NotFoundException('Image not found');
    const processed = await this.optimize(file.buffer);
    const id = randomUUID();
    const base = `school-web/${tenantId}/gallery/${albumId}/${id}`;
    const originalKey = `${base}.jpg`;
    const cardKey = `${base}-card.jpg`;
    const thumbKey = `${base}-thumb.webp`;
    await this.writePublic(originalKey, processed.original);
    await this.writePublic(cardKey, processed.card);
    await this.writePublic(thumbKey, processed.thumb);
    const asset = await this.prisma.schoolWebMediaAsset.create({
      data: {
        tenantId,
        fileName: file.originalname,
        storageKey: originalKey,
        mimeType: 'image/jpeg',
        bytes: processed.original.length,
        alt: item.altText || file.originalname.replace(/\.[^.]+$/, ''),
        variants: {
          original: originalKey,
          card: cardKey,
          thumb: thumbKey,
          width: processed.width,
          height: processed.height,
        },
      },
    });
    await this.prisma.schoolWebGalleryItem.update({
      where: { id: itemId },
      data: { assetId: asset.id },
    });
    if (item.albumId) {
      const album = await this.prisma.schoolWebGalleryAlbum.findFirst({
        where: { id: albumId, tenantId },
      });
      if (album?.coverAssetId === item.assetId) {
        await this.prisma.schoolWebGalleryAlbum.update({
          where: { id: albumId },
          data: { coverAssetId: asset.id },
        });
      }
    }
    await this.unlinkAsset(item.asset);
    await this.audit(tenantId, userId, 'image.replaced', albumId, { itemId });
    return this.getOffice(tenantId, albumId);
  }

  async bulkItems(
    tenantId: string,
    userId: string,
    albumId: string,
    dto: SchoolWebGalleryBulkItemsDto,
  ) {
    if (dto.action === 'MOVE') {
      if (!dto.albumId)
        throw new BadRequestException('Destination album is required');
      const dest = await this.prisma.schoolWebGalleryAlbum.findFirst({
        where: { id: dto.albumId, tenantId, deletedAt: null },
      });
      if (!dest) throw new NotFoundException('Destination album not found');
      await this.prisma.schoolWebGalleryItem.updateMany({
        where: { id: { in: dto.ids }, albumId, album: { tenantId } },
        data: { albumId: dto.albumId },
      });
      await this.audit(tenantId, userId, 'image.moved', albumId, {
        ids: dto.ids,
        dest: dto.albumId,
      });
      return { ok: true };
    }
    return this.deleteItems(tenantId, userId, albumId, dto.ids);
  }

  async patchItem(
    tenantId: string,
    userId: string,
    itemId: string,
    dto: PatchSchoolWebGalleryItemDto,
  ) {
    await this.ready(tenantId);
    const item = await this.prisma.schoolWebGalleryItem.findFirst({
      where: { id: itemId, album: { tenantId, deletedAt: null } },
    });
    if (!item) throw new NotFoundException('Image not found');
    if (dto.moveToAlbumId) {
      const dest = await this.prisma.schoolWebGalleryAlbum.findFirst({
        where: { id: dto.moveToAlbumId, tenantId, deletedAt: null },
      });
      if (!dest) throw new NotFoundException('Destination album not found');
    }
    return this.prisma.schoolWebGalleryItem.update({
      where: { id: itemId },
      data: {
        title: dto.title?.trim() ?? undefined,
        caption: dto.caption?.trim() ?? undefined,
        description: dto.description?.trim() ?? undefined,
        altText: dto.altText?.trim() ?? undefined,
        credit: dto.credit?.trim() ?? undefined,
        albumId: dto.moveToAlbumId || undefined,
      },
    });
  }

  async deleteItems(
    tenantId: string,
    userId: string,
    albumId: string,
    itemIds: string[],
  ) {
    await this.ready(tenantId);
    const items = await this.prisma.schoolWebGalleryItem.findMany({
      where: { id: { in: itemIds }, albumId, album: { tenantId } },
      include: { asset: true },
    });
    await this.prisma.schoolWebGalleryItem.deleteMany({
      where: { id: { in: items.map((i) => i.id) } },
    });
    for (const item of items) {
      await this.unlinkAsset(item.asset);
    }
    await this.audit(tenantId, userId, 'image.deleted', albumId, {
      count: items.length,
    });
    return { ok: true, deleted: items.length };
  }

  async reorder(
    tenantId: string,
    albumId: string,
    dto: SchoolWebGalleryReorderDto,
  ) {
    await this.ready(tenantId);
    await this.prisma.$transaction(
      dto.itemIds.map((id, index) =>
        this.prisma.schoolWebGalleryItem.updateMany({
          where: { id, albumId, album: { tenantId } },
          data: { sortOrder: index },
        }),
      ),
    );
    return { ok: true };
  }

  async setCover(
    tenantId: string,
    userId: string,
    albumId: string,
    itemId: string,
  ) {
    await this.ready(tenantId);
    const item = await this.prisma.schoolWebGalleryItem.findFirst({
      where: { id: itemId, albumId, album: { tenantId, deletedAt: null } },
    });
    if (!item) throw new NotFoundException('Image is not in this album');
    await this.prisma.schoolWebGalleryAlbum.update({
      where: { id: albumId },
      data: { coverAssetId: item.assetId, updatedById: userId },
    });
    return this.getOffice(tenantId, albumId);
  }

  async listCategories(tenantId: string) {
    await this.ready(tenantId);
    await this.ensureDefaultCategories(tenantId);
    return this.prisma.schoolWebGalleryCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertCategory(
    tenantId: string,
    dto: UpsertSchoolWebGalleryTaxonomyDto,
    id?: string,
  ) {
    await this.ready(tenantId);
    const slug = await this.uniqueTaxonomy(
      'category',
      tenantId,
      dto.slug || dto.name,
      id,
    );
    const data = { name: dto.name.trim(), slug, sortOrder: dto.sortOrder ?? 0 };
    if (id) {
      const existing = await this.prisma.schoolWebGalleryCategory.findFirst({
        where: { id, tenantId },
      });
      if (!existing) throw new NotFoundException('Category not found');
      return this.prisma.schoolWebGalleryCategory.update({
        where: { id },
        data,
      });
    }
    return this.prisma.schoolWebGalleryCategory.create({
      data: { ...data, tenantId },
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    await this.ready(tenantId);
    await this.prisma.schoolWebGalleryAlbum.updateMany({
      where: { tenantId, categoryId: id },
      data: { categoryId: null },
    });
    await this.prisma.schoolWebGalleryCategory.deleteMany({
      where: { id, tenantId },
    });
    return { ok: true };
  }

  async listTags(tenantId: string) {
    await this.ready(tenantId);
    return this.prisma.schoolWebGalleryTag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async upsertTag(
    tenantId: string,
    dto: UpsertSchoolWebGalleryTaxonomyDto,
    id?: string,
  ) {
    await this.ready(tenantId);
    const slug = await this.uniqueTaxonomy(
      'tag',
      tenantId,
      dto.slug || dto.name,
      id,
    );
    const data = { name: dto.name.trim(), slug };
    if (id) {
      const existing = await this.prisma.schoolWebGalleryTag.findFirst({
        where: { id, tenantId },
      });
      if (!existing) throw new NotFoundException('Tag not found');
      return this.prisma.schoolWebGalleryTag.update({ where: { id }, data });
    }
    return this.prisma.schoolWebGalleryTag.create({
      data: { ...data, tenantId },
    });
  }

  async deleteTag(tenantId: string, id: string) {
    await this.ready(tenantId);
    await this.prisma.schoolWebGalleryAlbumTag.deleteMany({
      where: { tagId: id },
    });
    await this.prisma.schoolWebGalleryTag.deleteMany({
      where: { id, tenantId },
    });
    return { ok: true };
  }

  async listPublic(tenantId: string, opts: QueryOpts & { page?: number } = {}) {
    await this.ready(tenantId);
    await this.ensureDefaultCategories(tenantId);
    const page = Math.max(1, opts.page ?? 1);
    const take = 12;
    const where: Prisma.SchoolWebGalleryAlbumWhereInput = {
      tenantId,
      deletedAt: null,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    };
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.tagId) where.tags = { some: { tagId: opts.tagId } };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { eventName: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }
    const [total, rows, categories, tags] = await Promise.all([
      this.prisma.schoolWebGalleryAlbum.count({ where }),
      this.prisma.schoolWebGalleryAlbum.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { eventDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * take,
        take,
        include: {
          category: true,
          tags: { include: { tag: true } },
          coverAsset: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.schoolWebGalleryCategory.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolWebGalleryTag.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      page,
      total,
      pageSize: take,
      categories,
      tags,
      albums: rows.map((album) => this.serializeAlbum(album, false)),
    };
  }

  async getPublic(tenantId: string, slug: string) {
    await this.ready(tenantId);
    const album = await this.prisma.schoolWebGalleryAlbum.findFirst({
      where: {
        tenantId,
        slug,
        deletedAt: null,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        coverAsset: true,
        items: { orderBy: { sortOrder: 'asc' }, include: { asset: true } },
      },
    });
    if (!album || (album.scheduledAt && album.scheduledAt > new Date())) {
      throw new NotFoundException('Album not found');
    }
    await this.prisma.schoolWebGalleryAlbum.update({
      where: { id: album.id },
      data: { viewCount: { increment: 1 } },
    });
    return this.serializeAlbum(album, true);
  }

  private withCover<
    T extends {
      coverAsset?: { storageKey: string; variants: Prisma.JsonValue } | null;
    },
  >(album: T) {
    return {
      ...album,
      cover: album.coverAsset
        ? publicAssetUrl(album.coverAsset.storageKey, album.coverAsset.variants)
        : null,
    };
  }

  serializeAlbum(
    album: {
      id: string;
      slug: string;
      title: string;
      description: string | null;
      eventName: string | null;
      eventDate: Date | null;
      location: string | null;
      status: string;
      visibility: string;
      allowDownload: boolean;
      seoJson: Prisma.JsonValue;
      viewCount: number;
      sortOrder: number;
      category: { id: string; name: string; slug: string } | null;
      tags?: Array<{ tag: { id: string; name: string; slug: string } }>;
      coverAsset: {
        storageKey: string;
        variants: Prisma.JsonValue;
        alt: string | null;
      } | null;
      items?: Array<{
        id: string;
        title: string | null;
        caption: string | null;
        description: string | null;
        altText: string | null;
        credit: string | null;
        sortOrder: number;
        asset: {
          storageKey: string;
          variants: Prisma.JsonValue;
          mimeType: string;
          bytes: number;
        };
      }>;
      _count?: { items: number };
    },
    withItems: boolean,
  ) {
    const cover = album.coverAsset
      ? publicAssetUrl(album.coverAsset.storageKey, album.coverAsset.variants)
      : album.items?.[0]
        ? publicAssetUrl(
            album.items[0].asset.storageKey,
            album.items[0].asset.variants,
          )
        : null;
    return {
      id: album.id,
      slug: album.slug,
      title: album.title,
      description: album.description,
      eventName: album.eventName,
      eventDate: album.eventDate,
      location: album.location,
      status: album.status,
      visibility: album.visibility,
      allowDownload: album.allowDownload,
      seo: album.seoJson,
      viewCount: album.viewCount,
      photoCount: album._count?.items ?? album.items?.length ?? 0,
      category: album.category,
      tags: (album.tags ?? []).map((row) => row.tag),
      cover,
      items: withItems
        ? (album.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            caption: item.caption,
            description: item.description,
            altText: item.altText,
            credit: item.credit,
            sortOrder: item.sortOrder,
            urls: publicAssetUrl(item.asset.storageKey, item.asset.variants),
          }))
        : undefined,
    };
  }

  private async ensureDefaultCategories(tenantId: string) {
    const count = await this.prisma.schoolWebGalleryCategory.count({
      where: { tenantId },
    });
    if (count) return;
    const names = [
      'School Events',
      'Sports',
      'Cultural Programs',
      'Annual Day',
      'Independence Day',
      'Republic Day',
      'Academic Activities',
      'Staff Activities',
      'Field Trips',
      'Other Events',
    ];
    await this.prisma.schoolWebGalleryCategory.createMany({
      data: names.map((name, sortOrder) => ({
        tenantId,
        name,
        slug: slugifyGallery(name),
        sortOrder,
      })),
    });
  }

  private async uniqueSlug(tenantId: string, raw: string, ignoreId?: string) {
    const base = slugifyGallery(raw);
    let slug = base;
    let n = 2;
    while (
      await this.prisma.schoolWebGalleryAlbum.findFirst({
        where: {
          tenantId,
          slug,
          ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
        },
      })
    ) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  private async uniqueTaxonomy(
    kind: 'category' | 'tag',
    tenantId: string,
    raw: string,
    ignoreId?: string,
  ) {
    const base = slugifyGallery(raw);
    let slug = base;
    let n = 2;
    const exists = async () =>
      kind === 'category'
        ? this.prisma.schoolWebGalleryCategory.findFirst({
            where: {
              tenantId,
              slug,
              ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
            },
          })
        : this.prisma.schoolWebGalleryTag.findFirst({
            where: {
              tenantId,
              slug,
              ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
            },
          });
    while (await exists()) slug = `${base}-${n++}`;
    return slug;
  }

  private async optimize(buffer: Buffer) {
    const meta = await sharp(buffer, { failOn: 'error' }).rotate().metadata();
    const original = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    const card = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const thumb = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 480, height: 360, fit: 'cover' })
      .webp({ quality: 72 })
      .toBuffer();
    return {
      original,
      card,
      thumb,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  }

  private async writePublic(key: string, data: Buffer) {
    const contentType = key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const stored = await this.storage.put(key, data, {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    if (!stored.url) {
      const uploadPath = join(resolveUploadRoot(), key);
      await mkdir(dirname(uploadPath), { recursive: true });
      await writeFile(uploadPath, data);
    }
  }

  private async unlinkAsset(asset: {
    id: string;
    storageKey: string;
    variants: Prisma.JsonValue;
  }) {
    const bag =
      asset.variants && typeof asset.variants === 'object'
        ? (asset.variants as Record<string, unknown>)
        : {};
    const keys = [asset.storageKey, bag.original, bag.card, bag.thumb].filter(
      (k): k is string => typeof k === 'string' && k.length > 0,
    );
    for (const key of [...new Set(keys)]) {
      try {
        await unlink(join(resolveUploadRoot(), key));
      } catch {
        // File may already be gone.
      }
    }
    await this.prisma.schoolWebGalleryAlbum.updateMany({
      where: { coverAssetId: asset.id },
      data: { coverAssetId: null },
    });
    try {
      await this.prisma.schoolWebMediaAsset.delete({ where: { id: asset.id } });
    } catch {
      // Still referenced elsewhere.
    }
  }
}
