import {
  BadRequestException,
  Body,
  Controller,
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
import {
  StudentIdCardPrintRequestDto,
  StudentPortalChangeRequestDto,
  UpdateAbcIdDto,
  UploadStudentPortalDocumentDto,
} from './dto/student-portal-profile.dto';
import { StudentPortalProfileService } from './services/student-portal-profile.service';
import { StudentPortalService } from './services/student-portal.service';
import { StudentLeaveService } from './services/student-leave.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('student-portal')
@Controller({ path: 'students', version: '1' })
export class StudentPortalController {
  constructor(
    private readonly portal: StudentPortalService,
    private readonly portalProfile: StudentPortalProfileService,
    private readonly studentLeave: StudentLeaveService,
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

  @Get('me/dashboard/widgets/:widget')
  @RequireAnyPermission('student:portal:self')
  getDashboardWidget(
    @CurrentUser() user: JwtUser,
    @Param('widget') widget: string,
  ) {
    switch (widget) {
      case 'attendance':
        return this.portal.getDashboardWidgetAttendance(user);
      case 'fees':
        return this.portal.getDashboardWidgetFees(user);
      case 'timetable':
        return this.portal.getDashboardWidgetTimetable(user);
      case 'lms':
        return this.portal.getDashboardWidgetLms(user);
      case 'examinations':
        return this.portal.getDashboardWidgetExaminations(user);
      case 'notifications':
        return this.portal.getDashboardWidgetNotifications(user);
      case 'calendar':
        return this.portal.getDashboardWidgetCalendar(user);
      case 'library':
        return this.portal.getDashboardWidgetLibrary(user);
      case 'health':
        return this.portal.getDashboardWidgetHealth(user);
      case 'qr-pass':
        return this.portal.getDashboardWidgetQrPass(user);
      default:
        throw new BadRequestException(`Unknown dashboard widget: ${widget}`);
    }
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

  @Patch('me/profile/abc-id')
  @RequireAnyPermission('student:portal:self')
  updateAbcId(@CurrentUser() user: JwtUser, @Body() dto: UpdateAbcIdDto) {
    return this.portalProfile.updateMyAbcId(user, dto.abcId);
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

  @Get('leave/types')
  @RequireAnyPermission(
    'student:portal:self',
    'principal-desk:access',
    'students:read',
  )
  listLeaveTypes(@CurrentUser() user: JwtUser) {
    return this.studentLeave.listTypes(user.tid);
  }

  @Post('leave/applications')
  @RequireAnyPermission('student:portal:self')
  applyLeave(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      leaveTypeId: string;
      fromDate: string;
      toDate: string;
      reason?: string;
    },
  ) {
    return this.studentLeave.apply(user, dto);
  }

  @Get('me/leave/applications')
  @RequireAnyPermission('student:portal:self')
  myLeaveApplications(@CurrentUser() user: JwtUser) {
    return this.portal
      .resolveStudent(user)
      .then((student) =>
        this.studentLeave.listForStudent(user.tid, student.id),
      );
  }
}
