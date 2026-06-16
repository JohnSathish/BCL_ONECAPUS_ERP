import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateDepartmentSubmissionDto,
  ReviewDepartmentSubmissionDto,
} from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';

export type DepartmentScope = {
  scoped: boolean;
  departmentIds: string[];
  primaryDepartmentId?: string;
  isHod: boolean;
};

@Injectable()
export class NaacDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async resolveDepartmentScope(user: JwtUser): Promise<DepartmentScope> {
    if (user.permissions?.includes('naac-iqac:manage')) {
      return { scoped: false, departmentIds: [], isHod: false };
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true, departmentId: true },
    });

    const hodDepts = staff
      ? await this.prisma.department.findMany({
          where: { tenantId: user.tid, hodId: staff.id, deletedAt: null },
          select: { id: true },
        })
      : [];

    if (hodDepts.length > 0) {
      const ids = hodDepts.map((d) => d.id);
      return {
        scoped: true,
        departmentIds: ids,
        primaryDepartmentId: ids[0],
        isHod: true,
      };
    }

    if (
      user.dataScope &&
      !user.dataScope.allDepartments &&
      user.dataScope.departmentIds.length
    ) {
      return {
        scoped: true,
        departmentIds: user.dataScope.departmentIds,
        primaryDepartmentId: user.dataScope.departmentIds[0],
        isHod: false,
      };
    }

    if (staff?.departmentId) {
      return {
        scoped: true,
        departmentIds: [staff.departmentId],
        primaryDepartmentId: staff.departmentId,
        isHod: false,
      };
    }

    return { scoped: false, departmentIds: [], isHod: false };
  }

  private assertDepartmentAccess(scope: DepartmentScope, departmentId: string) {
    if (scope.scoped && !scope.departmentIds.includes(departmentId)) {
      throw new ForbiddenException('Department not in your scope');
    }
  }

  async dashboard(user: JwtUser, departmentId?: string) {
    const scope = await this.resolveDepartmentScope(user);
    let effectiveDeptId = departmentId;

    if (scope.scoped) {
      if (departmentId) this.assertDepartmentAccess(scope, departmentId);
      effectiveDeptId = departmentId ?? scope.primaryDepartmentId;
    }

    const submissionWhere: Record<string, unknown> = { tenantId: user.tid };
    if (scope.scoped && scope.departmentIds.length) {
      submissionWhere.departmentId = effectiveDeptId
        ? effectiveDeptId
        : { in: scope.departmentIds };
    } else if (effectiveDeptId) {
      submissionWhere.departmentId = effectiveDeptId;
    }

    const deptWhere: Record<string, unknown> = {
      tenantId: user.tid,
      deletedAt: null,
    };
    if (scope.scoped && scope.departmentIds.length) {
      deptWhere.id = { in: scope.departmentIds };
    }

    const [submissions, departments] = await Promise.all([
      this.db().naacDepartmentSubmission.findMany({
        where: submissionWhere,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.department.findMany({
        where: deptWhere,
        select: { id: true, name: true, code: true, hodId: true },
      }),
    ]);

    const submittedDeptIds = new Set(
      submissions
        .filter(
          (s: { status: string }) =>
            s.status === 'SUBMITTED' || s.status === 'APPROVED',
        )
        .map((s: { departmentId: string }) => s.departmentId),
    );

    return {
      scope,
      departments,
      submissions,
      pendingDepartments: departments.filter(
        (d) => !submittedDeptIds.has(d.id),
      ),
      submittedCount: submittedDeptIds.size,
      totalDepartments: departments.length,
    };
  }

  async listSubmissions(
    user: JwtUser,
    query: { status?: string; academicYear?: string },
  ) {
    const scope = await this.resolveDepartmentScope(user);
    const where: Record<string, unknown> = { tenantId: user.tid };
    if (scope.scoped && scope.departmentIds.length) {
      where.departmentId = { in: scope.departmentIds };
    }
    if (query.status) where.status = query.status;
    if (query.academicYear) where.academicYear = query.academicYear;

    return this.db().naacDepartmentSubmission.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async createSubmission(user: JwtUser, dto: CreateDepartmentSubmissionDto) {
    const scope = await this.resolveDepartmentScope(user);
    this.assertDepartmentAccess(scope, dto.departmentId);

    const status = dto.submit === false ? 'PENDING' : 'SUBMITTED';
    return this.db().naacDepartmentSubmission.create({
      data: {
        tenantId: user.tid,
        departmentId: dto.departmentId,
        academicYear: dto.academicYear,
        submissionType: dto.submissionType,
        payload: dto.payload ?? {},
        status,
        submittedById: status === 'SUBMITTED' ? user.sub : undefined,
      },
    });
  }

  async submitDraft(user: JwtUser, id: string) {
    const scope = await this.resolveDepartmentScope(user);
    const row = await this.db().naacDepartmentSubmission.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Submission not found');
    this.assertDepartmentAccess(scope, row.departmentId);
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Only pending drafts can be submitted');
    }
    return this.db().naacDepartmentSubmission.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedById: user.sub },
    });
  }

  async reviewSubmission(
    user: JwtUser,
    id: string,
    dto: ReviewDepartmentSubmissionDto,
  ) {
    const row = await this.db().naacDepartmentSubmission.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Submission not found');
    if (row.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted items can be reviewed');
    }
    if (!['APPROVED', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException(
        'Review status must be APPROVED or REJECTED',
      );
    }

    const payload = {
      ...((row.payload as Record<string, unknown>) ?? {}),
      ...(dto.reviewNotes ? { reviewNotes: dto.reviewNotes } : {}),
    };

    return this.db().naacDepartmentSubmission.update({
      where: { id },
      data: { status: dto.status, reviewedById: user.sub, payload },
    });
  }
}
