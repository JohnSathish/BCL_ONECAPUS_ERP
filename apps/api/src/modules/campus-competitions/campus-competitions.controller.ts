import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  AllocateStudentsDto,
  AutoAllocateDto,
  BulkTransferDto,
  CreateTeamDto,
  GenerateFixturesDto,
  RegisterEntryDto,
  TransferStudentDto,
  TransitionMeetStatusDto,
  UpsertCoordinatorDto,
  UpsertEventDto,
  UpsertHouseDto,
  UpsertMeetDto,
  UpsertPointRulesDto,
  UpsertResultsDto,
} from './dto/campus-competitions.dto';
import { CompetitionHousesService } from './services/competition-houses.service';
import { CompetitionMeetsService } from './services/competition-meets.service';
import { CompetitionScoringService } from './services/competition-scoring.service';

@Controller('campus-competitions')
export class CampusCompetitionsController {
  constructor(
    private readonly houses: CompetitionHousesService,
    private readonly meets: CompetitionMeetsService,
    private readonly scoring: CompetitionScoringService,
  ) {}

  @Public()
  @Get('display/:token/live')
  publicLiveBoard(@Param('token') token: string) {
    return this.scoring.publicLiveBoard(token);
  }

  @Get('meet-types')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:self',
  )
  meetTypes() {
    return this.meets.listMeetTypes();
  }

  @Get('houses')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:allocate',
  )
  listHouses(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.houses.listHouses(user, status);
  }

  @Post('houses')
  @RequirePermissions('campus-competitions:manage')
  createHouse(@CurrentUser() user: JwtUser, @Body() dto: UpsertHouseDto) {
    return this.houses.createHouse(user, dto);
  }

  @Get('houses/:id')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:allocate',
  )
  getHouse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.houses.getHouse(user, id);
  }

  @Patch('houses/:id')
  @RequirePermissions('campus-competitions:manage')
  updateHouse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertHouseDto,
  ) {
    return this.houses.updateHouse(user, id, dto);
  }

  @Post('houses/:id/status')
  @RequirePermissions('campus-competitions:manage')
  setHouseStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' },
  ) {
    return this.houses.setHouseStatus(user, id, body.status);
  }

  @Post('houses/:id/merge')
  @RequirePermissions('campus-competitions:manage')
  mergeHouse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { intoHouseId: string },
  ) {
    return this.houses.mergeHouses(user, id, body.intoHouseId);
  }

  @Post('houses/:id/coordinators')
  @RequirePermissions('campus-competitions:manage')
  upsertCoordinator(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertCoordinatorDto,
  ) {
    return this.houses.upsertCoordinator(user, id, dto);
  }

  @Delete('coordinators/:coordinatorId')
  @RequirePermissions('campus-competitions:manage')
  removeCoordinator(
    @CurrentUser() user: JwtUser,
    @Param('coordinatorId') coordinatorId: string,
  ) {
    return this.houses.removeCoordinator(user, coordinatorId);
  }

  @Get('houses/:id/dashboard')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:self',
  )
  houseDashboard(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('meetId') meetId?: string,
  ) {
    return this.houses.houseDashboard(user, id, meetId);
  }

  @Post('allocations')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  allocate(@CurrentUser() user: JwtUser, @Body() dto: AllocateStudentsDto) {
    return this.houses.allocateStudents(user, dto);
  }

  @Post('allocations/auto')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  autoAllocate(@CurrentUser() user: JwtUser, @Body() dto: AutoAllocateDto) {
    return this.houses.autoAllocate(user, dto);
  }

  @Post('allocations/import')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  importAllocations(
    @CurrentUser() user: JwtUser,
    @Body() body: { rows: Array<{ studentKey: string; houseCode: string }> },
  ) {
    return this.houses.importAllocations(user, body.rows ?? []);
  }

  @Post('transfers')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  transfer(@CurrentUser() user: JwtUser, @Body() dto: TransferStudentDto) {
    return this.houses.transferStudent(user, dto);
  }

  @Post('transfers/bulk')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  bulkTransfer(@CurrentUser() user: JwtUser, @Body() dto: BulkTransferDto) {
    return this.houses.bulkTransfer(user, dto);
  }

  @Get('transfers')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  transferHistory(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.houses.transferHistory(user, studentId);
  }

  @Get('me/house')
  @RequireAnyPermission('campus-competitions:self', 'student:portal:self')
  myHouse(@CurrentUser() user: JwtUser) {
    return this.houses.myHouse(user);
  }

  @Get('open')
  @RequireAnyPermission('campus-competitions:self', 'student:portal:self')
  openMeets(@CurrentUser() user: JwtUser) {
    return this.meets.openMeetsForStudents(user);
  }

  @Get('meets')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  listMeets(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.meets.listMeets(user, status);
  }

  @Post('meets')
  @RequirePermissions('campus-competitions:manage')
  createMeet(@CurrentUser() user: JwtUser, @Body() dto: UpsertMeetDto) {
    return this.meets.createMeet(user, dto);
  }

  @Get('meets/:id')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
    'campus-competitions:self',
  )
  getMeet(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meets.getMeet(user, id);
  }

  @Patch('meets/:id')
  @RequirePermissions('campus-competitions:manage')
  updateMeet(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertMeetDto,
  ) {
    return this.meets.updateMeet(user, id, dto);
  }

  @Post('meets/:id/status')
  @RequirePermissions('campus-competitions:manage')
  transitionMeet(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: TransitionMeetStatusDto,
  ) {
    return this.meets.transitionMeet(user, id, dto);
  }

  @Put('meets/:id/point-rules')
  @RequirePermissions('campus-competitions:manage')
  updatePointRules(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertPointRulesDto,
  ) {
    return this.meets.updatePointRules(user, id, dto);
  }

  @Get('meets/:id/categories')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
  )
  categories(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meets.listCategories(user, id);
  }

  @Post('meets/:id/events')
  @RequirePermissions('campus-competitions:manage')
  createEvent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertEventDto,
  ) {
    return this.meets.createEvent(user, id, dto);
  }

  @Get('meets/:id/leaderboard')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
    'campus-competitions:self',
    'student:portal:self',
  )
  leaderboard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.leaderboard(user, id);
  }

  @Get('meets/:id/live')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
    'campus-competitions:self',
    'student:portal:self',
  )
  liveBoard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.liveBoard(user, id);
  }

  @Post('meets/:id/display-token')
  @RequirePermissions('campus-competitions:manage')
  ensureDisplayToken(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meets.ensureDisplayToken(user, id);
  }

  @Post('meets/:id/live-event')
  @RequireAnyPermission(
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  setLiveEvent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { liveEventId?: string | null },
  ) {
    return this.meets.setLiveEvent(user, id, body.liveEventId ?? null);
  }

  @Get('meets/:id/announcements')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
    'campus-competitions:self',
  )
  listAnnouncements(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meets.listAnnouncements(user, id);
  }

  @Post('meets/:id/announcements')
  @RequireAnyPermission(
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  createAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { message: string; severity?: string },
  ) {
    return this.meets.createAnnouncement(
      user,
      id,
      body.message ?? '',
      body.severity ?? 'INFO',
    );
  }

  @Get('meets/:id/medals')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:self',
  )
  medals(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.medalTally(user, id);
  }

  @Get('meets/:id/reports/summary')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
  )
  reportsSummary(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.reportsSummary(user, id);
  }

  @Get('meets/:id/reports/csv')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
  )
  @Header('Content-Type', 'text/csv; charset=utf-8')
  reportsCsv(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.reportsCsv(user, id);
  }

  @Post('meets/:id/certificates/participation')
  @RequireAnyPermission(
    'campus-competitions:certificates',
    'campus-competitions:manage',
  )
  issueParticipation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.issueParticipationCertificates(user, id);
  }

  @Post('meets/:id/certificates/places')
  @RequireAnyPermission(
    'campus-competitions:certificates',
    'campus-competitions:manage',
  )
  issuePlaces(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.scoring.issuePlaceCertificates(user, id);
  }

  @Patch('events/:eventId')
  @RequirePermissions('campus-competitions:manage')
  updateEvent(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body() dto: UpsertEventDto,
  ) {
    return this.meets.updateEvent(user, eventId, dto);
  }

  @Get('events/:eventId')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
    'campus-competitions:self',
  )
  getEvent(@CurrentUser() user: JwtUser, @Param('eventId') eventId: string) {
    return this.meets.getEvent(user, eventId);
  }

  @Get('events/:eventId/entries')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  listEntries(@CurrentUser() user: JwtUser, @Param('eventId') eventId: string) {
    return this.meets.listEntries(user, eventId);
  }

  @Post('entries')
  @RequireAnyPermission(
    'campus-competitions:self',
    'campus-competitions:manage',
    'student:portal:self',
  )
  register(@CurrentUser() user: JwtUser, @Body() dto: RegisterEntryDto) {
    return this.meets.registerEntry(user, dto);
  }

  @Post('teams')
  @RequirePermissions('campus-competitions:manage')
  createTeam(@CurrentUser() user: JwtUser, @Body() dto: CreateTeamDto) {
    return this.meets.createTeam(user, dto);
  }

  @Post('events/:eventId/fixtures')
  @RequirePermissions('campus-competitions:manage')
  generateFixtures(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body() dto: GenerateFixturesDto,
  ) {
    return this.meets.generateFixtures(user, eventId, dto);
  }

  @Get('events/:eventId/results')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  listResults(@CurrentUser() user: JwtUser, @Param('eventId') eventId: string) {
    return this.scoring.listResults(user, eventId);
  }

  @Put('events/:eventId/results')
  @RequireAnyPermission(
    'campus-competitions:score',
    'campus-competitions:manage',
  )
  upsertResults(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body() dto: UpsertResultsDto,
  ) {
    return this.scoring.upsertResults(user, eventId, dto);
  }

  @Post('events/:eventId/results/publish')
  @RequireAnyPermission(
    'campus-competitions:score',
    'campus-competitions:manage',
    'campus-competitions:approve',
  )
  publishResults(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.scoring.publishEventResults(user, eventId);
  }

  @Post('events/:eventId/results/submit')
  @RequireAnyPermission(
    'campus-competitions:score',
    'campus-competitions:manage',
  )
  submitResults(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.scoring.submitResultsForApproval(user, eventId);
  }

  @Post('events/:eventId/results/approve')
  @RequireAnyPermission(
    'campus-competitions:approve',
    'campus-competitions:manage',
  )
  approveResults(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.scoring.approveAndPublishResults(user, eventId);
  }
}
