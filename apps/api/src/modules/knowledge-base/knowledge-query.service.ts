import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REGULATION_SOURCE_TYPES } from './knowledge-source-types';

export type KnowledgeTablePayload = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  totalRows?: number;
};

export type KnowledgeAnswer = {
  kind:
    | 'course'
    | 'semester'
    | 'fact'
    | 'course_list'
    | 'compare'
    | 'definition'
    | 'text';
  title: string;
  markdown: string;
  table?: KnowledgeTablePayload;
  source: {
    documentTitle: string;
    section?: string | null;
    pageRef?: string | null;
  };
  data?: Record<string, unknown>;
};

@Injectable()
export class KnowledgeQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async answer(
    tenantId: string,
    question: string,
  ): Promise<KnowledgeAnswer | null> {
    const q = question.trim();
    if (!q) return null;

    const courseCode = this.extractCourseCode(q);
    if (courseCode) {
      return this.answerCourse(tenantId, courseCode);
    }

    const diff = await this.answerDifference(tenantId, q);
    if (diff) return diff;

    const definition = await this.answerDefinition(tenantId, q);
    if (definition) return definition;

    const semester = this.extractSemester(q);

    // Category catalogue (e.g. "Which MDC courses in Semester 1?") before full semester plan
    const categoryMatch = q.match(
      /\b(MDC|AEC|SEC|VAC|MAJOR|MINOR)\b(?:\s+courses?)?/i,
    );
    if (categoryMatch && /(list|which|available|all|show|belong)/i.test(q)) {
      return this.listCoursesByCategory(
        tenantId,
        categoryMatch[1].toUpperCase(),
        semester,
      );
    }

    if (semester && /compare|vs|versus|difference/i.test(q)) {
      const other = this.extractSecondSemester(q, semester);
      return this.compareSemesters(tenantId, semester, other);
    }
    if (
      semester &&
      /(detail|structure|explain|show|framework|papers?)/i.test(q)
    ) {
      if (/explain/i.test(q)) return this.explainSemester(tenantId, semester);
      return this.semesterDetails(tenantId, semester);
    }
    // "Semester 1 courses" / "courses in semester 1" without a category
    if (semester && /\bcourses?\b/i.test(q) && !/\bstudents?\b/i.test(q)) {
      return this.semesterDetails(tenantId, semester);
    }
    // "Total credits of Semester 5"
    if (semester && /\bcredits?\b/i.test(q)) {
      return this.semesterDetails(tenantId, semester);
    }

    if (/fyup|four[- ]year|4[- ]year/i.test(q) && /credit/i.test(q)) {
      return this.answerFact(tenantId, 'FYUP_TOTAL_CREDITS');
    }
    if (/120|three[- ]year|3[- ]year/i.test(q) && /credit/i.test(q)) {
      return this.answerFact(tenantId, 'UG3_TOTAL_CREDITS');
    }

    if (this.isRegulationQuestion(q)) {
      const reg = await this.searchRegulations(tenantId, q);
      if (reg) return reg;
    }

    // Keyword fallback over facts + chunks
    return this.keywordSearch(tenantId, q);
  }

  /** Short semester context for hybrid KB + ERP answers. */
  async semesterContextBrief(tenantId: string, semester: number) {
    const plan = await this.prisma.knowledgeSemesterPlan.findFirst({
      where: {
        tenantId,
        semester,
        document: { status: 'ACTIVE', sourceType: 'CURRICULUM' },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) {
      return {
        markdown: `Semester ${this.roman(semester)} (no structured plan in Knowledge Base yet).`,
        source: null,
      };
    }
    const lines = plan.lines as Array<{ category: string; credits: number }>;
    const summary = lines.map((l) => l.category).join(', ');
    return {
      markdown: [
        `Semester ${this.roman(semester)} framework (${plan.totalCredits} credits): ${summary}.`,
        `Source: ${plan.document.title}`,
      ].join('\n'),
      source: {
        documentTitle: plan.document.title,
        section: `Semester ${this.roman(semester)}`,
      },
    };
  }

  private isRegulationQuestion(q: string) {
    return /\b(change|switch|alter)\s+(?:their\s+)?major\b|\bmajor\s+change\b|\bpromotion\s+rule|\battendance\s+requirement|\bminimum\s+attendance|\beligible\s+for\s+exam|\bexam\s+regulation|\bhostel\s+refund|\brefund\s+policy|\bleave\s+rule|\bservice\s+rule|\bcan\s+semester\b/i.test(
      q,
    );
  }

  private async searchRegulations(
    tenantId: string,
    q: string,
  ): Promise<KnowledgeAnswer | null> {
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3)
      .slice(0, 8);

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        tenantId,
        document: {
          status: 'ACTIVE',
          sourceType: { in: [...REGULATION_SOURCE_TYPES] },
        },
        OR: tokens.map((t) => ({
          content: { contains: t, mode: 'insensitive' as const },
        })),
      },
      include: { document: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    if (chunks.length) {
      const primary = chunks[0];
      const extras = chunks.slice(1);
      const markdown = [
        primary.heading ?? 'From institutional regulations',
        '',
        primary.content.slice(0, 900),
        extras.length
          ? `\n\nAlso relevant (${extras[0].document.title}): ${extras[0].content.slice(0, 300)}…`
          : '',
        '',
        `Source: ${primary.document.title}${primary.pageNo ? ` · p. ${primary.pageNo}` : ''}`,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        kind: 'text',
        title: primary.heading ?? primary.document.title,
        markdown,
        source: {
          documentTitle: primary.document.title,
          section: primary.heading,
          pageRef: primary.pageNo != null ? String(primary.pageNo) : null,
        },
      };
    }

    // Fall back to regulation facts (attendance %, etc.)
    const facts = await this.prisma.knowledgeFact.findMany({
      where: {
        tenantId,
        document: {
          status: 'ACTIVE',
          sourceType: { in: [...REGULATION_SOURCE_TYPES] },
        },
      },
      include: { document: true },
      take: 5,
    });
    if (facts.length && /attendance|promotion|exam/i.test(q)) {
      const rows = facts.map((f) => ({
        rule: f.label,
        value: f.value,
        source: f.document.title,
      }));
      return {
        kind: 'fact',
        title: 'Regulation facts',
        markdown: [
          'Extracted regulation facts:',
          ...facts.map((f) => `• ${f.label}: ${f.value} (${f.document.title})`),
        ].join('\n'),
        table: {
          columns: [
            { key: 'rule', label: 'Rule' },
            { key: 'value', label: 'Value' },
            { key: 'source', label: 'Source' },
          ],
          rows,
        },
        source: {
          documentTitle: facts[0].document.title,
          section: 'Regulation facts',
        },
      };
    }

    return null;
  }

  private async answerDefinition(
    tenantId: string,
    q: string,
  ): Promise<KnowledgeAnswer | null> {
    const terms = [
      'FYUP',
      'MDC',
      'AEC',
      'SEC',
      'VAC',
      'VTC',
      'MAJOR',
      'MINOR',
      'NEP',
      'UG',
    ];
    const isDefQuestion =
      /^(what\s+is|define|explain|meaning\s+of)\b/i.test(q.trim()) ||
      /\bwhat\s+is\b/i.test(q);
    if (!isDefQuestion) return null;

    const hit = terms.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(q));
    if (!hit) return null;

    // Prefer course answers when a code is present (handled earlier)
    const rows = await this.prisma.$queryRaw<
      Array<{ term: string; definition: string; document_title: string | null }>
    >`
      SELECT d.term, d.definition, doc.title AS document_title
      FROM platform.knowledge_definitions d
      LEFT JOIN platform.knowledge_documents doc ON doc.id = d.document_id
      WHERE d.tenant_id = ${tenantId}::uuid
        AND LOWER(d.term) = LOWER(${hit})
      LIMIT 1
    `;
    const def = rows[0];
    if (!def) return null;

    const sourceTitle =
      def.document_title ??
      'NEHU Curriculum and Credit Framework for Undergraduate Programmes';

    return {
      kind: 'definition',
      title: def.term,
      markdown: [
        `${def.term}`,
        '',
        def.definition,
        '',
        `Source: ${sourceTitle}`,
      ].join('\n'),
      source: {
        documentTitle: sourceTitle,
        section: `Definition: ${def.term}`,
      },
      data: { term: def.term, definition: def.definition },
    };
  }

  private async answerDifference(
    tenantId: string,
    q: string,
  ): Promise<KnowledgeAnswer | null> {
    if (!/\b(difference|differ|vs\.?|versus|compare)\b/i.test(q)) return null;
    const terms = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC', 'MAJOR', 'MINOR', 'FYUP'];
    const found = terms.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(q));
    if (found.length < 2) return null;

    const defs: Array<{
      term: string;
      definition: string;
      document_title: string | null;
    }> = [];
    for (const term of found) {
      const rows = await this.prisma.$queryRaw<
        Array<{
          term: string;
          definition: string;
          document_title: string | null;
        }>
      >`
        SELECT d.term, d.definition, doc.title AS document_title
        FROM platform.knowledge_definitions d
        LEFT JOIN platform.knowledge_documents doc ON doc.id = d.document_id
        WHERE d.tenant_id = ${tenantId}::uuid
          AND LOWER(d.term) = LOWER(${term})
        LIMIT 1
      `;
      if (rows[0]) defs.push(rows[0]);
    }
    if (defs.length < 2) return null;

    const rows = defs.map((d) => ({
      term: d.term,
      definition: d.definition,
    }));
    const sourceTitle =
      defs[0].document_title ??
      'NEHU Curriculum and Credit Framework for Undergraduate Programmes';

    return {
      kind: 'compare',
      title: `${defs.map((d) => d.term).join(' vs ')}`,
      markdown: [
        `${defs.map((d) => d.term).join(' vs ')}`,
        '',
        ...defs.map((d) => `• ${d.term}: ${d.definition}`),
        '',
        `Source: ${sourceTitle}`,
      ].join('\n'),
      table: {
        columns: [
          { key: 'term', label: 'Term' },
          { key: 'definition', label: 'Definition' },
        ],
        rows,
      },
      source: { documentTitle: sourceTitle, section: 'Definitions' },
    };
  }

  private extractCourseCode(q: string): string | null {
    const m = q.match(/\b((?:MDC|AEC|SEC|VAC|SUB|VTC)[-\s]?\d{2,3})\b/i);
    if (!m) return null;
    return m[1]
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/^(MDC|AEC|SEC|VAC|SUB|VTC)(\d)/, '$1-$2');
  }

  private extractSemester(q: string): number | null {
    const roman: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
    };
    const m1 = q.match(/\bsem(?:ester)?\s*([1-8]|i{1,3}|iv|v?i{0,3})\b/i);
    if (!m1) return null;
    const token = m1[1].toLowerCase();
    if (/^\d+$/.test(token)) return Number(token);
    return roman[token] ?? null;
  }

  private extractSecondSemester(q: string, first: number): number {
    const roman: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
    };
    const matches = [
      ...q.matchAll(/\bsem(?:ester)?\s*([1-8]|i{1,3}|iv|v?i{0,3})\b/gi),
    ];
    for (const m of matches) {
      const token = m[1].toLowerCase();
      const n = /^\d+$/.test(token) ? Number(token) : (roman[token] ?? null);
      if (n != null && n !== first) return n;
    }
    return first === 1 ? 2 : first === 2 ? 1 : first + 1;
  }

  private async answerCourse(
    tenantId: string,
    code: string,
  ): Promise<KnowledgeAnswer | null> {
    const course = await this.prisma.knowledgeCourse.findFirst({
      where: {
        tenantId,
        code: { equals: code, mode: 'insensitive' },
        document: { status: 'ACTIVE' },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!course) return null;

    const categoryLabel = this.categoryLabel(course.category);
    const rows = [
      ['Course Code', course.code],
      ['Course Name', course.title],
      ['Semester', course.semester ? this.roman(course.semester) : '—'],
      ['Category', categoryLabel],
      ['Credits', course.credits != null ? String(course.credits) : '—'],
    ];
    const markdown = [
      `${course.code}`,
      `Course Name: ${course.title}`,
      `Semester: ${course.semester ? this.roman(course.semester) : '—'}`,
      `Category: ${categoryLabel}`,
      `Credits: ${course.credits != null ? String(course.credits) : '—'}`,
      '',
      `Source: ${course.document.title}`,
    ].join('\n');

    return {
      kind: 'course',
      title: course.code,
      markdown,
      table: {
        columns: [
          { key: 'field', label: 'Field' },
          { key: 'value', label: 'Value' },
        ],
        rows: rows.map(([field, value]) => ({ field, value })),
      },
      source: {
        documentTitle: course.document.title,
        section: categoryLabel,
        pageRef: course.pageRef,
      },
      data: {
        code: course.code,
        title: course.title,
        semester: course.semester,
        category: course.category,
        credits: course.credits,
      },
    };
  }

  private async semesterDetails(
    tenantId: string,
    semester: number,
  ): Promise<KnowledgeAnswer | null> {
    const plan = await this.prisma.knowledgeSemesterPlan.findFirst({
      where: {
        tenantId,
        semester,
        document: { status: 'ACTIVE' },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) return null;

    const lines = plan.lines as Array<{
      category: string;
      courseCodePattern: string;
      credits: number;
      papers?: number;
    }>;

    const body = lines.map((l) => ({
      category: l.category,
      courseCode: l.courseCodePattern,
      credits: String(l.credits),
    }));
    body.push({
      category: 'Total Credits',
      courseCode: '',
      credits: String(plan.totalCredits),
    });

    const markdown = [
      `Semester ${this.roman(semester)} course details`,
      `Total Credits: ${plan.totalCredits}`,
      '',
      `Source: ${plan.document.title}`,
    ].join('\n');

    return {
      kind: 'semester',
      title: `Semester ${this.roman(semester)}`,
      markdown,
      table: {
        columns: [
          { key: 'category', label: 'Course Category' },
          { key: 'courseCode', label: 'Course Code' },
          { key: 'credits', label: 'Credits' },
        ],
        rows: body,
        totalRows: body.length,
      },
      source: {
        documentTitle: plan.document.title,
        section: `Semester ${this.roman(semester)}`,
        pageRef: plan.pageRef,
      },
      data: { semester, totalCredits: plan.totalCredits, lines },
    };
  }

  private async explainSemester(
    tenantId: string,
    semester: number,
  ): Promise<KnowledgeAnswer | null> {
    const plan = await this.prisma.knowledgeSemesterPlan.findFirst({
      where: {
        tenantId,
        semester,
        document: { status: 'ACTIVE' },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) return null;
    const lines = plan.lines as Array<{ category: string }>;
    const expand: Record<string, string> = {
      'Major/Core': 'Major/Core',
      'Minor/Core': 'Minor/Core',
      MDC: 'Multidisciplinary Course',
      AEC: 'Ability Enhancement Course',
      SEC: 'Skill Enhancement Course',
      VAC: 'Value Added Course',
    };
    const papers = lines.map((l) => expand[l.category] ?? l.category);
    const markdown = [
      `Semester ${this.roman(semester)} consists of ${papers.length} papers.`,
      '',
      ...papers.map((p) => `• ${p}`),
      '',
      `Total Credits: ${plan.totalCredits}`,
      '',
      `Source: ${plan.document.title}`,
    ].join('\n');

    return {
      kind: 'text',
      title: `Semester ${this.roman(semester)}`,
      markdown,
      source: {
        documentTitle: plan.document.title,
        section: `Semester ${this.roman(semester)}`,
        pageRef: plan.pageRef,
      },
      data: { semester, totalCredits: plan.totalCredits, papers },
    };
  }

  private async compareSemesters(
    tenantId: string,
    a: number,
    b: number,
  ): Promise<KnowledgeAnswer | null> {
    const plans = await this.prisma.knowledgeSemesterPlan.findMany({
      where: {
        tenantId,
        semester: { in: [a, b] },
        document: { status: 'ACTIVE' },
      },
      include: { document: true },
    });
    const planA = plans.find((p) => p.semester === a);
    const planB = plans.find((p) => p.semester === b);
    if (!planA || !planB) return null;

    const linesA = planA.lines as Array<{
      category: string;
      courseCodePattern: string;
      credits: number;
    }>;
    const linesB = planB.lines as Array<{
      category: string;
      courseCodePattern: string;
      credits: number;
    }>;
    const categories = [
      ...new Set([...linesA, ...linesB].map((l) => l.category)),
    ];
    const body = categories.map((cat) => {
      const la = linesA.find((l) => l.category === cat);
      const lb = linesB.find((l) => l.category === cat);
      return {
        category: cat,
        codeA: la?.courseCodePattern ?? '—',
        creditsA: la ? String(la.credits) : '—',
        codeB: lb?.courseCodePattern ?? '—',
        creditsB: lb ? String(lb.credits) : '—',
      };
    });
    body.push({
      category: 'Total Credits',
      codeA: '',
      creditsA: String(planA.totalCredits),
      codeB: '',
      creditsB: String(planB.totalCredits),
    });

    const markdown = [
      `Semester ${this.roman(a)} vs Semester ${this.roman(b)}`,
      '',
      `Source: ${planA.document.title}`,
    ].join('\n');

    return {
      kind: 'compare',
      title: `Semester ${this.roman(a)} vs ${this.roman(b)}`,
      markdown,
      table: {
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'codeA', label: `Sem ${this.roman(a)} Code` },
          { key: 'creditsA', label: `Sem ${this.roman(a)} Credits` },
          { key: 'codeB', label: `Sem ${this.roman(b)} Code` },
          { key: 'creditsB', label: `Sem ${this.roman(b)} Credits` },
        ],
        rows: body,
        totalRows: body.length,
      },
      source: {
        documentTitle: planA.document.title,
        section: `Semester ${this.roman(a)} & ${this.roman(b)}`,
      },
    };
  }

  private async listCoursesByCategory(
    tenantId: string,
    category: string,
    semester: number | null,
  ): Promise<KnowledgeAnswer | null> {
    const where: Prisma.KnowledgeCourseWhereInput = {
      tenantId,
      document: { status: 'ACTIVE' },
      category: { equals: category, mode: 'insensitive' },
    };
    if (semester != null) where.semester = semester;

    const courses = await this.prisma.knowledgeCourse.findMany({
      where,
      include: { document: true },
      orderBy: { code: 'asc' },
    });
    if (!courses.length) return null;

    const body = courses.map((c) => ({ code: c.code, course: c.title }));
    const semLabel = semester ? ` in Semester ${this.roman(semester)}` : '';
    const markdown = [
      `${category} courses${semLabel}`,
      '',
      `Source: ${courses[0].document.title}`,
    ].join('\n');

    return {
      kind: 'course_list',
      title: `${category} courses`,
      markdown,
      table: {
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'course', label: 'Course' },
        ],
        rows: body,
        totalRows: body.length,
      },
      source: {
        documentTitle: courses[0].document.title,
        section: semester
          ? `Semester ${this.roman(semester)} ${category}`
          : category,
      },
      data: { category, semester, courses: body },
    };
  }

  private async answerFact(
    tenantId: string,
    key: string,
  ): Promise<KnowledgeAnswer | null> {
    const fact = await this.prisma.knowledgeFact.findFirst({
      where: { tenantId, key, document: { status: 'ACTIVE' } },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!fact) return null;

    let markdown = '';
    if (key === 'FYUP_TOTAL_CREDITS') {
      markdown = [
        'A Four-Year Undergraduate Programme (FYUP) requires',
        '',
        `${fact.value} Credits`,
        '',
        `as specified in the ${fact.document.title}.`,
      ].join('\n');
    } else {
      markdown = [
        `${fact.label}: ${fact.value}`,
        '',
        `Source: ${fact.document.title}`,
      ].join('\n');
    }

    return {
      kind: 'fact',
      title: fact.label,
      markdown,
      source: {
        documentTitle: fact.document.title,
        pageRef: fact.pageRef,
      },
      data: { key: fact.key, value: fact.value },
    };
  }

  private async keywordSearch(
    tenantId: string,
    q: string,
  ): Promise<KnowledgeAnswer | null> {
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3)
      .slice(0, 6);
    if (!tokens.length) return null;

    const courses = await this.prisma.knowledgeCourse.findMany({
      where: {
        tenantId,
        document: { status: 'ACTIVE' },
        OR: tokens.flatMap((t) => [
          { title: { contains: t, mode: 'insensitive' as const } },
          { code: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      include: { document: true },
      take: 8,
    });
    if (courses.length === 1) {
      return this.answerCourse(tenantId, courses[0].code);
    }
    if (courses.length > 1) {
      const body = courses.map((c) => ({
        code: c.code,
        course: c.title,
        credits: c.credits != null ? String(c.credits) : '—',
      }));
      return {
        kind: 'course_list',
        title: 'Matching courses',
        markdown: [
          'Matching courses from the knowledge base',
          '',
          `Source: ${courses[0].document.title}`,
        ].join('\n'),
        table: {
          columns: [
            { key: 'code', label: 'Code' },
            { key: 'course', label: 'Course' },
            { key: 'credits', label: 'Credits' },
          ],
          rows: body,
          totalRows: body.length,
        },
        source: { documentTitle: courses[0].document.title },
      };
    }

    const facts = await this.prisma.knowledgeFact.findMany({
      where: {
        tenantId,
        document: { status: 'ACTIVE' },
        OR: tokens.flatMap((t) => [
          { label: { contains: t, mode: 'insensitive' as const } },
          { key: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      include: { document: true },
      take: 3,
    });
    if (facts.length) {
      return this.answerFact(tenantId, facts[0].key);
    }

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        tenantId,
        document: { status: 'ACTIVE' },
        OR: tokens.map((t) => ({
          content: { contains: t, mode: 'insensitive' as const },
        })),
      },
      include: { document: true },
      take: 2,
    });
    if (!chunks.length) {
      return this.searchRegulations(tenantId, q);
    }

    const markdown = [
      chunks[0].heading ?? 'From institutional knowledge',
      '',
      chunks[0].content.slice(0, 800),
      '',
      `Source: ${chunks[0].document.title}`,
    ].join('\n');

    return {
      kind: 'text',
      title: chunks[0].heading ?? 'Knowledge',
      markdown,
      source: {
        documentTitle: chunks[0].document.title,
        section: chunks[0].heading,
        pageRef: chunks[0].pageNo != null ? String(chunks[0].pageNo) : null,
      },
    };
  }

  private categoryLabel(category: string) {
    const map: Record<string, string> = {
      MDC: 'Multidisciplinary Course (MDC)',
      AEC: 'Ability Enhancement Course (AEC)',
      SEC: 'Skill Enhancement Course (SEC)',
      VAC: 'Value Added Course (VAC)',
      MAJOR: 'Major/Core',
      MINOR: 'Minor/Core',
      VTC: 'Vocational Training Course (VTC)',
    };
    return map[category.toUpperCase()] ?? category;
  }

  private roman(n: number) {
    const map: Record<number, string> = {
      1: 'I',
      2: 'II',
      3: 'III',
      4: 'IV',
      5: 'V',
      6: 'VI',
      7: 'VII',
      8: 'VIII',
    };
    return map[n] ?? String(n);
  }
}
