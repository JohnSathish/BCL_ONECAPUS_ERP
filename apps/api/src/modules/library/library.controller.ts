import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { PrismaService } from '../../database/prisma.service';
import {
  ActivityQueryDto,
  BookPreviewQueryDto,
  BookQueryDto,
  CamsLibraryBridgeDto,
  CopyIncidentQueryDto,
  CreateAccessionBookDto,
  CreateBookCopyDto,
  CreateBookDto,
  CreateCategoryDto,
  CreateDigitalAssetDto,
  CreateReadingZoneDto,
  CreateResearchItemDto,
  DigitalAssetQueryDto,
  HardwareScanDto,
  IssueBookDto,
  LibraryAssistantAskDto,
  LinkLibraryNaacEvidenceDto,
  LibraryMemberQueryDto,
  LibrarySettingsDto,
  LibrarySearchQueryDto,
  MemberDetailQueryDto,
  MemberSummaryQueryDto,
  NaacLibraryReportQueryDto,
  PayFineDto,
  ReadingAnalyticsQueryDto,
  RegisterVisitorDto,
  RenewLoanDto,
  ReportQueryDto,
  ResearchApprovalDto,
  ResearchItemQueryDto,
  ReportCopyIncidentDto,
  ReplaceCopyIncidentDto,
  ResolveIncidentDto,
  ReserveBookDto,
  ReturnBookDto,
  ScanAccessDto,
  UpdateAccessionWorkflowDto,
  UpdateBookDto,
  UpdateDigitalAssetDto,
  UpdateReadingZoneDto,
  UpdateResearchItemDto,
  VisitQueryDto,
  WaiveFineDto,
} from './dto/library.dto';
import { LibraryAccessService } from './services/library-access.service';
import { LibraryAnalyticsService } from './services/library-analytics.service';
import { LibraryCatalogueService } from './services/library-catalogue.service';
import { LibraryCopyIncidentsService } from './services/library-copy-incidents.service';
import { LibraryCirculationService } from './services/library-circulation.service';
import { LibraryDigitalAssetsService } from './services/library-digital-assets.service';
import { LibraryFinesService } from './services/library-fines.service';
import { LibraryMemberLookupService } from './services/library-member-lookup.service';
import { LibraryMembersService } from './services/library-members.service';
import { LibraryHardwareIntegrationService } from './services/library-hardware-integration.service';
import { LibraryKnowledgeAssistantService } from './services/library-knowledge-assistant.service';
import { LibraryNaacReportsService } from './services/library-naac-reports.service';
import { LibraryNotificationsService } from './services/library-notifications.service';
import { LibraryQuestionBankBridgeService } from './services/library-question-bank-bridge.service';
import { LibraryQrService } from './services/library-qr.service';
import { LibraryRecommendationService } from './services/library-recommendation.service';
import { LibraryReportsService } from './services/library-reports.service';
import { LibraryReservationService } from './services/library-reservation.service';
import { LibrarySearchService } from './services/library-search.service';
import { LibrarySettingsService } from './services/library-settings.service';
import { LibraryVisitorService } from './services/library-visitor.service';
import { LibraryZonesService } from './services/library-zones.service';
import { ResearchRepositoryService } from './services/research-repository.service';

const LIB_DESK = [
  'library:access-desk',
  'library:manage',
  'library:circulate',
] as const;
const LIB_READ = [
  'library:read',
  'library:manage',
  'library:circulate',
  'library:reports',
  'library:access-desk',
] as const;
const LIB_MANAGE = ['library:manage'] as const;
const LIB_CIRCULATE = ['library:circulate', 'library:manage'] as const;
const LIB_REPORTS = ['library:reports', 'library:manage'] as const;
const LIB_SETTINGS = ['library:settings', 'library:manage'] as const;
const LIB_DIGITAL_READ = [
  'library:digital:read',
  'library:digital:download',
  'library:read',
  'library:manage',
] as const;
const LIB_DIGITAL_MANAGE = [
  'library:digital:manage',
  'library:manage',
] as const;
const LIB_RESEARCH_READ = [
  'library:research:read',
  'library:read',
  'library:manage',
  'library:research:manage',
] as const;
const LIB_RESEARCH_SUBMIT = [
  'library:research:submit',
  'library:research:manage',
  'library:manage',
] as const;
const LIB_RESEARCH_MANAGE = [
  'library:research:manage',
  'library:manage',
] as const;

@ApiBearerAuth()
@ApiTags('library')
@Controller({ path: 'library', version: '1' })
export class LibraryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LibraryAccessService,
    private readonly analytics: LibraryAnalyticsService,
    private readonly catalogue: LibraryCatalogueService,
    private readonly circulation: LibraryCirculationService,
    private readonly incidents: LibraryCopyIncidentsService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly members: LibraryMembersService,
    private readonly reports: LibraryReportsService,
    private readonly naacReports: LibraryNaacReportsService,
    private readonly recommendations: LibraryRecommendationService,
    private readonly assistant: LibraryKnowledgeAssistantService,
    private readonly hardware: LibraryHardwareIntegrationService,
    private readonly reservations: LibraryReservationService,
    private readonly settings: LibrarySettingsService,
    private readonly visitors: LibraryVisitorService,
    private readonly digital: LibraryDigitalAssetsService,
    private readonly research: ResearchRepositoryService,
    private readonly qbBridge: LibraryQuestionBankBridgeService,
    private readonly qr: LibraryQrService,
    private readonly zones: LibraryZonesService,
    private readonly search: LibrarySearchService,
    private readonly notifications: LibraryNotificationsService,
    private readonly fines: LibraryFinesService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...LIB_READ)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.dashboard(user.tid);
  }

  @Get('dashboard/activity')
  @RequireAnyPermission(...LIB_READ)
  dashboardActivity(
    @CurrentUser() user: JwtUser,
    @Query() query: ActivityQueryDto,
  ) {
    return this.analytics.recentActivity(user.tid, query.limit ?? 20);
  }

  @Get('circulation/member-summary')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_READ)
  memberSummary(
    @CurrentUser() user: JwtUser,
    @Query() query: MemberSummaryQueryDto,
  ) {
    return this.circulation.memberSummary(user.tid, query.scanCode);
  }

  @Get('circulation/book-preview')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_READ)
  bookPreview(
    @CurrentUser() user: JwtUser,
    @Query() query: BookPreviewQueryDto,
  ) {
    return this.circulation.bookPreview(user.tid, query.barcode);
  }

  @Get('circulation/issue-preview')
  @RequireAnyPermission(...LIB_CIRCULATE)
  issuePreview(
    @CurrentUser() user: JwtUser,
    @Query('memberScan') memberScan: string,
    @Query('copyBarcode') copyBarcode: string,
  ) {
    return this.circulation.issuePreview(user.tid, memberScan, copyBarcode);
  }

  @Get('circulation/desk-context')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_READ)
  circulationDeskContext(@CurrentUser() user: JwtUser) {
    return this.circulation.deskContext(user.tid);
  }

  @Get('circulation/return-preview')
  @RequireAnyPermission(...LIB_CIRCULATE)
  returnPreview(
    @CurrentUser() user: JwtUser,
    @Query() query: BookPreviewQueryDto,
  ) {
    return this.circulation.returnPreview(user.tid, query.barcode);
  }

  @Get('circulation/renew-preview')
  @RequireAnyPermission(...LIB_CIRCULATE)
  renewPreview(
    @CurrentUser() user: JwtUser,
    @Query() query: BookPreviewQueryDto,
  ) {
    return this.circulation.renewPreview(user.tid, query.barcode);
  }

  @Get('copies/:id/qr')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_MANAGE)
  copyQr(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.qr.getCopyQr(user.tid, id);
  }

  @Post('access/scan')
  @RequireAnyPermission(...LIB_DESK)
  scan(@CurrentUser() user: JwtUser, @Body() dto: ScanAccessDto) {
    return this.access.scan(user.tid, dto);
  }

  @Post('access/self-checkin')
  @RequireAnyPermission('library:read', 'library:access-desk', 'library:manage')
  selfCheckIn(@CurrentUser() user: JwtUser, @Body() body: { zoneId?: string }) {
    return this.access.selfCheckIn(user, body.zoneId);
  }

  @Get('zones')
  @RequireAnyPermission(...LIB_READ)
  listZones(@CurrentUser() user: JwtUser) {
    return this.zones.list(user.tid);
  }

  @Get('zones/occupancy')
  @RequireAnyPermission(...LIB_READ)
  zoneOccupancy(@CurrentUser() user: JwtUser) {
    return this.zones.occupancy(user.tid);
  }

  @Post('zones')
  @RequireAnyPermission(...LIB_SETTINGS)
  createZone(@CurrentUser() user: JwtUser, @Body() dto: CreateReadingZoneDto) {
    return this.zones.create(user.tid, dto);
  }

  @Patch('zones/:id')
  @RequireAnyPermission(...LIB_SETTINGS)
  updateZone(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateReadingZoneDto,
  ) {
    return this.zones.update(user.tid, id, dto);
  }

  @Get('search')
  @RequireAnyPermission(...LIB_READ, ...LIB_DIGITAL_READ, ...LIB_RESEARCH_READ)
  unifiedSearch(
    @CurrentUser() user: JwtUser,
    @Query() query: LibrarySearchQueryDto,
  ) {
    return this.search.search(user, query.q, query.limit, query.type ?? 'ALL');
  }

  @Get('search/suggestions')
  @RequireAnyPermission(...LIB_READ, ...LIB_DIGITAL_READ, ...LIB_RESEARCH_READ)
  searchSuggestions(
    @CurrentUser() user: JwtUser,
    @Query() query: LibrarySearchQueryDto,
  ) {
    return this.search.suggestions(user, query.q, query.limit ?? 8);
  }

  @Post('circulation/notify-overdue')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_MANAGE)
  notifyOverdue(@CurrentUser() user: JwtUser) {
    return this.notifications.processOverdueReminders(user.tid);
  }

  @Post('circulation/notify-due-tomorrow')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_MANAGE)
  notifyDueTomorrow(@CurrentUser() user: JwtUser) {
    return this.notifications.processDueTomorrowReminders(user.tid);
  }

  @Get('circulation/incidents')
  @RequireAnyPermission(...LIB_READ)
  listIncidents(
    @CurrentUser() user: JwtUser,
    @Query() query: CopyIncidentQueryDto,
  ) {
    return this.incidents.listIncidents(user.tid, query);
  }

  @Post('circulation/incidents')
  @RequireAnyPermission(...LIB_CIRCULATE, ...LIB_MANAGE)
  reportIncident(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReportCopyIncidentDto,
  ) {
    return this.incidents.reportIncident(user, dto);
  }

  @Post('circulation/incidents/:id/replace')
  @RequireAnyPermission(...LIB_MANAGE)
  replaceIncident(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReplaceCopyIncidentDto,
  ) {
    return this.incidents.replaceCopy(user, id, dto);
  }

  @Post('circulation/incidents/:id/resolve')
  @RequireAnyPermission(...LIB_MANAGE)
  resolveIncident(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.incidents.resolveIncident(user, id, dto.notes);
  }

  @Post('circulation/accrue-fines')
  @RequireAnyPermission(...LIB_MANAGE)
  accrueFines(@CurrentUser() user: JwtUser) {
    return this.fines.accrueDailyRunningFines(user.tid);
  }

  @Get('circulation/fines')
  @RequireAnyPermission(...LIB_READ)
  listFines(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: 'UNPAID' | 'PAID' | 'WAIVED' | 'ALL',
  ) {
    return this.fines.listFines(user.tid, status ?? 'ALL');
  }

  @Post('circulation/fines/:id/pay')
  @RequireAnyPermission(...LIB_CIRCULATE)
  payFine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PayFineDto,
  ) {
    return this.fines.payFine(user, id, dto.notes);
  }

  @Post('circulation/fines/:id/waive')
  @RequireAnyPermission(...LIB_MANAGE)
  waiveFine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WaiveFineDto,
  ) {
    return this.fines.waiveFine(user, id, dto.reason);
  }

  @Post('circulation/renew')
  @RequireAnyPermission(...LIB_CIRCULATE)
  renew(@CurrentUser() user: JwtUser, @Body() dto: RenewLoanDto) {
    return this.circulation.renewLoan(user, dto.copyBarcode);
  }

  @Get('access/occupancy')
  @RequireAnyPermission(...LIB_DESK)
  occupancy(@CurrentUser() user: JwtUser) {
    return this.analytics.getOccupancy(user.tid);
  }

  @Get('access/desk-dashboard')
  @RequireAnyPermission(...LIB_DESK)
  accessDeskDashboard(@CurrentUser() user: JwtUser) {
    return this.access.accessDeskDashboard(user.tid);
  }

  @Get('access/visits')
  @RequireAnyPermission(...LIB_READ)
  visits(@CurrentUser() user: JwtUser, @Query() query: VisitQueryDto) {
    return this.access.listVisits(user.tid, query);
  }

  @Get('access/lookup/:scanCode')
  @RequireAnyPermission(...LIB_DESK)
  async lookupMember(
    @CurrentUser() user: JwtUser,
    @Param('scanCode') scanCode: string,
  ) {
    return this.lookup.lookup(user.tid, decodeURIComponent(scanCode));
  }

  @Post('visitors')
  @RequireAnyPermission(...LIB_DESK)
  registerVisitor(
    @CurrentUser() user: JwtUser,
    @Body() dto: RegisterVisitorDto,
  ) {
    return this.visitors.register(user.tid, dto);
  }

  @Get('visitors')
  @RequireAnyPermission(...LIB_READ)
  listVisitors(@CurrentUser() user: JwtUser) {
    return this.visitors.list(user.tid);
  }

  @Get('visitors/:passNumber')
  @RequireAnyPermission(...LIB_DESK)
  getVisitor(
    @CurrentUser() user: JwtUser,
    @Param('passNumber') passNumber: string,
  ) {
    return this.visitors.getByPass(user.tid, passNumber);
  }

  @Get('categories')
  @RequireAnyPermission(...LIB_READ)
  categories(@CurrentUser() user: JwtUser) {
    return this.catalogue.listCategories(user.tid);
  }

  @Post('categories')
  @RequirePermissions('library:manage')
  createCategory(@CurrentUser() user: JwtUser, @Body() dto: CreateCategoryDto) {
    return this.catalogue.createCategory(user.tid, dto);
  }

  @Get('books')
  @RequireAnyPermission(...LIB_READ)
  listBooks(@CurrentUser() user: JwtUser, @Query() query: BookQueryDto) {
    return this.catalogue.listBooks(user.tid, query);
  }

  @Get('books/:id')
  @RequireAnyPermission(...LIB_READ)
  getBook(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.catalogue.getBook(user.tid, id);
  }

  @Post('books')
  @RequirePermissions('library:manage')
  createBook(@CurrentUser() user: JwtUser, @Body() dto: CreateBookDto) {
    return this.catalogue.createBook(user.tid, dto);
  }

  @Patch('books/:id')
  @RequirePermissions('library:manage')
  updateBook(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.catalogue.updateBook(user.tid, id, dto);
  }

  @Get('accession/next')
  @RequirePermissions('library:manage')
  nextAccession(@CurrentUser() user: JwtUser) {
    return this.catalogue.peekNextAccessionNo(user.tid);
  }

  @Post('books/accession')
  @RequirePermissions('library:manage')
  createAccession(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAccessionBookDto,
  ) {
    return this.catalogue.createAccessionEntry(user.tid, dto);
  }

  @Patch('books/:id/accession')
  @RequirePermissions('library:manage')
  updateAccessionWorkflow(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccessionWorkflowDto,
  ) {
    return this.catalogue.updateAccessionWorkflow(user.tid, id, dto);
  }

  @Get('members')
  @RequireAnyPermission(...LIB_READ)
  listMembers(
    @CurrentUser() user: JwtUser,
    @Query() query: LibraryMemberQueryDto,
  ) {
    return this.members.listMembers(user.tid, query);
  }

  @Get('members/:memberId')
  @RequireAnyPermission(...LIB_READ)
  getMember(
    @CurrentUser() user: JwtUser,
    @Param('memberId') memberId: string,
    @Query() query: MemberDetailQueryDto,
  ) {
    return this.members.getMemberDetail(user.tid, memberId, query.memberType);
  }

  @Post('copies')
  @RequirePermissions('library:manage')
  addCopy(@CurrentUser() user: JwtUser, @Body() dto: CreateBookCopyDto) {
    return this.catalogue.addCopy(user.tid, dto);
  }

  @Post('circulation/issue')
  @RequireAnyPermission(...LIB_CIRCULATE)
  issue(@CurrentUser() user: JwtUser, @Body() dto: IssueBookDto) {
    return this.circulation.issue(user, dto);
  }

  @Post('circulation/return')
  @RequireAnyPermission(...LIB_CIRCULATE)
  returnBook(@CurrentUser() user: JwtUser, @Body() dto: ReturnBookDto) {
    return this.circulation.returnBook(user, dto);
  }

  @Get('circulation/overdue')
  @RequireAnyPermission(...LIB_READ)
  overdue(@CurrentUser() user: JwtUser) {
    return this.circulation.listOverdue(user.tid);
  }

  @Get('circulation/active')
  @RequireAnyPermission(...LIB_READ)
  activeLoans(@CurrentUser() user: JwtUser) {
    return this.circulation.listActiveLoans(user.tid);
  }

  @Post('circulation/reserve')
  @RequireAnyPermission('library:read', 'library:circulate', 'library:manage')
  reserve(@CurrentUser() user: JwtUser, @Body() dto: ReserveBookDto) {
    return this.reservations.reserve(user, dto);
  }

  @Post('circulation/reserve/:id/cancel')
  @RequireAnyPermission('library:read', 'library:circulate', 'library:manage')
  cancelReservation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.reservations.cancel(user, id);
  }

  @Get('reservations')
  @RequireAnyPermission(...LIB_READ)
  listReservations(@CurrentUser() user: JwtUser) {
    return this.reservations.listActive(user.tid);
  }

  @Get('reservations/queue')
  @RequireAnyPermission(...LIB_READ)
  reservationQueue(@CurrentUser() user: JwtUser) {
    return this.reservations.listQueue(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...LIB_SETTINGS)
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...LIB_SETTINGS)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: LibrarySettingsDto,
  ) {
    return this.settings.updateSettings(user.tid, dto);
  }

  @Get('me/visits')
  @RequireAnyPermission('library:read')
  myVisits(@CurrentUser() user: JwtUser) {
    return this.prismaStudentVisits(user);
  }

  @Get('me/fines')
  @RequireAnyPermission('library:read')
  async myFines(@CurrentUser() user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (!student) return [];
    const fines = await this.fines.listFines(user.tid, 'UNPAID');
    return fines.filter((f) => f.loan.studentId === student.id);
  }

  @Get('me/loans')
  @RequireAnyPermission('library:read')
  myLoans(@CurrentUser() user: JwtUser) {
    return this.prismaStudentLoans(user);
  }

  @Get('me/reservations')
  @RequireAnyPermission('library:read')
  myReservations(@CurrentUser() user: JwtUser) {
    return this.prismaStudentReservations(user);
  }

  @Get('me/dashboard')
  @RequireAnyPermission('library:read')
  myLibraryDashboard(@CurrentUser() user: JwtUser) {
    return this.recommendations.getStudentDashboard(user);
  }

  @Get('me/recommendations')
  @RequireAnyPermission('library:read')
  myRecommendations(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
  ) {
    return this.recommendations.getRecommendations(
      user,
      limit ? Math.min(30, Number(limit) || 12) : 12,
    );
  }

  @Get('me/qr')
  @RequireAnyPermission('library:read')
  myQr(@CurrentUser() user: JwtUser) {
    return this.qr.getStudentQr(user);
  }

  @Post('me/check-in')
  @RequireAnyPermission('library:read')
  myCheckIn(@CurrentUser() user: JwtUser, @Body() body: { zoneId?: string }) {
    return this.access.selfCheckIn(user, body.zoneId);
  }

  @Get('students/:studentId/visits')
  @RequireAnyPermission(...LIB_READ)
  studentVisits(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.access.getStudentVisits(user.tid, studentId);
  }

  @Get('reports/visitors/daily')
  @RequireAnyPermission(...LIB_REPORTS)
  reportDailyVisitors(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.dailyVisitors(user.tid, query);
  }

  @Get('reports/visitors/department')
  @RequireAnyPermission(...LIB_REPORTS)
  reportDepartmentVisitors(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.departmentWiseVisitors(user.tid, query);
  }

  @Get('reports/visitors/gender')
  @RequireAnyPermission(...LIB_REPORTS)
  reportGenderVisitors(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.genderWiseVisitors(user.tid, query);
  }

  @Get('reports/visitors/peak-hours')
  @RequireAnyPermission(...LIB_REPORTS)
  reportPeakHours(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.peakHours(user.tid, query);
  }

  @Get('reports/books/accession')
  @RequireAnyPermission(...LIB_REPORTS)
  reportAccession(@CurrentUser() user: JwtUser) {
    return this.reports.accessionRegister(user.tid);
  }

  @Get('reports/books/category-stock')
  @RequireAnyPermission(...LIB_REPORTS)
  reportCategoryStock(@CurrentUser() user: JwtUser) {
    return this.reports.categoryStock(user.tid);
  }

  @Get('reports/transactions/issues')
  @RequireAnyPermission(...LIB_REPORTS)
  reportIssues(@CurrentUser() user: JwtUser, @Query() query: ReportQueryDto) {
    return this.reports.issueReport(user.tid, query);
  }

  @Get('reports/transactions/returns')
  @RequireAnyPermission(...LIB_REPORTS)
  reportReturns(@CurrentUser() user: JwtUser, @Query() query: ReportQueryDto) {
    return this.reports.returnReport(user.tid, query);
  }

  @Get('reports/transactions/fines')
  @RequireAnyPermission(...LIB_REPORTS)
  reportFines(@CurrentUser() user: JwtUser, @Query() query: ReportQueryDto) {
    return this.reports.fineReport(user.tid, query);
  }

  @Get('reports/transactions/most-borrowed')
  @RequireAnyPermission(...LIB_REPORTS)
  reportMostBorrowed(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.mostBorrowed(user.tid, query);
  }

  @Get('reports/transactions/least-borrowed')
  @RequireAnyPermission(...LIB_REPORTS)
  reportLeastBorrowed(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.leastBorrowed(user.tid, query);
  }

  @Get('analytics/footfall')
  @RequireAnyPermission(...LIB_REPORTS)
  footfallTrends(@CurrentUser() user: JwtUser) {
    return this.analytics.footfallTrends(user.tid);
  }

  @Get('analytics/department-heatmap')
  @RequireAnyPermission(...LIB_REPORTS)
  departmentHeatmap(@CurrentUser() user: JwtUser) {
    return this.analytics.departmentHeatmap(user.tid);
  }

  @Get('analytics/gender-trends')
  @RequireAnyPermission(...LIB_REPORTS)
  genderTrends(@CurrentUser() user: JwtUser) {
    return this.analytics.genderTrends(user.tid);
  }

  @Get('analytics/reading')
  @RequireAnyPermission(...LIB_REPORTS)
  readingAnalytics(
    @CurrentUser() user: JwtUser,
    @Query() query: ReadingAnalyticsQueryDto,
  ) {
    return this.analytics.readingAnalytics(user.tid, query.days ?? 365);
  }

  @Get('reports/export/department-visitors.csv')
  @RequireAnyPermission(...LIB_REPORTS)
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="department-visitors.csv"',
  )
  async exportDepartmentCsv(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    const csv = await this.reports.exportDepartmentVisitorsCsv(user.tid, query);
    return csv;
  }

  @Get('reports/export/accession.csv')
  @RequireAnyPermission(...LIB_REPORTS)
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="accession-register.csv"',
  )
  async exportAccessionCsv(@CurrentUser() user: JwtUser) {
    return this.reports.exportAccessionCsv(user.tid);
  }

  @Get('reports/export/overdue.csv')
  @RequireAnyPermission(...LIB_REPORTS)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="overdue-loans.csv"')
  async exportOverdueCsv(@CurrentUser() user: JwtUser) {
    return this.reports.exportOverdueCsv(user.tid);
  }

  @Get('reports/export/fines.csv')
  @RequireAnyPermission(...LIB_REPORTS)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="library-fines.csv"')
  async exportFinesCsv(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.exportFinesCsv(user.tid, query);
  }

  @Get('reports/digital/downloads')
  @RequireAnyPermission(...LIB_REPORTS)
  reportDigitalDownloads(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.digitalDownloadReport(user.tid, query);
  }

  @Get('reports/digital/popular')
  @RequireAnyPermission(...LIB_REPORTS)
  reportPopularDigital(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.popularDigitalAssets(user.tid, query);
  }

  @Get('reports/research/usage')
  @RequireAnyPermission(...LIB_REPORTS)
  reportResearchUsage(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.researchUsageReport(user.tid, query);
  }

  @Get('reports/naac/summary')
  @RequireAnyPermission(...LIB_REPORTS)
  naacReportSummary(
    @CurrentUser() user: JwtUser,
    @Query() query: NaacLibraryReportQueryDto,
  ) {
    return this.naacReports.buildBundle(user.tid, query);
  }

  @Get('reports/naac/export')
  @RequireAnyPermission(...LIB_REPORTS)
  async naacReportExport(
    @CurrentUser() user: JwtUser,
    @Query() query: NaacLibraryReportQueryDto,
    @Query('format') format?: 'pdf' | 'xlsx' | 'csv',
  ) {
    const result = await this.naacReports.export(
      user.tid,
      query,
      format ?? 'pdf',
    );
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Post('reports/naac/link-evidence')
  @RequireAnyPermission(...LIB_MANAGE)
  linkNaacEvidence(
    @CurrentUser() user: JwtUser,
    @Body() dto: LinkLibraryNaacEvidenceDto,
  ) {
    return this.naacReports.linkEvidence(user, dto);
  }

  @Get('assistant/prompts')
  @RequireAnyPermission(...LIB_READ)
  assistantPrompts(@CurrentUser() user: JwtUser) {
    const isStudent = user.roles?.includes('student') ?? false;
    return this.assistant.defaultPrompts(isStudent);
  }

  @Post('assistant/ask')
  @RequireAnyPermission(...LIB_READ)
  askAssistant(
    @CurrentUser() user: JwtUser,
    @Body() dto: LibraryAssistantAskDto,
  ) {
    return this.assistant.ask(user, dto.question);
  }

  @Post('integrations/hardware-scan')
  @RequireAnyPermission(...LIB_DESK, ...LIB_MANAGE)
  hardwareScan(@CurrentUser() user: JwtUser, @Body() dto: HardwareScanDto) {
    return this.hardware.hardwareScan(user.tid, dto);
  }

  @Post('integrations/cams-library')
  @RequireAnyPermission('cams:manage', ...LIB_MANAGE)
  camsLibraryBridge(
    @CurrentUser() user: JwtUser,
    @Body() dto: CamsLibraryBridgeDto,
  ) {
    return this.hardware.camsLibraryBridge(
      user.tid,
      dto.accessPointCode,
      dto.scanCode,
      dto.method,
    );
  }

  @Get('digital-assets')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  listDigitalAssets(
    @CurrentUser() user: JwtUser,
    @Query() query: DigitalAssetQueryDto,
  ) {
    return this.digital.list(user, query);
  }

  @Get('digital-assets/popular')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  popularDigital(@CurrentUser() user: JwtUser) {
    return this.digital.popular(user.tid);
  }

  @Get('digital-assets/links/question-bank')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  listQbLinks(@CurrentUser() user: JwtUser) {
    return this.qbBridge.listLinked(user.tid);
  }

  @Post('digital-assets/sync/question-bank')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  syncQuestionBank(@CurrentUser() user: JwtUser) {
    return this.qbBridge.syncAllPublished(user);
  }

  @Get('digital-assets/:id')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  getDigitalAsset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.digital.getById(user, id);
  }

  @Post('digital-assets')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createDigitalAsset(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDigitalAssetDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.digital.create(user, dto, file);
  }

  @Patch('digital-assets/:id')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateDigitalAsset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDigitalAssetDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.digital.update(user, id, dto, file);
  }

  @Post('digital-assets/:id/publish')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  publishDigitalAsset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.digital.publish(user, id);
  }

  @Post('digital-assets/:id/archive')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  archiveDigitalAsset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.digital.archive(user, id);
  }

  @Get('digital-assets/:id/download')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  async downloadDigitalAsset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.digital.openDownload(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('digital-assets/:id/preview')
  @RequireAnyPermission(...LIB_DIGITAL_READ)
  async previewDigitalAsset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.digital.openPreview(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
    });
  }

  @Post('digital-assets/sync/question-bank/:paperId')
  @RequireAnyPermission(...LIB_DIGITAL_MANAGE)
  syncQuestionPaper(
    @CurrentUser() user: JwtUser,
    @Param('paperId') paperId: string,
  ) {
    return this.qbBridge.syncPublishedPaper(user, paperId);
  }

  @Get('research')
  @RequireAnyPermission(...LIB_RESEARCH_READ)
  listResearch(
    @CurrentUser() user: JwtUser,
    @Query() query: ResearchItemQueryDto,
  ) {
    return this.research.list(user, query);
  }

  @Get('research/pending')
  @RequireAnyPermission(...LIB_RESEARCH_MANAGE)
  pendingResearch(@CurrentUser() user: JwtUser) {
    return this.research.pendingReview(user.tid);
  }

  @Get('research/popular')
  @RequireAnyPermission(...LIB_RESEARCH_READ)
  popularResearch(@CurrentUser() user: JwtUser) {
    return this.research.popular(user.tid);
  }

  @Get('research/:id')
  @RequireAnyPermission(...LIB_RESEARCH_READ)
  getResearch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.research.getById(user, id);
  }

  @Post('research')
  @RequireAnyPermission(...LIB_RESEARCH_SUBMIT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createResearch(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateResearchItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.research.create(user, dto, file);
  }

  @Patch('research/:id')
  @RequireAnyPermission(...LIB_RESEARCH_SUBMIT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  updateResearch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateResearchItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.research.update(user, id, dto, file);
  }

  @Post('research/:id/submit')
  @RequireAnyPermission(...LIB_RESEARCH_SUBMIT)
  submitResearch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.research.submit(user, id);
  }

  @Post('research/:id/review')
  @RequireAnyPermission(...LIB_RESEARCH_MANAGE)
  reviewResearch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResearchApprovalDto,
  ) {
    return this.research.review(user, id, dto);
  }

  @Get('research/:id/download')
  @RequireAnyPermission(...LIB_RESEARCH_READ)
  async downloadResearch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { stream, fileName } = await this.research.openDownload(
      user,
      id,
      extractClientIp(req),
    );
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  private async prismaStudentVisits(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) return { items: [], totalVisits: 0 };
    return this.access.getStudentVisits(user.tid, student.id);
  }

  private async prismaStudentLoans(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) return [];
    return this.circulation.getMemberLoans(user.tid, student.id);
  }

  private async prismaStudentReservations(user: JwtUser) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) return [];
    return this.reservations.getStudentReservations(user.tid, student.id);
  }
}
