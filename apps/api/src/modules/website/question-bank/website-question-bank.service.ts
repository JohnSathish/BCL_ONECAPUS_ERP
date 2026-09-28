import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type WebsiteQuestionBankMaster,
  type WebsiteQuestionPaper,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { WebsiteCmsEnterpriseService } from '../website-cms-enterprise.service';
import { WebsiteService } from '../website.service';
import {
  QUESTION_BANK_DOWNLOAD_MODES,
  QUESTION_PAPER_DEFAULT_HARD_MAX_MB,
  QUESTION_PAPER_DEFAULT_MAX_MB,
  QUESTION_PAPER_DEFAULT_PAGE_SIZE,
  QUESTION_PAPER_MAX_PAGE_SIZE,
  QUESTION_PAPER_STORAGE_PREFIX,
  type QuestionBankDownloadMode,
  type QuestionBankMasterKind,
  type QuestionPaperSort,
  type QuestionPaperStatus,
} from './website-question-bank.constants';
import type {
  AdminQuestionPaperQueryDto,
  CreateQuestionBankMasterDto,
  PublicQuestionPaperQueryDto,
  QuestionBankSettingsDto,
  UpdateQuestionBankMasterDto,
  UpsertQuestionPaperDto,
} from './website-question-bank.dto';
import {
  assertValidQuestionPaperPdf,
  safeDownloadFileName,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeSubjectCode,
  slugifyQuestionPaper,
} from './website-question-bank.sanitize';

export const QUESTION_BANK_PUBLIC_PATH = '/academics/question-bank';

export type QuestionBankSettings = {
  downloadMode: QuestionBankDownloadMode;
  maxUploadMb: number;
  hardMaxUploadMb: number;
  pageSize: number;
  intro: string;
};

type MasterMap = Map<string, WebsiteQuestionBankMaster>;

type PaperFilters = Pick<
  PublicQuestionPaperQueryDto,
  | 'q'
  | 'academicYearId'
  | 'semester'
  | 'programmeId'
  | 'departmentId'
  | 'majorId'
  | 'subjectId'
  | 'subjectCode'
  | 'examTypeId'
  | 'examYear'
>;

const MASTER_REF_FIELDS = {
  academicYearId: 'ACADEMIC_YEAR',
  programmeId: 'PROGRAMME',
  departmentId: 'DEPARTMENT',
  majorId: 'MAJOR',
  subjectId: 'SUBJECT',
  examTypeId: 'EXAM_TYPE',
} as const satisfies Record<string, QuestionBankMasterKind>;

type MasterRefField = keyof typeof MASTER_REF_FIELDS;

const KIND_TO_FIELD: Record<QuestionBankMasterKind, MasterRefField> = {
  ACADEMIC_YEAR: 'academicYearId',
  PROGRAMME: 'programmeId',
  DEPARTMENT: 'departmentId',
  MAJOR: 'majorId',
  SUBJECT: 'subjectId',
  EXAM_TYPE: 'examTypeId',
};

const KIND_LABELS: Record<QuestionBankMasterKind, string> = {
  ACADEMIC_YEAR: 'academic year',
  PROGRAMME: 'programme',
  DEPARTMENT: 'department',
  MAJOR: 'major',
  SUBJECT: 'subject',
  EXAM_TYPE: 'examination type',
};

const SEARCHABLE_MASTER_KINDS = new Set<string>([
  'PROGRAMME',
  'DEPARTMENT',
  'MAJOR',
  'SUBJECT',
]);

@Injectable()
export class WebsiteQuestionBankService {
  private readonly logger = new Logger(WebsiteQuestionBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
    private readonly enterprise: WebsiteCmsEnterpriseService,
    private readonly storage: StorageService,
    private readonly audit: AdminAuditHelper,
  ) {}

  // ---------------------------------------------------------------- settings

  static hardMaxUploadMb(): number {
    const raw = Number(process.env.WEBSITE_QUESTION_PAPER_MAX_MB);
    return Number.isFinite(raw) && raw >= 1
      ? Math.min(Math.trunc(raw), 500)
      : QUESTION_PAPER_DEFAULT_HARD_MAX_MB;
  }

  private readSettings(settingsJson: unknown): QuestionBankSettings {
    const root = this.asRecord(settingsJson);
    const stored = this.asRecord(root.questionBank);
    const hardMaxUploadMb = WebsiteQuestionBankService.hardMaxUploadMb();
    const downloadMode = QUESTION_BANK_DOWNLOAD_MODES.includes(
      stored.downloadMode as QuestionBankDownloadMode,
    )
      ? (stored.downloadMode as QuestionBankDownloadMode)
      : 'NEW_TAB';
    const maxUploadRaw = Number(stored.maxUploadMb);
    const pageSizeRaw = Number(stored.pageSize);
    return {
      downloadMode,
      hardMaxUploadMb,
      maxUploadMb: Math.min(
        Number.isFinite(maxUploadRaw) && maxUploadRaw >= 1
          ? Math.trunc(maxUploadRaw)
          : QUESTION_PAPER_DEFAULT_MAX_MB,
        hardMaxUploadMb,
      ),
      pageSize:
        Number.isFinite(pageSizeRaw) && pageSizeRaw >= 5
          ? Math.min(Math.trunc(pageSizeRaw), QUESTION_PAPER_MAX_PAGE_SIZE)
          : QUESTION_PAPER_DEFAULT_PAGE_SIZE,
      intro: typeof stored.intro === 'string' ? stored.intro : '',
    };
  }

  async getSettings(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    return this.readSettings(site.settingsJson);
  }

  async updateSettings(user: JwtUser, dto: QuestionBankSettingsDto) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const root = this.asRecord(site.settingsJson);
    const current = this.readSettings(site.settingsJson);
    const hardMax = WebsiteQuestionBankService.hardMaxUploadMb();
    if (dto.maxUploadMb !== undefined && dto.maxUploadMb > hardMax) {
      throw new BadRequestException(
        `Maximum upload size cannot exceed the server limit of ${hardMax} MB`,
      );
    }
    const next = {
      downloadMode: dto.downloadMode ?? current.downloadMode,
      maxUploadMb: dto.maxUploadMb ?? current.maxUploadMb,
      pageSize: dto.pageSize ?? current.pageSize,
      intro:
        dto.intro !== undefined
          ? sanitizePlainText(dto.intro, 400)
          : current.intro,
    };
    const updated = await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: {
        settingsJson: { ...root, questionBank: next } as Prisma.InputJsonValue,
        updatedById: user.sub,
      },
    });
    this.logAudit(user, 'question_bank.settings.update', site.id, next);
    this.revalidate(user);
    return this.readSettings(updated.settingsJson);
  }

  // ------------------------------------------------------------- master data

  async listMasters(tenantId: string, kind?: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteQuestionBankMaster.findMany({
      where: { tenantId, siteId: site.id, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
    const usage = kind
      ? await this.masterUsageCounts(site.id, kind as QuestionBankMasterKind)
      : new Map<string, number>();
    return rows.map((row) => ({
      ...this.mapMaster(row),
      usageCount: usage.get(row.id) ?? 0,
    }));
  }

  async createMaster(user: JwtUser, dto: CreateQuestionBankMasterDto) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const kind = dto.kind as QuestionBankMasterKind;
    const label = sanitizePlainText(dto.label, 160);
    if (!label) throw new BadRequestException('Label is required');
    const parentId = await this.resolveMasterParent(
      site.id,
      kind,
      dto.parentId ?? null,
    );
    try {
      const row = await this.prisma.websiteQuestionBankMaster.create({
        data: {
          tenantId: user.tid,
          siteId: site.id,
          kind,
          label,
          code: this.normalizeMasterCode(kind, dto.code),
          parentId,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      this.logAudit(user, 'question_bank.master.create', row.id, {
        kind,
        label,
      });
      return { ...this.mapMaster(row), usageCount: 0 };
    } catch (error) {
      this.rethrowUnique(
        error,
        `A ${KIND_LABELS[kind]} named "${label}" already exists`,
      );
    }
  }

  async updateMaster(
    user: JwtUser,
    masterId: string,
    dto: UpdateQuestionBankMasterDto,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const existing = await this.prisma.websiteQuestionBankMaster.findFirst({
      where: { id: masterId, tenantId: user.tid, siteId: site.id },
    });
    if (!existing) throw new NotFoundException('Master record not found');
    const kind = existing.kind as QuestionBankMasterKind;

    const label =
      dto.label !== undefined ? sanitizePlainText(dto.label, 160) : undefined;
    if (label !== undefined && !label) {
      throw new BadRequestException('Label is required');
    }
    const code =
      dto.code !== undefined
        ? this.normalizeMasterCode(kind, dto.code)
        : undefined;
    const parentId =
      dto.parentId !== undefined
        ? await this.resolveMasterParent(
            site.id,
            kind,
            dto.parentId,
            existing.id,
          )
        : undefined;

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.websiteQuestionBankMaster.update({
          where: { id: existing.id },
          data: {
            ...(label !== undefined ? { label } : {}),
            ...(code !== undefined ? { code } : {}),
            ...(parentId !== undefined ? { parentId } : {}),
            ...(dto.sortOrder !== undefined
              ? { sortOrder: dto.sortOrder }
              : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            updatedById: user.sub,
          },
        });
        // Papers snapshot subject name/code; keep untouched snapshots in sync with the master.
        if (kind === 'SUBJECT') {
          if (label !== undefined && label !== existing.label) {
            await tx.websiteQuestionPaper.updateMany({
              where: {
                siteId: site.id,
                subjectId: existing.id,
                subjectName: existing.label,
              },
              data: { subjectName: label },
            });
          }
          if (code !== undefined && (code ?? '') !== (existing.code ?? '')) {
            await tx.websiteQuestionPaper.updateMany({
              where: {
                siteId: site.id,
                subjectId: existing.id,
                subjectCode: existing.code ?? '',
              },
              data: { subjectCode: code ?? '' },
            });
          }
        }
        return updated;
      });
      this.logAudit(user, 'question_bank.master.update', row.id, {
        kind,
        label: row.label,
      });
      this.revalidate(user);
      const usage = await this.masterUsageCounts(site.id, kind);
      return { ...this.mapMaster(row), usageCount: usage.get(row.id) ?? 0 };
    } catch (error) {
      this.rethrowUnique(
        error,
        `A ${KIND_LABELS[kind]} named "${label ?? existing.label}" already exists`,
      );
    }
  }

  async deleteMaster(user: JwtUser, masterId: string) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const existing = await this.prisma.websiteQuestionBankMaster.findFirst({
      where: { id: masterId, tenantId: user.tid, siteId: site.id },
    });
    if (!existing) throw new NotFoundException('Master record not found');
    const kind = existing.kind as QuestionBankMasterKind;
    const field = KIND_TO_FIELD[kind];
    const [paperCount, childCount] = await Promise.all([
      this.prisma.websiteQuestionPaper.count({
        where: { siteId: site.id, [field]: existing.id },
      }),
      kind === 'DEPARTMENT'
        ? this.prisma.websiteQuestionBankMaster.count({
            where: { siteId: site.id, parentId: existing.id },
          })
        : Promise.resolve(0),
    ]);
    if (paperCount > 0 || childCount > 0) {
      const parts = [
        paperCount
          ? `${paperCount} question paper${paperCount === 1 ? '' : 's'}`
          : '',
        childCount ? `${childCount} subject${childCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      throw new ConflictException(
        `"${existing.label}" is used by ${parts.join(' and ')}. Deactivate it instead of deleting.`,
      );
    }
    await this.prisma.websiteQuestionBankMaster.delete({
      where: { id: existing.id },
    });
    this.logAudit(user, 'question_bank.master.delete', existing.id, {
      kind,
      label: existing.label,
    });
    return { ok: true };
  }

  // ------------------------------------------------------------ admin papers

  async listAdminPapers(tenantId: string, query: AdminQuestionPaperQueryDto) {
    const site = await this.website.getOrCreateSite(tenantId);
    const masters = await this.loadMasters(site.id);
    const limit = Math.min(query.limit ?? 20, QUESTION_PAPER_MAX_PAGE_SIZE);
    const where: Prisma.WebsiteQuestionPaperWhereInput = {
      AND: [
        { tenantId, siteId: site.id },
        ...(query.status ? [{ status: query.status }] : []),
        this.buildFilterWhere(query, masters),
      ],
    };
    const [total, grouped] = await Promise.all([
      this.prisma.websiteQuestionPaper.count({ where }),
      this.prisma.websiteQuestionPaper.groupBy({
        by: ['status'],
        where: { tenantId, siteId: site.id },
        _count: { _all: true },
      }),
    ]);
    const { page, pageCount, skip } = this.paginate(total, query.page, limit);
    const rows = await this.prisma.websiteQuestionPaper.findMany({
      where,
      orderBy: this.orderBy((query.sort as QuestionPaperSort) ?? 'newest'),
      skip,
      take: limit,
    });
    const statusCounts: Record<QuestionPaperStatus, number> = {
      DRAFT: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };
    for (const row of grouped) {
      if (row.status in statusCounts) {
        statusCounts[row.status as QuestionPaperStatus] = row._count._all;
      }
    }
    return {
      items: rows.map((row) => this.mapAdminPaper(row, masters)),
      total,
      page,
      pageSize: limit,
      pageCount,
      statusCounts,
    };
  }

  async getAdminPaper(tenantId: string, paperId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const [row, masters] = await Promise.all([
      this.findPaperOrThrow(tenantId, site.id, paperId),
      this.loadMasters(site.id),
    ]);
    return this.mapAdminPaper(row, masters);
  }

  async createPaper(
    user: JwtUser,
    dto: UpsertQuestionPaperDto,
    file?: Express.Multer.File,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.readSettings(site.settingsJson);
    const masters = await this.loadMasters(site.id);
    const refs = this.resolveWriteData(dto, masters, null);

    const status = (dto.status as QuestionPaperStatus | undefined) ?? 'DRAFT';
    const title =
      sanitizePlainText(dto.title, 200) ||
      this.autoTitle(refs.subjectCode ?? '', refs.subjectName ?? '');
    if (!title) {
      throw new BadRequestException('Title or subject is required');
    }
    if (file)
      assertValidQuestionPaperPdf(file, settings.maxUploadMb * 1024 * 1024);
    if (status === 'PUBLISHED' && !file) {
      throw new BadRequestException('Upload the PDF before publishing');
    }

    const stored = file ? await this.storeFile(user.tid, site.id, file) : null;
    const slug = await this.uniqueSlug(
      site.id,
      slugifyQuestionPaper(
        [refs.subjectCode, title, refs.examYear].filter(Boolean).join(' '),
      ),
    );
    try {
      const row = await this.prisma.websiteQuestionPaper.create({
        data: {
          tenantId: user.tid,
          siteId: site.id,
          title,
          slug,
          ...refs,
          status,
          publishedAt: dto.publishedAt
            ? new Date(dto.publishedAt)
            : status === 'PUBLISHED'
              ? new Date()
              : null,
          ...(stored ? { ...stored, fileVersion: 1 } : {}),
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      this.logAudit(user, 'question_bank.paper.create', row.id, {
        title,
        status,
      });
      if (status === 'PUBLISHED') this.revalidate(user, row.slug);
      return this.mapAdminPaper(row, masters);
    } catch (error) {
      if (stored) await this.storage.remove(stored.fileStorageKey);
      throw error;
    }
  }

  async updatePaper(
    user: JwtUser,
    paperId: string,
    dto: UpsertQuestionPaperDto,
    file?: Express.Multer.File,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.readSettings(site.settingsJson);
    const [existing, masters] = await Promise.all([
      this.findPaperOrThrow(user.tid, site.id, paperId),
      this.loadMasters(site.id),
    ]);
    const refs = this.resolveWriteData(dto, masters, existing);

    let title: string | undefined;
    if (dto.title !== undefined) {
      title = sanitizePlainText(dto.title, 200);
      if (!title) throw new BadRequestException('Title cannot be empty');
    }

    if (file)
      assertValidQuestionPaperPdf(file, settings.maxUploadMb * 1024 * 1024);
    const nextStatus =
      (dto.status as QuestionPaperStatus | undefined) ??
      (existing.status as QuestionPaperStatus);
    if (nextStatus === 'PUBLISHED' && !file && !existing.fileStorageKey) {
      throw new BadRequestException('Upload the PDF before publishing');
    }

    let publishedAt: Date | null | undefined;
    if (dto.publishedAt !== undefined) {
      publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    const effectivePublishedAt =
      publishedAt !== undefined ? publishedAt : existing.publishedAt;
    if (nextStatus === 'PUBLISHED' && !effectivePublishedAt) {
      publishedAt = new Date();
    }

    const stored = file ? await this.storeFile(user.tid, site.id, file) : null;
    try {
      const row = await this.prisma.websiteQuestionPaper.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...refs,
          ...(dto.status !== undefined ? { status: nextStatus } : {}),
          ...(publishedAt !== undefined ? { publishedAt } : {}),
          ...(stored
            ? { ...stored, fileVersion: existing.fileVersion + 1 }
            : {}),
          updatedById: user.sub,
        },
      });
      if (stored && existing.fileStorageKey) {
        await this.storage.remove(existing.fileStorageKey);
      }
      this.logAudit(user, 'question_bank.paper.update', row.id, {
        title: row.title,
        status: row.status,
        fileReplaced: Boolean(stored),
      });
      if (existing.status === 'PUBLISHED' || row.status === 'PUBLISHED') {
        this.revalidate(user, row.slug);
      }
      return this.mapAdminPaper(row, masters);
    } catch (error) {
      if (stored) await this.storage.remove(stored.fileStorageKey);
      throw error;
    }
  }

  async setPaperStatus(user: JwtUser, paperId: string, status: string) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const [existing, masters] = await Promise.all([
      this.findPaperOrThrow(user.tid, site.id, paperId),
      this.loadMasters(site.id),
    ]);
    if (status === 'PUBLISHED' && !existing.fileStorageKey) {
      throw new BadRequestException('Upload the PDF before publishing');
    }
    const row = await this.prisma.websiteQuestionPaper.update({
      where: { id: existing.id },
      data: {
        status,
        ...(status === 'PUBLISHED' && !existing.publishedAt
          ? { publishedAt: new Date() }
          : {}),
        updatedById: user.sub,
      },
    });
    this.logAudit(
      user,
      `question_bank.paper.status.${status.toLowerCase()}`,
      row.id,
      {
        from: existing.status,
        to: status,
      },
    );
    this.revalidate(user, row.slug);
    return this.mapAdminPaper(row, masters);
  }

  async deletePaper(user: JwtUser, paperId: string) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const existing = await this.findPaperOrThrow(user.tid, site.id, paperId);
    await this.prisma.websiteQuestionPaper.delete({
      where: { id: existing.id },
    });
    if (existing.fileStorageKey) {
      await this.storage.remove(existing.fileStorageKey);
    }
    this.logAudit(user, 'question_bank.paper.delete', existing.id, {
      title: existing.title,
    });
    if (existing.status === 'PUBLISHED') this.revalidate(user, existing.slug);
    return { ok: true };
  }

  async getAdminFile(tenantId: string, paperId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const row = await this.findPaperOrThrow(tenantId, site.id, paperId);
    return this.readFile(row);
  }

  // ------------------------------------------------------------------ public

  async publicFilters(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.readSettings(site.settingsJson);
    const [masters, rows] = await Promise.all([
      this.loadMasters(site.id),
      this.prisma.websiteQuestionPaper.findMany({
        where: this.visibleWhere(tenantId, site.id),
        select: {
          academicYearId: true,
          programmeId: true,
          departmentId: true,
          majorId: true,
          subjectId: true,
          examTypeId: true,
          semester: true,
          examYear: true,
          subjectCode: true,
        },
      }),
    ]);

    const used = new Set<string>();
    const semesters = new Set<number>();
    const examYears = new Set<number>();
    const subjectCodes = new Set<string>();
    for (const row of rows) {
      for (const field of Object.keys(MASTER_REF_FIELDS) as MasterRefField[]) {
        const id = row[field];
        if (id) used.add(id);
      }
      if (row.semester != null) semesters.add(row.semester);
      if (row.examYear != null) examYears.add(row.examYear);
      if (row.subjectCode) subjectCodes.add(row.subjectCode);
    }

    const options = (kind: QuestionBankMasterKind) =>
      [...masters.values()]
        .filter((m) => m.kind === kind && m.isActive && used.has(m.id))
        .sort((a, b) =>
          a.sortOrder !== b.sortOrder
            ? a.sortOrder - b.sortOrder
            : kind === 'ACADEMIC_YEAR'
              ? b.label.localeCompare(a.label)
              : a.label.localeCompare(b.label),
        )
        .map((m) => ({
          id: m.id,
          label: m.label,
          ...(m.code ? { code: m.code } : {}),
          ...(m.parentId ? { parentId: m.parentId } : {}),
        }));

    return {
      total: rows.length,
      academicYears: options('ACADEMIC_YEAR'),
      programmes: options('PROGRAMME'),
      departments: options('DEPARTMENT'),
      majors: options('MAJOR'),
      subjects: options('SUBJECT'),
      examTypes: options('EXAM_TYPE'),
      semesters: [...semesters].sort((a, b) => a - b),
      examYears: [...examYears].sort((a, b) => b - a),
      subjectCodes: [...subjectCodes].sort((a, b) => a.localeCompare(b)),
      settings: {
        downloadMode: settings.downloadMode,
        pageSize: settings.pageSize,
        intro: settings.intro,
      },
    };
  }

  async listPublicPapers(tenantId: string, query: PublicQuestionPaperQueryDto) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.readSettings(site.settingsJson);
    const masters = await this.loadMasters(site.id);
    const limit = Math.min(
      query.limit ?? settings.pageSize,
      QUESTION_PAPER_MAX_PAGE_SIZE,
    );
    const where: Prisma.WebsiteQuestionPaperWhereInput = {
      AND: [
        this.visibleWhere(tenantId, site.id),
        this.buildFilterWhere(query, masters),
      ],
    };
    const total = await this.prisma.websiteQuestionPaper.count({ where });
    const { page, pageCount, skip } = this.paginate(total, query.page, limit);
    const rows = await this.prisma.websiteQuestionPaper.findMany({
      where,
      orderBy: this.orderBy((query.sort as QuestionPaperSort) ?? 'newest'),
      skip,
      take: limit,
    });
    return {
      items: rows.map((row) => this.mapPublicPaper(row, masters)),
      total,
      page,
      pageSize: limit,
      pageCount,
      downloadMode: settings.downloadMode,
    };
  }

  async getPublicPaper(tenantId: string, slug: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.readSettings(site.settingsJson);
    const [row, masters] = await Promise.all([
      this.prisma.websiteQuestionPaper.findFirst({
        where: { ...this.visibleWhere(tenantId, site.id), slug },
      }),
      this.loadMasters(site.id),
    ]);
    if (!row) throw new NotFoundException('Question paper not found');
    return {
      ...this.mapPublicPaper(row, masters),
      downloadMode: settings.downloadMode,
    };
  }

  async getPublicFile(tenantId: string, slug: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.readSettings(site.settingsJson);
    const row = await this.prisma.websiteQuestionPaper.findFirst({
      where: { ...this.visibleWhere(tenantId, site.id), slug },
    });
    if (!row) throw new NotFoundException('Question paper not found');
    const file = await this.readFile(row);
    void this.prisma.websiteQuestionPaper
      .update({
        where: { id: row.id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch(() => undefined);
    return { ...file, downloadMode: settings.downloadMode };
  }

  async listPublicSitemap(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteQuestionPaper.findMany({
      where: this.visibleWhere(tenantId, site.id),
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    });
    return rows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  // --------------------------------------------------------------- internals

  private visibleWhere(
    tenantId: string,
    siteId: string,
  ): Prisma.WebsiteQuestionPaperWhereInput {
    return {
      tenantId,
      siteId,
      status: 'PUBLISHED',
      fileStorageKey: { not: null },
      publishedAt: { lte: new Date() },
    };
  }

  private buildFilterWhere(
    filters: PaperFilters,
    masters: MasterMap,
  ): Prisma.WebsiteQuestionPaperWhereInput {
    const and: Prisma.WebsiteQuestionPaperWhereInput[] = [];
    for (const field of Object.keys(MASTER_REF_FIELDS) as MasterRefField[]) {
      const value = filters[field];
      if (value) and.push({ [field]: value });
    }
    if (filters.semester != null) and.push({ semester: filters.semester });
    if (filters.examYear != null) and.push({ examYear: filters.examYear });
    const code = sanitizeSubjectCode(filters.subjectCode);
    if (code) and.push({ subjectCode: { equals: code, mode: 'insensitive' } });

    const q = sanitizePlainText(filters.q, 120);
    if (q) {
      const needle = q.toLowerCase();
      const labelMatches = [...masters.values()].filter(
        (m) =>
          SEARCHABLE_MASTER_KINDS.has(m.kind) &&
          (m.label.toLowerCase().includes(needle) ||
            (m.code ?? '').toLowerCase().includes(needle)),
      );
      const idsFor = (kind: string) =>
        labelMatches.filter((m) => m.kind === kind).map((m) => m.id);
      const or: Prisma.WebsiteQuestionPaperWhereInput[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { subjectName: { contains: q, mode: 'insensitive' } },
        { subjectCode: { contains: q, mode: 'insensitive' } },
      ];
      const byKind: Array<[string, MasterRefField]> = [
        ['PROGRAMME', 'programmeId'],
        ['DEPARTMENT', 'departmentId'],
        ['MAJOR', 'majorId'],
        ['SUBJECT', 'subjectId'],
      ];
      for (const [kind, field] of byKind) {
        const ids = idsFor(kind);
        if (ids.length) or.push({ [field]: { in: ids } });
      }
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }

  private orderBy(
    sort: QuestionPaperSort,
  ): Prisma.WebsiteQuestionPaperOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [
          { publishedAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ];
      case 'title':
        return [{ title: 'asc' }, { createdAt: 'desc' }];
      case 'subject_code':
        return [{ subjectCode: 'asc' }, { title: 'asc' }];
      case 'exam_year':
        return [
          { examYear: { sort: 'desc', nulls: 'last' } },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
        ];
      default:
        return [
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ];
    }
  }

  private paginate(
    total: number,
    requestedPage: number | undefined,
    limit: number,
  ) {
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(requestedPage ?? 1, 1), pageCount);
    return { page, pageCount, skip: (page - 1) * limit };
  }

  private resolveWriteData(
    dto: UpsertQuestionPaperDto,
    masters: MasterMap,
    existing: WebsiteQuestionPaper | null,
  ) {
    const data: Partial<
      Pick<
        WebsiteQuestionPaper,
        | MasterRefField
        | 'semester'
        | 'examYear'
        | 'subjectName'
        | 'subjectCode'
        | 'description'
      >
    > = {};

    for (const field of Object.keys(MASTER_REF_FIELDS) as MasterRefField[]) {
      const value = dto[field];
      if (value === undefined) continue;
      if (value === null) {
        data[field] = null;
        continue;
      }
      const master = masters.get(value);
      const kind = MASTER_REF_FIELDS[field];
      if (!master || master.kind !== kind) {
        throw new BadRequestException(`Select a valid ${KIND_LABELS[kind]}`);
      }
      data[field] = master.id;
    }

    if (dto.semester !== undefined) data.semester = dto.semester;
    if (dto.examYear !== undefined) data.examYear = dto.examYear;
    if (dto.description !== undefined) {
      data.description = sanitizeMultilineText(dto.description, 4000);
    }
    if (dto.subjectName !== undefined) {
      data.subjectName = sanitizePlainText(dto.subjectName, 160);
    }
    if (dto.subjectCode !== undefined) {
      data.subjectCode = sanitizeSubjectCode(dto.subjectCode);
    }

    const subject = data.subjectId ? masters.get(data.subjectId) : undefined;
    if (subject) {
      const subjectChanged = subject.id !== existing?.subjectId;
      if (
        !data.subjectName &&
        (subjectChanged || dto.subjectName !== undefined)
      ) {
        data.subjectName = subject.label;
      }
      if (
        !data.subjectCode &&
        (subjectChanged || dto.subjectCode !== undefined)
      ) {
        data.subjectCode = subject.code ?? '';
      }
      if (
        dto.departmentId === undefined &&
        !existing?.departmentId &&
        subject.parentId
      ) {
        data.departmentId = subject.parentId;
      }
    }
    return data;
  }

  private autoTitle(code: string, name: string) {
    if (code && name) return `${code}: ${name}`;
    return name || code;
  }

  private async uniqueSlug(siteId: string, base: string) {
    const taken = await this.prisma.websiteQuestionPaper.findMany({
      where: { siteId, slug: { startsWith: base } },
      select: { slug: true },
    });
    const set = new Set(taken.map((row) => row.slug));
    if (!set.has(base)) return base;
    for (let n = 2; n < 10000; n += 1) {
      const candidate = `${base}-${n}`;
      if (!set.has(candidate)) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  private async storeFile(
    tenantId: string,
    siteId: string,
    file: Express.Multer.File,
  ) {
    const key = `${QUESTION_PAPER_STORAGE_PREFIX}/${tenantId}/${siteId}/${randomUUID()}.pdf`;
    await this.storage.put(key, file.buffer, {
      contentType: 'application/pdf',
      cacheControl: 'private, no-store',
    });
    return {
      fileStorageKey: key,
      fileName:
        sanitizePlainText(file.originalname, 200) || 'question-paper.pdf',
      fileMimeType: 'application/pdf',
      fileBytes: file.size,
      fileSha256: createHash('sha256').update(file.buffer).digest('hex'),
      fileUpdatedAt: new Date(),
    };
  }

  private async readFile(row: WebsiteQuestionPaper) {
    if (!row.fileStorageKey) {
      throw new NotFoundException('No PDF uploaded for this question paper');
    }
    const buffer = await this.storage.get(row.fileStorageKey);
    if (!buffer) {
      this.logger.warn(`Question paper file missing in storage: ${row.id}`);
      throw new NotFoundException('PDF file is not available');
    }
    const base = [row.subjectCode, row.title, row.examYear]
      .filter(Boolean)
      .join(' ');
    return { buffer, fileName: safeDownloadFileName(base || row.slug) };
  }

  private async findPaperOrThrow(
    tenantId: string,
    siteId: string,
    paperId: string,
  ) {
    const row = await this.prisma.websiteQuestionPaper.findFirst({
      where: { id: paperId, tenantId, siteId },
    });
    if (!row) throw new NotFoundException('Question paper not found');
    return row;
  }

  private async loadMasters(siteId: string): Promise<MasterMap> {
    const rows = await this.prisma.websiteQuestionBankMaster.findMany({
      where: { siteId },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async masterUsageCounts(
    siteId: string,
    kind: QuestionBankMasterKind,
  ) {
    const field = KIND_TO_FIELD[kind];
    const grouped = await this.prisma.websiteQuestionPaper.groupBy({
      by: [field],
      where: { siteId, [field]: { not: null } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped as Array<
      Record<string, unknown> & { _count: { _all: number } }
    >) {
      const id = row[field];
      if (typeof id === 'string') map.set(id, row._count._all);
    }
    return map;
  }

  private async resolveMasterParent(
    siteId: string,
    kind: QuestionBankMasterKind,
    parentId: string | null,
    selfId?: string,
  ): Promise<string | null> {
    if (!parentId) return null;
    if (kind !== 'SUBJECT') {
      throw new BadRequestException(
        'Only subjects can be linked to a department',
      );
    }
    if (parentId === selfId) {
      throw new BadRequestException('A record cannot be its own parent');
    }
    const parent = await this.prisma.websiteQuestionBankMaster.findFirst({
      where: { id: parentId, siteId, kind: 'DEPARTMENT' },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('Select a valid department');
    return parent.id;
  }

  private normalizeMasterCode(kind: QuestionBankMasterKind, code?: string) {
    if (code === undefined) return null;
    const value =
      kind === 'SUBJECT'
        ? sanitizeSubjectCode(code)
        : sanitizePlainText(code, 40);
    return value || null;
  }

  private mapMaster(row: WebsiteQuestionBankMaster) {
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      code: row.code,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private masterRef(masters: MasterMap, id: string | null) {
    if (!id) return null;
    const master = masters.get(id);
    if (!master) return null;
    return {
      id: master.id,
      label: master.label,
      ...(master.code ? { code: master.code } : {}),
    };
  }

  private mapPublicPaper(row: WebsiteQuestionPaper, masters: MasterMap) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
      semester: row.semester,
      examYear: row.examYear,
      description: row.description,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      academicYear: this.masterRef(masters, row.academicYearId),
      programme: this.masterRef(masters, row.programmeId),
      department: this.masterRef(masters, row.departmentId),
      major: this.masterRef(masters, row.majorId),
      subject: this.masterRef(masters, row.subjectId),
      examType: this.masterRef(masters, row.examTypeId),
      file: row.fileStorageKey
        ? { bytes: row.fileBytes ?? 0, version: row.fileVersion }
        : null,
    };
  }

  private mapAdminPaper(row: WebsiteQuestionPaper, masters: MasterMap) {
    return {
      ...this.mapPublicPaper(row, masters),
      status: row.status,
      academicYearId: row.academicYearId,
      programmeId: row.programmeId,
      departmentId: row.departmentId,
      majorId: row.majorId,
      subjectId: row.subjectId,
      examTypeId: row.examTypeId,
      file: row.fileStorageKey
        ? {
            name: row.fileName,
            bytes: row.fileBytes ?? 0,
            version: row.fileVersion,
            updatedAt: row.fileUpdatedAt?.toISOString() ?? null,
          }
        : null,
      downloadCount: row.downloadCount,
      publicPath: `${QUESTION_BANK_PUBLIC_PATH}/${row.slug}`,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private revalidate(user: JwtUser, slug?: string) {
    const paths = [QUESTION_BANK_PUBLIC_PATH, '/sitemap.xml'];
    if (slug) paths.push(`${QUESTION_BANK_PUBLIC_PATH}/${slug}`);
    void this.enterprise
      .requestRevalidation(user, paths)
      .catch(() => undefined);
  }

  private logAudit(
    user: JwtUser,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    void this.audit
      .log({
        tenantId: user.tid,
        userId: user.sub,
        module: 'website',
        action,
        entityType: 'website_question_paper',
        entityId,
        metadata,
      })
      .catch(() => undefined);
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
