import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import {
  NEHU_DEFINITIONS,
  NEHU_FACTS,
  SEM1_CATALOGUE,
  allFyugpSemesterPlans,
} from './fyugp-knowledge.constants';
import {
  REGULATION_FACT_PATTERNS,
  REGULATION_SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  type KnowledgeSourceType,
} from './knowledge-source-types';

const COURSE_LINE =
  /\b((?:MDC|AEC|SEC|VAC|SUB|VTC)-?\d{2,3})\s*[:\-–—]\s*([^\n\r]+)/gi;

const CATEGORY_FROM_CODE: Record<string, string> = {
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  SUB: 'MAJOR',
  VTC: 'VTC',
};

const CURRICULUM_TITLE =
  'NEHU Curriculum and Credit Framework for Undergraduate Programmes';

@Injectable()
export class KnowledgeIngestService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seeds all 8 FYUGP semester plans + definitions + facts into the active curriculum KB.
   * Use this as the baseline before importing course catalogues.
   */
  async seedFyugpFramework(tenantId: string, version = 'NEHU-FYUGP-2023') {
    const document = await this.ensureActiveCurriculumDoc(tenantId, {
      version,
      fileName: 'fyugp-framework-seed',
    });

    await this.seedSemesterPlans(tenantId, document.id);
    await this.seedDefinitions(tenantId, document.id);
    await this.seedFacts(tenantId, document.id);
    await this.seedSem1Catalogue(tenantId, document.id);

    return this.summary(document.id, document.title);
  }

  /**
   * Sync every active ERP course (with offering semester when available) into the KB.
   * This is the fastest way to feed all semester NEP syllabus already in OneCampus.
   */
  async syncFromErpCatalog(tenantId: string) {
    const document = await this.ensureActiveCurriculumDoc(tenantId, {
      version: 'ERP-CATALOG-SYNC',
      fileName: 'erp-course-catalog',
    });

    await this.seedSemesterPlans(tenantId, document.id);
    await this.seedDefinitions(tenantId, document.id);
    await this.seedFacts(tenantId, document.id);

    const courses = await this.prisma.course.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: {
        code: true,
        title: true,
        credits: true,
        courseType: true,
        description: true,
        offerings: {
          where: { deletedAt: null },
          select: { semesterSequence: true, category: true },
          take: 5,
          orderBy: { semesterSequence: 'asc' },
        },
      },
    });

    let upserted = 0;
    for (const course of courses) {
      const offering = course.offerings.find((o) => o.semesterSequence != null);
      const category = (
        offering?.category ??
        course.courseType ??
        this.categoryFromCode(course.code) ??
        'OTHER'
      )
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
      const semester =
        offering?.semesterSequence ?? this.inferSemesterFromCode(course.code);

      await this.prisma.knowledgeCourse.upsert({
        where: {
          tenantId_documentId_code: {
            tenantId,
            documentId: document.id,
            code: course.code,
          },
        },
        create: {
          tenantId,
          documentId: document.id,
          code: course.code,
          title: course.title,
          category: category || 'OTHER',
          credits: course.credits,
          semester,
        },
        update: {
          title: course.title,
          category: category || 'OTHER',
          credits: course.credits,
          semester,
        },
      });
      upserted += 1;
    }

    const summary = await this.summary(document.id, document.title);
    return { ...summary, syncedFromErp: upserted };
  }

  /** Excel template for bulk syllabus feed (all semesters). */
  async buildCoursesTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Courses');
    sheet.columns = [
      { header: 'course_code', key: 'code', width: 14 },
      { header: 'course_name', key: 'name', width: 40 },
      { header: 'category', key: 'category', width: 12 },
      { header: 'credits', key: 'credits', width: 10 },
      { header: 'semester', key: 'semester', width: 10 },
      { header: 'description', key: 'description', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const [code, name, category, credits, semester] of SEM1_CATALOGUE) {
      sheet.addRow({
        code,
        name,
        category,
        credits,
        semester,
        description: '',
      });
    }
    sheet.addRow({
      code: 'ECO-200',
      name: 'Example Major Paper (Sem 3)',
      category: 'MAJOR',
      credits: 4,
      semester: 3,
      description: 'Replace with real syllabus rows for Sem 3–8',
    });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /** Import courses from Excel (course_code, course_name, category, credits, semester). */
  async importCoursesExcel(
    tenantId: string,
    buffer: Buffer,
    fileName?: string,
  ) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel has no worksheets');

    const document = await this.ensureActiveCurriculumDoc(tenantId, {
      version: 'EXCEL-IMPORT',
      fileName: fileName ?? 'courses.xlsx',
    });
    await this.seedSemesterPlans(tenantId, document.id);
    await this.seedDefinitions(tenantId, document.id);
    await this.seedFacts(tenantId, document.id);

    const headerRow = sheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, col) => {
      const key = String(cell.value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      if (key) headers[key] = col;
    });

    const codeCol =
      headers.course_code ?? headers.code ?? headers.coursecode ?? 1;
    const nameCol =
      headers.course_name ??
      headers.name ??
      headers.title ??
      headers.course ??
      2;
    const catCol = headers.category ?? headers.course_category ?? 3;
    const creditsCol = headers.credits ?? headers.credit ?? 4;
    const semCol = headers.semester ?? headers.sem ?? headers.semester_no ?? 5;

    let imported = 0;
    let skipped = 0;
    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const code = String(row.getCell(codeCol).text ?? '')
        .trim()
        .toUpperCase();
      const title = String(row.getCell(nameCol).text ?? '').trim();
      if (!code || !title) {
        skipped += 1;
        continue;
      }
      const category =
        String(row.getCell(catCol).text ?? '')
          .trim()
          .toUpperCase() ||
        this.categoryFromCode(code) ||
        'OTHER';
      const creditsRaw = row.getCell(creditsCol).value;
      const credits =
        typeof creditsRaw === 'number'
          ? creditsRaw
          : Number(String(creditsRaw ?? '').replace(/[^\d.]/g, '')) || null;
      const semRaw = row.getCell(semCol).value;
      const semester =
        typeof semRaw === 'number'
          ? semRaw
          : Number(String(semRaw ?? '').replace(/\D/g, '')) ||
            this.inferSemesterFromCode(code);

      await this.prisma.knowledgeCourse.upsert({
        where: {
          tenantId_documentId_code: {
            tenantId,
            documentId: document.id,
            code,
          },
        },
        create: {
          tenantId,
          documentId: document.id,
          code,
          title,
          category,
          credits,
          semester,
        },
        update: { title, category, credits, semester },
      });
      imported += 1;
    }

    const summary = await this.summary(document.id, document.title);
    return { ...summary, imported, skipped };
  }

  /**
   * Ingest a regulation / policy PDF (examination, attendance, fees, hostel, HR, etc.).
   * Archives the previous ACTIVE document with the same title + source type.
   */
  async ingestRegulationPdf(
    tenantId: string,
    buffer: Buffer,
    opts: {
      title: string;
      sourceType: KnowledgeSourceType;
      fileName?: string;
      version?: string;
    },
  ) {
    if (!REGULATION_SOURCE_TYPES.includes(opts.sourceType)) {
      throw new BadRequestException(
        `sourceType must be one of: ${REGULATION_SOURCE_TYPES.join(', ')}`,
      );
    }
    const title = opts.title.trim();
    if (!title) throw new BadRequestException('title is required');

    const pdfParse = (await import('pdf-parse')).default as (
      buf: Buffer,
    ) => Promise<{ text?: string; numpages?: number }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text ?? '';
    if (text.length < 80) {
      throw new BadRequestException('Could not extract readable text from PDF');
    }

    await this.prisma.knowledgeDocument.updateMany({
      where: {
        tenantId,
        title,
        sourceType: opts.sourceType,
        status: 'ACTIVE',
      },
      data: { status: 'ARCHIVED' },
    });

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        title,
        sourceType: opts.sourceType,
        version: opts.version ?? new Date().toISOString().slice(0, 10),
        fileName: opts.fileName ?? 'regulation.pdf',
        pageCount: parsed.numpages ?? null,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });

    const facts = this.extractRegulationFacts(text);
    for (const fact of facts) {
      await this.prisma.knowledgeFact.upsert({
        where: {
          tenantId_documentId_key: {
            tenantId,
            documentId: document.id,
            key: fact.key,
          },
        },
        create: {
          tenantId,
          documentId: document.id,
          key: fact.key,
          label: fact.label,
          value: fact.value,
        },
        update: { label: fact.label, value: fact.value },
      });
    }

    const chunks = this.chunkTextWithPages(text, parsed.numpages ?? 1);
    for (const chunk of chunks.slice(0, 120)) {
      await this.prisma.knowledgeChunk.create({
        data: {
          tenantId,
          documentId: document.id,
          pageNo: chunk.pageNo,
          heading: chunk.heading,
          content: chunk.content,
        },
      });
    }

    const summary = await this.summary(document.id, document.title);
    return {
      ...summary,
      sourceType: opts.sourceType,
      sourceLabel: SOURCE_TYPE_LABELS[opts.sourceType],
      extractedFacts: facts.length,
      extractedChunks: Math.min(chunks.length, 120),
    };
  }

  private extractRegulationFacts(text: string) {
    const found: Array<{ key: string; label: string; value: string }> = [];
    for (const spec of REGULATION_FACT_PATTERNS) {
      const m = text.match(spec.pattern);
      if (m?.[1]) {
        found.push({
          key: `${spec.key}`,
          label: spec.label,
          value: `${m[1]}%`,
        });
      }
    }
    return found;
  }

  private chunkTextWithPages(text: string, pageCount: number) {
    const pages = text.split(/\f/g);
    const chunks: Array<{
      heading: string | null;
      content: string;
      pageNo: number | null;
    }> = [];

    const usePages = pages.length > 1 ? pages : [text];
    usePages.forEach((pageText, pageIdx) => {
      const pageNo =
        pages.length > 1 ? pageIdx + 1 : Math.min(pageIdx + 1, pageCount);
      const parts = pageText
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 30);

      let buf = '';
      let heading: string | null = null;
      for (const part of parts) {
        if (part.length < 100 && /^[A-Z0-9][A-Z0-9 \-/&:]{4,}$/.test(part)) {
          heading = part;
          continue;
        }
        if ((buf + ' ' + part).length > 1000) {
          if (buf) chunks.push({ heading, content: buf.trim(), pageNo });
          buf = part;
        } else {
          buf = `${buf} ${part}`.trim();
        }
      }
      if (buf) chunks.push({ heading, content: buf.trim(), pageNo });
    });

    return chunks;
  }

  async ingestNehuCurriculumPdf(tenantId: string, filePath: string) {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Knowledge PDF not found: ${abs}`);
    }
    const buffer = fs.readFileSync(abs);
    const pdfParse = (await import('pdf-parse')).default as (
      buf: Buffer,
    ) => Promise<{ text?: string; numpages?: number }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text ?? '';

    await this.prisma.knowledgeDocument.updateMany({
      where: { tenantId, title: CURRICULUM_TITLE, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        title: CURRICULUM_TITLE,
        sourceType: 'CURRICULUM',
        version: 'AC-2023-03-28',
        fileName: path.basename(abs),
        pageCount: parsed.numpages ?? null,
        status: 'ACTIVE',
        publishedAt: new Date('2023-03-28'),
      },
    });

    for (const course of this.extractCourses(text)) {
      await this.prisma.knowledgeCourse.upsert({
        where: {
          tenantId_documentId_code: {
            tenantId,
            documentId: document.id,
            code: course.code,
          },
        },
        create: { tenantId, documentId: document.id, ...course },
        update: {
          title: course.title,
          category: course.category,
          credits: course.credits,
          semester: course.semester,
        },
      });
    }

    await this.seedSem1Catalogue(tenantId, document.id);
    await this.seedSemesterPlans(tenantId, document.id);
    await this.seedDefinitions(tenantId, document.id);
    await this.seedFacts(tenantId, document.id);

    const chunks = this.chunkText(text, 1200);
    for (const chunk of chunks.slice(0, 40)) {
      await this.prisma.knowledgeChunk.create({
        data: {
          tenantId,
          documentId: document.id,
          heading: chunk.heading,
          content: chunk.content,
        },
      });
    }

    return this.summary(document.id, document.title);
  }

  private async ensureActiveCurriculumDoc(
    tenantId: string,
    opts: { version: string; fileName: string },
  ) {
    const existing = await this.prisma.knowledgeDocument.findFirst({
      where: { tenantId, status: 'ACTIVE', sourceType: 'CURRICULUM' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    return this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        title: CURRICULUM_TITLE,
        sourceType: 'CURRICULUM',
        version: opts.version,
        fileName: opts.fileName,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
  }

  private async seedSemesterPlans(tenantId: string, documentId: string) {
    for (const plan of allFyugpSemesterPlans()) {
      await this.prisma.knowledgeSemesterPlan.upsert({
        where: {
          tenantId_documentId_semester: {
            tenantId,
            documentId,
            semester: plan.semester,
          },
        },
        create: {
          tenantId,
          documentId,
          semester: plan.semester,
          totalCredits: plan.totalCredits,
          lines: plan.lines,
        },
        update: {
          totalCredits: plan.totalCredits,
          lines: plan.lines,
        },
      });
    }
  }

  private async seedDefinitions(tenantId: string, documentId: string) {
    for (const def of NEHU_DEFINITIONS) {
      // Raw SQL so ingest works even if Prisma client has not been regenerated yet
      await this.prisma.$executeRaw`
        INSERT INTO platform.knowledge_definitions (id, tenant_id, document_id, term, definition, created_at)
        VALUES (gen_random_uuid(), ${tenantId}::uuid, ${documentId}::uuid, ${def.term}, ${def.definition}, NOW())
        ON CONFLICT (tenant_id, term)
        DO UPDATE SET
          definition = EXCLUDED.definition,
          document_id = EXCLUDED.document_id
      `;
    }
  }

  private async seedFacts(tenantId: string, documentId: string) {
    for (const fact of NEHU_FACTS) {
      await this.prisma.knowledgeFact.upsert({
        where: {
          tenantId_documentId_key: {
            tenantId,
            documentId,
            key: fact.key,
          },
        },
        create: { tenantId, documentId, ...fact },
        update: { label: fact.label, value: fact.value },
      });
    }
  }

  private async seedSem1Catalogue(tenantId: string, documentId: string) {
    for (const [
      code,
      titleText,
      category,
      credits,
      semester,
    ] of SEM1_CATALOGUE) {
      await this.prisma.knowledgeCourse.upsert({
        where: {
          tenantId_documentId_code: { tenantId, documentId, code },
        },
        create: {
          tenantId,
          documentId,
          code,
          title: titleText,
          category,
          credits,
          semester,
        },
        update: { title: titleText, category, credits, semester },
      });
    }
  }

  private async summary(documentId: string, title: string) {
    const [courses, facts, semesterPlans, definitions, chunks] =
      await Promise.all([
        this.prisma.knowledgeCourse.count({ where: { documentId } }),
        this.prisma.knowledgeFact.count({ where: { documentId } }),
        this.prisma.knowledgeSemesterPlan.count({ where: { documentId } }),
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM platform.knowledge_definitions
          WHERE document_id = ${documentId}::uuid
        `.then((rows) => Number(rows[0]?.count ?? 0)),
        this.prisma.knowledgeChunk.count({ where: { documentId } }),
      ]);
    return {
      documentId,
      title,
      courses,
      facts,
      semesterPlans,
      definitions,
      chunks,
    };
  }

  private categoryFromCode(code: string): string | null {
    const prefix = code.toUpperCase().split(/[-_\s]/)[0];
    return CATEGORY_FROM_CODE[prefix] ?? (prefix.length <= 4 ? prefix : null);
  }

  private inferSemesterFromCode(code: string): number | null {
    const m = code.match(/(\d{2,3})\s*$/);
    if (!m) return null;
    const num = Number(m[1]);
    if (num >= 100 && num < 150) return 1;
    if (num >= 150 && num < 200) return 2;
    if (num >= 200 && num < 250) return 3;
    if (num >= 250 && num < 300) return 4;
    if (num >= 300 && num < 350) return 5;
    if (num >= 350 && num < 400) return 6;
    if (num >= 400 && num < 450) return 7;
    if (num >= 450 && num < 500) return 8;
    if (num >= 1 && num <= 8) return num;
    return null;
  }

  private extractCourses(text: string) {
    const found = new Map<
      string,
      {
        code: string;
        title: string;
        category: string;
        credits: number | null;
        semester: number | null;
      }
    >();
    let match: RegExpExecArray | null;
    const re = new RegExp(COURSE_LINE.source, 'gi');
    while ((match = re.exec(text)) !== null) {
      const rawCode = match[1]
        .toUpperCase()
        .replace(/^(MDC|AEC|SEC|VAC|SUB|VTC)(\d)/, '$1-$2');
      const code = rawCode.includes('-')
        ? rawCode
        : rawCode.replace(/^(MDC|AEC|SEC|VAC|SUB|VTC)/, '$1-');
      const title = match[2]
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[:\-–—]\s*$/, '');
      if (!title || title.length < 2) continue;
      if (/^(?:MDC|AEC|SEC|VAC|SUB|VTC)[-\s]?\d{2,3}\b/i.test(title)) continue;
      const prefix = code.split('-')[0];
      const category = CATEGORY_FROM_CODE[prefix] ?? prefix;
      const credits = category === 'MAJOR' || category === 'MINOR' ? 4 : 3;
      const semester = this.inferSemesterFromCode(code);
      found.set(code, { code, title, category, credits, semester });
    }
    return [...found.values()];
  }

  private chunkText(text: string, size: number) {
    const parts = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 40);
    const chunks: Array<{ heading: string | null; content: string }> = [];
    let buf = '';
    let heading: string | null = null;
    for (const part of parts) {
      if (part.length < 80 && /^[A-Z0-9][A-Z0-9 \-/&]{3,}$/.test(part)) {
        heading = part;
        continue;
      }
      if ((buf + ' ' + part).length > size) {
        if (buf) chunks.push({ heading, content: buf.trim() });
        buf = part;
      } else {
        buf = `${buf} ${part}`.trim();
      }
    }
    if (buf) chunks.push({ heading, content: buf.trim() });
    return chunks;
  }
}
