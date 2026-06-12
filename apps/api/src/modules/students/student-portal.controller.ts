import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import {
  StudentIdCardPrintRequestDto,
  StudentPortalChangeRequestDto,
  UploadStudentPortalDocumentDto,
} from './dto/student-portal-profile.dto';
import { StudentPortalProfileService } from './services/student-portal-profile.service';
import { StudentPortalService } from './services/student-portal.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('student-portal')
@Controller({ path: 'students', version: '1' })
export class StudentPortalController {
  constructor(
    private readonly portal: StudentPortalService,
    private readonly portalProfile: StudentPortalProfileService,
  ) {}

  @Get('me')
  @RequireAnyPermission('student:portal:self')
  getMe(@CurrentUser() user: JwtUser) {
    return this.portal.getMe(user);
  }

  @Get('me/dashboard')
  @RequireAnyPermission('student:portal:self')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.portal.getDashboard(user);
  }

  @Get('me/health')
  @RequireAnyPermission('student:portal:self')
  getHealth(@CurrentUser() user: JwtUser) {
    return this.portal.getHealth(user);
  }

  @Get('me/profile')
  @RequireAnyPermission('student:portal:self')
  getProfile(@CurrentUser() user: JwtUser) {
    return this.portalProfile.getMyProfile(user);
  }

  @Post('me/profile/change-requests')
  @RequireAnyPermission('student:portal:self')
  submitChangeRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: StudentPortalChangeRequestDto,
  ) {
    return this.portalProfile.submitChangeRequest(user, dto);
  }

  @Post('me/id-card/print-requests')
  @RequireAnyPermission('student:portal:self')
  submitIdCardPrintRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: StudentIdCardPrintRequestDto,
  ) {
    return this.portalProfile.submitIdCardPrintRequest(user, dto);
  }

  @Post('me/documents')
  @RequireAnyPermission('student:portal:self')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @Body() dto: UploadStudentPortalDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.portalProfile.uploadDocument(user, dto.documentType, file);
  }

  @Get('me/sessions')
  @RequireAnyPermission('student:portal:self')
  getSessions(@CurrentUser() user: JwtUser) {
    return this.portalProfile.listDeviceSessions(user.tid, user.sub);
  }
}
