import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { StaffPortalService } from './services/staff-portal.service';
import { StaffDocumentsService } from './services/staff-documents.service';
import { UploadStaffDocumentDto } from './dto/staff.dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('staff-portal')
@Controller({ path: 'staff', version: '1' })
export class StaffPortalController {
  constructor(
    private readonly portal: StaffPortalService,
    private readonly documents: StaffDocumentsService,
  ) {}

  @Get('me')
  @RequireAnyPermission('staff:portal:self')
  getMe(@CurrentUser() user: JwtUser) {
    return this.portal.getMe(user);
  }

  @Get('me/dashboard')
  @RequireAnyPermission('staff:portal:self')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.portal.getDashboard(user);
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
  async getMyDocumentCompliance(@CurrentUser() user: JwtUser) {
    const staffProfileId = await this.portal.resolveStaffProfileId(user);
    return this.documents.getCompliance(user.tid, staffProfileId);
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
    const staffProfileId = await this.portal.resolveStaffProfileId(user);
    return this.documents.uploadDocument(
      user.tid,
      staffProfileId,
      dto.documentType,
      file,
      user.sub,
      { selfService: true },
    );
  }

  @Get('me/timetable/today')
  @RequireAnyPermission('staff:portal:self')
  getTodayTimetable(@CurrentUser() user: JwtUser) {
    return this.portal.getTodayScheduleForUser(user);
  }
}
