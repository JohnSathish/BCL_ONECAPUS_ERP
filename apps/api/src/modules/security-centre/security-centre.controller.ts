import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  AcceptFileBaselineDto,
  SecurityCentreQueryDto,
  UpdateSecurityMonitorDto,
} from './dto/security-centre.dto';
import { SecurityCentreService } from './security-centre.service';
import { SuperAdminGuard } from './super-admin.guard';

@ApiBearerAuth()
@ApiTags('security-centre')
@UseGuards(SuperAdminGuard)
@Controller({ path: 'admin/security-centre', version: '1' })
export class SecurityCentreController {
  constructor(private readonly centre: SecurityCentreService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.centre.dashboard(user.tid);
  }

  @Get('events')
  events(@CurrentUser() user: JwtUser, @Query() query: SecurityCentreQueryDto) {
    return this.centre.listEvents(user.tid, query);
  }

  @Get('events/export')
  exportEvents(
    @CurrentUser() user: JwtUser,
    @Query() query: SecurityCentreQueryDto,
  ) {
    return this.centre.exportEvents(user.tid, query);
  }

  @Get('alerts')
  alerts(@CurrentUser() user: JwtUser, @Query() query: SecurityCentreQueryDto) {
    return this.centre.listAlerts(user.tid, query);
  }

  @Post('alerts/:id/acknowledge')
  acknowledge(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.centre.acknowledge(user.tid, id, user.sub);
  }

  @Get('trail')
  trail(@CurrentUser() user: JwtUser, @Query() query: SecurityCentreQueryDto) {
    return this.centre.listTrail(user.tid, query);
  }

  @Get('trail/export')
  exportTrail(
    @CurrentUser() user: JwtUser,
    @Query() query: SecurityCentreQueryDto,
  ) {
    return this.centre.exportTrail(user.tid, query);
  }

  @Get('integrity')
  integrity(@CurrentUser() user: JwtUser) {
    return Promise.all([
      this.centre.verifyChain(user.tid),
      this.centre.listFiles(user.tid),
    ]).then(([chain, files]) => ({ chain, files }));
  }

  @Post('integrity/scan')
  scan(@CurrentUser() user: JwtUser) {
    return this.centre.scanFiles(user.tid, user.sub);
  }

  @Post('integrity/accept')
  accept(@CurrentUser() user: JwtUser, @Body() dto: AcceptFileBaselineDto) {
    return this.centre.acceptFile(user.tid, user.sub, dto.relativePath);
  }

  @Get('policy')
  policy(@CurrentUser() user: JwtUser) {
    return this.centre.getPolicy(user.tid);
  }

  @Patch('policy')
  updatePolicy(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateSecurityMonitorDto,
  ) {
    return this.centre.savePolicy(user.tid, user.sub, dto);
  }
}
