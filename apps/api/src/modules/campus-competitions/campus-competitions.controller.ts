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
  AllocateByKeysDto,
  AllocateStudentsDto,
  AssignBibsDto,
  AutoAllocateDto,
  BulkTransferDto,
  CreateTeamDto,
  GenerateFixturesDto,
  RegisterEntryDto,
  TransferByKeyDto,
  TransferStudentDto,
  TransitionMeetStatusDto,
  UpsertCoordinatorDto,
  UpsertEventDto,
  UpsertHouseDto,
  UpsertMeetDto,
  UpsertPointRulesDto,
  UpsertResultsDto,
} from './dto/campus-competitions.dto';
import { CompetitionChampionshipService } from './services/competition-championship.service';
import { CompetitionCheckInService } from './services/competition-check-in.service';
import { CompetitionHousesService } from './services/competition-houses.service';
import { CompetitionMeetsService } from './services/competition-meets.service';
import { CompetitionScoringService } from './services/competition-scoring.service';

@Controller('campus-competitions')
export class CampusCompetitionsController {
  constructor(
    private readonly houses: CompetitionHousesService,
    private readonly meets: CompetitionMeetsService,
    private readonly scoring: CompetitionScoringService,
    private readonly championship: CompetitionChampionshipService,
    private readonly checkIns: CompetitionCheckInService,
  ) {}

  @Public()
  @Get('display/:token/live')
  publicLiveBoard(@Param('token') token: string) {
    return this.scoring.publicLiveBoard(token);
  }

  @Public()
  @Post('public/events/:eventId/check-in')
  publicCheckIn(
    @Param('eventId') eventId: string,
    @Query('token') token: string,
    @Body()
    body: {
      entryId?: string;
      qrPassToken?: string;
      scanCode?: string;
      rfidNumber?: string;
    },
  ) {
    return this.checkIns.publicCheckIn(eventId, token ?? '', body);
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

  @Post('houses/seed-defaults')
  @RequirePermissions('campus-competitions:manage')
  seedDefaultHouses(@CurrentUser() user: JwtUser) {
    return this.houses.seedDefaultHouses(user);
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

  @Post('allocations/by-keys')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  allocateByKeys(@CurrentUser() user: JwtUser, @Body() dto: AllocateByKeysDto) {
    return this.houses.allocateByKeys(user, dto);
  }

  @Post('transfers')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  transfer(@CurrentUser() user: JwtUser, @Body() dto: TransferStudentDto) {
    return this.houses.transferStudent(user, dto);
  }

  @Post('transfers/by-key')
  @RequireAnyPermission(
    'campus-competitions:allocate',
    'campus-competitions:manage',
  )
  transferByKey(@CurrentUser() user: JwtUser, @Body() dto: TransferByKeyDto) {
    return this.houses.transferByKey(user, dto);
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

  @Get('mine')
  @RequireAnyPermission('campus-competitions:self', 'student:portal:self')
  myEntries(@CurrentUser() user: JwtUser) {
    return this.meets.myEntries(user);
  }

  @Get('me/medals')
  @RequireAnyPermission('campus-competitions:self', 'student:portal:self')
  myMedals(@CurrentUser() user: JwtUser, @Query('meetId') meetId?: string) {
    return this.scoring.myMedals(user, meetId);
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

  @Get('events/:eventId/fixtures')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:score',
  )
  listFixtures(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.meets.listFixtures(user, eventId);
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

  @Post('events/:eventId/assign-bibs')
  @RequirePermissions('campus-competitions:manage')
  assignBibs(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body() dto: AssignBibsDto,
  ) {
    return this.meets.assignBibs(user, eventId, dto ?? {});
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

  @Get('championship/:academicYearId/standings')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
    'campus-competitions:self',
    'student:portal:self',
  )
  yearStandings(
    @CurrentUser() user: JwtUser,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.championship.yearStandings(user, academicYearId);
  }

  @Post('championship/:academicYearId/declare-house-of-year')
  @RequirePermissions('campus-competitions:manage')
  declareHouseOfYear(
    @CurrentUser() user: JwtUser,
    @Param('academicYearId') academicYearId: string,
    @Body()
    body: {
      houseId?: string;
      trophyId?: string;
      meetId?: string;
      studentRecipientIds?: string[];
    },
  ) {
    return this.championship.declareHouseOfYear(user, academicYearId, body);
  }

  @Get('trophies')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:manage',
  )
  listTrophies(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.championship.listTrophies(user, status);
  }

  @Post('trophies')
  @RequirePermissions('campus-competitions:manage')
  createTrophy(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      name: string;
      code: string;
      trophyType?: string;
      description?: string;
    },
  ) {
    return this.championship.createTrophy(user, body);
  }

  @Patch('trophies/:id')
  @RequirePermissions('campus-competitions:manage')
  updateTrophy(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      trophyType?: string;
      description?: string;
      status?: string;
    },
  ) {
    return this.championship.updateTrophy(user, id, body);
  }

  @Post('trophies/award')
  @RequirePermissions('campus-competitions:manage')
  awardTrophy(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      trophyId: string;
      academicYearId: string;
      awardType: string;
      houseId?: string;
      studentId?: string;
      meetId?: string;
      title?: string;
      notes?: string;
    },
  ) {
    return this.championship.awardTrophy(user, body);
  }

  @Post('trophy-awards/:awardId/return')
  @RequirePermissions('campus-competitions:manage')
  returnTrophy(
    @CurrentUser() user: JwtUser,
    @Param('awardId') awardId: string,
  ) {
    return this.championship.returnTrophy(user, awardId);
  }

  @Get('events/:eventId/check-ins')
  @RequireAnyPermission(
    'campus-competitions:read',
    'campus-competitions:score',
    'campus-competitions:manage',
  )
  listCheckIns(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.checkIns.listCheckIns(user, eventId);
  }

  @Post('events/:eventId/check-in')
  @RequireAnyPermission(
    'campus-competitions:score',
    'campus-competitions:manage',
  )
  checkIn(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      entryId?: string;
      qrPassToken?: string;
      scanCode?: string;
      rfidNumber?: string;
      method?: string;
    },
  ) {
    return this.checkIns.checkIn(user, eventId, body);
  }

  @Post('events/:eventId/check-in-token')
  @RequireAnyPermission(
    'campus-competitions:score',
    'campus-competitions:manage',
  )
  ensureCheckInToken(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.checkIns.ensureEventCheckInToken(user, eventId);
  }
}
