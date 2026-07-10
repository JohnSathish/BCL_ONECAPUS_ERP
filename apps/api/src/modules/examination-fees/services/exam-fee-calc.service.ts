import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ENROLLED_REG_STATUSES,
  EXAM_FEE_HEAD_CODES,
  EXAM_PAPER_TYPES,
  type ExamPaperType,
} from '../constants/exam-fee.constants';
import {
  allowedBacklogSemesters,
  resolveExamPaperType,
  roundMoney,
  toNumber,
} from '../utils/exam-fee.util';
import { ExamFeeMasterService } from './exam-fee-master.service';

export type FeeLinePreview = {
  headCode: string;
  headName: string;
  amount: number;
  quantity: number;
  unitAmount: number;
};

export type CurrentSubjectPreview = {
  courseId: string | null;
  subjectCode: string;
  subjectName: string;
  examPaperType: ExamPaperType;
  amount: number;
};

export type BackPaperInput = {
  semesterNo: number;
  subjectCode: string;
  subjectName: string;
  examPaperType: ExamPaperType;
};

@Injectable()
export class ExamFeeCalcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masters: ExamFeeMasterService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private rateMap(
    lines: Array<{ headCode: string; amount: unknown; headName: string }>,
  ) {
    const map = new Map<string, { amount: number; headName: string }>();
    for (const line of lines) {
      map.set(line.headCode, {
        amount: toNumber(line.amount),
        headName: line.headName,
      });
    }
    return map;
  }

  async loadStudentContext(tenantId: string, studentId: string) {
    const student = await this.db().student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        user: { select: { fullName: true, email: true } },
        academicStanding: {
          select: { currentSemesterSequence: true },
        },
      },
    });
    if (!student) {
      throw new BadRequestException('Student not found');
    }

    const semesterNo = student.academicStanding?.currentSemesterSequence ?? 1;

    return {
      student,
      semesterNo: Number(semesterNo) || 1,
      departmentId: student.departmentId ?? student.department?.id ?? null,
      departmentName: student.department?.name ?? null,
    };
  }

  async loadCurrentSubjects(
    tenantId: string,
    studentId: string,
    semesterNo: number,
    rates: Map<string, { amount: number; headName: string }>,
  ): Promise<CurrentSubjectPreview[]> {
    const registration = await this.db().semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId,
        OR: [
          { semesterSequence: semesterNo },
          { semester: { semesterNumber: semesterNo } },
        ],
      },
      include: {
        lines: {
          where: { status: { in: [...ENROLLED_REG_STATUSES] } },
          include: {
            offering: {
              include: {
                course: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    deliveryType: true,
                    hasPractical: true,
                    examPaperType: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const subjects: CurrentSubjectPreview[] = [];
    for (const line of registration?.lines ?? []) {
      const course = line.offering?.course;
      if (!course) continue;
      const examPaperType = resolveExamPaperType(course);
      const headCode =
        examPaperType === EXAM_PAPER_TYPES.THEORY_PRACTICAL
          ? EXAM_FEE_HEAD_CODES.CURRENT_THEORY_PRACTICAL
          : EXAM_FEE_HEAD_CODES.CURRENT_THEORY;
      const rate = rates.get(headCode)?.amount ?? 0;
      subjects.push({
        courseId: course.id,
        subjectCode: course.code,
        subjectName: course.title,
        examPaperType,
        amount: roundMoney(rate),
      });
    }
    return subjects;
  }

  validateBackPaper(semesterCycle: string, paper: BackPaperInput): void {
    const allowed = allowedBacklogSemesters(semesterCycle);
    if (!allowed.includes(paper.semesterNo)) {
      throw new BadRequestException(
        `Back paper semester ${paper.semesterNo} is not allowed for ${semesterCycle} semester examination. Allowed: ${allowed.join(', ')}.`,
      );
    }
  }

  backPaperAmount(
    rates: Map<string, { amount: number; headName: string }>,
    examPaperType: ExamPaperType,
  ): number {
    const headCode =
      examPaperType === EXAM_PAPER_TYPES.THEORY_PRACTICAL
        ? EXAM_FEE_HEAD_CODES.BACK_THEORY_PRACTICAL
        : EXAM_FEE_HEAD_CODES.BACK_THEORY;
    return roundMoney(rates.get(headCode)?.amount ?? 0);
  }

  async calculate(params: {
    tenantId: string;
    studentId: string;
    semesterCycle: string;
    lateFeeDate?: Date | null;
    backPapers?: BackPaperInput[];
    currentSubjects?: CurrentSubjectPreview[];
  }) {
    const master = await this.masters.getActiveMaster(params.tenantId);
    const rates = this.rateMap(master.lines);
    const ctx = await this.loadStudentContext(
      params.tenantId,
      params.studentId,
    );

    const currentSubjects =
      params.currentSubjects ??
      (await this.loadCurrentSubjects(
        params.tenantId,
        params.studentId,
        ctx.semesterNo,
        rates,
      ));

    const backPapers = params.backPapers ?? [];
    for (const paper of backPapers) {
      this.validateBackPaper(params.semesterCycle, paper);
    }

    const paperFees = currentSubjects.reduce((sum, s) => sum + s.amount, 0);
    const semesterExamFee =
      rates.get(EXAM_FEE_HEAD_CODES.SEMESTER_EXAM_FEE)?.amount ?? 0;
    const currentSemesterFee = roundMoney(paperFees + semesterExamFee);

    const pricedBack = backPapers.map((p) => ({
      ...p,
      amount: this.backPaperAmount(rates, p.examPaperType),
    }));
    const backPaperFee = roundMoney(
      pricedBack.reduce((sum, p) => sum + p.amount, 0),
    );

    const processingFee =
      rates.get(EXAM_FEE_HEAD_CODES.PROCESSING_FEE)?.amount ?? 0;

    let lateFee = 0;
    if (params.lateFeeDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lateFrom = new Date(params.lateFeeDate);
      lateFrom.setHours(0, 0, 0, 0);
      if (today >= lateFrom) {
        lateFee = rates.get(EXAM_FEE_HEAD_CODES.LATE_FEE)?.amount ?? 0;
      }
    }

    const breakdown: FeeLinePreview[] = [
      {
        headCode: EXAM_FEE_HEAD_CODES.SEMESTER_EXAM_FEE,
        headName:
          rates.get(EXAM_FEE_HEAD_CODES.SEMESTER_EXAM_FEE)?.headName ??
          'Semester Examination Fee',
        amount: roundMoney(semesterExamFee),
        quantity: 1,
        unitAmount: roundMoney(semesterExamFee),
      },
      ...currentSubjects.map((s) => ({
        headCode:
          s.examPaperType === EXAM_PAPER_TYPES.THEORY_PRACTICAL
            ? EXAM_FEE_HEAD_CODES.CURRENT_THEORY_PRACTICAL
            : EXAM_FEE_HEAD_CODES.CURRENT_THEORY,
        headName: `${s.subjectCode} (${s.examPaperType === EXAM_PAPER_TYPES.THEORY_PRACTICAL ? 'Theory + Practical' : 'Theory'})`,
        amount: s.amount,
        quantity: 1,
        unitAmount: s.amount,
      })),
      ...pricedBack.map((p) => ({
        headCode:
          p.examPaperType === EXAM_PAPER_TYPES.THEORY_PRACTICAL
            ? EXAM_FEE_HEAD_CODES.BACK_THEORY_PRACTICAL
            : EXAM_FEE_HEAD_CODES.BACK_THEORY,
        headName: `Back ${p.subjectCode} (Sem ${p.semesterNo})`,
        amount: p.amount,
        quantity: 1,
        unitAmount: p.amount,
      })),
      {
        headCode: EXAM_FEE_HEAD_CODES.PROCESSING_FEE,
        headName:
          rates.get(EXAM_FEE_HEAD_CODES.PROCESSING_FEE)?.headName ??
          'Processing Fee',
        amount: roundMoney(processingFee),
        quantity: 1,
        unitAmount: roundMoney(processingFee),
      },
    ];

    if (lateFee > 0) {
      breakdown.push({
        headCode: EXAM_FEE_HEAD_CODES.LATE_FEE,
        headName:
          rates.get(EXAM_FEE_HEAD_CODES.LATE_FEE)?.headName ?? 'Late Fee',
        amount: roundMoney(lateFee),
        quantity: 1,
        unitAmount: roundMoney(lateFee),
      });
    }

    const totalFee = roundMoney(
      currentSemesterFee + backPaperFee + processingFee + lateFee,
    );

    return {
      context: ctx,
      currentSubjects,
      backPapers: pricedBack,
      currentSemesterFee,
      backPaperFee,
      processingFee: roundMoney(processingFee),
      lateFee: roundMoney(lateFee),
      totalFee,
      breakdown,
      masterId: master.id as string,
    };
  }
}
