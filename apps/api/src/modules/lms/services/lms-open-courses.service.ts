import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { MoodleAuthService } from '../../moodle/moodle-auth.service';
import {
  CreateLmsOpenCourseDto,
  LmsOpenCourseListQueryDto,
  UpdateLmsOpenCourseDto,
} from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';

@Injectable()
export class LmsOpenCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly moodleAuth: MoodleAuthService,
  ) {}

  private assertVisibilityRules(visibility: string, programId?: string | null) {
    if (visibility === 'PROGRAMME' && !programId) {
      throw new BadRequestException(
        'programId is required when visibility is PROGRAMME',
      );
    }
    if (visibility === 'COLLEGE' && programId) {
      throw new BadRequestException(
        'programId must be empty when visibility is COLLEGE',
      );
    }
  }

  async listAdmin(tenantId: string, query: LmsOpenCourseListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.stream ? { stream: query.stream } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              {
                description: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.lmsOpenCourse.count({ where }),
      this.prisma.lmsOpenCourse.findMany({
        where,
        include: {
          program: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(tenantId: string, dto: CreateLmsOpenCourseDto) {
    this.assertVisibilityRules(dto.visibility, dto.programId ?? null);
    if (dto.visibility === 'PROGRAMME' && dto.programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: dto.programId, tenantId, deletedAt: null },
      });
      if (!program) throw new BadRequestException('Program not found');
    }

    return this.prisma.lmsOpenCourse.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        stream: dto.stream,
        visibility: dto.visibility,
        programId: dto.visibility === 'PROGRAMME' ? dto.programId! : null,
        moodleCourseId: dto.moodleCourseId,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateLmsOpenCourseDto) {
    const existing = await this.prisma.lmsOpenCourse.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Open course not found');

    const visibility = dto.visibility ?? existing.visibility;
    const programId =
      dto.programId !== undefined ? dto.programId : existing.programId;
    this.assertVisibilityRules(visibility, programId);

    if (visibility === 'PROGRAMME' && programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: programId, tenantId, deletedAt: null },
      });
      if (!program) throw new BadRequestException('Program not found');
    }

    return this.prisma.lmsOpenCourse.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.stream !== undefined ? { stream: dto.stream } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        programId: visibility === 'COLLEGE' ? null : programId,
        ...(dto.moodleCourseId !== undefined
          ? { moodleCourseId: dto.moodleCourseId }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async softDelete(tenantId: string, id: string) {
    const existing = await this.prisma.lmsOpenCourse.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Open course not found');
    await this.prisma.lmsOpenCourse.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return { ok: true };
  }

  private async resolveStudentProgramId(user: JwtUser) {
    const studentId = await this.access.getStudentId(user);
    if (!studentId) return null;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
      select: {
        programVersion: { select: { programId: true } },
      },
    });
    return student?.programVersion?.programId ?? null;
  }

  async listForPortal(user: JwtUser) {
    const programId = await this.resolveStudentProgramId(user);
    const rows = await this.prisma.lmsOpenCourse.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { visibility: 'COLLEGE' },
          ...(programId ? [{ visibility: 'PROGRAMME', programId }] : []),
        ],
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ stream: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    });
    return { courses: rows, programId };
  }

  async launchForPortal(user: JwtUser, openCourseId: string) {
    const programId = await this.resolveStudentProgramId(user);
    const course = await this.prisma.lmsOpenCourse.findFirst({
      where: {
        id: openCourseId,
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { visibility: 'COLLEGE' },
          ...(programId
            ? [{ visibility: 'PROGRAMME' as const, programId }]
            : []),
        ],
      },
    });
    if (!course) throw new NotFoundException('Open course not found');

    const url = await this.moodleAuth.buildLaunchUrl({
      tenantId: user.tid,
      userId: user.sub,
      moodleCourseId: course.moodleCourseId,
    });
    return { url, moodleCourseId: course.moodleCourseId, title: course.title };
  }
}
