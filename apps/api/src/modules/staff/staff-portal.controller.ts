import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { UpdateMyProfileDto, UploadStaffDocumentDto } from './dto/staff.dto';
import { StaffDocumentsService } from './services/staff-documents.service';
import { StaffPortalService } from './services/staff-portal.service';
import { StaffAssetsService } from './services/staff-assets.service';
import { StaffPublicationService } from './services/staff-publication.service';
import { StaffAwardService } from './services/staff-award.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('staff-portal')
@Controller({ path: 'staff', version: '1' })
export class StaffPortalController {
  constructor(
    private readonly portal: StaffPortalService,
    private readonly documents: StaffDocumentsService,
    private readonly assets: StaffAssetsService,
    private readonly publications: StaffPublicationService,
    private readonly awards: StaffAwardService,
  ) {}

  @Get('me')
  @RequireAnyPermission('staff:portal:self')
  getMe(@CurrentUser() user: JwtUser) {
    return this.portal.getMe(user);
  }

  @Patch('me/profile')
  @RequireAnyPermission('staff:portal:self')
  updateMyProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.portal.updateMyProfile(user, dto);
  }

  @Patch('me/address')
  @RequireAnyPermission('staff:portal:self')
  updateMyAddress(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      addressJson?: Record<string, unknown>;
      emergencyContactJson?: Record<string, unknown>;
    },
  ) {
    return this.portal.updateMyAddress(user, dto);
  }

  @Post('me/photo')
  @RequireAnyPermission('staff:portal:self')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async uploadMyPhoto(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.assets.uploadPhoto(user.tid, staff.id, file, user.sub);
  }

  @Get('me/dashboard')
  @RequireAnyPermission('staff:portal:self')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.portal.getDashboard(user);
  }

  @Get('me/dashboard/widgets/:widget')
  @RequireAnyPermission('staff:portal:self')
  getDashboardWidget(
    @CurrentUser() user: JwtUser,
    @Param('widget') widget: string,
  ) {
    if (widget === 'birthdays') {
      return this.portal.getDashboardWidgetBirthdays(user);
    }
    throw new BadRequestException(`Unknown dashboard widget: ${widget}`);
  }

  @Get('me/subject-assignments')
  @RequireAnyPermission('staff:portal:self')
  getSubjectAssignments(@CurrentUser() user: JwtUser) {
    return this.portal.getSubjectAssignments(user);
  }

  @Get('me/documents')
  @RequireAnyPermission('staff:portal:self')
  getDocuments(@CurrentUser() user: JwtUser) {
    return this.portal.getDocuments(user);
  }

  @Get('me/documents/compliance')
  @RequireAnyPermission('staff:portal:self')
  async getDocumentsCompliance(@CurrentUser() user: JwtUser) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.documents.getCompliance(user.tid, staff.id);
  }

  @Post('me/documents')
  @RequireAnyPermission('staff:portal:self')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async uploadMyDocument(
    @CurrentUser() user: JwtUser,
    @Body() dto: UploadStaffDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.documents.uploadDocument(
      user.tid,
      staff.id,
      dto.documentType,
      file,
      user.sub,
      { selfService: true },
    );
  }

  /* ─── Self-service publications ─── */

  @Get('me/publications')
  @RequireAnyPermission('staff:portal:self')
  async getMyPublications(@CurrentUser() user: JwtUser) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.publications.list(user.tid, staff.id);
  }

  @Post('me/publications')
  @RequireAnyPermission('staff:portal:self')
  async createMyPublication(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.publications.create(
      user.tid,
      staff.id,
      body as Parameters<StaffPublicationService['create']>[2],
    );
  }

  @Patch('me/publications/:pubId')
  @RequireAnyPermission('staff:portal:self')
  async updateMyPublication(
    @CurrentUser() user: JwtUser,
    @Param('pubId') pubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.publications.update(
      user.tid,
      staff.id,
      pubId,
      body as Parameters<StaffPublicationService['update']>[3],
    );
  }

  @Delete('me/publications/:pubId')
  @RequireAnyPermission('staff:portal:self')
  async deleteMyPublication(
    @CurrentUser() user: JwtUser,
    @Param('pubId') pubId: string,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.publications.remove(user.tid, staff.id, pubId);
  }

  /* ─── Self-service awards ─── */

  @Get('me/awards')
  @RequireAnyPermission('staff:portal:self')
  async getMyAwards(@CurrentUser() user: JwtUser) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.awards.list(user.tid, staff.id);
  }

  @Post('me/awards')
  @RequireAnyPermission('staff:portal:self')
  async createMyAward(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.awards.create(
      user.tid,
      staff.id,
      body as Parameters<StaffAwardService['create']>[2],
    );
  }

  @Patch('me/awards/:awardId')
  @RequireAnyPermission('staff:portal:self')
  async updateMyAward(
    @CurrentUser() user: JwtUser,
    @Param('awardId') awardId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.awards.update(
      user.tid,
      staff.id,
      awardId,
      body as Parameters<StaffAwardService['update']>[3],
    );
  }

  @Delete('me/awards/:awardId')
  @RequireAnyPermission('staff:portal:self')
  async deleteMyAward(
    @CurrentUser() user: JwtUser,
    @Param('awardId') awardId: string,
  ) {
    const staff = await this.portal.resolveStaffProfile(user.tid, user.sub);
    return this.awards.remove(user.tid, staff.id, awardId);
  }

  @Get('me/timetable/today')
  @RequireAnyPermission('staff:portal:self')
  getTodayTimetable(@CurrentUser() user: JwtUser) {
    return this.portal.getTodayScheduleForUser(user);
  }

  @Get('me/sections/:sectionId/roster')
  @RequireAnyPermission('staff:portal:self')
  getSectionRoster(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.portal.getSectionRoster(user, sectionId);
  }
}
