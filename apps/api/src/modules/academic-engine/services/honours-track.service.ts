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
  eligibilityOverrideReason?: string;
  aggregatePercentageAtSelection?: number;
};

export type HonoursTrackEligibility = {
  track: HonoursTrack;
  eligible: boolean;
  warning: string | null;
  blockReason: string | null;
  aggregatePercentageThroughSem6: number | null;
  eligibilityOverride: boolean;
  requiresOverride: boolean;
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
      eligibilityOverrideReason: track?.eligibilityOverrideReason ?? null,
      aggregatePercentageAtSelection:
        track?.aggregatePercentageAtSelection != null
          ? Number(track.aggregatePercentageAtSelection)
          : null,
      researchEligibilityPercent: HONOURS_RESEARCH_ELIGIBILITY_PERCENT,
      eligibility,
      record: track,
    };
  }

  /**
   * Research track is eligible only when attested Sem-6 aggregate >= 75%,
   * or an explicit principal override with reason is supplied.
   */
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
        blockReason: null,
        aggregatePercentageThroughSem6,
        eligibilityOverride,
        requiresOverride: false,
      };
    }

    if (eligibilityOverride) {
      return {
        track,
        eligible: true,
        warning: null,
        blockReason: null,
        aggregatePercentageThroughSem6,
        eligibilityOverride: true,
        requiresOverride: false,
      };
    }

    if (aggregatePercentageThroughSem6 == null) {
      return {
        track,
        eligible: false,
        warning: null,
        blockReason:
          'Aggregate percentage through Semester 6 is not recorded. Enter the NEHU-attested percentage before selecting Honours with Research.',
        aggregatePercentageThroughSem6: null,
        eligibilityOverride: false,
        requiresOverride: true,
      };
    }

    if (aggregatePercentageThroughSem6 < HONOURS_RESEARCH_ELIGIBILITY_PERCENT) {
      return {
        track,
        eligible: false,
        warning: null,
        blockReason: `Aggregate ${aggregatePercentageThroughSem6}% is below the NEHU ${HONOURS_RESEARCH_ELIGIBILITY_PERCENT}% threshold for Honours with Research. Principal override with reason is required.`,
        aggregatePercentageThroughSem6,
        eligibilityOverride: false,
        requiresOverride: true,
      };
    }

    return {
      track,
      eligible: true,
      warning: null,
      blockReason: null,
      aggregatePercentageThroughSem6,
      eligibilityOverride: false,
      requiresOverride: false,
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

    const wantsOverride =
      dto.track === 'HONOURS_WITH_RESEARCH' && Boolean(dto.eligibilityOverride);
    const overrideReason = dto.eligibilityOverrideReason?.trim() || null;

    if (wantsOverride && (!overrideReason || overrideReason.length < 5)) {
      throw new BadRequestException(
        'Principal override requires a reason (at least 5 characters) when selecting Honours with Research below the eligibility threshold.',
      );
    }

    const eligibility = this.evaluateEligibility(
      dto.track,
      aggregate,
      wantsOverride,
    );

    if (!eligibility.eligible) {
      throw new BadRequestException({
        message: eligibility.blockReason ?? 'Research track is not eligible',
        code: 'HONOURS_RESEARCH_NOT_ELIGIBLE',
        requiresOverride: eligibility.requiresOverride,
        aggregatePercentageThroughSem6: aggregate,
        researchEligibilityPercent: HONOURS_RESEARCH_ELIGIBILITY_PERCENT,
      });
    }

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
        eligibilityOverride: wantsOverride,
        eligibilityOverrideReason: wantsOverride ? overrideReason : null,
        selectedById: selectedById ?? null,
      },
      update: {
        track: dto.track,
        aggregatePercentageAtSelection:
          aggregate != null ? new Prisma.Decimal(aggregate.toFixed(2)) : null,
        eligibilityOverride: wantsOverride,
        eligibilityOverrideReason: wantsOverride ? overrideReason : null,
        selectedById: selectedById ?? null,
      },
    });

    return {
      track: saved.track as HonoursTrack,
      record: saved,
      eligibility,
    };
  }

  async updateAggregateThroughSem6(
    tenantId: string,
    studentId: string,
    aggregatePercentage: number,
  ) {
    if (
      !Number.isFinite(aggregatePercentage) ||
      aggregatePercentage < 0 ||
      aggregatePercentage > 100
    ) {
      throw new BadRequestException(
        'Aggregate percentage must be between 0 and 100',
      );
    }

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

  /** Ensure a Sem-8 track exists before registration auto-assign. */
  async assertTrackForSemester8(tenantId: string, studentId: string) {
    const track = await this.prisma.studentAcademicTrack.findUnique({
      where: {
        studentId_effectiveFromSemester: {
          studentId,
          effectiveFromSemester: 8,
        },
      },
    });
    if (!track) {
      throw new BadRequestException(
        'Select Semester 8 Honours pathway (UG Honours or Honours with Research) before registering subjects.',
      );
    }
    return track.track as HonoursTrack;
  }
}
