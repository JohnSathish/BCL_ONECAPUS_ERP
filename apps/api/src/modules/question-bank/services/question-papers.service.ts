import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateQuestionPaperDto,
  QuestionBankSettingsDto,
  QuestionPaperQueryDto,
  UpdateQuestionPaperDto,
} from '../dto/question-bank.dto';
import { QuestionBankAssetsService } from './question-bank-assets.service';
import { QuestionBankAnalyticsService } from './question-bank-analytics.service';

const DEFAULT_PAPER_TYPES = [
  'UNIVERSITY_EXAM',
  'END_SEMESTER',
  'MID_SEMESTER',
  'INTERNAL',
  'SUPPLEMENTARY',
  'PRACTICAL',
];

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
  }) {
    return [
      input.paperCode,
      input.paperName,
      input.paperType,
      input.examYear,
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
        maxUploadMb: 25,
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
        maxUploadMb: dto.maxUploadMb ?? 25,
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

    return { items, total, page, limit };
  }

  async getById(user: JwtUser, id: string, studentView = false) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
      include: {
        approvals: { orderBy: { sequence: 'asc' } },
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

    return { ...paper, related };
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

    let fileMeta: Partial<{
      filePath: string;
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
    }> = {};

    if (file?.buffer?.length) {
      const settings = await this.getSettings(user.tid);
      const course = dto.courseId
        ? await this.prisma.course.findFirst({
            where: { id: dto.courseId },
            select: { code: true },
          })
        : null;
      fileMeta = await this.assets.savePaperFile(user.tid, file, {
        courseCode: course?.code ?? dto.paperCode,
        examYear: dto.examYear,
        maxUploadMb: settings.maxUploadMb,
        allowedMimeTypes: settings.allowedMimeTypes as string[],
      });
    }

    return this.createInternal(user, { ...dto, ...fileMeta, status: 'DRAFT' });
  }

  async createInternal(
    user: JwtUser,
    input: CreateQuestionPaperDto & {
      filePath?: string;
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      status?: string;
    },
  ) {
    const searchText = this.buildSearchText({
      paperCode: input.paperCode,
      paperName: input.paperName,
      keywords: input.keywords,
      paperType: input.paperType,
      examYear: input.examYear,
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
        examinationSession: input.examinationSession,
        paperType: input.paperType,
        paperCategory: input.paperCategory,
        examMonth: input.examMonth,
        examYear: input.examYear,
        durationMinutes: input.durationMinutes,
        maxMarks: input.maxMarks,
        filePath: input.filePath,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        keywords: input.keywords ?? [],
        searchText,
        status: input.status ?? 'DRAFT',
        uploadedById: user.sub,
      },
    });

    await this.audit(user, 'paper.created', paper.id, { after: paper });
    return paper;
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

    let fileMeta: Record<string, unknown> = {};
    if (file?.buffer?.length) {
      const settings = await this.getSettings(user.tid);
      const courseCode = dto.paperCode ?? paper.paperCode;
      fileMeta = await this.assets.savePaperFile(user.tid, file, {
        courseCode,
        examYear: dto.examYear ?? paper.examYear ?? undefined,
        maxUploadMb: settings.maxUploadMb,
        allowedMimeTypes: settings.allowedMimeTypes as string[],
      });
    }

    const searchText = this.buildSearchText({
      paperCode: dto.paperCode ?? paper.paperCode,
      paperName: dto.paperName ?? paper.paperName,
      keywords: dto.keywords ?? paper.keywords,
      paperType: dto.paperType ?? paper.paperType,
      examYear: dto.examYear ?? paper.examYear,
    });

    const updated = await this.prisma.questionPaper.update({
      where: { id },
      data: { ...dto, ...fileMeta, searchText },
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
      throw new BadRequestException(
        'Preview is only available for PDF files in Phase 1',
      );
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
