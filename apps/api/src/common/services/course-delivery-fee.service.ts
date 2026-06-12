import { Injectable } from '@nestjs/common';
import {
  isCourseDeliveryType,
  normalizeCourseDeliveryInput,
  type CourseDeliveryType,
} from '../constants/course-delivery';
import { PrismaService } from '../../database/prisma.service';

export type PracticalFeeLine = {
  ruleCode: string;
  ruleName: string;
  amount: number;
  currency: string;
  perCourse: boolean;
  courseCodes: string[];
};

export type RegistrationDeliveryFeePreview = {
  practicalCourseCount: number;
  coursesWithPractical: { code: string; title: string; deliveryType: string }[];
  feeLines: PracticalFeeLine[];
  totalPracticalFees: number;
  currency: string;
};

type CourseRow = {
  code: string;
  title: string;
  deliveryType: string;
  hasPractical: boolean;
};

@Injectable()
export class CourseDeliveryFeeService {
  constructor(private readonly prisma: PrismaService) {}

  async previewRegistrationFees(
    tenantId: string,
    courses: CourseRow[],
  ): Promise<RegistrationDeliveryFeePreview> {
    const practicalCourses = courses.filter((c) => c.hasPractical);
    const rules = await this.prisma.feeRule.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const feeLines: PracticalFeeLine[] = [];
    let currency = 'INR';

    for (const rule of rules) {
      currency = rule.currency;
      const deliveryTypes = this.parseDeliveryTypes(rule.deliveryTypes);
      if (deliveryTypes.length === 0) continue;

      const matched = practicalCourses.filter((c) =>
        deliveryTypes.includes(c.deliveryType as CourseDeliveryType),
      );
      if (matched.length === 0) continue;

      const metadata = (rule.metadata ?? {}) as Record<string, unknown>;
      const prefixes = Array.isArray(metadata.subjectPrefixes)
        ? (metadata.subjectPrefixes as string[])
        : null;

      const eligible = prefixes
        ? matched.filter((c) =>
            prefixes.some((p) =>
              c.code.toUpperCase().startsWith(p.toUpperCase()),
            ),
          )
        : matched;

      if (eligible.length === 0) continue;

      const amount = Number(rule.amount);
      if (rule.ruleType === 'PER_PRACTICAL_COURSE') {
        feeLines.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          amount: amount * eligible.length,
          currency: rule.currency,
          perCourse: true,
          courseCodes: eligible.map((c) => c.code),
        });
      } else if (rule.ruleType === 'FLAT') {
        feeLines.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          amount,
          currency: rule.currency,
          perCourse: false,
          courseCodes: eligible.map((c) => c.code),
        });
      }
    }

    const totalPracticalFees = feeLines.reduce((sum, l) => sum + l.amount, 0);

    return {
      practicalCourseCount: practicalCourses.length,
      coursesWithPractical: practicalCourses.map((c) => ({
        code: c.code,
        title: c.title,
        deliveryType: c.deliveryType,
      })),
      feeLines,
      totalPracticalFees,
      currency,
    };
  }

  async previewFromRegistration(
    tenantId: string,
    registrationId: string,
  ): Promise<RegistrationDeliveryFeePreview> {
    const reg = await this.prisma.semesterRegistration.findFirst({
      where: { id: registrationId, tenantId },
      include: {
        lines: {
          include: {
            offering: { include: { course: true } },
          },
        },
      },
    });
    if (!reg) {
      return {
        practicalCourseCount: 0,
        coursesWithPractical: [],
        feeLines: [],
        totalPracticalFees: 0,
        currency: 'INR',
      };
    }

    const seen = new Set<string>();
    const courses: CourseRow[] = [];
    for (const line of reg.lines) {
      const c = line.offering.course;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      courses.push({
        code: c.code,
        title: c.title,
        deliveryType: c.deliveryType,
        hasPractical: c.hasPractical,
      });
    }
    return this.previewRegistrationFees(tenantId, courses);
  }

  private parseDeliveryTypes(raw: unknown): CourseDeliveryType[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (v): v is CourseDeliveryType =>
        typeof v === 'string' && isCourseDeliveryType(v),
    );
  }
}

export function courseDeliveryDefaultsFromCredits(credits: number) {
  return normalizeCourseDeliveryInput({
    deliveryType: 'THEORY',
    theoryCredits: credits,
    practicalCredits: 0,
    theoryHoursPerWeek: 0,
    practicalHoursPerWeek: 0,
    credits,
  });
}
