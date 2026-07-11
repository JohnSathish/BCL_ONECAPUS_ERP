import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateQuestionPaperDto,
  CreateShareLinkDto,
  CurriculumCoursesQueryDto,
  QuestionBankSettingsDto,
  QuestionPaperQueryDto,
  UpdateQuestionPaperDto,
} from '../dto/question-bank.dto';
import { resolveExamCycleFromSemester } from '../utils/question-paper-file.util';
import { QuestionBankAssetsService } from './question-bank-assets.service';
import { QuestionBankAnalyticsService } from './question-bank-analytics.service';

const DEFAULT_PAPER_TYPES = [
  'THEORY',
  'THEORY_PRACTICAL',
  'PRACTICAL',
  'UNIVERSITY_EXAM',
  'END_SEMESTER',
  'MID_SEMESTER',
  'INTERNAL',
  'SUPPLEMENTARY',
];

const DEFAULT_MIME_TYPES = ['application/pdf'];

@Injectable()
export class QuestionPapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: QuestionBankAssetsService,
    private readonly analytics: QuestionBankAnalyticsService,
  ) {}

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private isStudent(user: JwtUser) {
    return (
      user.roles?.includes('student') &&
      !this.hasPermission(user, 'question-bank:read')
    );
  }

  buildSearchText(input: {
    paperCode: string;
    paperName: string;
    keywords?: string[];
    paperType?: string;
    examYear?: number | null;
    examinationType?: string | null;
    subjectCategory?: string | null;
    language?: string | null;
  }) {
    return [
      input.paperCode,
      input.paperName,
      input.paperType,
      input.examYear,
      input.examinationType,
      input.subjectCategory,
      input.language,
      ...(input.keywords ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  async getSettings(tenantId: string) {
    const row = await this.prisma.questionBankSettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      return {
        tenantId,
        maxUploadMb: 20,
        allowedMimeTypes: DEFAULT_MIME_TYPES,
        allowedPaperTypes: DEFAULT_PAPER_TYPES,
        studentAccessEnabled: true,
      };
    }
    return {
      ...row,
      allowedMimeTypes:
        (row.allowedMimeTypes as string[]) ?? DEFAULT_MIME_TYPES,
      allowedPaperTypes:
        (row.allowedPaperTypes as string[]) ?? DEFAULT_PAPER_TYPES,
    };
  }

  async updateSettings(user: JwtUser, dto: QuestionBankSettingsDto) {
    return this.prisma.questionBankSettings.upsert({
      where: { tenantId: user.tid },
      create: {
        tenantId: user.tid,
        maxUploadMb: dto.maxUploadMb ?? 20,
        allowedMimeTypes: dto.allowedMimeTypes ?? DEFAULT_MIME_TYPES,
        allowedPaperTypes: dto.allowedPaperTypes ?? DEFAULT_PAPER_TYPES,
        studentAccessEnabled: dto.studentAccessEnabled ?? true,
      },
      update: {
        ...(dto.maxUploadMb !== undefined
          ? { maxUploadMb: dto.maxUploadMb }
          : {}),
        ...(dto.allowedMimeTypes
          ? { allowedMimeTypes: dto.allowedMimeTypes }
          : {}),
        ...(dto.allowedPaperTypes
          ? { allowedPaperTypes: dto.allowedPaperTypes }
          : {}),
        ...(dto.studentAccessEnabled !== undefined
          ? { studentAccessEnabled: dto.studentAccessEnabled }
          : {}),
      },
    });
  }

  async listCurriculumCourses(
    tenantId: string,
    query: CurriculumCoursesQueryDto,
  ) {
    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.programVersionId
          ? { programVersionId: query.programVersionId }
          : {}),
        ...(query.semesterNo ? { semesterSequence: query.semesterNo } : {}),
        ...(query.category
          ? { category: { equals: query.category, mode: 'insensitive' } }
          : {}),
        course: {
          deletedAt: null,
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(query.q
            ? {
                OR: [
                  { code: { contains: query.q, mode: 'insensitive' } },
                  { title: { contains: query.q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            credits: true,
            departmentId: true,
          },
        },
      },
      take: 200,
      orderBy: { course: { code: 'asc' } },
    });

    const byCourse = new Map<
      string,
      {
        id: string;
        code: string;
        title: string;
        credits: unknown;
        departmentId: string | null;
        category: string | null;
        semesterNo: number | null;
      }
    >();
    for (const row of offerings) {
      if (!row.course || byCourse.has(row.course.id)) continue;
      byCourse.set(row.course.id, {
        id: row.course.id,
        code: row.course.code,
        title: row.course.title,
        credits: row.course.credits,
        departmentId: row.course.departmentId,
        category: row.category,
        semesterNo: row.semesterSequence,
      });
    }

    if (byCourse.size === 0) {
      const courses = await this.prisma.course.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(query.q
            ? {
                OR: [
                  { code: { contains: query.q, mode: 'insensitive' } },
                  { title: { contains: query.q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          code: true,
          title: true,
          credits: true,
          departmentId: true,
        },
        take: 100,
        orderBy: { code: 'asc' },
      });
      return courses.map((c) => ({
        ...c,
        category: query.category ?? null,
        semesterNo: query.semesterNo ?? null,
      }));
    }

    return [...byCourse.values()];
  }

  async list(user: JwtUser, query: QuestionPaperQueryDto, studentView = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.programVersionId
        ? { programVersionId: query.programVersionId }
        : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
      ...(query.paperType ? { paperType: query.paperType } : {}),
      ...(query.examinationType
        ? { examinationType: query.examinationType }
        : {}),
      ...(query.examCycle ? { examCycle: query.examCycle } : {}),
      ...(query.subjectCategory
        ? { subjectCategory: query.subjectCategory }
        : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.examYear ? { examYear: query.examYear } : {}),
      ...(query.examMonth ? { examMonth: query.examMonth } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.uploadedById ? { uploadedById: query.uploadedById } : {}),
    };

    if (studentView || this.isStudent(user)) {
      where.status = 'PUBLISHED';
      const scope = await this.resolveStudentScope(user);
      if (scope.courseIds.length) {
        where.OR = [
          { courseId: { in: scope.courseIds } },
          ...(scope.departmentId && scope.semesterNo
            ? [
                {
                  courseId: null,
                  departmentId: scope.departmentId,
                  semesterNo: scope.semesterNo,
                },
              ]
            : []),
        ];
      } else if (scope.departmentId) {
        where.departmentId = scope.departmentId;
      }
    } else if (
      !query.status &&
      !this.hasPermission(user, 'question-bank:manage')
    ) {
      if (
        this.hasPermission(user, 'question-bank:contribute') &&
        !this.hasPermission(user, 'question-bank:read')
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
      this.prisma.questionPaper.findMany({
        where,
        orderBy: [{ examYear: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.questionPaper.count({ where }),
    ]);

    return {
      items: await this.enrichPapers(user.tid, items),
      total,
      page,
      limit,
    };
  }

  private async enrichPapers<
    T extends {
      id: string;
      courseId: string | null;
      departmentId: string | null;
      programVersionId: string | null;
      academicYearId: string | null;
      uploadedById: string | null;
      fileSizeBytes: number | null;
    },
  >(tenantId: string, items: T[]) {
    if (!items.length) return items;

    const courseIds = [
      ...new Set(items.map((i) => i.courseId).filter(Boolean)),
    ] as string[];
    const deptIds = [
      ...new Set(items.map((i) => i.departmentId).filter(Boolean)),
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
    const paperIds = items.map((i) => i.id);

    const [courses, depts, versions, years, uploaders, downloads] =
      await Promise.all([
        courseIds.length
          ? this.prisma.course.findMany({
              where: { id: { in: courseIds } },
              select: { id: true, code: true, title: true, credits: true },
            })
          : Promise.resolve([]),
        deptIds.length
          ? this.prisma.department.findMany({
              where: { id: { in: deptIds } },
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
              where: { id: { in: uploaderIds }, tenantId },
              select: { id: true, displayName: true, email: true },
            })
          : Promise.resolve([]),
        this.prisma.questionPaperAccessLog.groupBy({
          by: ['paperId'],
          where: {
            tenantId,
            paperId: { in: paperIds },
            action: 'DOWNLOAD',
          },
          _count: { paperId: true },
        }),
      ]);

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const deptMap = new Map(depts.map((d) => [d.id, d]));
    const pvMap = new Map(versions.map((v) => [v.id, v]));
    const yearMap = new Map(years.map((y) => [y.id, y]));
    const userMap = new Map(uploaders.map((u) => [u.id, u]));
    const downloadMap = new Map(
      downloads.map((d) => [d.paperId, d._count.paperId]),
    );

    return items.map((item) => {
      const course = item.courseId ? courseMap.get(item.courseId) : null;
      const dept = item.departmentId ? deptMap.get(item.departmentId) : null;
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
        courseLabel: course ? `${course.code} — ${course.title}` : null,
        courseCredits: course?.credits ?? null,
        departmentName: dept?.name ?? null,
        programmeName: pv?.program?.name ?? null,
        programmeCode: pv?.program?.code ?? null,
        academicYearName: year?.name ?? null,
        uploadedByName:
          uploader?.displayName?.trim() || uploader?.email || null,
        downloadCount: downloadMap.get(item.id) ?? 0,
      };
    });
  }

  async getById(user: JwtUser, id: string, studentView = false) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
      include: {
        approvals: { orderBy: { sequence: 'asc' } },
        versions: { orderBy: { versionNo: 'desc' } },
      },
    });
    if (!paper) throw new NotFoundException('Paper not found');

    if (studentView || this.isStudent(user)) {
      if (paper.status !== 'PUBLISHED')
        throw new ForbiddenException('Paper is not published');
      const scope = await this.resolveStudentScope(user);
      const allowed = this.studentCanAccessPaper(paper, scope);
      if (!allowed)
        throw new ForbiddenException('You do not have access to this paper');
    }

    const related = paper.courseId
      ? await this.prisma.questionPaper.findMany({
          where: {
            tenantId: user.tid,
            courseId: paper.courseId,
            id: { not: paper.id },
            deletedAt: null,
            status:
              studentView || this.isStudent(user) ? 'PUBLISHED' : undefined,
          },
          take: 6,
          orderBy: { examYear: 'desc' },
        })
      : [];

    const [enriched] = await this.enrichPapers(user.tid, [paper]);
    return { ...enriched, related, versions: paper.versions };
  }

  async create(
    user: JwtUser,
    dto: CreateQuestionPaperDto,
    file?: Express.Multer.File,
  ) {
    const canContribute =
      this.hasPermission(user, 'question-bank:contribute') ||
      this.hasPermission(user, 'question-bank:manage');
    if (!canContribute)
      throw new ForbiddenException(
        'Missing question-bank:contribute permission',
      );

    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }

    const settings = await this.getSettings(user.tid);
    const course = dto.courseId
      ? await this.prisma.course.findFirst({
          where: { id: dto.courseId, tenantId: user.tid, deletedAt: null },
          select: { id: true, code: true, title: true, departmentId: true },
        })
      : null;

    const paperCode = course?.code ?? dto.paperCode;
    const paperName = course?.title ?? dto.paperName;
    if (!paperCode || !paperName) {
      throw new BadRequestException(
        'Course selection or paper code/title is required',
      );
    }
    const departmentId = dto.departmentId ?? course?.departmentId ?? undefined;
    const examCycle =
      dto.examCycle ??
      resolveExamCycleFromSemester(dto.semesterNo) ??
      undefined;

    const identity = await this.findIdentityMatch(user.tid, {
      paperCode,
      academicYearId: dto.academicYearId,
      examYear: dto.examYear,
      examMonth: dto.examMonth,
      paperType: dto.paperType,
    });

    const fileMeta = await this.assets.savePaperFile(user.tid, file, {
      courseCode: paperCode,
      examYear: dto.examYear,
      examCycle,
      semesterNo: dto.semesterNo,
      paperCode,
      paperType: dto.paperType,
      maxUploadMb: settings.maxUploadMb,
      allowedMimeTypes: settings.allowedMimeTypes as string[],
      pdfOnly: true,
      canonicalName: true,
    });

    if (identity) {
      return this.addVersion(user, identity.id, file, {
        changeNote: 'Re-upload matched existing paper identity',
        preSaved: fileMeta,
      });
    }

    const universityName =
      dto.universityName ?? (await this.resolveDefaultUniversity(user.tid));

    return this.createInternal(user, {
      ...dto,
      paperCode,
      paperName,
      departmentId,
      examCycle,
      universityName,
      preparedById: dto.preparedById ?? user.sub,
      ...fileMeta,
      status: 'DRAFT',
    });
  }

  async createInternal(
    user: JwtUser,
    input: CreateQuestionPaperDto & {
      paperCode: string;
      paperName: string;
      filePath?: string;
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      checksumSha256?: string;
      status?: string;
    },
  ) {
    const searchText = this.buildSearchText({
      paperCode: input.paperCode,
      paperName: input.paperName,
      keywords: input.keywords,
      paperType: input.paperType,
      examYear: input.examYear,
      examinationType: input.examinationType,
      subjectCategory: input.subjectCategory,
      language: input.language,
    });

    const paper = await this.prisma.questionPaper.create({
      data: {
        tenantId: user.tid,
        paperCode: input.paperCode,
        paperName: input.paperName,
        academicYearId: input.academicYearId,
        programVersionId: input.programVersionId,
        departmentId: input.departmentId,
        courseId: input.courseId,
        semesterNo: input.semesterNo,
        examinationSession: input.examinationSession ?? input.examinationType,
        examinationType: input.examinationType,
        examCycle: input.examCycle,
        subjectCategory: input.subjectCategory,
        language: input.language,
        universityName: input.universityName,
        preparedById: input.preparedById ?? user.sub,
        verifiedById: input.verifiedById,
        notes: input.notes,
        paperType: input.paperType,
        paperCategory: input.paperCategory ?? input.subjectCategory,
        examMonth: input.examMonth,
        examYear: input.examYear,
        durationMinutes: input.durationMinutes,
        maxMarks: input.maxMarks,
        filePath: input.filePath,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        checksumSha256: input.checksumSha256,
        currentVersionNo: 1,
        keywords: input.keywords ?? [],
        searchText,
        status: input.status ?? 'DRAFT',
        uploadedById: user.sub,
      },
    });

    if (input.filePath && input.fileName) {
      await this.prisma.questionPaperVersion.create({
        data: {
          tenantId: user.tid,
          paperId: paper.id,
          versionNo: 1,
          filePath: input.filePath,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          checksumSha256: input.checksumSha256,
          uploadedById: user.sub,
          changeNote: 'Initial upload',
        },
      });
    }

    await this.audit(user, 'paper.created', paper.id, { after: paper });
    return paper;
  }

  async addVersion(
    user: JwtUser,
    paperId: string,
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
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id: paperId, tenantId: user.tid, deletedAt: null },
    });
    if (!paper) throw new NotFoundException('Paper not found');

    const isOwner = paper.uploadedById === user.sub;
    const canManage = this.hasPermission(user, 'question-bank:manage');
    if (!isOwner && !canManage) {
      throw new ForbiddenException('You can only version your own papers');
    }

    let fileMeta = opts?.preSaved;
    if (!fileMeta) {
      if (!file?.buffer?.length) {
        throw new BadRequestException('PDF file is required');
      }
      const settings = await this.getSettings(user.tid);
      fileMeta = await this.assets.savePaperFile(user.tid, file, {
        courseCode: paper.paperCode,
        examYear: paper.examYear,
        examCycle: paper.examCycle,
        semesterNo: paper.semesterNo,
        paperCode: paper.paperCode,
        paperType: paper.paperType,
        maxUploadMb: settings.maxUploadMb,
        allowedMimeTypes: settings.allowedMimeTypes as string[],
        pdfOnly: true,
        canonicalName: true,
      });
    }

    const nextVersion = (paper.currentVersionNo ?? 1) + 1;
    const [version, updated] = await this.prisma.$transaction([
      this.prisma.questionPaperVersion.create({
        data: {
          tenantId: user.tid,
          paperId: paper.id,
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
      this.prisma.questionPaper.update({
        where: { id: paper.id },
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

    await this.audit(user, 'paper.versioned', paper.id, {
      before: paper,
      after: { version: nextVersion, versionId: version.id },
    });
    return { paper: updated, version };
  }

  async listVersions(user: JwtUser, paperId: string) {
    await this.getById(user, paperId);
    return this.prisma.questionPaperVersion.findMany({
      where: { tenantId: user.tid, paperId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async downloadVersion(
    user: JwtUser,
    paperId: string,
    versionNo: number,
    ipAddress?: string,
  ) {
    await this.getById(user, paperId, this.isStudent(user));
    const version = await this.prisma.questionPaperVersion.findFirst({
      where: { tenantId: user.tid, paperId, versionNo },
    });
    if (!version) throw new NotFoundException('Version not found');
    await this.analytics.logAccess({
      tenantId: user.tid,
      paperId,
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

  async listShareLinks(user: JwtUser, paperId: string) {
    await this.getById(user, paperId);
    return this.prisma.questionPaperShareLink.findMany({
      where: { tenantId: user.tid, paperId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUploaders(tenantId: string) {
    const rows = await this.prisma.questionPaper.findMany({
      where: { tenantId, deletedAt: null, uploadedById: { not: null } },
      select: { uploadedById: true },
      distinct: ['uploadedById'],
    });
    const ids = rows
      .map((r) => r.uploadedById)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) return [];
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.displayName?.trim() || u.email || u.id,
      email: u.email,
    }));
  }

  async searchPeople(tenantId: string, q?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(q?.trim()
          ? {
              OR: [
                { displayName: { contains: q.trim(), mode: 'insensitive' } },
                { email: { contains: q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, displayName: true, email: true },
      take: 40,
      orderBy: { displayName: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.displayName?.trim() || u.email || u.id,
      email: u.email,
    }));
  }

  async createShareLink(
    user: JwtUser,
    paperId: string,
    dto: CreateShareLinkDto,
  ) {
    const paper = await this.getById(user, paperId);
    const canShare =
      this.hasPermission(user, 'question-bank:manage') ||
      this.hasPermission(user, 'question-bank:publish') ||
      paper.uploadedById === user.sub;
    if (!canShare) throw new ForbiddenException('Cannot share this paper');
    if (
      paper.status !== 'PUBLISHED' &&
      !this.hasPermission(user, 'question-bank:manage')
    ) {
      throw new BadRequestException('Only published papers can be shared');
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt =
      dto.expiresInDays != null
        ? new Date(Date.now() + dto.expiresInDays * 86400000)
        : null;

    const link = await this.prisma.questionPaperShareLink.create({
      data: {
        tenantId: user.tid,
        paperId,
        token,
        expiresAt,
        createdById: user.sub,
      },
    });
    return link;
  }

  async revokeShareLink(user: JwtUser, shareId: string) {
    const link = await this.prisma.questionPaperShareLink.findFirst({
      where: { id: shareId, tenantId: user.tid },
    });
    if (!link) throw new NotFoundException('Share link not found');
    const canManage =
      this.hasPermission(user, 'question-bank:manage') ||
      link.createdById === user.sub;
    if (!canManage) throw new ForbiddenException('Cannot revoke this link');
    return this.prisma.questionPaperShareLink.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }

  async downloadByShareToken(token: string, ipAddress?: string) {
    const link = await this.prisma.questionPaperShareLink.findFirst({
      where: { token, revokedAt: null },
      include: { paper: true },
    });
    if (!link?.paper || link.paper.deletedAt) {
      throw new NotFoundException('Share link invalid');
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Share link expired');
    }
    if (link.paper.status !== 'PUBLISHED') {
      throw new ForbiddenException('Paper is not published');
    }
    if (!link.paper.filePath) throw new NotFoundException('No file attached');

    await this.analytics.logAccess({
      tenantId: link.tenantId,
      paperId: link.paperId,
      userId: link.createdById ?? undefined,
      action: 'DOWNLOAD',
      ipAddress,
    });

    return this.assets.openDownloadStream(
      link.tenantId,
      link.paper.filePath,
      link.paper.fileName ?? undefined,
    );
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateQuestionPaperDto,
    file?: Express.Multer.File,
  ) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!paper) throw new NotFoundException('Paper not found');

    const isOwner = paper.uploadedById === user.sub;
    const canManage = this.hasPermission(user, 'question-bank:manage');
    if (!isOwner && !canManage)
      throw new ForbiddenException('You can only edit your own papers');
    if (!['DRAFT', 'REJECTED'].includes(paper.status) && !canManage) {
      throw new BadRequestException(
        'Only draft or rejected papers can be edited',
      );
    }

    if (file?.buffer?.length) {
      await this.addVersion(user, id, file, {
        changeNote: 'File replaced via edit',
      });
    }

    const searchText = this.buildSearchText({
      paperCode: dto.paperCode ?? paper.paperCode,
      paperName: dto.paperName ?? paper.paperName,
      keywords: dto.keywords ?? paper.keywords,
      paperType: dto.paperType ?? paper.paperType,
      examYear: dto.examYear ?? paper.examYear,
      examinationType: dto.examinationType ?? paper.examinationType,
      subjectCategory: dto.subjectCategory ?? paper.subjectCategory,
      language: dto.language ?? paper.language,
    });

    const updated = await this.prisma.questionPaper.update({
      where: { id },
      data: {
        ...dto,
        examinationSession: dto.examinationSession ?? dto.examinationType,
        paperCategory: dto.paperCategory ?? dto.subjectCategory,
        searchText,
      },
    });
    await this.audit(user, 'paper.updated', id, {
      before: paper,
      after: updated,
    });
    return updated;
  }

  async archive(user: JwtUser, id: string) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!paper) throw new NotFoundException('Paper not found');
    const canManage = this.hasPermission(user, 'question-bank:manage');
    const isOwner = paper.uploadedById === user.sub;
    if (!canManage && !(isOwner && paper.status === 'DRAFT')) {
      throw new ForbiddenException('You cannot archive this paper');
    }
    const updated = await this.prisma.questionPaper.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit(user, 'paper.archived', id, { after: updated });
    return updated;
  }

  async download(user: JwtUser, id: string, ipAddress?: string) {
    const paper = await this.getById(user, id, this.isStudent(user));
    if (!paper.filePath) throw new NotFoundException('No file attached');
    await this.analytics.logAccess({
      tenantId: user.tid,
      paperId: id,
      userId: user.sub,
      action: 'DOWNLOAD',
      ipAddress,
    });
    return this.assets.openDownloadStream(
      user.tid,
      paper.filePath,
      paper.fileName ?? undefined,
    );
  }

  async preview(user: JwtUser, id: string, ipAddress?: string) {
    const paper = await this.getById(user, id, this.isStudent(user));
    if (!paper.filePath) throw new NotFoundException('No file attached');
    if (paper.mimeType !== 'application/pdf') {
      throw new BadRequestException('Preview is only available for PDF files');
    }
    await this.analytics.logAccess({
      tenantId: user.tid,
      paperId: id,
      userId: user.sub,
      action: 'PREVIEW',
      ipAddress,
    });
    return this.assets.openDownloadStream(
      user.tid,
      paper.filePath,
      paper.fileName ?? undefined,
    );
  }

  async listMyPapers(user: JwtUser, query: QuestionPaperQueryDto) {
    return this.list(user, query, true);
  }

  async listBookmarks(user: JwtUser) {
    const rows = await this.prisma.questionPaperBookmark.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      include: { paper: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r.paper,
      bookmarkedAt: r.createdAt,
      bookmarkId: r.id,
    }));
  }

  async addBookmark(user: JwtUser, paperId: string) {
    await this.getById(user, paperId, true);
    return this.prisma.questionPaperBookmark.upsert({
      where: { userId_paperId: { userId: user.sub, paperId } },
      create: { tenantId: user.tid, userId: user.sub, paperId },
      update: {},
    });
  }

  async removeBookmark(user: JwtUser, paperId: string) {
    await this.prisma.questionPaperBookmark.deleteMany({
      where: { tenantId: user.tid, userId: user.sub, paperId },
    });
    return { ok: true };
  }

  async auditLogs(tenantId: string) {
    return this.prisma.questionBankAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  private async findIdentityMatch(
    tenantId: string,
    input: {
      paperCode: string;
      academicYearId?: string;
      examYear?: number;
      examMonth?: number;
      paperType: string;
    },
  ) {
    return this.prisma.questionPaper.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        paperCode: { equals: input.paperCode, mode: 'insensitive' },
        paperType: input.paperType,
        ...(input.academicYearId
          ? { academicYearId: input.academicYearId }
          : { academicYearId: null }),
        ...(input.examYear != null
          ? { examYear: input.examYear }
          : { examYear: null }),
        ...(input.examMonth != null
          ? { examMonth: input.examMonth }
          : { examMonth: null }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async resolveDefaultUniversity(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findFirst({
      where: { tenantId },
      select: { displayName: true },
    });
    return branding?.displayName ?? 'North Eastern Hill University (NEHU)';
  }

  private async resolveStudentScope(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true, departmentId: true },
    });
    if (!student)
      return {
        courseIds: [] as string[],
        departmentId: undefined,
        semesterNo: undefined,
      };

    const registrations = await this.prisma.semesterRegistration.findMany({
      where: { tenantId: user.tid, studentId: student.id },
      include: {
        lines: { include: { offering: { select: { courseId: true } } } },
      },
    });

    const courseIds = [
      ...new Set(
        registrations.flatMap((r) =>
          r.lines
            .map((l) => l.offering?.courseId)
            .filter((id): id is string => Boolean(id)),
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

  private studentCanAccessPaper(
    paper: {
      courseId: string | null;
      departmentId: string | null;
      semesterNo: number | null;
    },
    scope: { courseIds: string[]; departmentId?: string; semesterNo?: number },
  ) {
    if (paper.courseId && scope.courseIds.includes(paper.courseId)) return true;
    if (
      !paper.courseId &&
      paper.departmentId &&
      scope.departmentId &&
      paper.departmentId === scope.departmentId &&
      paper.semesterNo &&
      scope.semesterNo &&
      paper.semesterNo === scope.semesterNo
    ) {
      return true;
    }
    return scope.courseIds.length === 0 && !scope.departmentId;
  }

  private audit(
    user: JwtUser,
    action: string,
    paperId: string,
    input: Record<string, unknown> = {},
  ) {
    return this.prisma.questionBankAuditLog.create({
      data: {
        tenantId: user.tid,
        paperId,
        actorId: user.sub,
        action,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
      },
    });
  }
}
