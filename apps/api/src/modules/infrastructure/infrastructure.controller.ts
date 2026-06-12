import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  AvailabilityQueryDto,
  BuildingDto,
  FloorDto,
  InfrastructureQueryDto,
  ReservationDto,
  ReservationQueryDto,
  ReservationStatusDto,
  RoomDto,
  RoomTypeDto,
} from './dto/infrastructure.dto';
import { InfrastructureService } from './infrastructure.service';

@ApiBearerAuth()
@ApiTags('infrastructure')
@Controller({ path: 'infrastructure', version: '1' })
export class InfrastructureController {
  constructor(private readonly service: InfrastructureService) {}

  @Get('dashboard')
  @RequireAnyPermission('infrastructure:view', 'org:read', 'org:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Get('buildings')
  @RequireAnyPermission('infrastructure:view', 'org:read', 'org:manage')
  buildings(
    @CurrentUser() user: JwtUser,
    @Query() query: InfrastructureQueryDto,
  ) {
    return this.service.listBuildings(user.tid, query);
  }

  @Post('buildings')
  @RequireAnyPermission('infrastructure:create', 'org:manage')
  createBuilding(@CurrentUser() user: JwtUser, @Body() dto: BuildingDto) {
    return this.service.createBuilding(user, dto);
  }

  @Patch('buildings/:id')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  updateBuilding(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<BuildingDto>,
  ) {
    return this.service.updateBuilding(user, id, dto);
  }

  @Delete('buildings/:id')
  @RequireAnyPermission('infrastructure:delete', 'org:manage')
  deleteBuilding(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteBuilding(user, id);
  }

  @Post('buildings/:id/archive')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  archiveBuilding(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveBuilding(user, id, true);
  }

  @Post('buildings/:id/activate')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  activateBuilding(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveBuilding(user, id, false);
  }

  @Get('floors')
  @RequireAnyPermission('infrastructure:view', 'org:read', 'org:manage')
  floors(@CurrentUser() user: JwtUser, @Query() query: InfrastructureQueryDto) {
    return this.service.listFloors(user.tid, query);
  }

  @Post('floors')
  @RequireAnyPermission('infrastructure:create', 'org:manage')
  createFloor(@CurrentUser() user: JwtUser, @Body() dto: FloorDto) {
    return this.service.createFloor(user, dto);
  }

  @Patch('floors/:id')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  updateFloor(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<FloorDto>,
  ) {
    return this.service.updateFloor(user, id, dto);
  }

  @Delete('floors/:id')
  @RequireAnyPermission('infrastructure:delete', 'org:manage')
  deleteFloor(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteFloor(user, id);
  }

  @Post('floors/:id/archive')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  archiveFloor(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveFloor(user, id, true);
  }

  @Post('floors/:id/activate')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  activateFloor(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveFloor(user, id, false);
  }

  @Get('room-types')
  @RequireAnyPermission('infrastructure:view', 'org:read', 'academic:read')
  roomTypes(@CurrentUser() user: JwtUser) {
    return this.service.listRoomTypes(user.tid);
  }

  @Post('room-types')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  upsertRoomType(@CurrentUser() user: JwtUser, @Body() dto: RoomTypeDto) {
    return this.service.upsertRoomType(user, dto);
  }

  @Post('room-types/seed-defaults')
  @RequireAnyPermission('infrastructure:admin', 'org:manage')
  seedRoomTypes(@CurrentUser() user: JwtUser) {
    return this.service.seedRoomTypes(user);
  }

  @Get('rooms')
  @RequireAnyPermission('infrastructure:view', 'org:read', 'academic:read')
  rooms(@CurrentUser() user: JwtUser, @Query() query: InfrastructureQueryDto) {
    return this.service.listRooms(user.tid, query);
  }

  @Post('rooms')
  @RequireAnyPermission('infrastructure:create', 'org:manage')
  createRoom(@CurrentUser() user: JwtUser, @Body() dto: RoomDto) {
    return this.service.createRoom(user, dto);
  }

  @Patch('rooms/:id')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  updateRoom(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<RoomDto>,
  ) {
    return this.service.updateRoom(user, id, dto);
  }

  @Delete('rooms/:id')
  @RequireAnyPermission('infrastructure:delete', 'org:manage')
  deleteRoom(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteRoom(user, id);
  }

  @Post('rooms/:id/archive')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  archiveRoom(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveRoom(user, id, true);
  }

  @Post('rooms/:id/activate')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  activateRoom(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveRoom(user, id, false);
  }

  @Post('rooms/bulk')
  @RequireAnyPermission('infrastructure:edit', 'org:manage')
  bulkRooms(
    @CurrentUser() user: JwtUser,
    @Body() dto: { ids?: string[]; action?: string },
  ) {
    return this.service.bulkRooms(user, dto);
  }

  @Get('labs')
  @RequireAnyPermission('infrastructure:view', 'academic:read')
  labs(@CurrentUser() user: JwtUser) {
    return this.service.labs(user.tid);
  }

  @Get('shared-halls')
  @RequireAnyPermission('infrastructure:view', 'academic:read')
  sharedHalls(@CurrentUser() user: JwtUser) {
    return this.service.sharedHalls(user.tid);
  }

  @Get('availability')
  @RequireAnyPermission('infrastructure:view', 'academic:read')
  availability(
    @CurrentUser() user: JwtUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.service.availability(user.tid, query);
  }

  @Get('reservations')
  @RequireAnyPermission('infrastructure:view', 'academic:read')
  reservations(
    @CurrentUser() user: JwtUser,
    @Query() query: ReservationQueryDto,
  ) {
    return this.service.listReservations(user.tid, query);
  }

  @Post('reservations')
  @RequireAnyPermission(
    'infrastructure:assign',
    'infrastructure:edit',
    'org:manage',
  )
  reserve(@CurrentUser() user: JwtUser, @Body() dto: ReservationDto) {
    return this.service.reserve(user, dto);
  }

  @Patch('reservations/:id/status')
  @RequireAnyPermission(
    'infrastructure:assign',
    'infrastructure:edit',
    'org:manage',
  )
  reservationStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReservationStatusDto,
  ) {
    return this.service.updateReservationStatus(user, id, dto);
  }

  @Get('reports/:type')
  @RequireAnyPermission(
    'infrastructure:reports',
    'infrastructure:view',
    'org:read',
  )
  reports(@CurrentUser() user: JwtUser, @Param('type') type: string) {
    return this.service.reports(user.tid, type);
  }

  @Get('import/template')
  @RequireAnyPermission(
    'infrastructure:import',
    'infrastructure:view',
    'org:read',
  )
  async template(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buffer = await this.service.template(user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="infrastructure-room-template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('export')
  @RequireAnyPermission(
    'infrastructure:export',
    'infrastructure:view',
    'org:read',
  )
  async export(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buffer = await this.service.exportRooms(user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="infrastructure-rooms.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import/validate')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @RequireAnyPermission('infrastructure:import', 'org:manage')
  validateImport(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.importPreview(user.tid, file.buffer);
  }

  @Post('import/commit')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @RequireAnyPermission('infrastructure:import', 'org:manage')
  commitImport(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.importCommit(user, file.buffer);
  }

  @Get('audit-logs')
  @RequirePermissions('infrastructure:admin')
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.service.auditLogs(user.tid);
  }
}
