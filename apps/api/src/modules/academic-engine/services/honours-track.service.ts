import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  HONOURS_RESEARCH_ELIGIBILITY_PERCENT,
  type HonoursTrack,
} from '../domain/fyugp-templates';

export type SetHonoursTrackDto = {
  track: HonoursTrack;
  effectiveFromSemester?: number;
  eligibilityOverride?: boolean;
  aggregatePercentageAtSelection?: number;
};

export type HonoursTrackEligibility = {
  track: HonoursTrack;
  eligible: boolean;
  warning: string | null;
  aggregatePercentageThroughSem6: number | null;
  eligibilityOverride: boolean;
};

@Injectable()
export class HonoursTrackService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrack(
    tenantId: string,
    studentId: string,
    effectiveFromSemester = 8,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const track = await this.prisma.studentAcademicTrack.findUnique({
      where: {
        studentId_effectiveFromSemester: { studentId, effectiveFromSemester },
      },
    });
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });

    const aggregate =
      standing?.aggregatePercentageThroughSem6 != null
        ? Number(standing.aggregatePercentageThroughSem6)
        : null;

    const currentTrack = (track?.track ?? 'HONOURS') as HonoursTrack;
    const eligibility = this.evaluateEligibility(
      currentTrack,
      aggregate,
      track?.eligibilityOverride ?? false,
    );

    return {
      track: currentTrack,
      effectiveFromSemester,
      aggregatePercentageThroughSem6: aggregate,
      eligibilityOverride: track?.eligibilityOverride ?? false,
      aggregatePercentageAtSelection:
        track?.aggregatePercentageAtSelection != null
          ? Number(track.aggregatePercentageAtSelection)
          : null,
      eligibility,
      record: track,
    };
  }

  evaluateEligibility(
    track: HonoursTrack,
    aggregatePercentageThroughSem6: number | null,
    eligibilityOverride: boolean,
  ): HonoursTrackEligibility {
    if (track !== 'HONOURS_WITH_RESEARCH') {
      return {
        track,
        eligible: true,
        warning: null,
        aggregatePercentageThroughSem6,
        eligibilityOverride,
      };
    }

    if (eligibilityOverride) {
      return {
        track,
        eligible: true,
        warning: null,
        aggregatePercentageThroughSem6,
        eligibilityOverride: true,
      };
    }

    if (aggregatePercentageThroughSem6 == null) {
      return {
        track,
        eligible: true,
        warning:
          'Aggregate percentage through Semester 6 is not recorded. Research track selection is allowed with admin acknowledgment.',
        aggregatePercentageThroughSem6: null,
        eligibilityOverride: false,
      };
    }

    if (aggregatePercentageThroughSem6 < HONOURS_RESEARCH_ELIGIBILITY_PERCENT) {
      return {
        track,
        eligible: true,
        warning: `Aggregate ${aggregatePercentageThroughSem6}% is below the recommended ${HONOURS_RESEARCH_ELIGIBILITY_PERCENT}% for Honours with Research. Admin override may be required.`,
        aggregatePercentageThroughSem6,
        eligibilityOverride: false,
      };
    }

    return {
      track,
      eligible: true,
      warning: null,
      aggregatePercentageThroughSem6,
      eligibilityOverride: false,
    };
  }

  async setTrack(
    tenantId: string,
    studentId: string,
    dto: SetHonoursTrackDto,
    selectedById?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (dto.track !== 'HONOURS' && dto.track !== 'HONOURS_WITH_RESEARCH') {
      throw new BadRequestException('Invalid honours track');
    }

    const effectiveFromSemester = dto.effectiveFromSemester ?? 8;
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    const aggregate =
      dto.aggregatePercentageAtSelection ??
      (standing?.aggregatePercentageThroughSem6 != null
        ? Number(standing.aggregatePercentageThroughSem6)
        : null);

    const eligibility = this.evaluateEligibility(
      dto.track,
      aggregate,
      dto.eligibilityOverride ?? false,
    );

    const saved = await this.prisma.studentAcademicTrack.upsert({
      where: {
        studentId_effectiveFromSemester: { studentId, effectiveFromSemester },
      },
      create: {
        tenantId,
        studentId,
        track: dto.track,
        effectiveFromSemester,
        aggregatePercentageAtSelection:
          aggregate != null ? new Prisma.Decimal(aggregate.toFixed(2)) : null,
        eligibilityOverride: dto.eligibilityOverride ?? false,
        selectedById: selectedById ?? null,
      },
      update: {
        track: dto.track,
        aggregatePercentageAtSelection:
          aggregate != null ? new Prisma.Decimal(aggregate.toFixed(2)) : null,
        eligibilityOverride: dto.eligibilityOverride ?? false,
        selectedById: selectedById ?? null,
      },
    });

    return {
      record: saved,
      eligibility,
    };
  }

  async updateAggregateThroughSem6(
    tenantId: string,
    studentId: string,
    aggregatePercentage: number,
  ) {
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    if (!standing || standing.tenantId !== tenantId) {
      throw new NotFoundException('Student academic standing not found');
    }

    return this.prisma.studentAcademicStanding.update({
      where: { studentId },
      data: {
        aggregatePercentageThroughSem6: new Prisma.Decimal(
          aggregatePercentage.toFixed(2),
        ),
      },
    });
  }
}
