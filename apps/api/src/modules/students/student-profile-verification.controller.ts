import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { buildInstitutionalExcelReport } from '../../common/reports';
import {
  BulkReviewProfileChangesDto,
  ProfileSoftGateSettingsDto,
  ProfileVerificationQueryDto,
  ReviewProfileChangeDto,
  UpsertProfileUpdatePolicyDto,
} from './dto/student-portal-profile.dto';
import { StudentProfileChangeRequestService } from './services/student-profile-change-request.service';
import { StudentProfileUpdatePolicyService } from './services/student-profile-update-policy.service';
import { PrismaService } from '../../database/prisma.service';

@ApiBearerAuth()
@ApiTags('student-profile-verification')
@Controller({ path: 'students/profile-verification', version: '1' })
export class StudentProfileVerificationController {
  constructor(
    private readonly changeRequests: StudentProfileChangeRequestService,
    private readonly policy: StudentProfileUpdatePolicyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('policy')
  @RequireAnyPermission(
    'students:profile-policy',
    'students:profile-verify',
    'students:manage',
  )
  getPolicy(@CurrentUser() user: JwtUser) {
    return this.policy.list(user.tid);
  }

  @Put('policy')
  @RequireAnyPermission('students:profile-policy', 'students:manage')
  updatePolicy(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertProfileUpdatePolicyDto,
  ) {
    return this.policy.upsertMany(user.tid, dto.rows);
  }

  @Get('pending')
  @RequireAnyPermission(
    'students:profile-verify',
    'students:verify-documents',
    'students:manage',
  )
  listPending(
    @CurrentUser() user: JwtUser,
    @Query() query: ProfileVerificationQueryDto,
  ) {
    return this.changeRequests.listRequests(user.tid, {
      status: query.status ?? 'PENDING',
      studentId: query.studentId,
      sectionKey: query.sectionKey,
      take: query.take,
    });
  }

  @Get('history')
  @RequireAnyPermission(
    'students:profile-verify',
    'students:read',
    'students:manage',
  )
  listHistory(
    @CurrentUser() user: JwtUser,
    @Query() query: ProfileVerificationQueryDto,
  ) {
    return this.changeRequests.listRequests(user.tid, {
      status: query.status,
      studentId: query.studentId,
      sectionKey: query.sectionKey,
      take: query.take ?? 300,
    });
  }

  @Get('class-xii')
  @RequireAnyPermission(
    'students:profile-verify',
    'students:verify-documents',
    'students:manage',
  )
  listClassXii(@CurrentUser() user: JwtUser) {
    return this.changeRequests.listRequests(user.tid, {
      sectionKey: 'class_xii',
      status: 'PENDING',
    });
  }

  @Get('documents')
  @RequireAnyPermission(
    'students:verify-documents',
    'students:profile-verify',
    'students:manage',
  )
  async listPendingDocuments(@CurrentUser() user: JwtUser) {
    return this.prisma.studentDocument.findMany({
      where: { tenantId: user.tid, verificationStatus: 'PENDING' },
      include: {
        student: {
          select: {
            id: true,
            rollNumber: true,
            enrollmentNumber: true,
            masterProfile: { select: { fullName: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Get('completion-dashboard')
  @RequireAnyPermission(
    'students:profile-verify',
    'students:read',
    'students:manage',
  )
  completionDashboard(@CurrentUser() user: JwtUser) {
    return this.changeRequests.completionDashboard(user.tid);
  }

  @Post('requests/:id/review')
  @RequireAnyPermission('students:profile-verify', 'students:manage')
  reviewRequest(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewProfileChangeDto,
  ) {
    return this.changeRequests.reviewRequest(user, id, dto.action, dto.remarks);
  }

  @Post('requests/bulk-review')
  @RequireAnyPermission('students:profile-verify', 'students:manage')
  bulkReview(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkReviewProfileChangesDto,
  ) {
    return this.changeRequests.bulkReviewRequests(
      user,
      dto.requestIds,
      dto.action,
      dto.remarks,
    );
  }

  @Get('soft-gates')
  @RequireAnyPermission(
    'students:profile-policy',
    'students:profile-verify',
    'students:manage',
  )
  getSoftGates(@CurrentUser() user: JwtUser) {
    return this.policy.getSoftGates(user.tid);
  }

  @Put('soft-gates')
  @RequireAnyPermission('students:profile-policy', 'students:manage')
  updateSoftGates(
    @CurrentUser() user: JwtUser,
    @Body() dto: ProfileSoftGateSettingsDto,
  ) {
    return this.policy.updateSoftGates(user.tid, dto);
  }

  @Post('items/:id/review')
  @RequireAnyPermission('students:profile-verify', 'students:manage')
  reviewItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewProfileChangeDto,
  ) {
    return this.changeRequests.reviewItem(user, id, dto.action, dto.remarks);
  }

  @Get('reports/:type')
  @RequireAnyPermission(
    'students:profile-verify',
    'students:export',
    'students:read',
    'students:manage',
  )
  async report(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ProfileVerificationQueryDto,
  ) {
    const report = await this.changeRequests.buildReport(user.tid, type);
    if (query.format === 'csv') {
      const keys = Object.keys(report.rows[0] ?? { note: 'empty' });
      const lines = [
        keys.join(','),
        ...report.rows.map((row) =>
          keys
            .map((k) => {
              const v = String(row[k] ?? '');
              return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
            })
            .join(','),
        ),
      ];
      return new StreamableFile(Buffer.from(`${lines.join('\n')}\n`, 'utf8'), {
        type: 'text/csv; charset=utf-8',
        disposition: `attachment; filename="${type}-profile-report.csv"`,
      });
    }
    if (query.format === 'xlsx') {
      const keys = Object.keys(report.rows[0] ?? { note: 'empty' });
      const built = await buildInstitutionalExcelReport({
        meta: { reportTitle: report.title },
        sheets: [
          {
            name: 'Report',
            columns: keys.map((k) => ({ key: k, label: k })),
            rows: report.rows,
          },
        ],
        filenameBase: `${type}-profile-report`,
      });
      return new StreamableFile(built.buffer, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: `attachment; filename="${built.filename}"`,
      });
    }
    return report;
  }
}
