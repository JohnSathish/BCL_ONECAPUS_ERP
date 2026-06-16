import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type {
  CreateTeachingSubjectGroupDto,
  LinkTeachingSubjectGroupPaperDto,
  SyncTeachingSubjectGroupsDto,
  TeachingSubjectGroupQueryDto,
  UpdateTeachingSubjectGroupDto,
} from './dto/teaching-subject-group.dto';

const GROUP_INCLUDE = {
  academicSubject: { select: { id: true, slug: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  primaryStaffProfile: {
    select: { id: true, fullName: true, shortCode: true, employeeCode: true },
  },
  offeringSection: { select: { id: true, sectionCode: true } },
  papers: {
    orderBy: [{ paperIndex: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      course: {
        select: { id: true, code: true, title: true, subjectSlug: true },
      },
      offeringSection: { select: { id: true, sectionCode: true } },
    },
  },
};

@Injectable()
export class TeachingSubjectGroupService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: TeachingSubjectGroupQueryDto) {
    return (this.prisma as any).teachingSubjectGroup.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.semesterNo ? { semesterNo: query.semesterNo } : {}),
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(query.fyugpCategory
          ? { fyugpCategory: query.fyugpCategory.toUpperCase() }
          : {}),
        ...(query.academicSubjectId
          ? { academicSubjectId: query.academicSubjectId }
          : {}),
      },
      include: GROUP_INCLUDE,
      orderBy: [
        { semesterNo: 'asc' },
        { fyugpCategory: 'asc' },
        { title: 'asc' },
      ],
      take: 500,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await (this.prisma as any).teachingSubjectGroup.findFirst({
      where: { tenantId, id, deletedAt: null },
      include: GROUP_INCLUDE,
    });
    if (!row) throw new NotFoundException('Teaching subject group not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateTeachingSubjectGroupDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await (this.prisma as any).teachingSubjectGroup.findFirst({
      where: { tenantId: user.tid, code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Subject group code ${code} already exists`,
      );
    }

    const group = await (this.prisma as any).teachingSubjectGroup.create({
      data: {
        tenantId: user.tid,
        institutionId: dto.institutionId,
        code,
        title: dto.title.trim(),
        academicSubjectId: dto.academicSubjectId,
        academicYearId: dto.academicYearId,
        semesterNo: dto.semesterNo,
        shiftId: dto.shiftId,
        fyugpCategory: dto.fyugpCategory.toUpperCase(),
        departmentId: dto.departmentId,
        primaryStaffProfileId: dto.primaryStaffProfileId,
        offeringSectionId: dto.offeringSectionId,
        status: 'ACTIVE',
      },
    });

    if (dto.courseIds?.length) {
      await this.linkPapers(user.tid, group.id, dto.courseIds);
    }

    return this.get(user.tid, group.id);
  }

  async update(user: JwtUser, id: string, dto: UpdateTeachingSubjectGroupDto) {
    await this.get(user.tid, id);
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await (this.prisma as any).teachingSubjectGroup.findFirst({
        where: { tenantId: user.tid, code, deletedAt: null, NOT: { id } },
      });
      if (clash) {
        throw new BadRequestException(
          `Subject group code ${code} already exists`,
        );
      }
    }
    await (this.prisma as any).teachingSubjectGroup.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.semesterNo !== undefined ? { semesterNo: dto.semesterNo } : {}),
        ...(dto.fyugpCategory
          ? { fyugpCategory: dto.fyugpCategory.toUpperCase() }
          : {}),
        academicSubjectId: dto.academicSubjectId,
        academicYearId: dto.academicYearId,
        shiftId: dto.shiftId,
        departmentId: dto.departmentId,
        primaryStaffProfileId: dto.primaryStaffProfileId,
        offeringSectionId: dto.offeringSectionId,
        status: dto.status,
      },
    });
    return this.get(user.tid, id);
  }

  async remove(user: JwtUser, id: string) {
    await this.get(user.tid, id);
    await (this.prisma as any).teachingSubjectGroup.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return { ok: true };
  }

  async addPaper(
    user: JwtUser,
    groupId: string,
    dto: LinkTeachingSubjectGroupPaperDto,
  ) {
    await this.get(user.tid, groupId);
    await (this.prisma as any).teachingSubjectGroupPaper.upsert({
      where: {
        teachingSubjectGroupId_courseId: {
          teachingSubjectGroupId: groupId,
          courseId: dto.courseId,
        },
      },
      create: {
        tenantId: user.tid,
        teachingSubjectGroupId: groupId,
        courseId: dto.courseId,
        paperIndex: dto.paperIndex,
        offeringSectionId: dto.offeringSectionId,
      },
      update: {
        paperIndex: dto.paperIndex,
        offeringSectionId: dto.offeringSectionId,
      },
    });
    return this.get(user.tid, groupId);
  }

  async removePaper(user: JwtUser, groupId: string, courseId: string) {
    await this.get(user.tid, groupId);
    await (this.prisma as any).teachingSubjectGroupPaper.deleteMany({
      where: { teachingSubjectGroupId: groupId, courseId },
    });
    return this.get(user.tid, groupId);
  }

  /** Build subject groups from registered offerings grouped by subject slug + category. */
  async syncFromSemester(user: JwtUser, dto: SyncTeachingSubjectGroupsDto) {
    const categoryFilter = dto.fyugpCategory?.toUpperCase();
    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        semesterSequence: dto.semesterNo,
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            subjectSlug: true,
            departmentId: true,
          },
        },
        sections: {
          where: {
            deletedAt: null,
            ...(dto.shiftId ? { shiftId: dto.shiftId } : {}),
          },
          take: 1,
        },
      },
      take: 1000,
    });

    const buckets = new Map<
      string,
      {
        subjectSlug: string;
        category: string;
        departmentId?: string | null;
        courses: Array<{
          id: string;
          code: string;
          title: string;
          offeringSectionId?: string;
        }>;
      }
    >();

    for (const offering of offerings) {
      const course = offering.course;
      if (!course) continue;
      const slug =
        course.subjectSlug ??
        course.code.split('-')[0]?.toLowerCase() ??
        'general';
      const category = (offering.category ?? 'MAJOR').toUpperCase();
      const key = `${category}:${slug}:${dto.semesterNo}`;
      const bucket = buckets.get(key) ?? {
        subjectSlug: slug,
        category,
        departmentId: course.departmentId,
        courses: [],
      };
      bucket.courses.push({
        id: course.id,
        code: course.code,
        title: course.title,
        offeringSectionId: offering.sections[0]?.id,
      });
      buckets.set(key, bucket);
    }

    let created = 0;
    let updated = 0;

    for (const bucket of buckets.values()) {
      if (!bucket.courses.length) continue;
      const subject = await (this.prisma as any).academicSubject.findFirst({
        where: {
          tenantId: user.tid,
          slug: bucket.subjectSlug,
          deletedAt: null,
        },
      });
      const label = this.groupTitle(
        bucket.category,
        subject?.name ?? bucket.subjectSlug,
      );
      const code = `${bucket.category}-${bucket.subjectSlug.toUpperCase().replace(/[^A-Z0-9]/g, '')}-S${dto.semesterNo}`;
      const existing = await (
        this.prisma as any
      ).teachingSubjectGroup.findFirst({
        where: { tenantId: user.tid, code, deletedAt: null },
      });

      let groupId: string;
      if (existing) {
        groupId = existing.id;
        await (this.prisma as any).teachingSubjectGroup.update({
          where: { id: groupId },
          data: {
            title: label,
            academicSubjectId: subject?.id ?? existing.academicSubjectId,
            departmentId: bucket.departmentId ?? existing.departmentId,
            academicYearId: dto.academicYearId ?? existing.academicYearId,
            shiftId: dto.shiftId ?? existing.shiftId,
          },
        });
        updated += 1;
      } else {
        const createdGroup = await (
          this.prisma as any
        ).teachingSubjectGroup.create({
          data: {
            tenantId: user.tid,
            code,
            title: label,
            academicSubjectId: subject?.id,
            academicYearId: dto.academicYearId,
            semesterNo: dto.semesterNo,
            shiftId: dto.shiftId,
            fyugpCategory: bucket.category,
            departmentId: bucket.departmentId,
            offeringSectionId: bucket.courses[0]?.offeringSectionId,
            status: 'ACTIVE',
          },
        });
        groupId = createdGroup.id;
        created += 1;
      }

      await this.linkPapers(
        user.tid,
        groupId,
        bucket.courses.map((c) => c.id),
        bucket.courses,
      );
    }

    return { created, updated, buckets: buckets.size };
  }

  async resolveEntryLinks(
    tenantId: string,
    teachingSubjectGroupId?: string | null,
    courseId?: string | null,
    offeringSectionId?: string | null,
    staffProfileId?: string | null,
  ) {
    if (!teachingSubjectGroupId) {
      return { courseId, offeringSectionId, staffProfileId };
    }
    const group = await (this.prisma as any).teachingSubjectGroup.findFirst({
      where: { tenantId, id: teachingSubjectGroupId, deletedAt: null },
      include: {
        papers: { orderBy: [{ paperIndex: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!group) throw new NotFoundException('Teaching subject group not found');

    const primaryPaper = group.papers[0];
    return {
      courseId: courseId ?? primaryPaper?.courseId ?? null,
      offeringSectionId:
        offeringSectionId ??
        group.offeringSectionId ??
        primaryPaper?.offeringSectionId ??
        null,
      staffProfileId: staffProfileId ?? group.primaryStaffProfileId ?? null,
      teachingSubjectGroupId: group.id,
    };
  }

  async studentsForGroup(
    tenantId: string,
    groupId: string,
    semesterNo?: number | null,
  ) {
    const group = await this.get(tenantId, groupId);
    const seen = new Map<string, any>();

    const addStudents = (rows: any[]) => {
      for (const student of rows) {
        if (!seen.has(student.id)) seen.set(student.id, student);
      }
    };

    if (group.offeringSectionId) {
      addStudents(
        await this.studentsForSection(
          tenantId,
          group.offeringSectionId,
          semesterNo,
        ),
      );
    }

    for (const paper of group.papers ?? []) {
      if (paper.offeringSectionId) {
        addStudents(
          await this.studentsForSection(
            tenantId,
            paper.offeringSectionId,
            semesterNo,
          ),
        );
      }
    }

    if (
      !seen.size &&
      group.academicSubjectId &&
      ['MAJOR', 'MINOR'].includes(String(group.fyugpCategory).toUpperCase())
    ) {
      const field =
        group.fyugpCategory === 'MINOR' ? 'minorSubjectId' : 'majorSubjectId';
      const tracks = await (this.prisma as any).studentMajorMinorTrack.findMany(
        {
          where: {
            tenantId,
            [field]: group.academicSubjectId,
          },
          include: {
            student: {
              include: {
                masterProfile: true,
                user: { select: { displayName: true } },
              },
            },
          },
          take: 500,
        },
      );
      if (semesterNo) {
        const registrations = await this.prisma.semesterRegistration.findMany({
          where: {
            tenantId,
            semesterSequence: semesterNo,
            studentId: { in: tracks.map((t: any) => t.studentId) },
            status: {
              in: ['approved', 'confirmed', 'registered', 'submitted'],
            },
          },
          select: { studentId: true },
        });
        const allowed = new Set(registrations.map((r) => r.studentId));
        addStudents(
          tracks
            .filter((t: any) => allowed.has(t.studentId))
            .map((t: any) => t.student),
        );
      } else {
        addStudents(tracks.map((t: any) => t.student));
      }
    }

    return [...seen.values()];
  }

  async linkedPaperIds(tenantId: string, groupId: string) {
    const papers = await (
      this.prisma as any
    ).teachingSubjectGroupPaper.findMany({
      where: { tenantId, teachingSubjectGroupId: groupId },
      select: { courseId: true, offeringSectionId: true },
    });
    return papers;
  }

  async findByCode(tenantId: string, code: string) {
    return (this.prisma as any).teachingSubjectGroup.findFirst({
      where: {
        tenantId,
        code: code.trim().toUpperCase(),
        deletedAt: null,
      },
      include: {
        papers: { orderBy: [{ paperIndex: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async findForCourse(tenantId: string, courseId: string, semesterNo?: number) {
    const paper = await (
      this.prisma as any
    ).teachingSubjectGroupPaper.findFirst({
      where: { tenantId, courseId },
      include: { teachingSubjectGroup: true },
    });
    const group = paper?.teachingSubjectGroup;
    if (!group || group.deletedAt) return null;
    if (semesterNo && group.semesterNo !== semesterNo) return null;
    return group;
  }

  private async linkPapers(
    tenantId: string,
    groupId: string,
    courseIds: string[],
    meta?: Array<{ id: string; offeringSectionId?: string }>,
  ) {
    const unique = [...new Set(courseIds)];
    for (let i = 0; i < unique.length; i += 1) {
      const courseId = unique[i];
      const offeringSectionId = meta?.find(
        (m) => m.id === courseId,
      )?.offeringSectionId;
      await (this.prisma as any).teachingSubjectGroupPaper.upsert({
        where: {
          teachingSubjectGroupId_courseId: {
            teachingSubjectGroupId: groupId,
            courseId,
          },
        },
        create: {
          tenantId,
          teachingSubjectGroupId: groupId,
          courseId,
          paperIndex: i + 1,
          offeringSectionId,
        },
        update: {
          paperIndex: i + 1,
          offeringSectionId,
        },
      });
    }
  }

  private async studentsForSection(
    tenantId: string,
    offeringSectionId: string,
    semesterNo?: number | null,
  ) {
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringSectionId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: {
          ...(semesterNo ? { semesterSequence: semesterNo } : {}),
        },
      },
      include: {
        registration: {
          include: {
            student: {
              include: {
                masterProfile: true,
                user: { select: { displayName: true } },
              },
            },
          },
        },
      },
      take: 500,
    });
    return lines.map((line) => line.registration.student);
  }

  private groupTitle(category: string, subjectName: string) {
    const pretty = subjectName
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    if (category === 'MAJOR') return `Major ${pretty}`;
    if (category === 'MINOR') return `Minor ${pretty}`;
    return `${category} ${pretty}`;
  }
}
