import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import {
  SIS_TRANSPORT_ATTENDANCE,
  SIS_TRANSPORT_FEE,
  SIS_TRANSPORT_MANAGE,
  SIS_TRANSPORT_SETTINGS,
  SIS_TRANSPORT_TRACKING,
  SIS_TRANSPORT_VIEW,
} from './school-sis-iam.perms';
import {
  SchoolSisTransportService,
  type TransportActor,
} from './school-sis-transport.service';
import {
  BoardingDto,
  BreakdownDto,
  BulkAllocationDto,
  BulkAttendanceDto,
  GenerateTripsDto,
  GpsPingDto,
  ImportRowsDto,
  ReviewRequestDto,
  SaveAllocationDto,
  SaveConcessionDto,
  SaveFeePlanDto,
  SaveFuelDto,
  SaveGeofenceDto,
  SaveIncidentDto,
  SaveMaintenanceDto,
  SavePersonnelDocumentDto,
  SavePersonnelDto,
  SaveRequestDto,
  SaveRouteDto,
  SaveStopDto,
  SaveTransportSettingsDto,
  SaveVehicleDocumentDto,
  SaveVehicleDto,
  TripActionDto,
} from './dto/school-transport.dto';

function actor(user: JwtUser, req?: { ip?: string }): TransportActor {
  const p = user.permissions ?? [];
  const star = p.includes('*');
  const manage =
    star ||
    p.includes(SCHOOL_SIS_PERMISSION_MANAGE) ||
    p.includes('transport.routes.manage') ||
    p.includes('transport.update');
  return {
    userId: user.sub,
    manage,
    canOverride: manage || p.includes('transport.settings.manage'),
    ip: req?.ip,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-transport')
@Controller({ path: 'school-sis/transport', version: '1' })
export class SchoolSisTransportController {
  constructor(private readonly transport: SchoolSisTransportService) {}

  @Get('dashboard')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.transport.dashboard(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW, ...SIS_TRANSPORT_SETTINGS)
  settings(@CurrentUser() user: JwtUser) {
    return this.transport.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...SIS_TRANSPORT_SETTINGS)
  patchSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveTransportSettingsDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveSettings(user.tid, actor(user, req), dto);
  }

  @Get('vehicles')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  vehicles(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listVehicles(user.tid, q);
  }

  @Post('vehicles')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createVehicle(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveVehicleDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveVehicle(user.tid, actor(user, req), dto);
  }

  @Patch('vehicles/:id')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  patchVehicle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveVehicleDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveVehicle(user.tid, actor(user, req), dto, id);
  }

  @Post('vehicles/:id/documents')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  vehicleDoc(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveVehicleDocumentDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveVehicleDocument(
      user.tid,
      actor(user, req),
      id,
      dto,
    );
  }

  @Get('personnel')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  personnel(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listPersonnel(user.tid, q.kind || 'DRIVER', q);
  }

  @Post('personnel')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createPersonnel(
    @CurrentUser() user: JwtUser,
    @Body() dto: SavePersonnelDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.savePersonnel(user.tid, actor(user, req), dto);
  }

  @Patch('personnel/:id')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  patchPersonnel(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SavePersonnelDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.savePersonnel(user.tid, actor(user, req), dto, id);
  }

  @Post('personnel/:id/documents')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  personnelDoc(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SavePersonnelDocumentDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.savePersonnelDocument(
      user.tid,
      actor(user, req),
      id,
      dto,
    );
  }

  @Get('stops')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  stops(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listStops(user.tid, q);
  }

  @Post('stops')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createStop(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveStopDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveStop(user.tid, actor(user, req), dto);
  }

  @Patch('stops/:id')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  patchStop(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveStopDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveStop(user.tid, actor(user, req), dto, id);
  }

  @Get('routes')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  routes(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listRoutes(user.tid, q);
  }

  @Post('routes')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createRoute(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveRouteDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveRoute(user.tid, actor(user, req), dto);
  }

  @Patch('routes/:id')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  patchRoute(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveRouteDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveRoute(user.tid, actor(user, req), dto, id);
  }

  @Get('students/search')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  search(@CurrentUser() user: JwtUser, @Query('q') q: string) {
    return this.transport.searchStudents(user.tid, q || '');
  }

  @Get('allocations')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  allocations(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listAllocations(user.tid, q);
  }

  @Post('allocations')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  allocate(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveAllocationDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveAllocation(user.tid, actor(user, req), dto);
  }

  @Post('allocations/bulk')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  bulk(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkAllocationDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.bulkAllocate(user.tid, actor(user, req), dto);
  }

  @Post('allocations/:id/end')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  endAlloc(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { ip?: string },
  ) {
    return this.transport.endAllocation(
      user.tid,
      actor(user, req),
      id,
      body.reason,
    );
  }

  @Get('trips')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  trips(
    @CurrentUser() user: JwtUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.transport.listTrips(user.tid, q);
  }

  @Post('trips/generate')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  generate(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateTripsDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.generateTrips(user.tid, actor(user, req), dto);
  }

  @Get('trips/:id/roster')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW, ...SIS_TRANSPORT_ATTENDANCE)
  roster(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.transport.tripRoster(user.tid, id);
  }

  @Post('trips/:id/:action')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE, ...SIS_TRANSPORT_ATTENDANCE)
  tripAction(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('action') action: 'start' | 'complete' | 'cancel' | 'delay',
    @Body() dto: TripActionDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.tripAction(
      user.tid,
      actor(user, req),
      id,
      action,
      dto,
    );
  }

  @Post('trips/:id/boarding')
  @RequireAnyPermission(...SIS_TRANSPORT_ATTENDANCE)
  boarding(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BoardingDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.recordBoarding(user.tid, actor(user, req), id, dto);
  }

  @Post('trips/:id/bulk-attendance')
  @RequireAnyPermission(...SIS_TRANSPORT_ATTENDANCE)
  bulkAtt(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BulkAttendanceDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.bulkAttendance(user.tid, actor(user, req), id, dto);
  }

  @Get('maintenance')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  maintenance(
    @CurrentUser() user: JwtUser,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.transport.listMaintenance(user.tid, vehicleId);
  }

  @Post('maintenance')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createMaint(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveMaintenanceDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveMaintenance(user.tid, actor(user, req), dto);
  }

  @Get('fuel')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  fuel(@CurrentUser() user: JwtUser, @Query('vehicleId') vehicleId?: string) {
    return this.transport.listFuel(user.tid, vehicleId);
  }

  @Post('fuel')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  createFuel(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveFuelDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveFuel(user.tid, actor(user, req), dto);
  }

  @Get('incidents')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  incidents(@CurrentUser() user: JwtUser) {
    return this.transport.listIncidents(user.tid);
  }

  @Post('incidents')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE, ...SIS_TRANSPORT_ATTENDANCE)
  createIncident(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveIncidentDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveIncident(user.tid, actor(user, req), dto);
  }

  @Post('incidents/:id/resolve')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  resolve(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { actionTaken?: string },
    @Req() req: { ip?: string },
  ) {
    return this.transport.resolveIncident(
      user.tid,
      actor(user, req),
      id,
      body.actionTaken,
    );
  }

  @Post('breakdown')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE, ...SIS_TRANSPORT_ATTENDANCE)
  breakdown(
    @CurrentUser() user: JwtUser,
    @Body() dto: BreakdownDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.reportBreakdown(user.tid, actor(user, req), dto);
  }

  @Get('tracking')
  @RequireAnyPermission(...SIS_TRANSPORT_TRACKING)
  tracking(@CurrentUser() user: JwtUser) {
    return this.transport.tracking(user.tid);
  }

  @Post('tracking/ping')
  @RequireAnyPermission(...SIS_TRANSPORT_ATTENDANCE)
  ping(
    @CurrentUser() user: JwtUser,
    @Body() dto: GpsPingDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.pingGps(user.tid, actor(user, req), dto);
  }

  @Get('geofences')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  geofences(@CurrentUser() user: JwtUser) {
    return this.transport.listGeofences(user.tid);
  }

  @Post('geofences')
  @RequireAnyPermission(...SIS_TRANSPORT_SETTINGS, ...SIS_TRANSPORT_MANAGE)
  createFence(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveGeofenceDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveGeofence(user.tid, actor(user, req), dto);
  }

  @Get('fees/plans')
  @RequireAnyPermission(...SIS_TRANSPORT_FEE, ...SIS_TRANSPORT_VIEW)
  feePlans(@CurrentUser() user: JwtUser) {
    return this.transport.listFeePlans(user.tid);
  }

  @Post('fees/plans')
  @RequireAnyPermission(...SIS_TRANSPORT_FEE)
  createPlan(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveFeePlanDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveFeePlan(user.tid, actor(user, req), dto);
  }

  @Post('fees/concessions')
  @RequireAnyPermission(...SIS_TRANSPORT_FEE)
  concession(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveConcessionDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveConcession(user.tid, actor(user, req), dto);
  }

  @Get('requests')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  requests(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.transport.listRequests(user.tid, status);
  }

  @Post('requests')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  createRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveRequestDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.saveRequest(user.tid, actor(user, req), dto);
  }

  @Post('requests/:id/review')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  review(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.reviewRequest(user.tid, actor(user, req), id, dto);
  }

  @Post('import')
  @RequireAnyPermission(...SIS_TRANSPORT_MANAGE)
  importRows(
    @CurrentUser() user: JwtUser,
    @Body() dto: ImportRowsDto,
    @Req() req: { ip?: string },
  ) {
    return this.transport.importRows(user.tid, actor(user, req), dto);
  }

  @Get('audit')
  @RequireAnyPermission(...SIS_TRANSPORT_VIEW)
  audit(@CurrentUser() user: JwtUser) {
    return this.transport.listAudit(user.tid);
  }
}
