import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateComplaintDto,
  CreateEnquiryDto,
  CreateGatePassDto,
  LinkAdmissionDto,
  ListQueryDto,
  KioskScanDto,
  UpdateComplaintDto,
  UpdateEnquiryDto,
} from './dto/front-office.dto';
import { FrontOfficeAdmissionsLinkService } from './services/front-office-admissions-link.service';
import { FrontOfficeComplaintsService } from './services/front-office-complaints.service';
import { FrontOfficeDashboardService } from './services/front-office-dashboard.service';
import { FrontOfficeEnquiriesService } from './services/front-office-enquiries.service';
import { FrontOfficeGatePassesService } from './services/front-office-gate-passes.service';
import { FrontOfficeKioskService } from './services/front-office-kiosk.service';

const FO_READ = [
  'front-office:read',
  'front-office:manage',
  'front-office:desk',
  'front-office:reports',
] as const;
const FO_MANAGE = ['front-office:manage'] as const;
const FO_DESK = ['front-office:desk', 'front-office:manage'] as const;

@ApiBearerAuth()
@ApiTags('front-office')
@Controller({ path: 'front-office', version: '1' })
export class FrontOfficeController {
  constructor(
    private readonly dashboard: FrontOfficeDashboardService,
    private readonly enquiries: FrontOfficeEnquiriesService,
    private readonly gatePasses: FrontOfficeGatePassesService,
    private readonly complaints: FrontOfficeComplaintsService,
    private readonly admissionsLink: FrontOfficeAdmissionsLinkService,
    private readonly kiosk: FrontOfficeKioskService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...FO_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('enquiries')
  @RequireAnyPermission(...FO_READ)
  listEnquiries(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.enquiries.list(user.tid, query);
  }

  @Post('enquiries')
  @RequireAnyPermission(...FO_DESK)
  createEnquiry(@CurrentUser() user: JwtUser, @Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(user, dto);
  }

  @Patch('enquiries/:id')
  @RequireAnyPermission(...FO_MANAGE, ...FO_DESK)
  updateEnquiry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    return this.enquiries.update(user, id, dto);
  }

  @Get('gate-passes')
  @RequireAnyPermission(...FO_READ)
  listGatePasses(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.gatePasses.list(user.tid, query);
  }

  @Post('gate-passes')
  @RequireAnyPermission(...FO_DESK)
  createGatePass(@CurrentUser() user: JwtUser, @Body() dto: CreateGatePassDto) {
    return this.gatePasses.create(user, dto);
  }

  @Get('gate-passes/lookup/:passNumber')
  @RequireAnyPermission(...FO_DESK)
  lookupGatePass(
    @CurrentUser() user: JwtUser,
    @Param('passNumber') passNumber: string,
  ) {
    return this.gatePasses.lookup(user.tid, decodeURIComponent(passNumber));
  }

  @Post('gate-passes/:id/check-in')
  @RequireAnyPermission(...FO_DESK)
  checkIn(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gatePasses.checkIn(user, id);
  }

  @Post('gate-passes/:id/check-out')
  @RequireAnyPermission(...FO_DESK)
  checkOut(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gatePasses.checkOut(user, id);
  }

  @Post('gate-passes/:id/cancel')
  @RequireAnyPermission(...FO_MANAGE, ...FO_DESK)
  cancelGatePass(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gatePasses.cancel(user, id);
  }

  @Get('gate-passes/:id/print')
  @RequireAnyPermission(...FO_READ)
  printGatePass(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.gatePasses.printLabel(user, id);
  }

  @Get('admissions/desk-summary')
  @RequireAnyPermission(...FO_READ)
  admissionsDeskSummary(@CurrentUser() user: JwtUser) {
    return this.admissionsLink.deskSummary(user.tid);
  }

  @Post('enquiries/:id/link-admission')
  @RequireAnyPermission(...FO_DESK)
  linkEnquiryAdmission(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: LinkAdmissionDto,
  ) {
    return this.admissionsLink.linkEnquiry(
      user,
      id,
      dto.admissionApplicationId,
    );
  }

  @Post('enquiries/from-admission/:applicationId')
  @RequireAnyPermission(...FO_DESK)
  enquiryFromAdmission(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.admissionsLink.createEnquiryFromApplication(
      user,
      applicationId,
    );
  }

  @Get('kiosk/status')
  @RequireAnyPermission(...FO_DESK)
  kioskStatus(@CurrentUser() user: JwtUser) {
    return this.kiosk.status(user.tid);
  }

  @Post('kiosk/scan')
  @RequireAnyPermission(...FO_DESK)
  kioskScan(@CurrentUser() user: JwtUser, @Body() dto: KioskScanDto) {
    return this.kiosk.scan(user, dto);
  }

  @Get('complaints')
  @RequireAnyPermission(...FO_READ)
  listComplaints(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.complaints.list(user.tid, query);
  }

  @Post('complaints')
  @RequireAnyPermission(...FO_DESK)
  createComplaint(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaints.create(user, dto);
  }

  @Patch('complaints/:id')
  @RequireAnyPermission(...FO_MANAGE, ...FO_DESK)
  updateComplaint(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaints.update(user, id, dto);
  }
}
