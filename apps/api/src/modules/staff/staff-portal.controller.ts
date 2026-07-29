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
import { StaffSelfServiceProfileService } from './services/staff-self-service-profile.service';

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
    private readonly selfService: StaffSelfServiceProfileService,
  ) {}

  @Get('me')
  @RequireAnyPermission('staff:portal:self')
  getMe(@CurrentUser() user: JwtUser) {
    return this.selfService.getExtendedMe(user);
  }

  @Get('me/profile')
  @RequireAnyPermission('staff:portal:self')
  getProfile(@CurrentUser() user: JwtUser) {
    return this.selfService.getExtendedMe(user);
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
    const doc = await this.documents.uploadDocument(
      user.tid,
      staff.id,
      dto.documentType,
      file,
      user.sub,
      { selfService: true },
    );
    await this.selfService.logDocumentUpload(
      user,
      dto.documentType,
      (doc as { id?: string })?.id ?? '',
    );
    return doc;
  }

  /* ─── Self-service profile extensions ─── */

  @Patch('me/personal')
  @RequireAnyPermission('staff:portal:self')
  updatePersonal(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updatePersonal(
      user,
      body as Parameters<StaffSelfServiceProfileService['updatePersonal']>[1],
    );
  }

  @Patch('me/contact')
  @RequireAnyPermission('staff:portal:self')
  updateContact(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateContact(
      user,
      body as Parameters<StaffSelfServiceProfileService['updateContact']>[1],
    );
  }

  @Patch('me/bank')
  @RequireAnyPermission('staff:portal:self')
  updateBank(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateBank(
      user,
      body as Parameters<StaffSelfServiceProfileService['updateBank']>[1],
    );
  }

  @Get('me/emergency-contacts')
  @RequireAnyPermission('staff:portal:self')
  listEmergency(@CurrentUser() user: JwtUser) {
    return this.selfService.listEmergencyContacts(user);
  }

  @Post('me/emergency-contacts')
  @RequireAnyPermission('staff:portal:self')
  createEmergency(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.createEmergencyContact(
      user,
      body as Parameters<
        StaffSelfServiceProfileService['createEmergencyContact']
      >[1],
    );
  }

  @Patch('me/emergency-contacts/:id')
  @RequireAnyPermission('staff:portal:self')
  updateEmergency(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateEmergencyContact(
      user,
      id,
      body as Parameters<
        StaffSelfServiceProfileService['updateEmergencyContact']
      >[2],
    );
  }

  @Delete('me/emergency-contacts/:id')
  @RequireAnyPermission('staff:portal:self')
  deleteEmergency(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.selfService.deleteEmergencyContact(user, id);
  }

  @Get('me/qualifications')
  @RequireAnyPermission('staff:portal:self')
  listQualifications(@CurrentUser() user: JwtUser) {
    return this.selfService.listQualifications(user);
  }

  @Post('me/qualifications')
  @RequireAnyPermission('staff:portal:self')
  createQualification(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.createQualification(
      user,
      body as Parameters<
        StaffSelfServiceProfileService['createQualification']
      >[1],
    );
  }

  @Patch('me/qualifications/:id')
  @RequireAnyPermission('staff:portal:self')
  updateQualification(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateQualification(
      user,
      id,
      body as Parameters<
        StaffSelfServiceProfileService['updateQualification']
      >[2],
    );
  }

  @Delete('me/qualifications/:id')
  @RequireAnyPermission('staff:portal:self')
  deleteQualification(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.selfService.deleteQualification(user, id);
  }

  @Get('me/experience')
  @RequireAnyPermission('staff:portal:self')
  listExperience(@CurrentUser() user: JwtUser) {
    return this.selfService.listExperience(user);
  }

  @Post('me/experience')
  @RequireAnyPermission('staff:portal:self')
  createExperience(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.createExperience(
      user,
      body as Parameters<StaffSelfServiceProfileService['createExperience']>[1],
    );
  }

  @Patch('me/experience/:id')
  @RequireAnyPermission('staff:portal:self')
  updateExperience(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateExperience(
      user,
      id,
      body as Parameters<StaffSelfServiceProfileService['updateExperience']>[2],
    );
  }

  @Delete('me/experience/:id')
  @RequireAnyPermission('staff:portal:self')
  deleteExperience(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.selfService.deleteExperience(user, id);
  }

  @Get('me/certifications')
  @RequireAnyPermission('staff:portal:self')
  listCertifications(@CurrentUser() user: JwtUser) {
    return this.selfService.listCertifications(user);
  }

  @Post('me/certifications')
  @RequireAnyPermission('staff:portal:self')
  createCertification(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.createCertification(
      user,
      body as Parameters<
        StaffSelfServiceProfileService['createCertification']
      >[1],
    );
  }

  @Patch('me/certifications/:id')
  @RequireAnyPermission('staff:portal:self')
  updateCertification(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.selfService.updateCertification(
      user,
      id,
      body as Parameters<
        StaffSelfServiceProfileService['updateCertification']
      >[2],
    );
  }

  @Delete('me/certifications/:id')
  @RequireAnyPermission('staff:portal:self')
  deleteCertification(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.selfService.deleteCertification(user, id);
  }

  @Get('me/profile/history')
  @RequireAnyPermission('staff:portal:self')
  profileHistory(@CurrentUser() user: JwtUser) {
    return this.selfService.getHistory(user);
  }

  @Post('me/profile/submit')
  @RequireAnyPermission('staff:portal:self')
  submitProfile(@CurrentUser() user: JwtUser) {
    return this.selfService.submitForReview(user);
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
