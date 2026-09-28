import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../../administration/admin-audit.helper';
import { QuestionBankAnalyticsService } from '../../question-bank/services/question-bank-analytics.service';
import { QuestionBankAssetsService } from '../../question-bank/services/question-bank-assets.service';
import { WebsiteCmsEnterpriseService } from '../website-cms-enterprise.service';
import { WebsiteService } from '../website.service';
import {
  EXAM_TYPE_LABELS,
  QUESTION_BANK_DOWNLOAD_MODES,
  QUESTION_PAPER_DEFAULT_PAGE_SIZE,
  QUESTION_PAPER_MAX_PAGE_SIZE,
  SUBJECT_CATEGORY_LABELS,
  type QuestionBankDownloadMode,
  type QuestionPaperSort,
} from './website-question-bank.constants';
import type {
  PublicQuestionPaperQueryDto,
  QuestionBankSettingsDto,
} from './website-question-bank.dto';
import {
  paperIdFromSlug,
  questionPaperSlug,
  safeDownloadFileName,
  sanitizePlainText,
  sanitizeSubjectCode,
} from './website-question-bank.sanitize';

export const QUESTION_BANK_PUBLIC_PATH = '/academics/question-bank';

export type QuestionBankSettings = {
  downloadMode: QuestionBankDownloadMode;
  pageSize: number;
  intro: string;
};

const PAPER_SELECT = {
  id: true,
  paperCode: true,
  paperName: true,
  academicYearId: true,
  programVersionId: true,
  departmentId: true,
  courseId: true,
  semesterNo: true,
  examinationType: true,
  subjectCategory: true,
  examYear: true,
  examMonth: true,
  fileSizeBytes: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.QuestionPaperSelect;

type PaperRow = Prisma.QuestionPaperGetPayload<{ select: typeof PAPER_SELECT }>;

type Option = { id: string; label: string; code?: string; parentId?: string };

type RefMaps = {
  years: Map<string, Option>;
  programmes: Map<string, Option>;
  departments: Map<string, Option>;
  subjects: Map<string, Option>;
};

const enumOption = (value: string | null, labels: Record<string, string>) =>
  value
    ? { id: value, label: labels[value] ?? value.replace(/_/g, ' ') }
    : null;

/**
 * Public college-website view of the ERP Question Paper Repository.
 * Only published papers that are marked "show on website" are exposed.
 */
@Injectable()
export class WebsiteQuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
    private readonly enterprise: WebsiteCmsEnterpriseService,
    private readonly audit: AdminAuditHelper,
    private readonly assets: QuestionBankAssetsService,
    private readonly analytics: QuestionBankAnalyticsService,
  ) {}

  // ---------------------------------------------------------------- settings

  private readSettings(settingsJson: unknown): QuestionBankSettings {
    const stored = this.asRecord(this.asRecord(settingsJson).questionBank);
    const pageSizeRaw = Number(stored.pageSize);
    return {
      downloadMode: QUESTION_BANK_DOWNLOAD_MODES.includes(
        stored.downloadMode as QuestionBankDownloadMode,
      )
        ? (stored.downloadMode as QuestionBankDownloadMode)
        : 'NEW_TAB',
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
    const next: QuestionBankSettings = {
      downloadMode:
        (dto.downloadMode as QuestionBankDownloadMode) ?? current.downloadMode,
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
    void this.audit
      .log({
        tenantId: user.tid,
        userId: user.sub,
        module: 'website',
        action: 'question_bank.settings.update',
        entityType: 'website_site',
        entityId: site.id,
        metadata: next,
      })
      .catch(() => undefined);
    void this.enterprise
      .requestRevalidation(user, [QUESTION_BANK_PUBLIC_PATH])
      .catch(() => undefined);
    return this.readSettings(updated.settingsJson);
  }

  // ------------------------------------------------------------------ public

  async publicFilters(tenantId: string) {
    const [settings, rows] = await Promise.all([
      this.getSettings(tenantId),
      this.prisma.questionPaper.findMany({
        where: this.visibleWhere(tenantId),
        select: PAPER_SELECT,
      }),
    ]);
    const refs = await this.loadRefs(tenantId, rows);

    const categories = new Set<string>();
    const examTypes = new Set<string>();
    const semesters = new Set<number>();
    const examYears = new Set<number>();
    const subjectCodes = new Set<string>();
    for (const row of rows) {
      if (row.subjectCategory) categories.add(row.subjectCategory);
      if (row.examinationType) examTypes.add(row.examinationType);
      if (row.semesterNo != null) semesters.add(row.semesterNo);
      if (row.examYear != null) examYears.add(row.examYear);
      if (row.paperCode) subjectCodes.add(row.paperCode);
    }
    const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
    const enumOptions = (values: Set<string>, labels: Record<string, string>) =>
      [...values].map((value) => enumOption(value, labels)!).sort(byLabel);

    return {
      total: rows.length,
      academicYears: [...refs.years.values()].sort((a, b) =>
        b.label.localeCompare(a.label),
      ),
      programmes: [...refs.programmes.values()].sort(byLabel),
      departments: [...refs.departments.values()].sort(byLabel),
      categories: enumOptions(categories, SUBJECT_CATEGORY_LABELS),
      subjects: [...refs.subjects.values()].sort(byLabel),
      examTypes: enumOptions(examTypes, EXAM_TYPE_LABELS),
      semesters: [...semesters].sort((a, b) => a - b),
      examYears: [...examYears].sort((a, b) => b - a),
      subjectCodes: [...subjectCodes].sort((a, b) => a.localeCompare(b)),
      settings,
    };
  }

  async listPublicPapers(tenantId: string, query: PublicQuestionPaperQueryDto) {
    const settings = await this.getSettings(tenantId);
    const limit = Math.min(
      query.limit ?? settings.pageSize,
      QUESTION_PAPER_MAX_PAGE_SIZE,
    );
    const where: Prisma.QuestionPaperWhereInput = {
      AND: [
        this.visibleWhere(tenantId),
        await this.buildFilterWhere(tenantId, query),
      ],
    };
    const total = await this.prisma.questionPaper.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
    const rows = await this.prisma.questionPaper.findMany({
      where,
      select: PAPER_SELECT,
      orderBy: this.orderBy((query.sort as QuestionPaperSort) ?? 'newest'),
      skip: (page - 1) * limit,
      take: limit,
    });
    const refs = await this.loadRefs(tenantId, rows);
    return {
      items: rows.map((row) => this.mapPublicPaper(row, refs)),
      total,
      page,
      pageSize: limit,
      pageCount,
      downloadMode: settings.downloadMode,
    };
  }

  async getPublicPaper(tenantId: string, slug: string) {
    const [settings, row] = await Promise.all([
      this.getSettings(tenantId),
      this.findVisibleBySlug(tenantId, slug),
    ]);
    const refs = await this.loadRefs(tenantId, [row]);
    return {
      ...this.mapPublicPaper(row, refs),
      downloadMode: settings.downloadMode,
    };
  }

  async getPublicFile(tenantId: string, slug: string, ipAddress?: string) {
    const [settings, row] = await Promise.all([
      this.getSettings(tenantId),
      this.findVisibleBySlug(tenantId, slug, { filePath: true }),
    ]);
    const { stream } = this.assets.openDownloadStream(tenantId, row.filePath!);
    void this.analytics
      .logAccess({ tenantId, paperId: row.id, action: 'DOWNLOAD', ipAddress })
      .catch(() => undefined);
    return {
      stream,
      bytes: row.fileSizeBytes ?? undefined,
      fileName: safeDownloadFileName(
        [row.paperCode, row.paperName, row.examYear].filter(Boolean).join(' '),
      ),
      downloadMode: settings.downloadMode,
    };
  }

  async listPublicSitemap(tenantId: string) {
    const rows = await this.prisma.questionPaper.findMany({
      where: this.visibleWhere(tenantId),
      select: {
        id: true,
        paperCode: true,
        paperName: true,
        examYear: true,
        updatedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    });
    return rows.map((row) => ({
      slug: questionPaperSlug(row),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  // --------------------------------------------------------------- internals

  private visibleWhere(tenantId: string): Prisma.QuestionPaperWhereInput {
    return {
      tenantId,
      deletedAt: null,
      status: 'PUBLISHED',
      showOnWebsite: true,
      filePath: { not: null },
    };
  }

  private async findVisibleBySlug<S extends Prisma.QuestionPaperSelect>(
    tenantId: string,
    slug: string,
    extra?: S,
  ) {
    const id = paperIdFromSlug(slug);
    const row = id
      ? await this.prisma.questionPaper.findFirst({
          where: { ...this.visibleWhere(tenantId), id },
          select: { ...PAPER_SELECT, ...(extra ?? {}) },
        })
      : null;
    if (!row) throw new NotFoundException('Question paper not found');
    return row as PaperRow & { filePath?: string | null };
  }

  private async buildFilterWhere(
    tenantId: string,
    query: PublicQuestionPaperQueryDto,
  ): Promise<Prisma.QuestionPaperWhereInput> {
    const and: Prisma.QuestionPaperWhereInput[] = [];
    if (query.academicYearId)
      and.push({ academicYearId: query.academicYearId });
    if (query.departmentId) and.push({ departmentId: query.departmentId });
    if (query.subjectId) and.push({ courseId: query.subjectId });
    if (query.category) and.push({ subjectCategory: query.category });
    if (query.examType) and.push({ examinationType: query.examType });
    if (query.semester != null) and.push({ semesterNo: query.semester });
    if (query.examYear != null) and.push({ examYear: query.examYear });
    const code = sanitizeSubjectCode(query.subjectCode);
    if (code) and.push({ paperCode: { equals: code, mode: 'insensitive' } });

    if (query.programmeId) {
      const versions = await this.prisma.programVersion.findMany({
        where: { programId: query.programmeId },
        select: { id: true },
      });
      and.push({ programVersionId: { in: versions.map((v) => v.id) } });
    }

    const q = sanitizePlainText(query.q, 120);
    if (q) {
      const contains = { contains: q, mode: 'insensitive' as const };
      const [departments, versions, courses] = await Promise.all([
        this.prisma.department.findMany({
          where: { tenantId, OR: [{ name: contains }, { code: contains }] },
          select: { id: true },
          take: 50,
        }),
        this.prisma.programVersion.findMany({
          where: {
            program: { tenantId, OR: [{ name: contains }, { code: contains }] },
          },
          select: { id: true },
          take: 100,
        }),
        this.prisma.course.findMany({
          where: { tenantId, OR: [{ title: contains }, { code: contains }] },
          select: { id: true },
          take: 200,
        }),
      ]);
      const or: Prisma.QuestionPaperWhereInput[] = [
        { paperName: contains },
        { paperCode: contains },
        { searchText: { contains: q.toLowerCase() } },
      ];
      if (departments.length)
        or.push({ departmentId: { in: departments.map((d) => d.id) } });
      if (versions.length)
        or.push({ programVersionId: { in: versions.map((v) => v.id) } });
      if (courses.length)
        or.push({ courseId: { in: courses.map((c) => c.id) } });
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }

  private orderBy(
    sort: QuestionPaperSort,
  ): Prisma.QuestionPaperOrderByWithRelationInput[] {
    switch (sort) {
      case 'oldest':
        return [
          { publishedAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ];
      case 'title':
        return [{ paperName: 'asc' }, { examYear: 'desc' }];
      case 'subject_code':
        return [{ paperCode: 'asc' }, { examYear: 'desc' }];
      case 'exam_year':
        return [
          { examYear: { sort: 'desc', nulls: 'last' } },
          { paperCode: 'asc' },
        ];
      default:
        return [
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ];
    }
  }

  private async loadRefs(tenantId: string, rows: PaperRow[]): Promise<RefMaps> {
    const ids = (pick: (row: PaperRow) => string | null) => [
      ...new Set(rows.map(pick).filter((id): id is string => Boolean(id))),
    ];
    const yearIds = ids((r) => r.academicYearId);
    const versionIds = ids((r) => r.programVersionId);
    const departmentIds = ids((r) => r.departmentId);
    const courseIds = ids((r) => r.courseId);

    const [years, versions, departments, courses] = await Promise.all([
      yearIds.length
        ? this.prisma.academicYear.findMany({
            where: { id: { in: yearIds }, tenantId },
            select: { id: true, name: true },
          })
        : [],
      versionIds.length
        ? this.prisma.programVersion.findMany({
            where: { id: { in: versionIds } },
            select: {
              id: true,
              program: { select: { id: true, code: true, name: true } },
            },
          })
        : [],
      departmentIds.length
        ? this.prisma.department.findMany({
            where: { id: { in: departmentIds }, tenantId },
            select: { id: true, code: true, name: true },
          })
        : [],
      courseIds.length
        ? this.prisma.course.findMany({
            where: { id: { in: courseIds }, tenantId },
            select: { id: true, code: true, title: true, departmentId: true },
          })
        : [],
    ]);

    const programmes = new Map<string, Option>();
    for (const version of versions) {
      if (!version.program) continue;
      programmes.set(version.id, {
        id: version.program.id,
        label: version.program.name,
        code: version.program.code,
      });
    }
    return {
      years: new Map(years.map((y) => [y.id, { id: y.id, label: y.name }])),
      programmes,
      departments: new Map(
        departments.map((d) => [
          d.id,
          { id: d.id, label: d.name, code: d.code },
        ]),
      ),
      subjects: new Map(
        courses.map((c) => [
          c.id,
          {
            id: c.id,
            label: c.title,
            code: c.code,
            ...(c.departmentId ? { parentId: c.departmentId } : {}),
          },
        ]),
      ),
    };
  }

  private mapPublicPaper(row: PaperRow, refs: RefMaps) {
    const ref = (map: Map<string, Option>, id: string | null) =>
      (id ? map.get(id) : undefined) ?? null;
    return {
      id: row.id,
      slug: questionPaperSlug(row),
      title: row.paperName,
      subjectName: row.paperName,
      subjectCode: row.paperCode,
      semester: row.semesterNo,
      examYear: row.examYear,
      examMonth: row.examMonth,
      description: '',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      academicYear: ref(refs.years, row.academicYearId),
      programme: ref(refs.programmes, row.programVersionId),
      department: ref(refs.departments, row.departmentId),
      category: enumOption(row.subjectCategory, SUBJECT_CATEGORY_LABELS),
      subject: ref(refs.subjects, row.courseId),
      examType: enumOption(row.examinationType, EXAM_TYPE_LABELS),
      file: { bytes: row.fileSizeBytes ?? 0 },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
