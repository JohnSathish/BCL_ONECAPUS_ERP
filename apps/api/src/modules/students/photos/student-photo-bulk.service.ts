import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { JwtUser } from '../../../common/decorators/current-user.decorator';
import { StudentsService } from '../students.service';
import { toStudentListQuery } from '../dto/students.dto';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import type {
  PhotoBulkApplyDto,
  PhotoBulkDeleteDto,
  PhotoBulkPreviewDto,
  PhotoNormalizationDto,
} from './dto/student-photo-bulk.dto';

const MAX_FILES = 5000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGE_BYTES = 20 * 1024;
/** Total bytes across all files in one preview request (individual files mode). */
const MAX_TOTAL_UPLOAD_BYTES = 512 * 1024 * 1024;
const ASYNC_THRESHOLD = 200;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

type UploadedPhoto = {
  originalName: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  modifiedAt?: number;
};

type StudentMatch = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  applicationNumber: string | null;
  admissionNumber: string | null;
  masterProfile: { fullName: string; photoPath: string | null } | null;
};

@Injectable()
export class StudentPhotoBulkService {
  private readonly logger = new Logger(StudentPhotoBulkService.name);
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  async preview(
    user: JwtUser,
    dto: PhotoBulkPreviewDto,
    files: Express.Multer.File[],
    ipAddress?: string,
  ) {
    const normalizationInput = this.parseJsonField<PhotoNormalizationDto>(
      dto.normalization,
    );
    const scopeFilter = this.parseJsonField<any>(dto.scopeFilter);
    const photoFiles = await this.expandFiles(files);
    if (!photoFiles.length)
      throw new BadRequestException('Upload photos or a ZIP file');
    if (photoFiles.length > MAX_FILES) {
      throw new BadRequestException(`Maximum ${MAX_FILES} files per batch`);
    }
    const totalBytes = photoFiles.reduce(
      (sum, file) => sum + file.buffer.length,
      0,
    );
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Total upload size ${Math.round(totalBytes / (1024 * 1024))} MB exceeds ${Math.round(MAX_TOTAL_UPLOAD_BYTES / (1024 * 1024))} MB. Zip the photos into one file and upload the ZIP instead.`,
      );
    }

    const normalization = this.defaultNormalization(normalizationInput);
    const batch = await (this.prisma as any).studentPhotoBulkBatch.create({
      data: {
        tenantId: user.tid,
        status: 'PREVIEWED',
        uploadMode: dto.uploadMode ?? 'FILES',
        identifierStrategy: dto.identifierStrategy,
        normalization: normalization as Prisma.InputJsonValue,
        scopeFilter: scopeFilter
          ? (scopeFilter as Prisma.InputJsonValue)
          : undefined,
        conflictStrategy: dto.conflictStrategy ?? 'SKIP_EXISTING',
        duplicateStrategy: dto.duplicateStrategy ?? 'LATEST',
        cropMode: dto.cropMode ?? 'COVER',
        actorId: user.sub,
        ipAddress,
      },
    });

    const scopeStudents = await this.loadStudents(user, scopeFilter);
    const studentMap = this.buildStudentMap(
      scopeStudents,
      dto.identifierStrategy,
      normalization,
    );
    const csvMap = this.parseCsvMap(dto.csvMap, normalization);
    const identifiers = new Map<string, UploadedPhoto[]>();

    for (const file of photoFiles) {
      const rawIdentifier =
        csvMap.get(file.fileName) ?? this.identifierFromFile(file.fileName);
      const identifier = this.normalize(rawIdentifier, normalization);
      const list = identifiers.get(identifier) ?? [];
      list.push(file);
      identifiers.set(identifier, list);
    }

    const stagedDir = join(
      this.uploadRoot,
      user.tid,
      'student-photo-bulk',
      batch.id,
      'staged',
    );
    await mkdir(stagedDir, { recursive: true });

    const rows: any[] = [];
    let matched = 0;
    let unmatched = 0;
    let duplicates = 0;
    let errors = 0;

    for (const [identifier, groupedFiles] of identifiers) {
      if (groupedFiles.length > 1) duplicates += groupedFiles.length - 1;
      const chosen = await this.chooseDuplicate(
        groupedFiles,
        dto.duplicateStrategy ?? 'LATEST',
      );
      for (const file of groupedFiles) {
        const isChosen = file === chosen;
        const student = studentMap.get(identifier);
        const validation = await this.validateAndStage(
          user.tid,
          batch.id,
          file,
          stagedDir,
          isChosen,
          dto.cropMode ?? 'COVER',
        );
        let status = 'MATCHED';
        let errorMessage = validation.errorMessage;
        if (!student) {
          status = 'UNMATCHED';
          unmatched += 1;
        } else if (!isChosen) {
          status = 'DUPLICATE';
          errorMessage =
            'Duplicate identifier; not selected by duplicate strategy';
        } else if (validation.errorMessage) {
          status = 'ERROR';
          errors += 1;
        } else {
          matched += 1;
        }
        rows.push({
          tenantId: user.tid,
          batchId: batch.id,
          studentId: student?.id ?? null,
          fileName: file.fileName,
          originalName: file.originalName,
          identifier,
          oldPhotoPath: student?.masterProfile?.photoPath ?? null,
          stagedPath: validation.stagedPath,
          thumbnailPath: validation.thumbnailPath,
          mimeType: file.mimeType,
          checksum: validation.checksum,
          fileSize: file.buffer.length,
          width: validation.width,
          height: validation.height,
          status,
          errorMessage,
          duplicateGroup: groupedFiles.length > 1 ? identifier : null,
        });
      }
    }

    const missing = scopeStudents.filter((student) => {
      const id = this.identifierForStudent(student, dto.identifierStrategy);
      return id && !identifiers.has(this.normalize(id, normalization));
    }).length;

    if (rows.length) {
      await (this.prisma as any).studentPhotoBulkChange.createMany({
        data: rows,
      });
    }

    await (this.prisma as any).studentPhotoBulkBatch.update({
      where: { id: batch.id },
      data: {
        totalFiles: photoFiles.length,
        matchedCount: matched,
        unmatchedCount: unmatched,
        duplicateCount: duplicates,
        missingCount: missing,
        errorCount: errors,
      },
    });

    return this.getBatch(user.tid, batch.id);
  }

  async apply(user: JwtUser, dto: PhotoBulkApplyDto) {
    const batch = await this.assertBatch(user.tid, dto.batchId);
    const stuckProcessing =
      batch.status === 'PROCESSING' &&
      !batch.appliedAt &&
      batch.assignedCount === 0 &&
      Date.now() - new Date(batch.updatedAt).getTime() > 30_000;

    const started = await (this.prisma as any).studentPhotoBulkBatch.updateMany(
      {
        where: {
          id: dto.batchId,
          tenantId: user.tid,
          OR: [
            { status: { in: ['PREVIEWED', 'FAILED'] } },
            ...(stuckProcessing
              ? [{ status: 'PROCESSING', appliedAt: null, assignedCount: 0 }]
              : []),
          ],
        },
        data: {
          status: 'PROCESSING',
          assignedCount: 0,
          skippedCount: 0,
        },
      },
    );

    if (started.count === 0) {
      if (batch.status === 'PROCESSING') {
        throw new BadRequestException(
          'Photo assignment is already in progress',
        );
      }
      throw new BadRequestException(
        `Batch status is ${batch.status}, cannot apply`,
      );
    }

    if (batch.matchedCount > ASYNC_THRESHOLD) {
      // Run in-process — the shared BullMQ "exports" queue has many processors and
      // the wrong worker often completes photo jobs without doing any work.
      void this.applyBatchInternal(
        user.tid,
        dto.batchId,
        user.sub,
        dto.conflictStrategy,
      ).catch(async (err) => {
        this.logger.error(
          `Photo bulk apply failed for batch ${dto.batchId}`,
          err instanceof Error ? err.stack : String(err),
        );
        await (this.prisma as any).studentPhotoBulkBatch.update({
          where: { id: dto.batchId },
          data: { status: 'FAILED' },
        });
      });
      return {
        batchId: dto.batchId,
        async: true,
        message: 'Photo assignment started',
      };
    }
    return this.applyBatchInternal(
      user.tid,
      dto.batchId,
      user.sub,
      dto.conflictStrategy,
    );
  }

  async applyBatchInternal(
    tenantId: string,
    batchId: string,
    actorId: string,
    conflictOverride?: string,
  ) {
    try {
      return await this.runApplyBatch(
        tenantId,
        batchId,
        actorId,
        conflictOverride,
      );
    } catch (err) {
      this.logger.error(
        `Photo bulk apply crashed for batch ${batchId}`,
        err instanceof Error ? err.stack : String(err),
      );
      await (this.prisma as any).studentPhotoBulkBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  private async runApplyBatch(
    tenantId: string,
    batchId: string,
    actorId: string,
    conflictOverride?: string,
  ) {
    const batch = await this.assertBatch(tenantId, batchId);
    const conflict = conflictOverride ?? batch.conflictStrategy;
    const changes = await (this.prisma as any).studentPhotoBulkChange.findMany({
      where: { batchId, status: 'MATCHED', studentId: { not: null } },
      include: { student: { include: { masterProfile: true } } },
      orderBy: { createdAt: 'asc' },
    });

    let assigned = 0;
    let skipped = 0;
    let errors = 0;
    const total = changes.length;
    const flushEvery = 5;

    const flushProgress = async () => {
      await (this.prisma as any).studentPhotoBulkBatch.update({
        where: { id: batchId },
        data: {
          assignedCount: assigned,
          skippedCount: skipped,
          errorCount: batch.errorCount + errors,
        },
      });
    };

    for (let index = 0; index < changes.length; index += 1) {
      const change = changes[index];
      try {
        const currentPhoto =
          change.student?.masterProfile?.photoPath ?? change.oldPhotoPath;
        if (currentPhoto && conflict === 'SKIP_EXISTING') {
          skipped += 1;
          await (this.prisma as any).studentPhotoBulkChange.update({
            where: { id: change.id },
            data: { status: 'SKIPPED', errorMessage: 'Existing photo kept' },
          });
        } else {
          const publicPath = await this.persistAssignedPhoto(
            tenantId,
            change.studentId,
            change.stagedPath,
            conflict === 'KEEP_BOTH',
          );
          await this.prisma.studentProfile.upsert({
            where: { studentId: change.studentId },
            create: {
              tenantId,
              studentId: change.studentId,
              fullName: change.student?.masterProfile?.fullName ?? 'Student',
              photoPath: publicPath,
            },
            update: { photoPath: publicPath },
          });
          await this.prisma.studentProfileAuditLog.create({
            data: {
              tenantId,
              studentId: change.studentId,
              sectionKey: 'bulk_photo',
              fieldKey: 'photoPath',
              oldValue: currentPhoto ?? null,
              newValue: publicPath,
              actorId,
            },
          });
          await (this.prisma as any).studentPhotoBulkChange.update({
            where: { id: change.id },
            data: { status: 'ASSIGNED', newPhotoPath: publicPath },
          });
          assigned += 1;
        }
      } catch (err) {
        errors += 1;
        await (this.prisma as any).studentPhotoBulkChange.update({
          where: { id: change.id },
          data: {
            status: 'ERROR',
            errorMessage: err instanceof Error ? err.message : 'Assign failed',
          },
        });
      }

      if ((index + 1) % flushEvery === 0 || index === total - 1) {
        await flushProgress();
      }
    }

    const reportPath = await this.writeReport(tenantId, batchId);
    await (this.prisma as any).studentPhotoBulkBatch.update({
      where: { id: batchId },
      data: {
        status: errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
        assignedCount: assigned,
        skippedCount: skipped,
        errorCount: batch.errorCount + errors,
        reportPath,
        appliedAt: new Date(),
      },
    });
    return {
      batchId,
      async: false,
      assigned,
      skipped,
      errors,
      total: changes.length,
    };
  }

  async listBatches(tenantId: string) {
    return (this.prisma as any).studentPhotoBulkBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { actor: { select: { id: true, email: true } } },
    });
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await (this.prisma as any).studentPhotoBulkBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        actor: { select: { id: true, email: true } },
        changes: {
          take: 500,
          orderBy: [{ status: 'asc' }, { fileName: 'asc' }],
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                applicationNumber: true,
                enrollmentNumber: true,
                masterProfile: { select: { fullName: true, photoPath: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Photo bulk batch not found');
    return batch;
  }

  async downloadReport(tenantId: string, batchId: string) {
    const batch = await this.assertBatch(tenantId, batchId);
    const reportPath =
      batch.reportPath ?? (await this.writeReport(tenantId, batchId));
    if (!batch.reportPath) {
      await (this.prisma as any).studentPhotoBulkBatch.update({
        where: { id: batchId },
        data: { reportPath },
      });
    }
    return {
      path: join(process.cwd(), reportPath.replace(/^\/uploads\//, 'uploads/')),
    };
  }

  async exportIdentifiers(user: JwtUser, query: any) {
    const students = await this.loadStudents(user, query);
    const strategy = query.identifierStrategy ?? 'rollNumber';
    const rows = [
      'StudentIdentifier,FullName,RollNumber,ApplicationNumber,RegistrationNumber,StudentId',
    ];
    for (const student of students) {
      const identifier = this.identifierForStudent(student, strategy) ?? '';
      rows.push(
        [
          identifier,
          student.masterProfile?.fullName ?? '',
          student.rollNumber ?? '',
          student.applicationNumber ?? '',
          student.enrollmentNumber ?? '',
          student.id,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
    }
    return Buffer.from(rows.join('\n'), 'utf8');
  }

  async deletePhotos(user: JwtUser, dto: PhotoBulkDeleteDto) {
    const ids = dto.studentIds?.length
      ? dto.studentIds
      : (await this.loadStudents(user, dto.filter)).map((s) => s.id);
    if (!ids.length) throw new BadRequestException('No students selected');
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        tenantId: user.tid,
        studentId: { in: ids },
        photoPath: { not: null },
      },
    });
    for (const profile of profiles) {
      await this.prisma.studentProfile.update({
        where: { studentId: profile.studentId },
        data: { photoPath: null },
      });
      await this.prisma.studentProfileAuditLog.create({
        data: {
          tenantId: user.tid,
          studentId: profile.studentId,
          sectionKey: 'bulk_photo',
          fieldKey: 'photoPath',
          oldValue: profile.photoPath,
          newValue: null,
          actorId: user.sub,
        },
      });
    }
    return { deleted: profiles.length };
  }

  async reprocessPhotos(user: JwtUser, dto: PhotoBulkDeleteDto) {
    const ids = dto.studentIds?.length
      ? dto.studentIds
      : (await this.loadStudents(user, dto.filter)).map((s) => s.id);
    if (!ids.length) throw new BadRequestException('No students selected');
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        tenantId: user.tid,
        studentId: { in: ids },
        photoPath: { not: null },
      },
    });
    let reprocessed = 0;
    let errors = 0;
    for (const profile of profiles) {
      try {
        if (!profile.photoPath) continue;
        const source = join(
          process.cwd(),
          profile.photoPath.replace(/^\/uploads\//, 'uploads/'),
        );
        const dir = join(
          this.uploadRoot,
          user.tid,
          'students',
          profile.studentId,
        );
        await mkdir(dir, { recursive: true });
        await sharp(await readFile(source))
          .rotate()
          .resize(400, 400, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 82 })
          .toFile(join(dir, 'photo.jpg'));
        await this.prisma.studentProfile.update({
          where: { studentId: profile.studentId },
          data: {
            photoPath: `/uploads/tenants/${user.tid}/students/${profile.studentId}/photo.jpg`,
          },
        });
        reprocessed += 1;
      } catch {
        errors += 1;
      }
    }
    return { reprocessed, errors };
  }

  private async expandFiles(
    files: Express.Multer.File[],
  ): Promise<UploadedPhoto[]> {
    const out: UploadedPhoto[] = [];
    for (const file of files ?? []) {
      const ext = extname(file.originalname).toLowerCase();
      if (
        ext === '.zip' ||
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed'
      ) {
        const zip = await JSZip.loadAsync(file.buffer);
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          const entryExt = extname(entry.name).toLowerCase();
          if (!IMAGE_EXTENSIONS.has(entryExt)) continue;
          out.push({
            originalName: entry.name,
            fileName: basename(entry.name),
            buffer: await entry.async('nodebuffer'),
            mimeType: this.mimeFromExtension(entryExt),
            modifiedAt: entry.date?.getTime(),
          });
        }
      } else if (IMAGE_EXTENSIONS.has(ext) || IMAGE_MIMES.has(file.mimetype)) {
        out.push({
          originalName: file.originalname,
          fileName: basename(file.originalname),
          buffer: file.buffer,
          mimeType: file.mimetype || this.mimeFromExtension(ext),
        });
      }
    }
    return out;
  }

  private async validateAndStage(
    tenantId: string,
    batchId: string,
    file: UploadedPhoto,
    stagedDir: string,
    shouldProcess: boolean,
    cropMode: 'COVER' | 'CONTAIN',
  ) {
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    let errorMessage: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let stagedPath: string | null = null;
    let thumbnailPath: string | null = null;

    if (file.buffer.length < MIN_IMAGE_BYTES)
      errorMessage = 'Image is smaller than 20 KB';
    if (file.buffer.length > MAX_IMAGE_BYTES)
      errorMessage = 'Image exceeds 5 MB';
    if (!IMAGE_MIMES.has(file.mimeType))
      errorMessage = 'Unsupported image format';

    if (!errorMessage) {
      try {
        const image = sharp(file.buffer, { failOn: 'error' });
        const meta = await image.metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        if ((width ?? 0) < 300 || (height ?? 0) < 300) {
          errorMessage = 'Image must be at least 300x300px';
        } else if (shouldProcess) {
          const safeBase = `${Date.now()}-${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const profileName = `${safeBase}.jpg`;
          const thumbName = `${safeBase}-thumb.jpg`;
          const fit = cropMode === 'CONTAIN' ? 'contain' : 'cover';
          await sharp(file.buffer)
            .rotate()
            .resize(400, 400, {
              fit,
              position: 'centre',
              background: '#ffffff',
            })
            .jpeg({ quality: 82 })
            .toFile(join(stagedDir, profileName));
          await sharp(file.buffer)
            .rotate()
            .resize(96, 96, { fit, position: 'centre', background: '#ffffff' })
            .jpeg({ quality: 76 })
            .toFile(join(stagedDir, thumbName));
          stagedPath = `/uploads/tenants/${tenantId}/student-photo-bulk/${batchId}/staged/${profileName}`;
          thumbnailPath = `/uploads/tenants/${tenantId}/student-photo-bulk/${batchId}/staged/${thumbName}`;
        }
      } catch {
        errorMessage = 'Corrupt or unreadable image';
      }
    }

    return { checksum, errorMessage, width, height, stagedPath, thumbnailPath };
  }

  private async persistAssignedPhoto(
    tenantId: string,
    studentId: string,
    stagedPath: string,
    keepBoth: boolean,
  ) {
    if (!stagedPath) throw new BadRequestException('Missing staged photo');
    const source = join(
      process.cwd(),
      stagedPath.replace(/^\/uploads\//, 'uploads/'),
    );
    const buffer = await readFile(source);
    const dir = join(this.uploadRoot, tenantId, 'students', studentId);
    await mkdir(dir, { recursive: true });
    const filename = keepBoth ? `profile-${Date.now()}.jpg` : 'photo.jpg';
    await writeFile(join(dir, filename), buffer);
    return `/uploads/tenants/${tenantId}/students/${studentId}/${filename}`;
  }

  private async loadStudents(
    user: JwtUser,
    filter?: any,
  ): Promise<StudentMatch[]> {
    const query = filter
      ? toStudentListQuery(filter)
      : { page: 1, limit: MAX_FILES };
    const result = await this.students.list(user, {
      ...query,
      page: 1,
      limit: MAX_FILES,
    });
    const ids = result.data.map((s: any) => s.id);
    if (!ids.length) return [];
    return this.prisma.student.findMany({
      where: { tenantId: user.tid, id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        applicationNumber: true,
        admissionNumber: true,
        masterProfile: { select: { fullName: true, photoPath: true } },
      },
    }) as Promise<StudentMatch[]>;
  }

  private buildStudentMap(
    students: StudentMatch[],
    strategy: string,
    normalization: Required<PhotoNormalizationDto>,
  ) {
    const map = new Map<string, StudentMatch>();
    for (const student of students) {
      const identifier = this.identifierForStudent(student, strategy);
      if (identifier)
        map.set(this.normalize(identifier, normalization), student);
    }
    return map;
  }

  private identifierForStudent(student: StudentMatch, strategy: string) {
    switch (strategy) {
      case 'rollNumber':
        return student.rollNumber;
      case 'applicationNumber':
        return student.applicationNumber;
      case 'studentCode':
        return student.admissionNumber ?? student.rollNumber;
      case 'enrollmentNumber':
      case 'nehuRegistrationNumber':
        return student.enrollmentNumber;
      case 'studentId':
        return student.id;
      default:
        return student.rollNumber;
    }
  }

  private identifierFromFile(fileName: string) {
    return basename(fileName, extname(fileName));
  }

  private normalize(value: string, opts: Required<PhotoNormalizationDto>) {
    let next = value.trim();
    if (opts.ignoreExtension) next = basename(next, extname(next));
    if (opts.ignoreSpaces) next = next.replace(/\s+/g, '');
    if (opts.stripSpecialCharacters) next = next.replace(/[^a-zA-Z0-9]/g, '');
    if (opts.ignoreCase) next = next.toUpperCase();
    return next;
  }

  private defaultNormalization(
    opts?: PhotoNormalizationDto,
  ): Required<PhotoNormalizationDto> {
    return {
      ignoreExtension: opts?.ignoreExtension ?? true,
      ignoreSpaces: opts?.ignoreSpaces ?? true,
      ignoreCase: opts?.ignoreCase ?? true,
      stripSpecialCharacters: opts?.stripSpecialCharacters ?? false,
    };
  }

  private parseJsonField<T>(value: unknown): T | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    }
    return value as T;
  }

  private parseCsvMap(
    csv: string | undefined,
    normalization: Required<PhotoNormalizationDto>,
  ) {
    const map = new Map<string, string>();
    if (!csv?.trim()) return map;
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const [header, ...rows] = lines;
    if (!header) return map;
    const columns = header.split(',').map((c) => c.trim());
    const idIdx = columns.findIndex((c) => /studentidentifier/i.test(c));
    const fileIdx = columns.findIndex((c) => /photofile/i.test(c));
    if (idIdx < 0 || fileIdx < 0) return map;
    for (const row of rows) {
      const cells = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cells[fileIdx] && cells[idIdx])
        map.set(basename(cells[fileIdx]), cells[idIdx]);
    }
    return map;
  }

  private async chooseDuplicate(files: UploadedPhoto[], strategy: string) {
    if (files.length === 1) return files[0];
    if (strategy === 'HIGHEST_RESOLUTION') {
      const scored = await Promise.all(
        files.map(async (file) => {
          try {
            const meta = await sharp(file.buffer).metadata();
            return { file, score: (meta.width ?? 0) * (meta.height ?? 0) };
          } catch {
            return { file, score: 0 };
          }
        }),
      );
      return scored.sort((a, b) => b.score - a.score)[0]?.file ?? files[0];
    }
    return (
      [...files].sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))[0] ??
      files[0]
    );
  }

  private async writeReport(tenantId: string, batchId: string) {
    const rows = await (this.prisma as any).studentPhotoBulkChange.findMany({
      where: { tenantId, batchId },
      orderBy: { fileName: 'asc' },
    });
    const csv = ['File,Identifier,Status,Error']
      .concat(
        rows.map((r: any) =>
          [r.fileName, r.identifier ?? '', r.status, r.errorMessage ?? '']
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ),
      )
      .join('\n');
    const dir = join(this.uploadRoot, tenantId, 'student-photo-bulk', batchId);
    await mkdir(dir, { recursive: true });
    const disk = join(dir, 'report.csv');
    await writeFile(disk, csv);
    return `/uploads/tenants/${tenantId}/student-photo-bulk/${batchId}/report.csv`;
  }

  private async assertBatch(tenantId: string, batchId: string) {
    const batch = await (this.prisma as any).studentPhotoBulkBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException('Photo bulk batch not found');
    return batch;
  }

  private mimeFromExtension(ext: string) {
    switch (ext.toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}
