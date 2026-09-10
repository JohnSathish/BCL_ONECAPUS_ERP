import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { FEE_2026_GROUPS } from './school-sis-fee-2026.catalog';

const STRUCTURE_CODE = 'XI-2026-27';

/** Official Class XI 2026–27 heads from St_Lukes_Fee_Structure_2026_2027.xlsx */
const CLASS_XI_LINES: Array<{
  kind: 'ANNUAL' | 'UNIFORM' | 'MONTHLY';
  code: string;
  label: string;
  amount: number | null;
  unspecified?: boolean;
  remarks?: string;
  sortOrder: number;
}> = [
  {
    kind: 'ANNUAL',
    code: 'ADM',
    label: 'Admission',
    amount: 1800,
    sortOrder: 1,
  },
  {
    kind: 'ANNUAL',
    code: 'TUI-MJ',
    label: 'Tuition Fees (May + June)',
    amount: 1600,
    sortOrder: 2,
  },
  {
    kind: 'ANNUAL',
    code: 'EXAM',
    label: 'Examination Fees',
    amount: 350,
    sortOrder: 3,
  },
  {
    kind: 'ANNUAL',
    code: 'GAMES',
    label: 'Games and Sports',
    amount: 400,
    sortOrder: 4,
  },
  {
    kind: 'ANNUAL',
    code: 'MAINT',
    label: 'Maintenance/Teachers’ Welfare',
    amount: 1000,
    sortOrder: 5,
  },
  {
    kind: 'ANNUAL',
    code: 'EST',
    label: 'Establishment/Foundation Fees',
    amount: 800,
    sortOrder: 6,
  },
  {
    kind: 'ANNUAL',
    code: 'FUNC',
    label: 'Functions and Celebrations',
    amount: 300,
    sortOrder: 7,
  },
  {
    kind: 'ANNUAL',
    code: 'CARD',
    label: 'Admit, School Diary & ID and Fees Card',
    amount: 400,
    sortOrder: 8,
  },
  { kind: 'ANNUAL', code: 'LIB', label: 'Library', amount: 150, sortOrder: 9 },
  {
    kind: 'ANNUAL',
    code: 'MISC',
    label: 'Miscellaneous',
    amount: 200,
    sortOrder: 10,
  },
  {
    kind: 'UNIFORM',
    code: 'UNI-SET',
    label: 'Regular uniform (1 set)',
    amount: 1100,
    sortOrder: 20,
  },
  {
    kind: 'UNIFORM',
    code: 'UNI-JER',
    label: 'Jerseys (Tracks, T Shirt & Jacket)',
    amount: 1200,
    sortOrder: 21,
  },
  {
    kind: 'UNIFORM',
    code: 'UNI-BLA',
    label: 'Blazer',
    amount: 1500,
    sortOrder: 22,
  },
  {
    kind: 'MONTHLY',
    code: 'TUI-M',
    label: 'Tuition Fee',
    amount: 800,
    sortOrder: 30,
  },
  {
    kind: 'MONTHLY',
    code: 'COMP',
    label: 'Computer Fee',
    amount: null,
    unspecified: true,
    remarks: 'Amount not specified in source',
    sortOrder: 31,
  },
  {
    kind: 'MONTHLY',
    code: 'LATE',
    label: 'Late Fee',
    amount: null,
    unspecified: true,
    remarks: 'Amount not specified in source',
    sortOrder: 32,
  },
];

const CLASS_XI_NOTES = [
  'Pupils with dues may be barred from sitting for examinations.',
  'Fees once paid are not refundable.',
  'School will issue the uniform at the time of Admission.',
  'Uniform package: Regular uniform (1 set) ₹1,100; Jerseys (Tracks, T Shirt & Jacket) ₹1,200; Blazer ₹1,500; Total ₹3,800.',
];

const include = {
  grade: { select: { id: true, code: true, name: true, sortOrder: true } },
  academicYear: { select: { id: true, name: true, code: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  installments: { orderBy: { sequence: 'asc' as const } },
};

@Injectable()
export class SchoolSisFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async list(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.ensureOfficialStructures(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const rows = await this.prisma.schoolFeeStructure.findMany({
      where: { tenantId, academicYearId: year.id },
      include,
      orderBy: [{ grade: { sortOrder: 'asc' } }, { code: 'asc' }],
    });
    return { academicYear: year, structures: rows.map(withTotals) };
  }

  async one(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolFeeStructure.findFirst({
      where: { id, tenantId },
      include,
    });
    if (!row) throw new NotFoundException('Fee structure not found');
    return withTotals(row);
  }

  async forStudent(tenantId: string, studentId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.ensureOfficialStructures(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const enrollment = await this.prisma.schoolEnrollment.findFirst({
      where: { tenantId, studentId, academicYearId: year.id, deletedAt: null },
      include: { section: { include: { grade: true } }, student: true },
    });
    if (!enrollment)
      throw new NotFoundException(
        'No enrollment for the current academic year',
      );
    const rows = await this.prisma.schoolFeeStructure.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        gradeId: enrollment.section.gradeId,
        status: 'PUBLISHED',
      },
      include,
      orderBy: { code: 'asc' },
    });
    const structure =
      rows.find((r) => r.code === '2026-NEW') ??
      rows.find((r) => r.code === STRUCTURE_CODE) ??
      rows[0] ??
      null;
    return {
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
      },
      enrollment: {
        id: enrollment.id,
        rollNumber: enrollment.rollNumber,
        grade: enrollment.section.grade,
        section: { id: enrollment.section.id, name: enrollment.section.name },
      },
      structure: structure ? withTotals(structure) : null,
      structures: rows.map(withTotals),
    };
  }

  async ensureOfficialStructures(tenantId: string) {
    await this.ensureClassXi(tenantId);
    await this.ensureFee2026(tenantId);
  }

  async ensureClassXi(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const grade = await this.prisma.schoolGrade.findFirst({
      where: { tenantId, code: 'XI', deletedAt: null },
    });
    if (!grade)
      throw new NotFoundException('Class XI is not in the class catalogue');
    const existing = await this.prisma.schoolFeeStructure.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        gradeId: grade.id,
        code: STRUCTURE_CODE,
      },
    });
    if (existing) {
      return this.prisma.schoolFeeStructure.findFirstOrThrow({
        where: { id: existing.id },
        include,
      });
    }
    return this.prisma.schoolFeeStructure.create({
      data: {
        tenantId,
        academicYearId: year.id,
        gradeId: grade.id,
        code: STRUCTURE_CODE,
        name: 'Class XI 2026–27',
        status: 'PUBLISHED',
        sourceLabel: 'St_Lukes_Fee_Structure_2026_2027.xlsx',
        notesJson: CLASS_XI_NOTES,
        lines: {
          create: CLASS_XI_LINES.map((line) => ({
            tenantId,
            kind: line.kind,
            code: line.code,
            label: line.label,
            amount: line.amount,
            unspecified: Boolean(line.unspecified),
            remarks: line.remarks ?? null,
            sortOrder: line.sortOrder,
          })),
        },
        installments: {
          create: [
            { tenantId, sequence: 1, label: 'Installment 1', amount: 5400 },
            { tenantId, sequence: 2, label: 'Installment 2', amount: 5400 },
          ],
        },
      },
      include,
    });
  }

  async ensureFee2026(tenantId: string) {
    const year = await this.sis.currentYear(tenantId);
    const grades = await this.prisma.schoolGrade.findMany({
      where: { tenantId, deletedAt: null },
    });
    const byCode = new Map(grades.map((g) => [g.code, g]));

    for (const group of FEE_2026_GROUPS) {
      for (const gradeCode of group.gradeCodes) {
        const grade = byCode.get(gradeCode);
        if (!grade) continue;
        const existing = await this.prisma.schoolFeeStructure.findFirst({
          where: {
            tenantId,
            academicYearId: year.id,
            gradeId: grade.id,
            code: group.code,
          },
        });
        if (existing) continue;
        await this.prisma.schoolFeeStructure.create({
          data: {
            tenantId,
            academicYearId: year.id,
            gradeId: grade.id,
            code: group.code,
            name: `${grade.name} · ${group.name}`,
            status: 'PUBLISHED',
            sourceLabel: 'St_Lukes_Fee_Structure_2026.xlsx',
            notesJson: group.notes,
            lines: {
              create: group.lines.map((line) => ({
                tenantId,
                kind: line.kind,
                code: line.code,
                label: line.label,
                amount: line.amount,
                unspecified: Boolean(line.unspecified),
                remarks: line.remarks ?? null,
                sortOrder: line.sortOrder,
              })),
            },
          },
        });
      }
    }
  }
}

function withTotals<
  T extends {
    lines: Array<{ kind: string; amount: number | null }>;
    installments: Array<{ amount: number }>;
  },
>(row: T) {
  const annual = sumKind(row.lines, 'ANNUAL');
  const uniform = sumKind(row.lines, 'UNIFORM');
  const grand = annual + uniform;
  return {
    ...row,
    totals: {
      annual,
      uniform,
      grand,
      installments: row.installments.reduce((s, i) => s + i.amount, 0),
      printedGrandTotal: grand,
    },
  };
}

function sumKind(
  lines: Array<{ kind: string; amount: number | null }>,
  kind: string,
) {
  return lines
    .filter((l) => l.kind === kind)
    .reduce((s, l) => s + (l.amount ?? 0), 0);
}
