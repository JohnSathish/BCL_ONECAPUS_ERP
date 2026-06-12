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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdmissionsService } from './admissions.service';
import {
  CreateApplicationDto,
  CreateIntakeDto,
  GenerateMeritListDto,
  RunSeatAllocationDto,
  UpdateAllocationStatusDto,
  UpdateApplicationStatusDto,
} from './dto/admissions.dto';

@ApiBearerAuth()
@ApiTags('admissions')
@RequireAnyPermission('admissions:read', 'admissions:manage')
@Controller({ path: 'admissions', version: '1' })
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    return this.admissions.getSummary(user.tid);
  }

  @Get('intakes')
  intakes(@CurrentUser() user: JwtUser) {
    return this.admissions.listIntakes(user.tid);
  }

  @Post('intakes')
  createIntake(@CurrentUser() user: JwtUser, @Body() dto: CreateIntakeDto) {
    return this.admissions.createIntake(user.tid, dto);
  }

  @Get('applications')
  applications(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationQueryDto,
    @Query('intakeId') intakeId?: string,
    @Query('status') status?: string,
  ) {
    return this.admissions.listApplications(user.tid, {
      ...query,
      intakeId,
      status,
    });
  }

  @Post('applications')
  createApplication(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.admissions.createApplication(user.tid, dto);
  }

  @Patch('applications/:id/status')
  updateApplicationStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.admissions.updateApplicationStatus(user.tid, id, dto);
  }

  @Get('merit-lists')
  meritLists(
    @CurrentUser() user: JwtUser,
    @Query('intakeId') intakeId?: string,
  ) {
    return this.admissions.listMeritLists(user.tid, intakeId);
  }

  @Get('merit-lists/:id')
  meritList(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.admissions.getMeritList(user.tid, id);
  }

  @Post('merit-lists/generate')
  generateMeritList(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateMeritListDto,
  ) {
    return this.admissions.generateMeritList(user.tid, dto);
  }

  @Post('merit-lists/:id/publish')
  publishMeritList(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.admissions.publishMeritList(user.tid, id);
  }

  @Get('allocations')
  allocations(
    @CurrentUser() user: JwtUser,
    @Query('intakeId') intakeId?: string,
  ) {
    return this.admissions.listAllocations(user.tid, intakeId);
  }

  @Post('allocations/run')
  runAllocation(
    @CurrentUser() user: JwtUser,
    @Body() dto: RunSeatAllocationDto,
  ) {
    return this.admissions.runSeatAllocation(user.tid, dto);
  }

  @Patch('allocations/:id/status')
  updateAllocationStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAllocationStatusDto,
  ) {
    return this.admissions.updateAllocationStatus(user.tid, id, dto);
  }
}
