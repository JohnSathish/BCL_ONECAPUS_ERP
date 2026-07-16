import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { AlumniDocumentsService } from './services/alumni-documents.service';
import { AlumniService } from './services/alumni.service';

@ApiBearerAuth()
@ApiTags('alumni')
@RequireModule('alumni')
@Controller({ path: 'alumni', version: '1' })
export class AlumniController {
  constructor(
    private readonly alumni: AlumniService,
    private readonly alumniDocuments: AlumniDocumentsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.alumni.adminDashboard(user.tid);
  }

  @Get('profiles')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  listProfiles(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('graduationYear') graduationYear?: string,
    @Query('status') status?: string,
  ) {
    return this.alumni.list(user.tid, {
      q,
      status,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
    });
  }

  @Get()
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  list(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('graduationYear') graduationYear?: string,
    @Query('status') status?: string,
  ) {
    return this.alumni.list(user.tid, {
      q,
      status,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
    });
  }

  @Get('events')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  listEvents(@CurrentUser() user: JwtUser) {
    return this.alumni.listAdminEvents(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  settings(@CurrentUser() user: JwtUser) {
    return this.alumni.getPortalInfo(user.tid);
  }

  @Post('events')
  @RequirePermissions('alumni:manage')
  createEvent(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      title: string;
      summary?: string;
      description?: string;
      eventType?: string;
      venue?: string;
      startsAt: string;
      endsAt?: string;
      isPublished?: boolean;
      coverUrl?: string;
    },
  ) {
    return this.alumni.createEvent(user, body);
  }

  @Post('events/:id/publish')
  @RequirePermissions('alumni:manage')
  publishEvent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { isPublished?: boolean },
  ) {
    return this.alumni.setEventPublished(user, id, body.isPublished !== false);
  }

  @Post('events/:id/unpublish')
  @RequirePermissions('alumni:manage')
  unpublishEvent(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.alumni.setEventPublished(user, id, false);
  }

  @Post()
  @RequirePermissions('alumni:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      studentId?: string;
      userId?: string;
      fullName: string;
      graduationYear?: number;
      programme?: string;
      email?: string;
      phone?: string;
      currentOrg?: string;
      currentRole?: string;
      mentorshipOptIn?: boolean;
    },
  ) {
    return this.alumni.create(user, body);
  }

  @Post('convert-student')
  @RequirePermissions('alumni:manage')
  convertStudent(
    @CurrentUser() user: JwtUser,
    @Body() body: { studentId: string },
  ) {
    return this.alumni.convertStudent(user, body.studentId);
  }

  @Post(':id/activate')
  @RequirePermissions('alumni:manage')
  activate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.alumni.activateMembership(user, id);
  }

  @Get(':id/membership-card.pdf')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  async membershipCardPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.alumniDocuments.getMembershipCardPdf(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @Get(':id/payments/:paymentId/receipt.pdf')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  async adminPaymentReceiptPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.alumniDocuments.getAdminPaymentReceiptPdf(
        user.tid,
        id,
        paymentId,
      );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @Get(':id')
  @RequireAnyPermission('alumni:read', 'alumni:manage')
  async get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.alumni.get(user.tid, id);
  }

  @Patch(':id')
  @RequirePermissions('alumni:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      fullName: string;
      graduationYear: number;
      programme: string;
      department: string;
      email: string;
      phone: string;
      currentOrg: string;
      currentRole: string;
      mentorshipOptIn: boolean;
      status: string;
      directoryVisible: boolean;
    }>,
  ) {
    return this.alumni.update(user.tid, id, body);
  }

  @Patch('settings/portal')
  @RequirePermissions('alumni:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body()
    body: Partial<{
      associationName: string;
      tagline: string;
      contactEmail: string;
      contactPhone: string;
      address: string;
      logoUrl: string;
      heroImageUrl: string;
      heroImages: string[];
    }>,
  ) {
    return this.alumni.updateSettings(user, body);
  }
}
