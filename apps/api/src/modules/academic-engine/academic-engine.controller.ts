import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { AcademicEngineService } from './academic-engine.service';
import { AdminRegistrationService } from './services/admin-registration.service';
import {
  CreateOfferingSectionDto,
  CreateProgramChoiceDto,
  CreateRegistrationDto,
  CreateRegistrationWindowDto,
  BulkAutoAssignDto,
  BulkGenerateRegistrationsDto,
  AutoAssignRegistrationDto,
  FreezeRegistrationDto,
  ListRegistrationsQueryDto,
  LockWindowDto,
  ResetVtcTrackDto,
  TrackOverrideDto,
  RejectRegistrationDto,
  UpdateRegistrationWorkflowDto,
  UpdateOfferingCapacityDto,
  UpdateRegistrationLinesDto,
  UpsertApprovalPolicyDto,
  UpsertStructureDto,
  UpsertStudentProfileDto,
  ValidateSubjectBasketDto,
} from './dto/academic-engine.dto';
import {
  ApplyFyugpTemplateDto,
  ApplyTemplateToVersionDto,
  CreateFyugpTemplateDto,
  UpdateFyugpTemplateDto,
} from './dto/fyugp-structure-template.dto';
import { FyugpStructureTemplateService } from './services/fyugp-structure-template.service';
import { CategoryPoolService } from './services/category-pool.service';
import { CurriculumCompletionService } from './services/curriculum-completion.service';
import {
  CurriculumCompletionExportQueryDto,
  CurriculumCompletionMissingItemsQueryDto,
  CurriculumCompletionQueryDto,
} from './dto/curriculum-completion-query.dto';
import { AdmissionPoolsService } from './services/admission-pools.service';
import { MajorMinorEligibilityService } from './services/major-minor-eligibility.service';
import { CourseEligibilityService } from './services/course-eligibility.service';
import {
  AddPoolCourseDto,
  AssignPoolDto,
  CreateCategoryPoolDto,
  RemovePoolCourseDto,
  ProvisionPoolSectionsDto,
  UpdateCategoryPoolDto,
  UpsertPoolAssignmentsDto,
  UpsertPoolExclusionDto,
} from './dto/category-pool.dto';

@ApiBearerAuth()
@ApiTags('academic-engine')
@Controller({ path: 'academic-engine', version: '1' })
export class AcademicEngineController {
  constructor(
    private readonly engine: AcademicEngineService,
    private readonly adminRegistration: AdminRegistrationService,
    private readonly fyugpTemplates: FyugpStructureTemplateService,
    private readonly categoryPools: CategoryPoolService,
    private readonly admissionPools: AdmissionPoolsService,
    private readonly eligibility: MajorMinorEligibilityService,
    private readonly courseEligibility: CourseEligibilityService,
    private readonly curriculumCompletion: CurriculumCompletionService,
  ) {}

  @Get('academic-subjects')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  listAcademicSubjects(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.courseEligibility.listAcademicSubjects(user.tid, institutionId);
  }

  @Get('summary')
  @RequirePermissions('academic-engine:read')
  summary(@CurrentUser() user: JwtUser) {
    return this.engine.getSummary(user.tid);
  }

  @Get('streams')
  @RequireAnyPermission(
    'academic-engine:read',
    'academic:read',
    'admissions:read',
  )
  listStreams(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.engine.listStreams(user.tid, institutionId);
  }

  @Get('shifts')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  listShifts(
    @CurrentUser() user: JwtUser,
    @Query('campusId') campusId?: string,
  ) {
    return this.engine.listShifts(user.tid, campusId);
  }

  @Get('classrooms')
  @RequirePermissions('academic-engine:read')
  listClassrooms(@CurrentUser() user: JwtUser) {
    return this.engine.listClassrooms(user.tid);
  }

  @Get('offerings/catalog')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  catalog(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId: string,
    @Query('semesterSequence') semesterSequence: string,
    @Query('shiftId') shiftId?: string,
    @Query('category') category?: string,
    @Query('studentId') studentId?: string,
    @Query('streamId') streamId?: string,
    @Query('majorSubjectSlug') majorSubjectSlug?: string,
    @Query('minorSubjectSlug') minorSubjectSlug?: string,
    @Query('class12Subjects') class12Subjects?: string,
    @Query('includeIneligible') includeIneligible?: string,
  ) {
    return this.engine.catalog(user, {
      programVersionId,
      semesterSequence: Number(semesterSequence),
      shiftId,
      category,
      studentId,
      streamId,
      majorSubjectSlug,
      minorSubjectSlug,
      class12Subjects,
      includeIneligible:
        includeIneligible === '1' || includeIneligible === 'true',
    });
  }

  @Get('offerings/:id/sections')
  @RequirePermissions('academic-engine:read')
  listSections(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.listOfferingSections(user, id);
  }

  @Post('offerings/:id/sections')
  @RequirePermissions('academic-engine:manage')
  createSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateOfferingSectionDto,
  ) {
    return this.engine.createOfferingSection(user, id, dto);
  }

  @Get('programs/:versionId/structure')
  @RequirePermissions('academic-engine:read')
  getStructure(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
  ) {
    return this.engine.getStructure(user.tid, versionId);
  }

  @Get('programs/:versionId/admission-pools')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  getAdmissionPools(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Query('semesterSequence') semesterSequence: string,
    @Query('shiftId') shiftId?: string,
    @Query('majorSubjectSlug') majorSubjectSlug?: string,
  ) {
    return this.admissionPools.getAdmissionPools(
      user.tid,
      versionId,
      Number(semesterSequence),
      shiftId,
      majorSubjectSlug,
    );
  }

  @Get('programs/:versionId/eligible-majors')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  listEligibleMajors(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    return this.eligibility.listEligibleMajors(
      user.tid,
      versionId,
      semesterSequence ? Number(semesterSequence) : 1,
    );
  }

  @Get('programs/:versionId/eligible-minors')
  @RequireAnyPermission(
    'academic-engine:read',
    'students:read',
    'students:manage',
  )
  listEligibleMinors(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Query('majorSubjectSlug') majorSubjectSlug: string,
    @Query('semesterSequence') semesterSequence?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.eligibility.listEligibleMinors(
      user.tid,
      versionId,
      majorSubjectSlug,
      semesterSequence ? Number(semesterSequence) : 1,
      academicYearId,
    );
  }

  @Get('fyugp/major-minor-rules')
  @RequirePermissions('academic-engine:read')
  listMajorMinorRules(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.eligibility.listMajorMinorRules(user.tid, institutionId);
  }

  @Post('admissions/validate-subject-basket')
  @RequireAnyPermission('academic-engine:read', 'students:manage')
  validateSubjectBasket(
    @CurrentUser() user: JwtUser,
    @Body() dto: ValidateSubjectBasketDto,
  ) {
    return this.admissionPools.validateSubjectBasket(user.tid, dto);
  }

  @Put('programs/:versionId/structure')
  @RequirePermissions('academic-engine:manage')
  upsertStructure(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Body() dto: UpsertStructureDto,
  ) {
    return this.engine.upsertStructure(user.tid, versionId, dto);
  }

  @Post('programs/:versionId/structure/load-nehu-defaults')
  @RequirePermissions('academic-engine:manage')
  loadNehuDefaults(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
  ) {
    return this.fyugpTemplates.loadNehuDefaultsForVersion(user.tid, versionId);
  }

  @Post('programs/:targetVersionId/structure/clone-from/:sourceVersionId')
  @RequirePermissions('academic-engine:manage')
  cloneStructure(
    @CurrentUser() user: JwtUser,
    @Param('targetVersionId') targetVersionId: string,
    @Param('sourceVersionId') sourceVersionId: string,
  ) {
    return this.fyugpTemplates.cloneStructureBetweenVersions(
      user.tid,
      sourceVersionId,
      targetVersionId,
    );
  }

  @Post('programs/:versionId/structure/apply-template/:templateId')
  @RequirePermissions('academic-engine:manage')
  applyTemplateToVersion(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyTemplateToVersionDto,
  ) {
    return this.fyugpTemplates.applyTemplateToVersion(
      user.tid,
      templateId,
      versionId,
      dto.conflictStrategy ?? 'REPLACE_ALL',
    );
  }

  @Get('fyugp-templates')
  @RequirePermissions('academic-engine:read')
  listFyugpTemplates(
    @CurrentUser() user: JwtUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.fyugpTemplates.listTemplates(
      user.tid,
      includeInactive !== 'true',
    );
  }

  @Post('fyugp-templates')
  @RequirePermissions('academic-engine:manage')
  createFyugpTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFyugpTemplateDto,
  ) {
    return this.fyugpTemplates.createTemplate(user.tid, user.sub, dto);
  }

  @Post('fyugp-templates/from-nehu-defaults')
  @RequirePermissions('academic-engine:manage')
  createFyugpTemplateFromNehuDefaults(@CurrentUser() user: JwtUser) {
    return this.fyugpTemplates.createFromNehuDefaults(user.tid, user.sub);
  }

  @Get('fyugp-templates/:id')
  @RequirePermissions('academic-engine:read')
  getFyugpTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fyugpTemplates.getTemplate(user.tid, id);
  }

  @Put('fyugp-templates/:id')
  @RequirePermissions('academic-engine:manage')
  updateFyugpTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFyugpTemplateDto,
  ) {
    return this.fyugpTemplates.updateTemplate(user.tid, id, dto);
  }

  @Delete('fyugp-templates/:id')
  @RequirePermissions('academic-engine:manage')
  deleteFyugpTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fyugpTemplates.deleteTemplate(user.tid, id);
  }

  @Post('fyugp-templates/:id/preview-apply')
  @RequirePermissions('academic-engine:read')
  previewApplyFyugpTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApplyFyugpTemplateDto,
  ) {
    return this.fyugpTemplates.previewApply(user.tid, id, dto);
  }

  @Post('fyugp-templates/:id/apply')
  @RequirePermissions('academic-engine:manage')
  applyFyugpTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApplyFyugpTemplateDto,
  ) {
    return this.fyugpTemplates.applyTemplate(user.tid, id, dto);
  }

  @Get('category-pools')
  @RequirePermissions('academic-engine:read')
  listCategoryPools(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
    @Query('categoryType') categoryType?: string,
    @Query('semesterNo') semesterNo?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categoryPools.listPools(user.tid, {
      institutionId,
      categoryType,
      semesterNo: semesterNo ? Number(semesterNo) : undefined,
      activeOnly: includeInactive !== 'true',
    });
  }

  @Get('category-pools/utilization')
  @RequirePermissions('academic-engine:read')
  categoryPoolUtilization(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.categoryPools.getPoolUtilization(user.tid, { institutionId });
  }

  @Post('category-pools/provision-sections')
  @RequirePermissions('academic-engine:manage')
  provisionPoolSections(
    @CurrentUser() user: JwtUser,
    @Body() dto: ProvisionPoolSectionsDto,
  ) {
    return this.categoryPools.provisionMissingPoolSections(user.tid, dto);
  }

  @Post('category-pools')
  @RequirePermissions('academic-engine:manage')
  createCategoryPool(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCategoryPoolDto,
  ) {
    return this.categoryPools.createPool(user.tid, user.sub, dto);
  }

  @Get('category-pools/:id')
  @RequirePermissions('academic-engine:read')
  getCategoryPool(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.categoryPools.getPool(user.tid, id);
  }

  @Put('category-pools/:id')
  @RequirePermissions('academic-engine:manage')
  updateCategoryPool(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryPoolDto,
  ) {
    return this.categoryPools.updatePool(user.tid, id, dto);
  }

  @Delete('category-pools/:id')
  @RequirePermissions('academic-engine:manage')
  deleteCategoryPool(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.categoryPools.deletePool(user.tid, id);
  }

  @Post('category-pools/:id/courses')
  @RequirePermissions('academic-engine:manage')
  addPoolCourse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddPoolCourseDto,
  ) {
    return this.categoryPools.addPoolCourse(user.tid, id, dto);
  }

  @Delete('category-pools/:id/courses')
  @RequirePermissions('academic-engine:manage')
  removePoolCourse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RemovePoolCourseDto,
  ) {
    return this.categoryPools.removePoolCourse(user.tid, id, dto.courseId);
  }

  @Post('category-pools/:id/preview-assign')
  @RequirePermissions('academic-engine:read')
  previewAssignCategoryPool(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignPoolDto,
  ) {
    return this.categoryPools.previewAssignPool(user.tid, id, dto);
  }

  @Post('category-pools/:id/assign')
  @RequirePermissions('academic-engine:manage')
  assignCategoryPool(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignPoolDto,
  ) {
    return this.categoryPools.assignPool(user.tid, id, dto);
  }

  @Get('programs/:versionId/pool-assignments')
  @RequirePermissions('academic-engine:read')
  getProgramPoolAssignments(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
  ) {
    return this.categoryPools.getProgramAssignments(user.tid, versionId);
  }

  @Put('programs/:versionId/pool-assignments')
  @RequirePermissions('academic-engine:manage')
  upsertProgramPoolAssignments(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Body() dto: UpsertPoolAssignmentsDto,
  ) {
    return this.categoryPools.upsertProgramAssignments(
      user.tid,
      versionId,
      dto.assignments,
    );
  }

  @Get('programs/:versionId/pool-exclusions')
  @RequirePermissions('academic-engine:read')
  listProgramPoolExclusions(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
  ) {
    return this.categoryPools.listProgramExclusions(user.tid, versionId);
  }

  @Post('programs/:versionId/pool-exclusions')
  @RequirePermissions('academic-engine:manage')
  upsertProgramPoolExclusion(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Body() dto: UpsertPoolExclusionDto,
  ) {
    return this.categoryPools.upsertPoolExclusion(user.tid, versionId, dto);
  }

  @Get('programs/:versionId/curriculum-coverage')
  @RequirePermissions('academic-engine:read')
  curriculumCoverageReport(
    @CurrentUser() user: JwtUser,
    @Param('versionId') versionId: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    return this.categoryPools.getCurriculumCoverageReport(
      user.tid,
      versionId,
      semesterSequence ? Number(semesterSequence) : undefined,
    );
  }

  @Get('offerings')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  listOfferings(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId?: string,
    @Query('semesterSequence') semesterSequence?: string,
    @Query('category') category?: string,
  ) {
    return this.engine.listOfferings(user.tid, {
      programVersionId,
      semesterSequence: semesterSequence ? Number(semesterSequence) : undefined,
      category,
    });
  }

  @Patch('offerings/:id/capacity')
  @RequirePermissions('academic-engine:manage')
  updateCapacity(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingCapacityDto,
  ) {
    return this.engine.updateOfferingCapacity(user.tid, id, dto);
  }

  @Get('students/:studentId/profile')
  @RequirePermissions('academic-engine:read')
  getProfile(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.engine.getStudentProfile(user.tid, studentId);
  }

  @Put('students/:studentId/profile')
  @RequirePermissions('academic-engine:manage')
  upsertProfile(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: UpsertStudentProfileDto,
  ) {
    return this.engine.upsertStudentProfile(user.tid, studentId, dto);
  }

  @Post('students/:studentId/choices')
  @RequirePermissions('academic-engine:manage')
  createChoice(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: CreateProgramChoiceDto,
  ) {
    return this.engine.createProgramChoice(user.tid, studentId, dto);
  }

  @Post('students/:studentId/major-minor-track/unlock')
  @RequirePermissions('academic:manage')
  unlockMajorMinorTrack(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: TrackOverrideDto,
  ) {
    return this.engine.unlockMajorMinorTrack(
      user.tid,
      studentId,
      user.sub,
      dto.reason,
    );
  }

  @Post('students/:studentId/vtc-track/reset')
  @RequirePermissions('academic:manage')
  resetVtcTrack(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: ResetVtcTrackDto,
  ) {
    return this.engine.resetVtcTrack(
      user.tid,
      studentId,
      user.sub,
      dto.reason,
      {
        trackGroupCode: dto.trackGroupCode,
        sem3OfferingId: dto.sem3OfferingId,
      },
    );
  }

  @Get('registration-windows')
  @RequirePermissions('academic-engine:read')
  listWindows(@CurrentUser() user: JwtUser) {
    return this.engine.listRegistrationWindows(user.tid);
  }

  @Post('registration-windows')
  @RequirePermissions('academic-engine:manage')
  createWindow(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRegistrationWindowDto,
  ) {
    return this.engine.createRegistrationWindow(user.tid, dto);
  }

  @Patch('registration-windows/:id/lock')
  @RequirePermissions('academic-engine:manage')
  lockWindow(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: LockWindowDto,
  ) {
    return this.engine.setWindowLocked(user.tid, id, dto.locked);
  }

  @Get('registrations')
  @RequirePermissions('academic-engine:manage')
  listRegistrations(
    @CurrentUser() user: JwtUser,
    @Query() query: ListRegistrationsQueryDto,
  ) {
    return this.adminRegistration.listRegistrations(user.tid, query);
  }

  @Get('registrations/students/:studentId/context')
  @RequirePermissions('academic-engine:manage')
  studentRegistrationContext(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.adminRegistration.getStudentRegistrationContext(
      user.tid,
      studentId,
      semesterId,
    );
  }

  @Post('registrations/bulk-auto-assign')
  @RequirePermissions('academic-engine:manage')
  bulkAutoAssign(@CurrentUser() user: JwtUser, @Body() dto: BulkAutoAssignDto) {
    return this.adminRegistration.bulkAutoAssign(user.tid, dto, user.sub);
  }

  @Post('registrations/bulk-generate')
  @RequirePermissions('academic-engine:manage')
  bulkGenerate(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkGenerateRegistrationsDto,
  ) {
    return this.adminRegistration.bulkGenerate(user.tid, dto, user.sub);
  }

  @Post('registrations/freeze')
  @RequirePermissions('academic-engine:manage')
  freezeRegistrations(
    @CurrentUser() user: JwtUser,
    @Body() dto: FreezeRegistrationDto,
  ) {
    return this.adminRegistration.setRegistrationFrozen(user.tid, dto.frozen, {
      studentIds: dto.studentIds,
      admissionBatchId: dto.admissionBatchId,
      programVersionId: dto.programVersionId,
    });
  }

  @Get('institutions/:institutionId/registration-workflow')
  @RequirePermissions('academic-engine:read')
  getRegistrationWorkflow(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
  ) {
    return this.adminRegistration.getWorkflowForInstitution(
      user.tid,
      institutionId,
    );
  }

  @Put('institutions/:institutionId/registration-workflow')
  @RequirePermissions('academic-engine:manage')
  updateRegistrationWorkflow(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Body() dto: UpdateRegistrationWorkflowDto,
  ) {
    return this.adminRegistration.updateWorkflow(user.tid, institutionId, dto);
  }

  @Get('registrations/me/workflow')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  myRegistrationWorkflow(@CurrentUser() user: JwtUser) {
    return this.engine.getMyRegistrationWorkflow(user.tid, user.sub);
  }

  @Get('registrations/me')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  myRegistration(
    @CurrentUser() user: JwtUser,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.engine.getMyRegistration(user.tid, user.sub, semesterId);
  }

  @Post('registrations/me')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  createMyRegistration(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.engine.createMyRegistration(user.tid, user.sub, dto);
  }

  @Patch('registrations/me/:id/lines')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  updateMyLines(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationLinesDto,
  ) {
    return this.engine.updateMyRegistrationLines(
      user.tid,
      user.sub,
      id,
      dto.lines,
    );
  }

  @Post('registrations/me/:id/validate')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  validateMy(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.validateMyRegistration(user.tid, user.sub, id);
  }

  @Get('registrations/me/credit-summary')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  myCreditSummary(@CurrentUser() user: JwtUser) {
    return this.engine.getMyCreditSummary(user.tid, user.sub);
  }

  @Post('registrations/me/:id/submit')
  @RequireAnyPermission('academic-engine:read', 'academic:read')
  submitMy(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.submitMyRegistration(user.tid, user.sub, id);
  }

  @Post('registrations/:id/auto-assign')
  @RequirePermissions('academic-engine:manage')
  autoAssignRegistration(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AutoAssignRegistrationDto,
  ) {
    return this.adminRegistration.autoAssignRegistration(
      user.tid,
      id,
      user.sub,
      dto.assignMode ?? 'COMPULSORY_ONLY',
    );
  }

  @Get('registrations/:id')
  @RequirePermissions('academic-engine:read')
  getRegistration(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.getRegistration(user.tid, id);
  }

  @Post('registrations/for-student/:studentId')
  @RequirePermissions('academic-engine:manage')
  createRegistrationForStudent(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.engine.createRegistration(user.tid, studentId, dto);
  }

  @Patch('registrations/:id/lines')
  @RequirePermissions('academic-engine:manage')
  updateLines(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationLinesDto,
  ) {
    return this.engine.updateRegistrationLines(user.tid, id, dto.lines, {
      registrationSource: 'ADMIN_ASSIGNED',
      assignedById: user.sub,
    });
  }

  @Post('registrations/:id/validate')
  @RequirePermissions('academic-engine:read')
  validate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.validateRegistration(user.tid, id);
  }

  @Post('registrations/:id/submit')
  @RequirePermissions('academic-engine:manage')
  submit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.submitRegistration(user.tid, id, user.sub);
  }

  @Post('registrations/:id/approve')
  @RequirePermissions('academic-engine:manage')
  approve(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.engine.approveRegistration(user.tid, id, user.sub, user.roles);
  }

  @Post('registrations/:id/reject')
  @RequirePermissions('academic-engine:manage')
  reject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.engine.rejectRegistration(user.tid, id, user.sub, dto.comment);
  }

  @Get('registration-policies')
  @RequirePermissions('academic-engine:read')
  listPolicies(@CurrentUser() user: JwtUser) {
    return this.engine.listApprovalPolicies(user.tid);
  }

  @Put('registration-policies')
  @RequirePermissions('academic-engine:manage')
  upsertPolicy(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertApprovalPolicyDto,
  ) {
    return this.engine.upsertApprovalPolicy(user.tid, dto);
  }

  @Post('waitlist/:lineId/promote')
  @RequirePermissions('academic-engine:manage')
  promoteWaitlist(
    @CurrentUser() user: JwtUser,
    @Param('lineId') lineId: string,
  ) {
    return this.engine.promoteWaitlist(user.tid, lineId, user.sub);
  }

  @Get('reports/mdc-conflicts')
  @RequirePermissions('academic-engine:read')
  mdcConflicts(@CurrentUser() user: JwtUser) {
    return this.engine.mdcConflictReport(user.tid);
  }

  @Get('reports/seat-utilization')
  @RequirePermissions('academic-engine:read')
  seatUtilization(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId?: string,
  ) {
    return this.engine.seatUtilizationReport(user.tid, programVersionId);
  }

  @Get('reports/registration-analytics')
  @RequirePermissions('academic-engine:read')
  registrationAnalytics(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId?: string,
  ) {
    return this.engine.registrationAnalytics(user.tid, programVersionId);
  }

  @Get('curriculum-completion/summary')
  @RequirePermissions('academic-engine:read')
  curriculumCompletionSummary(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumCompletionQueryDto,
  ) {
    return this.curriculumCompletion.getSummary(user.tid, query);
  }

  @Get('curriculum-completion/matrix')
  @RequirePermissions('academic-engine:read')
  curriculumCompletionMatrix(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumCompletionQueryDto,
  ) {
    return this.curriculumCompletion.getMatrix(user.tid, query);
  }

  @Get('curriculum-completion/missing-items')
  @RequirePermissions('academic-engine:read')
  curriculumCompletionMissingItems(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumCompletionMissingItemsQueryDto,
  ) {
    return this.curriculumCompletion.getMissingItems(user.tid, query);
  }

  @Get('curriculum-completion/shared-pools-audit')
  @RequirePermissions('academic-engine:read')
  curriculumCompletionSharedPoolsAudit(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumCompletionQueryDto,
  ) {
    return this.curriculumCompletion.getSharedPoolsAudit(user.tid, query);
  }

  @Get('curriculum-completion/export')
  @RequirePermissions('academic-engine:read')
  async curriculumCompletionExport(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumCompletionExportQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.curriculumCompletion.exportReport(user.tid, query);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }
}
