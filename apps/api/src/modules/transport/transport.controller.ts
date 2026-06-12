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
  AssignStudentDto,
  CreateRouteDto,
  CreateStopDto,
  CreateVehicleDto,
  ListQueryDto,
  StudentSearchQueryDto,
  UpdateRouteDto,
  UpdateVehicleDto,
} from './dto/transport.dto';
import { TransportCapacityService } from './services/transport-capacity.service';
import { TransportStudentLookupService } from './services/transport-student-lookup.service';
import {
  TransportAssignmentsService,
  TransportDashboardService,
  TransportRoutesService,
  TransportVehiclesService,
} from './services/transport.service';

const TR_READ = [
  'transport:read',
  'transport:manage',
  'transport:assign',
] as const;
const TR_MANAGE = ['transport:manage'] as const;
const TR_ASSIGN = ['transport:assign', 'transport:manage'] as const;

@ApiBearerAuth()
@ApiTags('transport')
@Controller({ path: 'transport', version: '1' })
export class TransportController {
  constructor(
    private readonly dashboard: TransportDashboardService,
    private readonly routes: TransportRoutesService,
    private readonly vehicles: TransportVehiclesService,
    private readonly assignments: TransportAssignmentsService,
    private readonly capacity: TransportCapacityService,
    private readonly studentLookup: TransportStudentLookupService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...TR_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('alerts')
  @RequireAnyPermission(...TR_READ)
  listAlerts(@CurrentUser() user: JwtUser) {
    return this.capacity.listAlerts(user.tid);
  }

  @Get('students/search')
  @RequireAnyPermission(...TR_ASSIGN)
  searchStudents(
    @CurrentUser() user: JwtUser,
    @Query() query: StudentSearchQueryDto,
  ) {
    return this.studentLookup.search(user.tid, query.q, query.limit);
  }

  @Get('routes/:id/capacity')
  @RequireAnyPermission(...TR_READ)
  routeCapacity(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.capacity.routeCapacity(user.tid, id);
  }

  @Get('routes')
  @RequireAnyPermission(...TR_READ)
  listRoutes(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.routes.list(user.tid, query);
  }

  @Get('routes/:id')
  @RequireAnyPermission(...TR_READ)
  getRoute(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.routes.get(user.tid, id);
  }

  @Post('routes')
  @RequireAnyPermission(...TR_MANAGE)
  createRoute(@CurrentUser() user: JwtUser, @Body() dto: CreateRouteDto) {
    return this.routes.create(user, dto);
  }

  @Patch('routes/:id')
  @RequireAnyPermission(...TR_MANAGE)
  updateRoute(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routes.update(user, id, dto);
  }

  @Post('routes/:id/stops')
  @RequireAnyPermission(...TR_MANAGE)
  addStop(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStopDto,
  ) {
    return this.routes.addStop(user, id, dto);
  }

  @Get('vehicles')
  @RequireAnyPermission(...TR_READ)
  listVehicles(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.vehicles.list(user.tid, query);
  }

  @Post('vehicles')
  @RequireAnyPermission(...TR_MANAGE)
  createVehicle(@CurrentUser() user: JwtUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(user, dto);
  }

  @Patch('vehicles/:id')
  @RequireAnyPermission(...TR_MANAGE)
  updateVehicle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(user, id, dto);
  }

  @Get('assignments')
  @RequireAnyPermission(...TR_READ)
  listAssignments(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.assignments.list(user.tid, query);
  }

  @Post('assignments')
  @RequireAnyPermission(...TR_ASSIGN)
  assignStudent(@CurrentUser() user: JwtUser, @Body() dto: AssignStudentDto) {
    return this.assignments.assign(user, dto);
  }

  @Post('assignments/:id/cancel')
  @RequireAnyPermission(...TR_ASSIGN)
  cancelAssignment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.cancel(user, id);
  }
}
