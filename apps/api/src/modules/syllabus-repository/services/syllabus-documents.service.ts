import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateSyllabusDocumentDto,
  ExtractSyllabusHintsDto,
  SyllabusCourseLookupQueryDto,
  SyllabusDocumentQueryDto,
  SyllabusPreflightQueryDto,
  SyllabusSettingsDto,
  UpdateSyllabusDocumentDto,
} from '../dto/syllabus-repository.dto';
import { SyllabusAnalyticsService } from './syllabus-analytics.service';
import { SyllabusAssetsService } from './syllabus-assets.service';

const DEFAULT_MIME_TYPES = ['application/pdf'];

type StudentScope = {
  courseIds: string[];
  departmentId?: string;
  semesterNo?: number;
};

@Injectable()
export class SyllabusDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: SyllabusAssetsService,
    private readonly analytics: SyllabusAnalyticsService,
  ) {}

  private hasPermission(user: JwtUser, slug: string) {
    if (user.permissions?.includes(slug)) return true;
    if (user.permissions?.includes('academic:manage')) {
      return [
        'syllabus-repository:manage',
        'syllabus-repository:publish',
        'syllabus-repository:approve',
        'syllabus-repository:contribute',
        'syllabus-repository:read',
        'syllabus-repository:download',
        'syllabus-repository:reports',
      ].includes(slug);
    }
    return false;
  }

  private canManage(user: JwtUser) {
    return (
      this.hasPermission(user, 'syllabus-repository:manage') ||
      this.hasPermission(user, 'academic:manage')
    );
  }

  private canContribute(user: JwtUser) {
    return (
      this.canManage(user) ||
      this.hasPermission(user, 'syllabus-repository:contribute')
    );
  }

  private isStudent(user: JwtUser) {
    return (
      Boolean(user.roles?.includes('student')) &&
      !this.hasPermission(user, 'syllabus-repository:read') &&
      !this.hasPermission(user, 'academic:manage') &&
      !this.hasPermission(user, 'academic:read')
    );
  }

  buildSearchText(input: {
    paperCode: string;
    paperTitle: string;
    keywords?: string[];
    category?: string | null;
  }) {
    return [
      input.paperCode,
      input.paperTitle,
      input.category,
      ...(input.keywords ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  async getSettings(tenantId: string) {
    const row = await this.prisma.syllabusRepositorySettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      return {
        tenantId,
        maxUploadMb: 25,
        allowedMimeTypes: DEFAULT_MIME_TYPES,
        studentAccessEnabled: true,
        watermarkEnabled: false,
      };
    }
    return {
      ...row,
      allowedMimeTypes:
        (row.allowedMimeTypes as string[]) ?? DEFAULT_MIME_TYPES,
    };
  }

  async updateSettings(user: JwtUser, dto: SyllabusSettingsDto) {
    return this.prisma.syllabusRepositorySettings.upsert({
      where: { tenantId: user.tid },
      create: {
        tenantId: user.tid,
        maxUploadMb: dto.maxUploadMb ?? 25,
        allowedMimeTypes: dto.allowedMimeTypes ?? DEFAULT_MIME_TYPES,
        studentAccessEnabled: dto.studentAccessEnabled ?? true,
        watermarkEnabled: dto.watermarkEnabled ?? false,
      },
      update: {
        ...(dto.maxUploadMb !== undefined
          ? { maxUploadMb: dto.maxUploadMb }
          : {}),
        ...(dto.allowedMimeTypes
          ? { allowedMimeTypes: dto.allowedMimeTypes }
          : {}),
        ...(dto.studentAccessEnabled !== undefined
          ? { studentAccessEnabled: dto.studentAccessEnabled }
          : {}),
        ...(dto.watermarkEnabled !== undefined
          ? { watermarkEnabled: dto.watermarkEnabled }
          : {}),
      },
    });
  }

  private mapCourseLookup(course: {
    id: string;
    code: string;
    title: string;
    credits: unknown;
    courseType?: string | null;
    syllabusVersion?: string | null;
    departmentId?: string | null;
    department?: { id: string; code: string; name: string | null } | null;
    offerings?: Array<{
      id: string;
      category: string | null;
      semesterSequence: number | null;
      programVersionId: string | null;
      programVersion?: {
        id: string;
        programId: string;
        program?: { id: string; code: string; name: string | null } | null;
      } | null;
    }>;
  }) {
    const hint = course.offerings?.find((o) => o.semesterSequence != null);
    const programme = hint?.programVersion?.program;
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      credits: course.credits,
      departmentId: course.departmentId ?? course.department?.id ?? null,
      departmentName:
        course.department?.name ?? course.department?.code ?? null,
      departmentCode: course.department?.code ?? null,
      programId: hint?.programVersion?.programId ?? programme?.id ?? null,
      programVersionId: hint?.programVersionId ?? null,
      programmeName: programme?.name ?? null,
      programmeCode: programme?.code ?? null,
      semesterNo: hint?.semesterSequence ?? null,
      category: hint?.category ?? null,
      subjectType: course.courseType ?? null,
      curriculumVersion: course.syllabusVersion ?? null,
      categoryHint: hint?.category ?? null,
      semesterNoHint: hint?.semesterSequence ?? null,
      programIdHint: hint?.programVersion?.programId ?? null,
      programVersionIdHint: hint?.programVersionId ?? null,
      offerings: (course.offerings ?? []).map((o) => ({
        id: o.id,
        category: o.category,
        semesterNo: o.semesterSequence,
        programVersionId: o.programVersionId,
        programmeName: o.programVersion?.program?.name ?? null,
        programmeCode: o.programVersion?.program?.code ?? null,
      })),
    };
  }

  private courseLookupInclude() {
    return {
      department: { select: { id: true, code: true, name: true } },
      offerings: {
        where: { deletedAt: null },
        select: {
          id: true,
          category: true,
          semesterSequence: true,
          programVersionId: true,
          programVersion: {
            select: {
              id: true,
              programId: true,
              program: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { semesterSequence: 'asc' as const },
        take: 5,
      },
    };
  }

  async lookupCourse(tenantId: string, code: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        code: { equals: code.trim(), mode: 'insensitive' },
      },
      include: this.courseLookupInclude(),
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.mapCourseLookup(course);
  }

  async searchCourses(tenantId: string, query: SyllabusCourseLookupQueryDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const code = query.code?.trim();
    if (code && !query.q && !query.departmentId && query.semesterNo == null) {
      try {
        return { items: [await this.lookupCourse(tenantId, code)] };
      } catch {
        return { items: [] };
      }
    }

    const q = (query.q ?? code ?? '').trim();
    const courses = await this.prisma.course.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.subjectType
          ? { courseType: { equals: query.subjectType, mode: 'insensitive' } }
          : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { title: { contains: q, mode: 'insensitive' } },
                {
                  department: {
                    name: { contains: q, mode: 'insensitive' },
                  },
                },
                {
                  department: {
                    code: { contains: q, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
        ...(query.semesterNo != null
          ? {
              offerings: {
                some: {
                  deletedAt: null,
                  semesterSequence: query.semesterNo,
                },
              },
            }
          : {}),
      },
      include: this.courseLookupInclude(),
      orderBy: [{ code: 'asc' }],
      take: limit,
    });

    return { items: courses.map((c) => this.mapCourseLookup(c)) };
  }

  async preflight(tenantId: string, query: SyllabusPreflightQueryDto) {
    const existing = await this.findIdentityMatch(tenantId, {
      courseId: query.courseId,
      academicYearId: query.academicYearId,
      semesterNo: query.semesterNo,
      category: query.category,
    });
    if (!existing) {
      return { exists: false as const, document: null, latestVersion: null };
    }
    const latestVersion = await this.prisma.syllabusVersion.findFirst({
      where: { documentId: existing.id, tenantId },
      orderBy: { versionNo: 'desc' },
    });
    return {
      exists: true as const,
      document: {
        id: existing.id,
        paperCode: existing.paperCode,
        paperTitle: existing.paperTitle,
        status: existing.status,
        currentVersionNo: existing.currentVersionNo,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        publishedAt: existing.publishedAt,
      },
      latestVersion: latestVersion
        ? {
            id: latestVersion.id,
            versionNo: latestVersion.versionNo,
            fileName: latestVersion.fileName,
            fileSizeBytes: latestVersion.fileSizeBytes,
            checksumSha256: latestVersion.checksumSha256,
            createdAt: latestVersion.createdAt,
            changeNote: latestVersion.changeNote,
          }
        : null,
      nextVersionNo: (existing.currentVersionNo ?? 1) + 1,
    };
  }

  async extractHints(
    tenantId: string,
    file: Express.Multer.File | undefined,
    dto: ExtractSyllabusHintsDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }
    let text = '';
    let pageCount: number | null = null;
    try {
      const pdfParse = (await import('pdf-parse')).default as (
        buf: Buffer,
      ) => Promise<{ text?: string; numpages?: number }>;
      const parsed = await pdfParse(file.buffer);
      text = parsed.text ?? '';
      pageCount = parsed.numpages ?? null;
    } catch {
      return {
        readable: false,
        pageCount: null,
        suggestions: {},
        mismatches: ['Could not extract text from PDF (may be scanned).'],
      };
    }

    const normalized = text.replace(/\s+/g, ' ').trim();
    const codeMatch =
      normalized
        .match(/\b([A-Z]{2,6}[- ]?\d{2,4}[A-Z]?)\b/i)?.[1]
        ?.replace(/\s+/g, '-') ?? null;
    const creditsMatch = normalized.match(
      /(?:credits?|credit\s*hours?)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
    )?.[1];
    const titleMatch =
      normalized
        .match(
          /(?:paper\s*title|course\s*title|title)\s*[:\-]\s*([A-Za-z0-9 ,.&()\-]{5,80})/i,
        )?.[1]
        ?.trim() ?? null;

    const suggestions = {
      paperCode: codeMatch,
      paperTitle: titleMatch,
      credits: creditsMatch ? Number(creditsMatch) : null,
    };

    let expectedCode = dto.paperCode?.trim() ?? null;
    let expectedTitle = dto.paperTitle?.trim() ?? null;
    let expectedCredits =
      dto.credits != null && !Number.isNaN(Number(dto.credits))
        ? Number(dto.credits)
        : null;

    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, tenantId, deletedAt: null },
        select: { code: true, title: true, credits: true },
      });
      if (course) {
        expectedCode = expectedCode || course.code;
        expectedTitle = expectedTitle || course.title;
        if (expectedCredits == null && course.credits != null) {
          expectedCredits = Number(course.credits);
        }
      }
    }

    const mismatches: string[] = [];
    if (
      suggestions.paperCode &&
      expectedCode &&
      suggestions.paperCode.replace(/[-\s]/g, '').toLowerCase() !==
        expectedCode.replace(/[-\s]/g, '').toLowerCase()
    ) {
      mismatches.push(
        `PDF suggests paper code "${suggestions.paperCode}" but Course Master has "${expectedCode}"`,
      );
    }
    if (
      suggestions.credits != null &&
      expectedCredits != null &&
      Math.abs(suggestions.credits - expectedCredits) > 0.01
    ) {
      mismatches.push(
        `PDF suggests ${suggestions.credits} credits but Course Master has ${expectedCredits}`,
      );
    }
    if (
      suggestions.paperTitle &&
      expectedTitle &&
      !suggestions.paperTitle
        .toLowerCase()
        .includes(expectedTitle.slice(0, 12).toLowerCase()) &&
      !expectedTitle
        .toLowerCase()
        .includes(suggestions.paperTitle.slice(0, 12).toLowerCase())
    ) {
      mismatches.push(
        `PDF title hint "${suggestions.paperTitle}" may not match "${expectedTitle}"`,
      );
    }

    return {
      readable: normalized.length >= 40,
      pageCount: pageCount ?? null,
      textPreview: normalized.slice(0, 400),
      suggestions,
      mismatches,
    };
  }

  async list(user: JwtUser, query: SyllabusDocumentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
      ...(query.uploadedById ? { uploadedById: query.uploadedById } : {}),
    };

    if (query.studentView || this.isStudent(user)) {
      await this.assertStudentAccessEnabled(user.tid);
      where.status = 'PUBLISHED';
      this.applyStudentScope(where, await this.resolveStudentScope(user));
    } else if (!this.canManage(user)) {
      if (
        this.canContribute(user) &&
        !this.hasPermission(user, 'syllabus-repository:read')
      ) {
        where.uploadedById = user.sub;
      }
    }

    if (query.q) {
      where.searchText = {
        contains: query.q.toLowerCase(),
        mode: 'insensitive',
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.syllabusDocument.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.syllabusDocument.count({ where }),
    ]);

    return {
      items: await this.enrichDocuments(user.tid, items),
      total,
      page,
      limit,
    };
  }

  async getById(user: JwtUser, id: string, studentView = false) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
      include: {
        approvals: { orderBy: { sequence: 'asc' } },
        versions: { orderBy: { versionNo: 'desc' } },
      },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');

    if (studentView || this.isStudent(user)) {
      await this.assertStudentAccessEnabled(user.tid);
      if (doc.status !== 'PUBLISHED') {
        throw new ForbiddenException('Syllabus is not published');
      }
      const scope = await this.resolveStudentScope(user);
      if (!this.studentCanAccessDocument(doc, scope)) {
        throw new ForbiddenException('You do not have access to this syllabus');
      }
    }

    const [enriched] = await this.enrichDocuments(user.tid, [doc]);
    return { ...enriched, versions: doc.versions, approvals: doc.approvals };
  }

  async create(
    user: JwtUser,
    dto: CreateSyllabusDocumentDto,
    file?: Express.Multer.File,
  ) {
    if (!this.canContribute(user)) {
      throw new ForbiddenException(
        'Missing syllabus-repository:contribute permission',
      );
    }
    if (!file?.buffer?.length)
      throw new BadRequestException('PDF file is required');

    const course =
      dto.courseId || dto.paperCode
        ? await this.resolveCourse(user.tid, dto.courseId, dto.paperCode)
        : null;
    if (!course)
      throw new BadRequestException('Course or paperCode is required');

    const offering = await this.findOfferingHint(
      user.tid,
      course.id,
      dto.semesterNo,
      dto.category,
    );
    const paperCode = course.code;
    const paperTitle = dto.paperTitle?.trim() || course.title;
    const semesterNo =
      dto.semesterNo ?? offering?.semesterSequence ?? undefined;
    const category = dto.category ?? offering?.category ?? undefined;
    const departmentId = dto.departmentId ?? course.departmentId ?? undefined;
    const identity = await this.findIdentityMatch(user.tid, {
      courseId: course.id,
      academicYearId: dto.academicYearId,
      semesterNo,
      category,
    });
    const versionMode = dto.versionMode ?? 'auto';
    if (identity && versionMode === 'reject_if_exists') {
      throw new ConflictException({
        message: 'A syllabus already exists for this subject identity',
        documentId: identity.id,
        currentVersionNo: identity.currentVersionNo,
      });
    }

    const settings = await this.getSettings(user.tid);
    const fileMeta = await this.assets.saveSyllabusFile(user.tid, file, {
      academicYear: dto.academicYear ?? dto.academicYearId,
      semesterNo,
      paperCode,
      category,
      maxUploadMb: settings.maxUploadMb,
      allowedMimeTypes: settings.allowedMimeTypes as string[],
      pdfOnly: true,
      canonicalName: true,
    });

    if (identity) {
      await this.assertChecksumNotDuplicate(
        user.tid,
        identity.id,
        fileMeta.checksumSha256,
      );
      return this.addVersion(user, identity.id, file, {
        changeNote:
          versionMode === 'new_version'
            ? 'New version confirmed via upload wizard'
            : 'Re-upload matched existing syllabus identity',
        preSaved: fileMeta,
      });
    }

    const searchText = this.buildSearchText({
      paperCode,
      paperTitle,
      keywords: dto.keywords,
      category,
    });
    const document = await this.prisma.syllabusDocument.create({
      data: {
        tenantId: user.tid,
        courseId: course.id,
        programId: dto.programId ?? offering?.programVersion?.programId,
        programVersionId:
          dto.programVersionId ?? offering?.programVersionId ?? undefined,
        departmentId,
        academicYearId: dto.academicYearId,
        paperCode,
        paperTitle,
        semesterNo,
        credits: dto.credits ?? course.credits,
        subjectType: dto.subjectType ?? course.courseType,
        category,
        curriculumVersion: dto.curriculumVersion,
        versionLabel: dto.versionLabel,
        effectiveFrom: this.parseDate(dto.effectiveFrom),
        effectiveTo: this.parseDate(dto.effectiveTo),
        filePath: fileMeta.filePath,
        fileName: fileMeta.fileName,
        mimeType: fileMeta.mimeType,
        fileSizeBytes: fileMeta.fileSizeBytes,
        checksumSha256: fileMeta.checksumSha256,
        keywords: dto.keywords ?? [],
        searchText,
        notes: dto.notes,
        uploadedById: user.sub,
        status: 'DRAFT',
      },
    });

    await this.prisma.syllabusVersion.create({
      data: {
        tenantId: user.tid,
        documentId: document.id,
        versionNo: 1,
        filePath: fileMeta.filePath,
        fileName: fileMeta.fileName,
        mimeType: fileMeta.mimeType,
        fileSizeBytes: fileMeta.fileSizeBytes,
        checksumSha256: fileMeta.checksumSha256,
        uploadedById: user.sub,
        changeNote: 'Initial upload',
      },
    });
    await this.audit(user, 'syllabus.created', document.id, {
      after: document,
    });
    return document;
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateSyllabusDocumentDto,
    file?: Express.Multer.File,
  ) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');
    const isOwner = doc.uploadedById === user.sub;
    if (!isOwner && !this.canManage(user)) {
      throw new ForbiddenException('You can only edit your own syllabi');
    }
    if (!['DRAFT', 'REJECTED'].includes(doc.status) && !this.canManage(user)) {
      throw new BadRequestException(
        'Only draft or rejected syllabi can be edited',
      );
    }
    if (file?.buffer?.length) {
      await this.addVersion(user, id, file, {
        changeNote: 'File replaced via edit',
      });
    }

    const course = dto.courseId
      ? await this.resolveCourse(user.tid, dto.courseId)
      : null;
    const paperCode = course?.code ?? dto.paperCode ?? doc.paperCode;
    const paperTitle = course?.title ?? dto.paperTitle ?? doc.paperTitle;
    const category = dto.category ?? doc.category;
    const searchText = this.buildSearchText({
      paperCode,
      paperTitle,
      keywords: dto.keywords ?? doc.keywords,
      category,
    });

    const updated = await this.prisma.syllabusDocument.update({
      where: { id },
      data: {
        courseId: course?.id ?? dto.courseId,
        programId: dto.programId,
        programVersionId: dto.programVersionId,
        departmentId: dto.departmentId ?? course?.departmentId,
        academicYearId: dto.academicYearId,
        paperCode,
        paperTitle,
        semesterNo: dto.semesterNo,
        credits: dto.credits,
        subjectType: dto.subjectType ?? course?.courseType,
        category,
        curriculumVersion: dto.curriculumVersion,
        versionLabel: dto.versionLabel,
        effectiveFrom: this.parseDate(dto.effectiveFrom),
        effectiveTo: this.parseDate(dto.effectiveTo),
        notes: dto.notes,
        keywords: dto.keywords,
        searchText,
      },
    });
    await this.audit(user, 'syllabus.updated', id, {
      before: doc,
      after: updated,
    });
    return updated;
  }

  async archive(user: JwtUser, id: string) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');
    const isOwner = doc.uploadedById === user.sub;
    if (!this.canManage(user) && !(isOwner && doc.status === 'DRAFT')) {
      throw new ForbiddenException('You cannot archive this syllabus');
    }
    const updated = await this.prisma.syllabusDocument.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit(user, 'syllabus.archived', id, { after: updated });
    return updated;
  }

  async addVersion(
    user: JwtUser,
    documentId: string,
    file?: Express.Multer.File,
    opts?: {
      changeNote?: string;
      preSaved?: {
        filePath: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        checksumSha256: string;
      };
    },
  ) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id: documentId, tenantId: user.tid, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');
    const isOwner = doc.uploadedById === user.sub;
    if (!isOwner && !this.canManage(user)) {
      throw new ForbiddenException('You can only version your own syllabi');
    }
    let fileMeta = opts?.preSaved;
    if (!fileMeta) {
      if (!file?.buffer?.length)
        throw new BadRequestException('PDF file is required');
      const settings = await this.getSettings(user.tid);
      fileMeta = await this.assets.saveSyllabusFile(user.tid, file, {
        academicYear: doc.academicYearId,
        semesterNo: doc.semesterNo,
        paperCode: doc.paperCode,
        category: doc.category,
        maxUploadMb: settings.maxUploadMb,
        allowedMimeTypes: settings.allowedMimeTypes as string[],
        pdfOnly: true,
        canonicalName: true,
      });
    }

    await this.assertChecksumNotDuplicate(
      user.tid,
      doc.id,
      fileMeta.checksumSha256,
    );

    const nextVersion = (doc.currentVersionNo ?? 1) + 1;
    const [version, updated] = await this.prisma.$transaction([
      this.prisma.syllabusVersion.create({
        data: {
          tenantId: user.tid,
          documentId: doc.id,
          versionNo: nextVersion,
          filePath: fileMeta.filePath,
          fileName: fileMeta.fileName,
          mimeType: fileMeta.mimeType,
          fileSizeBytes: fileMeta.fileSizeBytes,
          checksumSha256: fileMeta.checksumSha256,
          uploadedById: user.sub,
          changeNote: opts?.changeNote ?? 'File replaced',
        },
      }),
      this.prisma.syllabusDocument.update({
        where: { id: doc.id },
        data: {
          filePath: fileMeta.filePath,
          fileName: fileMeta.fileName,
          mimeType: fileMeta.mimeType,
          fileSizeBytes: fileMeta.fileSizeBytes,
          checksumSha256: fileMeta.checksumSha256,
          currentVersionNo: nextVersion,
        },
      }),
    ]);
    await this.audit(user, 'syllabus.versioned', doc.id, {
      before: doc,
      after: { version: nextVersion, versionId: version.id },
    });
    return { document: updated, version };
  }

  async listVersions(user: JwtUser, documentId: string) {
    await this.getById(user, documentId, this.isStudent(user));
    return this.prisma.syllabusVersion.findMany({
      where: { tenantId: user.tid, documentId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async download(user: JwtUser, id: string, ipAddress?: string) {
    const doc = await this.getById(user, id, this.isStudent(user));
    if (!doc.filePath) throw new NotFoundException('No file attached');
    await this.analytics.logAccess({
      tenantId: user.tid,
      documentId: id,
      userId: user.sub,
      action: 'DOWNLOAD',
      ipAddress,
    });
    return this.assets.openDownloadStream(
      user.tid,
      doc.filePath,
      doc.fileName ?? undefined,
    );
  }

  async preview(user: JwtUser, id: string, ipAddress?: string) {
    const doc = await this.getById(user, id, this.isStudent(user));
    if (!doc.filePath) throw new NotFoundException('No file attached');
    if (doc.mimeType !== 'application/pdf') {
      throw new BadRequestException('Preview is only available for PDF files');
    }
    await this.analytics.logAccess({
      tenantId: user.tid,
      documentId: id,
      userId: user.sub,
      action: 'VIEW',
      ipAddress,
    });
    return this.assets.openDownloadStream(
      user.tid,
      doc.filePath,
      doc.fileName ?? undefined,
    );
  }

  async downloadVersion(
    user: JwtUser,
    documentId: string,
    versionNo: number,
    ipAddress?: string,
  ) {
    await this.getById(user, documentId, this.isStudent(user));
    const version = await this.prisma.syllabusVersion.findFirst({
      where: { tenantId: user.tid, documentId, versionNo },
    });
    if (!version) throw new NotFoundException('Version not found');
    await this.analytics.logAccess({
      tenantId: user.tid,
      documentId,
      userId: user.sub,
      action: 'DOWNLOAD',
      ipAddress,
    });
    return this.assets.openDownloadStream(
      user.tid,
      version.filePath,
      version.fileName,
    );
  }

  async listMyBookmarks(user: JwtUser) {
    const rows = await this.prisma.syllabusBookmark.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows
      .filter((row) => !row.document.deletedAt)
      .map((row) => ({
        ...row.document,
        bookmarkedAt: row.createdAt,
        bookmarkId: row.id,
      }));
  }

  async toggleBookmark(user: JwtUser, documentId: string) {
    await this.getById(user, documentId, true);
    const existing = await this.prisma.syllabusBookmark.findUnique({
      where: { userId_documentId: { userId: user.sub, documentId } },
    });
    if (existing) {
      await this.prisma.syllabusBookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }
    const bookmark = await this.prisma.syllabusBookmark.create({
      data: { tenantId: user.tid, userId: user.sub, documentId },
    });
    return { bookmarked: true, bookmark };
  }

  async listForStudentMe(user: JwtUser) {
    await this.assertStudentAccessEnabled(user.tid);
    const scope = await this.resolveStudentScope(user);
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
      status: 'PUBLISHED',
    };
    this.applyStudentScope(where, scope);
    const docs = await this.prisma.syllabusDocument.findMany({
      where,
      orderBy: [{ semesterNo: 'asc' }, { paperCode: 'asc' }],
    });
    return this.enrichDocuments(user.tid, docs);
  }

  async askAboutDocument(user: JwtUser, id: string, question: string) {
    const doc = await this.getById(user, id, this.isStudent(user));
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((term) => term.length > 2);
    const chunks = doc.knowledgeDocumentId
      ? await this.prisma.knowledgeChunk.findMany({
          where: { tenantId: user.tid, documentId: doc.knowledgeDocumentId },
          take: 80,
        })
      : await this.prisma.knowledgeChunk.findMany({
          where: {
            tenantId: user.tid,
            document: {
              title: { contains: doc.paperCode, mode: 'insensitive' },
              sourceType: 'SYLLABUS',
              status: 'ACTIVE',
            },
          },
          take: 80,
        });

    const scored = chunks
      .map((chunk) => {
        const text = `${chunk.heading ?? ''} ${chunk.content}`.toLowerCase();
        const score = terms.reduce(
          (sum, term) => sum + (text.includes(term) ? 1 : 0),
          0,
        );
        return { chunk, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (!scored.length) {
      return {
        answer:
          'I could not find a matching syllabus section for that question in the indexed document.',
        sources: [],
      };
    }

    return {
      answer: scored
        .map(({ chunk }) => chunk.content)
        .join('\n\n')
        .slice(0, 1800),
      sources: scored.map(({ chunk }) => ({
        chunkId: chunk.id,
        heading: chunk.heading,
        pageNo: chunk.pageNo,
      })),
    };
  }

  private async enrichDocuments<
    T extends {
      courseId: string;
      departmentId: string | null;
      programId: string | null;
      programVersionId: string | null;
      academicYearId: string | null;
      uploadedById: string | null;
    },
  >(tenantId: string, items: T[]) {
    if (!items.length) return items;
    const courseIds = [
      ...new Set(items.map((i) => i.courseId).filter(Boolean)),
    ];
    const deptIds = [
      ...new Set(items.map((i) => i.departmentId).filter(Boolean)),
    ] as string[];
    const programIds = [
      ...new Set(items.map((i) => i.programId).filter(Boolean)),
    ] as string[];
    const pvIds = [
      ...new Set(items.map((i) => i.programVersionId).filter(Boolean)),
    ] as string[];
    const yearIds = [
      ...new Set(items.map((i) => i.academicYearId).filter(Boolean)),
    ] as string[];
    const uploaderIds = [
      ...new Set(items.map((i) => i.uploadedById).filter(Boolean)),
    ] as string[];

    const [courses, depts, programs, versions, years, uploaders] =
      await Promise.all([
        this.prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, code: true, title: true, credits: true },
        }),
        deptIds.length
          ? this.prisma.department.findMany({
              where: { id: { in: deptIds } },
              select: { id: true, code: true, name: true },
            })
          : Promise.resolve([]),
        programIds.length
          ? this.prisma.program.findMany({
              where: { id: { in: programIds } },
              select: { id: true, code: true, name: true },
            })
          : Promise.resolve([]),
        pvIds.length
          ? this.prisma.programVersion.findMany({
              where: { id: { in: pvIds } },
              select: {
                id: true,
                program: { select: { code: true, name: true } },
              },
            })
          : Promise.resolve([]),
        yearIds.length
          ? this.prisma.academicYear.findMany({
              where: { id: { in: yearIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        uploaderIds.length
          ? this.prisma.user.findMany({
              where: { tenantId, id: { in: uploaderIds } },
              select: { id: true, displayName: true, email: true },
            })
          : Promise.resolve([]),
      ]);

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const deptMap = new Map(depts.map((d) => [d.id, d]));
    const programMap = new Map(programs.map((p) => [p.id, p]));
    const pvMap = new Map(versions.map((v) => [v.id, v]));
    const yearMap = new Map(years.map((y) => [y.id, y]));
    const userMap = new Map(uploaders.map((u) => [u.id, u]));

    return items.map((item) => {
      const course = courseMap.get(item.courseId);
      const dept = item.departmentId ? deptMap.get(item.departmentId) : null;
      const program = item.programId ? programMap.get(item.programId) : null;
      const pv = item.programVersionId
        ? pvMap.get(item.programVersionId)
        : null;
      const year = item.academicYearId
        ? yearMap.get(item.academicYearId)
        : null;
      const uploader = item.uploadedById
        ? userMap.get(item.uploadedById)
        : null;
      return {
        ...item,
        courseLabel: course ? `${course.code} - ${course.title}` : null,
        courseCredits: course?.credits ?? null,
        departmentName: dept?.name ?? null,
        programName: program?.name ?? pv?.program?.name ?? null,
        programCode: program?.code ?? pv?.program?.code ?? null,
        academicYearName: year?.name ?? null,
        uploadedByName:
          uploader?.displayName?.trim() || uploader?.email || null,
      };
    });
  }

  private async resolveCourse(
    tenantId: string,
    courseId?: string,
    paperCode?: string,
  ) {
    return this.prisma.course.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        ...(courseId
          ? { id: courseId }
          : { code: { equals: paperCode?.trim() ?? '', mode: 'insensitive' } }),
      },
      select: {
        id: true,
        code: true,
        title: true,
        departmentId: true,
        credits: true,
        courseType: true,
      },
    });
  }

  private findOfferingHint(
    tenantId: string,
    courseId: string,
    semesterNo?: number,
    category?: string,
  ) {
    return this.prisma.courseOffering.findFirst({
      where: {
        tenantId,
        courseId,
        deletedAt: null,
        ...(semesterNo ? { semesterSequence: semesterNo } : {}),
        ...(category
          ? { category: { equals: category, mode: 'insensitive' } }
          : {}),
      },
      include: {
        programVersion: { select: { id: true, programId: true } },
      },
      orderBy: { semesterSequence: 'asc' },
    });
  }

  private async assertChecksumNotDuplicate(
    tenantId: string,
    documentId: string,
    checksumSha256: string,
  ) {
    const existing = await this.prisma.syllabusVersion.findFirst({
      where: {
        tenantId,
        documentId,
        checksumSha256,
      },
      select: { versionNo: true, fileName: true },
    });
    if (existing) {
      throw new ConflictException(
        `This exact PDF was already uploaded as version ${existing.versionNo}${
          existing.fileName ? ` (${existing.fileName})` : ''
        }`,
      );
    }
  }

  private findIdentityMatch(
    tenantId: string,
    input: {
      courseId: string;
      academicYearId?: string;
      semesterNo?: number | null;
      category?: string | null;
    },
  ) {
    return this.prisma.syllabusDocument.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        courseId: input.courseId,
        ...(input.academicYearId
          ? { academicYearId: input.academicYearId }
          : { academicYearId: null }),
        ...(input.semesterNo != null
          ? { semesterNo: input.semesterNo }
          : { semesterNo: null }),
        ...(input.category
          ? { category: { equals: input.category, mode: 'insensitive' } }
          : { category: null }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async assertStudentAccessEnabled(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    if (!settings.studentAccessEnabled) {
      throw new ForbiddenException('Student syllabus access is disabled');
    }
  }

  private async resolveStudentScope(user: JwtUser): Promise<StudentScope> {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true, departmentId: true },
    });
    if (!student) return { courseIds: [] };
    const registrations = await this.prisma.semesterRegistration.findMany({
      where: { tenantId: user.tid, studentId: student.id, archivedAt: null },
      include: {
        lines: {
          where: { status: { notIn: ['dropped', 'cancelled', 'rejected'] } },
          include: { offering: { select: { courseId: true } } },
        },
      },
    });
    const courseIds = [
      ...new Set(
        registrations.flatMap((r) =>
          r.lines
            .map((line) => line.offering?.courseId)
            .filter((courseId): courseId is string => Boolean(courseId)),
        ),
      ),
    ];
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId: student.id },
      select: { currentSemesterSequence: true },
    });
    return {
      courseIds,
      departmentId: student.departmentId ?? undefined,
      semesterNo: standing?.currentSemesterSequence ?? undefined,
    };
  }

  private applyStudentScope(
    where: Record<string, unknown>,
    scope: StudentScope,
  ) {
    if (scope.courseIds.length) {
      where.courseId = { in: scope.courseIds };
    } else if (scope.departmentId) {
      where.departmentId = scope.departmentId;
      if (scope.semesterNo) where.semesterNo = scope.semesterNo;
    } else {
      where.id = { in: [] };
    }
  }

  private studentCanAccessDocument(
    doc: {
      courseId: string;
      departmentId: string | null;
      semesterNo: number | null;
    },
    scope: StudentScope,
  ) {
    if (scope.courseIds.includes(doc.courseId)) return true;
    return Boolean(
      doc.departmentId &&
      scope.departmentId &&
      doc.departmentId === scope.departmentId &&
      doc.semesterNo &&
      scope.semesterNo &&
      doc.semesterNo === scope.semesterNo,
    );
  }

  private parseDate(value?: string | null) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
    return date;
  }

  private audit(
    user: JwtUser,
    action: string,
    documentId: string,
    input: Record<string, unknown> = {},
  ) {
    return this.prisma.syllabusAuditLog.create({
      data: {
        tenantId: user.tid,
        documentId,
        actorId: user.sub,
        action,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
