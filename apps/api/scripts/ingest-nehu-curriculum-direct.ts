/**
 * Lightweight ingest (no Nest bootstrap) for NEHU curriculum PDF.
 *
 *   npx tsx scripts/ingest-nehu-curriculum-direct.ts
 *   npx tsx scripts/ingest-nehu-curriculum-direct.ts --tenant=demo --pdf="C:\path\to\file.pdf"
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const DEFAULT_PDF =
  'C:\\Users\\johnm\\OneDrive\\Desktop\\Import Live 1-3-5\\NEHU CURRICULUM AND CREDIT FRAMEWORK FOR UNDERGRADUATE PROGRAMMES.pdf';

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

const SEMESTER_1_LINES = [
  {
    category: 'Major/Core',
    courseCodePattern: 'SUB-100',
    credits: 4,
    papers: 1,
  },
  {
    category: 'Minor/Core',
    courseCodePattern: 'SUB-101',
    credits: 4,
    papers: 1,
  },
  {
    category: 'MDC',
    courseCodePattern: 'MDC-110/111/…/119',
    credits: 3,
    papers: 1,
  },
  {
    category: 'AEC',
    courseCodePattern: 'AEC-120/121/…/129',
    credits: 3,
    papers: 1,
  },
  {
    category: 'SEC',
    courseCodePattern: 'SEC-130/131/…/139',
    credits: 3,
    papers: 1,
  },
  { category: 'VAC', courseCodePattern: 'VAC-140', credits: 3, papers: 1 },
];

const SEMESTER_2_LINES = [
  {
    category: 'Major/Core',
    courseCodePattern: 'SUB-150',
    credits: 4,
    papers: 1,
  },
  {
    category: 'Minor/Core',
    courseCodePattern: 'SUB-151',
    credits: 4,
    papers: 1,
  },
  {
    category: 'MDC',
    courseCodePattern: 'MDC-160/161/…/169',
    credits: 3,
    papers: 1,
  },
  {
    category: 'AEC',
    courseCodePattern: 'AEC-170/171/…/179',
    credits: 3,
    papers: 1,
  },
  {
    category: 'SEC',
    courseCodePattern: 'SEC-180/181/…/189',
    credits: 3,
    papers: 1,
  },
  { category: 'VAC', courseCodePattern: 'VAC-190/…', credits: 3, papers: 1 },
];

const SEM1_CATALOGUE = [
  ['MDC-110', 'Introductory Life Sciences', 'MDC', 3, 1],
  ['MDC-111', 'Mathematics in Daily Life', 'MDC', 3, 1],
  ['MDC-112', 'Culture and Society', 'MDC', 3, 1],
  ['MDC-113', 'Foundations of Library & Information Science', 'MDC', 3, 1],
  ['MDC-114', 'NSS and Youth', 'MDC', 3, 1],
  ['MDC-115', 'Introduction to Social Work Practice', 'MDC', 3, 1],
  ['AEC-120', 'MIL', 'AEC', 3, 1],
  ['AEC-121', 'Alternative English', 'AEC', 3, 1],
  ['SEC-130', 'Public Speaking', 'SEC', 3, 1],
  ['SEC-131', 'Motivation', 'SEC', 3, 1],
  ['SEC-132', 'Team Building', 'SEC', 3, 1],
  ['VAC-140', 'Environmental Science', 'VAC', 3, 1],
  ['SUB-100', 'Major / Core (subject paper)', 'MAJOR', 4, 1],
  ['SUB-101', 'Minor / Core (subject paper)', 'MINOR', 4, 1],
] as const;

const prisma = new PrismaClient();

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const pdfPath = path.resolve(readArg('pdf') ?? DEFAULT_PDF);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);

  const buffer = fs.readFileSync(pdfPath);
  const pdfParse = (await import('pdf-parse')).default as (
    buf: Buffer,
  ) => Promise<{ text?: string; numpages?: number }>;
  const parsed = await pdfParse(buffer);
  const text = parsed.text ?? '';

  const title =
    'NEHU Curriculum and Credit Framework for Undergraduate Programmes';

  await prisma.knowledgeDocument.updateMany({
    where: { tenantId: tenant.id, title, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });

  const document = await prisma.knowledgeDocument.create({
    data: {
      tenantId: tenant.id,
      title,
      sourceType: 'CURRICULUM',
      version: 'AC-2023-03-28',
      fileName: path.basename(pdfPath),
      pageCount: parsed.numpages ?? null,
      status: 'ACTIVE',
      publishedAt: new Date('2023-03-28'),
    },
  });

  const found = new Map<
    string,
    {
      code: string;
      title: string;
      category: string;
      credits: number;
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
    const courseTitle = match[2]
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[:\-–—]\s*$/, '');
    if (!courseTitle || courseTitle.length < 2) continue;
    if (/^(?:MDC|AEC|SEC|VAC|SUB|VTC)[-\s]?\d{2,3}\b/i.test(courseTitle))
      continue;
    const prefix = code.split('-')[0];
    const category = CATEGORY_FROM_CODE[prefix] ?? prefix;
    const num = Number(code.split('-')[1] ?? 0);
    let semester: number | null = null;
    const credits = category === 'MAJOR' || category === 'MINOR' ? 4 : 3;
    if (num >= 100 && num < 150) semester = 1;
    else if (num >= 150 && num < 200) semester = 2;
    found.set(code, { code, title: courseTitle, category, credits, semester });
  }

  for (const course of found.values()) {
    await prisma.knowledgeCourse.upsert({
      where: {
        tenantId_documentId_code: {
          tenantId: tenant.id,
          documentId: document.id,
          code: course.code,
        },
      },
      create: { tenantId: tenant.id, documentId: document.id, ...course },
      update: {
        title: course.title,
        category: course.category,
        credits: course.credits,
        semester: course.semester,
      },
    });
  }

  for (const [code, titleText, category, credits, semester] of SEM1_CATALOGUE) {
    await prisma.knowledgeCourse.upsert({
      where: {
        tenantId_documentId_code: {
          tenantId: tenant.id,
          documentId: document.id,
          code,
        },
      },
      create: {
        tenantId: tenant.id,
        documentId: document.id,
        code,
        title: titleText,
        category,
        credits,
        semester,
      },
      update: { title: titleText, category, credits, semester },
    });
  }

  await prisma.knowledgeSemesterPlan.upsert({
    where: {
      tenantId_documentId_semester: {
        tenantId: tenant.id,
        documentId: document.id,
        semester: 1,
      },
    },
    create: {
      tenantId: tenant.id,
      documentId: document.id,
      semester: 1,
      totalCredits: 20,
      lines: SEMESTER_1_LINES,
    },
    update: { totalCredits: 20, lines: SEMESTER_1_LINES },
  });

  await prisma.knowledgeSemesterPlan.upsert({
    where: {
      tenantId_documentId_semester: {
        tenantId: tenant.id,
        documentId: document.id,
        semester: 2,
      },
    },
    create: {
      tenantId: tenant.id,
      documentId: document.id,
      semester: 2,
      totalCredits: 20,
      lines: SEMESTER_2_LINES,
    },
    update: { totalCredits: 20, lines: SEMESTER_2_LINES },
  });

  const facts = [
    { key: 'FYUP_TOTAL_CREDITS', label: 'FYUP total credits', value: '160' },
    {
      key: 'UG3_TOTAL_CREDITS',
      label: '3-year UG total credits',
      value: '120',
    },
    {
      key: 'SEMESTER_1_TOTAL_CREDITS',
      label: 'Semester I total credits',
      value: '20',
    },
    {
      key: 'MAJOR_CREDITS_4Y',
      label: 'Major credits in 4-year FYUP',
      value: '80',
    },
    {
      key: 'MINOR_CREDITS_4Y',
      label: 'Minor credits in 4-year FYUP',
      value: '20',
    },
  ];
  for (const fact of facts) {
    await prisma.knowledgeFact.upsert({
      where: {
        tenantId_documentId_key: {
          tenantId: tenant.id,
          documentId: document.id,
          key: fact.key,
        },
      },
      create: { tenantId: tenant.id, documentId: document.id, ...fact },
      update: { label: fact.label, value: fact.value },
    });
  }

  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40);
  let buf = '';
  let heading: string | null = null;
  const chunks: Array<{ heading: string | null; content: string }> = [];
  for (const part of parts) {
    if (part.length < 80 && /^[A-Z0-9][A-Z0-9 \-/&]{3,}$/.test(part)) {
      heading = part;
      continue;
    }
    if ((buf + ' ' + part).length > 1200) {
      if (buf) chunks.push({ heading, content: buf.trim() });
      buf = part;
    } else {
      buf = `${buf} ${part}`.trim();
    }
  }
  if (buf) chunks.push({ heading, content: buf.trim() });

  for (const chunk of chunks.slice(0, 40)) {
    await prisma.knowledgeChunk.create({
      data: {
        tenantId: tenant.id,
        documentId: document.id,
        heading: chunk.heading,
        content: chunk.content,
      },
    });
  }

  const courseCount = await prisma.knowledgeCourse.count({
    where: { documentId: document.id },
  });

  console.log({
    documentId: document.id,
    title: document.title,
    pageCount: document.pageCount,
    courses: courseCount,
    facts: facts.length,
    chunks: Math.min(chunks.length, 40),
    extractedFromPdf: found.size,
  });

  // Smoke-test structured answers
  const mdc110 = await prisma.knowledgeCourse.findFirst({
    where: {
      tenantId: tenant.id,
      code: 'MDC-110',
      document: { status: 'ACTIVE' },
    },
  });
  const fyup = await prisma.knowledgeFact.findFirst({
    where: {
      tenantId: tenant.id,
      key: 'FYUP_TOTAL_CREDITS',
      document: { status: 'ACTIVE' },
    },
  });
  console.log('MDC-110:', mdc110?.title, mdc110?.credits?.toString());
  console.log('FYUP credits:', fyup?.value);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
