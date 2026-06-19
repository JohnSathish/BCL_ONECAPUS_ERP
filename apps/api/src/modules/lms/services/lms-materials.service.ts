import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateLmsMaterialDto,
  LmsMaterialListQueryDto,
  UpdateLmsMaterialDto,
} from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';
import { LmsNotificationService } from './lms-notification.service';
import { LmsSettingsService } from './lms-settings.service';

@Injectable()
export class LmsMaterialsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly settings: LmsSettingsService,
    private readonly audit: LmsAuditService,
    private readonly notifications: LmsNotificationService,
  ) {}

  async list(
    user: JwtUser,
    workspaceId: string,
    query: LmsMaterialListQueryDto,
    studentView = false,
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    const studentId = studentView ? await this.access.getStudentId(user) : null;

    const materials = await this.prisma.lmsMaterial.findMany({
      where: {
        tenantId: user.tid,
        workspaceId,
        deletedAt: null,
        ...(studentView
          ? { status: 'PUBLISHED', visibility: { not: 'FACULTY_ONLY' } }
          : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.unit ? { unit: query.unit } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true, email: true } },
        bookmarks: studentId
          ? { where: { studentId }, select: { id: true } }
          : false,
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return materials.map((m) => ({
      ...m,
      bookmarked: studentId ? (m.bookmarks?.length ?? 0) > 0 : false,
      bookmarks: undefined,
    }));
  }

  async create(
    user: JwtUser,
    workspaceId: string,
    dto: CreateLmsMaterialDto,
    file?: Express.Multer.File,
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'upload');
    const settings = await this.settings.getOrCreate(user.tid);

    let filePath: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;

    if (file?.buffer?.length) {
      const allowed = (settings.allowedMimeTypes as string[]) ?? [];
      if (allowed.length && !allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not allowed`,
        );
      }
      if (file.size > settings.maxUploadMb * 1024 * 1024) {
        throw new BadRequestException(
          `File exceeds ${settings.maxUploadMb} MB limit`,
        );
      }

      const materialId = randomUUID();
      const ext = extname(file.originalname) || '';
      const dir = join(
        this.uploadRoot,
        user.tid,
        'lms',
        'workspaces',
        workspaceId,
        'materials',
        materialId,
      );
      await mkdir(dir, { recursive: true });
      const filename = `v1${ext}`;
      await writeFile(join(dir, filename), file.buffer);
      filePath = `/uploads/tenants/${user.tid}/lms/workspaces/${workspaceId}/materials/${materialId}/${filename}`;
      mimeType = file.mimetype;
      fileSize = file.size;

      const material = await this.prisma.lmsMaterial.create({
        data: {
          id: materialId,
          tenantId: user.tid,
          workspaceId,
          title: dto.title,
          description: dto.description,
          category: dto.category ?? 'OTHER',
          unit: dto.unit,
          visibility: dto.visibility ?? settings.defaultVisibility,
          filePath,
          externalUrl: dto.externalUrl,
          mimeType,
          fileSize,
          status: 'DRAFT',
          uploadedById: user.sub,
        },
      });

      await this.audit.log({
        tenantId: user.tid,
        workspaceId,
        entityType: 'MATERIAL',
        entityId: material.id,
        action: 'UPLOAD',
        actorId: user.sub,
      });

      return material;
    }

    if (!dto.externalUrl) {
      throw new BadRequestException('Provide a file or external URL');
    }

    const material = await this.prisma.lmsMaterial.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        title: dto.title,
        description: dto.description,
        category: dto.category ?? 'OTHER',
        unit: dto.unit,
        visibility: dto.visibility ?? settings.defaultVisibility,
        externalUrl: dto.externalUrl,
        status: 'DRAFT',
        uploadedById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId,
      entityType: 'MATERIAL',
      entityId: material.id,
      action: 'CREATE_LINK',
      actorId: user.sub,
    });

    return material;
  }

  async update(user: JwtUser, materialId: string, dto: UpdateLmsMaterialDto) {
    const material = await this.prisma.lmsMaterial.findFirst({
      where: { id: materialId, tenantId: user.tid, deletedAt: null },
    });
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertWorkspaceAccess(
      user,
      material.workspaceId,
      'upload',
    );

    return this.prisma.lmsMaterial.update({
      where: { id: materialId },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        ...(dto.externalUrl !== undefined
          ? { externalUrl: dto.externalUrl }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async publish(user: JwtUser, materialId: string) {
    const material = await this.prisma.lmsMaterial.findFirst({
      where: { id: materialId, tenantId: user.tid, deletedAt: null },
    });
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertWorkspaceAccess(
      user,
      material.workspaceId,
      'publish',
    );

    const updated = await this.prisma.lmsMaterial.update({
      where: { id: materialId },
      data: { status: 'PUBLISHED', publishAt: new Date() },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: material.workspaceId,
      entityType: 'MATERIAL',
      entityId: materialId,
      action: 'PUBLISH',
      actorId: user.sub,
    });

    void this.notifications.notify({
      tenantId: user.tid,
      type: 'LMS_MATERIAL_PUBLISHED',
      title: `New material: ${updated.title}`,
      body: updated.description ?? 'New learning material published',
      workspaceId: material.workspaceId,
    });

    return updated;
  }

  async archive(user: JwtUser, materialId: string) {
    const material = await this.prisma.lmsMaterial.findFirst({
      where: { id: materialId, tenantId: user.tid, deletedAt: null },
    });
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertWorkspaceAccess(
      user,
      material.workspaceId,
      'publish',
    );
    return this.prisma.lmsMaterial.update({
      where: { id: materialId },
      data: { status: 'ARCHIVED' },
    });
  }

  async toggleBookmark(user: JwtUser, materialId: string) {
    const material = await this.prisma.lmsMaterial.findFirst({
      where: {
        id: materialId,
        tenantId: user.tid,
        deletedAt: null,
        status: 'PUBLISHED',
      },
    });
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertWorkspaceAccess(user, material.workspaceId, 'read');
    const studentId = await this.access.getStudentId(user);
    if (!studentId) throw new BadRequestException('Student profile required');

    const existing = await this.prisma.lmsMaterialBookmark.findUnique({
      where: { studentId_materialId: { studentId, materialId } },
    });
    if (existing) {
      await this.prisma.lmsMaterialBookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    }
    await this.prisma.lmsMaterialBookmark.create({
      data: { tenantId: user.tid, studentId, materialId },
    });
    return { bookmarked: true };
  }

  async recordDownload(user: JwtUser, materialId: string) {
    const material = await this.prisma.lmsMaterial.findFirst({
      where: { id: materialId, tenantId: user.tid, deletedAt: null },
    });
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertWorkspaceAccess(user, material.workspaceId, 'read');
    await this.audit.log({
      tenantId: user.tid,
      workspaceId: material.workspaceId,
      entityType: 'MATERIAL',
      entityId: materialId,
      action: 'DOWNLOAD',
      actorId: user.sub,
    });
    return {
      filePath: material.filePath,
      externalUrl: material.externalUrl,
      title: material.title,
    };
  }

  async search(user: JwtUser, q: string, limit = 20) {
    const [materials, announcements] = await Promise.all([
      this.prisma.lmsMaterial.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          status: 'PUBLISHED',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { workspace: { select: { id: true, title: true } } },
        take: limit,
      }),
      this.prisma.lmsAnnouncement.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { workspace: { select: { id: true, title: true } } },
        take: limit,
      }),
    ]);
    return { materials, announcements };
  }
}
