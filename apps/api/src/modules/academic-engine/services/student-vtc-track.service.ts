import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  expectedVtcStageForSemester,
  resolveVtcTrackFields,
} from '../../../common/services/vtc-track-metadata';
import { PrismaService } from '../../../database/prisma.service';

const offeringInclude = {
  course: {
    select: {
      id: true,
      code: true,
      title: true,
      vtcTrackGroupCode: true,
      vtcTrackStage: true,
    },
  },
} as const;

@Injectable()
export class StudentVtcTrackService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrack(tenantId: string, studentId: string) {
    return this.prisma.studentVtcTrack.findFirst({
      where: { tenantId, studentId },
      include: {
        selectedSem3Offering: { include: offeringInclude },
        selectedSem4Offering: { include: offeringInclude },
        selectedSem6Offering: { include: offeringInclude },
      },
    });
  }

  async recordSelection(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
    offeringId: string,
  ) {
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: offeringId, tenantId, deletedAt: null, category: 'VTC' },
      include: offeringInclude,
    });
    if (!offering) {
      throw new BadRequestException('VTC offering not found');
    }

    const meta = resolveVtcTrackFields({
      code: offering.course.code,
      title: offering.course.title,
      vtcTrackGroupCode: offering.course.vtcTrackGroupCode,
      vtcTrackStage: offering.course.vtcTrackStage,
    });
    if (!meta.vtcTrackGroupCode) {
      throw new BadRequestException(
        `Course ${offering.course.code} has no VTC track group metadata`,
      );
    }

    const expectedStage = expectedVtcStageForSemester(semesterSequence);
    if (expectedStage != null && meta.vtcTrackStage !== expectedStage) {
      throw new ConflictException(
        `VTC course stage ${meta.vtcTrackStage ?? '?'} does not match semester ${semesterSequence} (expected stage ${expectedStage})`,
      );
    }

    const existing = await this.getTrack(tenantId, studentId);

    if (semesterSequence === 3) {
      return this.prisma.studentVtcTrack.upsert({
        where: { studentId },
        create: {
          tenantId,
          studentId,
          trackGroupCode: meta.vtcTrackGroupCode,
          selectedSem3OfferingId: offeringId,
          lockedAtSemester: 3,
        },
        update: {
          trackGroupCode: meta.vtcTrackGroupCode,
          selectedSem3OfferingId: offeringId,
        },
      });
    }

    if (!existing) {
      throw new ConflictException(
        'VTC track must be selected in Semester III first',
      );
    }
    if (existing.trackGroupCode !== meta.vtcTrackGroupCode) {
      throw new ConflictException(
        `VTC selection must continue track "${existing.trackGroupCode}", not "${meta.vtcTrackGroupCode}"`,
      );
    }

    const updateData =
      semesterSequence === 4
        ? { selectedSem4OfferingId: offeringId }
        : semesterSequence === 6
          ? { selectedSem6OfferingId: offeringId }
          : null;
    if (!updateData) {
      throw new BadRequestException(
        'VTC track continuity applies to semesters III, IV, and VI only',
      );
    }

    return this.prisma.studentVtcTrack.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  filterVtcSections<
    T extends {
      courseOffering: {
        course: {
          vtcTrackGroupCode: string | null;
          vtcTrackStage: number | null;
          code: string;
          title: string;
        };
      };
    },
  >(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
    sections: T[],
  ): Promise<T[]> {
    return this.filterVtcSectionsSync(
      tenantId,
      studentId,
      semesterSequence,
      sections,
    );
  }

  async filterVtcSectionsSync<
    T extends {
      courseOffering: {
        course: {
          vtcTrackGroupCode: string | null;
          vtcTrackStage: number | null;
          code: string;
          title: string;
        };
      };
    },
  >(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
    sections: T[],
  ): Promise<T[]> {
    const expectedStage = expectedVtcStageForSemester(semesterSequence);
    if (expectedStage == null) return sections;

    const track = await this.getTrack(tenantId, studentId);
    if (!track && semesterSequence === 3) return sections;
    if (!track) return [];

    return sections.filter((s) => {
      const meta = resolveVtcTrackFields({
        code: s.courseOffering.course.code,
        title: s.courseOffering.course.title,
        vtcTrackGroupCode: s.courseOffering.course.vtcTrackGroupCode,
        vtcTrackStage: s.courseOffering.course.vtcTrackStage,
      });
      return (
        meta.vtcTrackGroupCode === track.trackGroupCode &&
        meta.vtcTrackStage === expectedStage
      );
    });
  }

  async resetTrack(
    tenantId: string,
    studentId: string,
    userId: string,
    reason: string,
    opts?: { trackGroupCode?: string; sem3OfferingId?: string },
  ) {
    const existing = await this.getTrack(tenantId, studentId);
    if (!existing) throw new NotFoundException('VTC track not found');

    if (opts?.sem3OfferingId) {
      await this.recordSelection(tenantId, studentId, 3, opts.sem3OfferingId);
      return this.getTrack(tenantId, studentId);
    }

    return this.prisma.studentVtcTrack.update({
      where: { id: existing.id },
      data: {
        ...(opts?.trackGroupCode
          ? { trackGroupCode: opts.trackGroupCode }
          : {}),
        resetReason: reason.trim(),
        resetAt: new Date(),
        resetById: userId,
        selectedSem4OfferingId: null,
        selectedSem6OfferingId: null,
      },
    });
  }
}
