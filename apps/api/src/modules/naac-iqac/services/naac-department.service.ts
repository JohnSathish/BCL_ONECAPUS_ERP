import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateDepartmentSubmissionDto,
  ReviewDepartmentSubmissionDto,
} from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async dashboard(tenantId: string, departmentId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (departmentId) where.departmentId = departmentId;

    const [submissions, departments] = await Promise.all([
      this.db().naacDepartmentSubmission.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
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
      departments,
      submissions,
      pendingDepartments: departments.filter(
        (d) => !submittedDeptIds.has(d.id),
      ),
      submittedCount: submittedDeptIds.size,
      totalDepartments: departments.length,
    };
  }

  async createSubmission(user: JwtUser, dto: CreateDepartmentSubmissionDto) {
    return this.db().naacDepartmentSubmission.create({
      data: {
        tenantId: user.tid,
        departmentId: dto.departmentId,
        academicYear: dto.academicYear,
        submissionType: dto.submissionType,
        payload: dto.payload ?? {},
        status: 'SUBMITTED',
        submittedById: user.sub,
      },
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
    return this.db().naacDepartmentSubmission.update({
      where: { id },
      data: { status: dto.status, reviewedById: user.sub },
    });
  }
}
