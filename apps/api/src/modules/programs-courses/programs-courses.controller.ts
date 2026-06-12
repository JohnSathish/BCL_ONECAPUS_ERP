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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CurriculumOfferingListQueryDto } from './dto/curriculum-offering-list-query.dto';
import {
  CreateCourseDto,
  CreateCourseOfferingDto,
  CreateOfferingSectionDto,
  CreateProgramDto,
  CreateProgramVersionDto,
  DuplicateProgramVersionDto,
  NormalizeProgramVersionsDto,
  RelabelProgramVersionDto,
  UpdateCourseDto,
  UpdateCourseOfferingDto,
  UpdateOfferingSectionDto,
  UpdateProgramDto,
} from './dto/programs-courses.dto';
import { CourseImportService } from './import/course-import.service';
import { ProgramsCoursesService } from './programs-courses.service';
import { CourseEligibilityService } from '../academic-engine/services/course-eligibility.service';
import {
  CourseEligibilityPreviewDto,
  CourseEligibilityStatsDto,
  UpdateCourseEligibilityDto,
} from './dto/course-eligibility.dto';

@ApiBearerAuth()
@ApiTags('programs-courses')
@RequireAnyPermission(
  'academic:read',
  'academic:manage',
  'academic-engine:read',
)
@Controller({ path: 'programs-courses', version: '1' })
export class ProgramsCoursesController {
  constructor(
    private readonly service: ProgramsCoursesService,
    private readonly courseImport: CourseImportService,
    private readonly courseEligibility: CourseEligibilityService,
  ) {}

  @Get('catalog-summary')
  catalogSummary(@CurrentUser() user: JwtUser) {
    return this.service.getCatalogSummary(user.tid);
  }

  @Get('programs')
  programs(@CurrentUser() user: JwtUser, @Query() query: PaginationQueryDto) {
    return this.service.listPrograms(user.tid, query);
  }

  @Get('programs/:id')
  getProgram(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getProgram(user.tid, id);
  }

  @Post('programs')
  @RequirePermissions('academic:manage')
  createProgram(@CurrentUser() user: JwtUser, @Body() dto: CreateProgramDto) {
    return this.service.createProgram(user.tid, dto);
  }

  @Patch('programs/:id')
  updateProgram(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.service.updateProgram(user.tid, id, dto);
  }

  @Delete('programs/:id')
  deleteProgram(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.softDeleteProgram(user.tid, id);
  }

  @Get('programs/:programId/versions')
  listProgramVersions(
    @CurrentUser() user: JwtUser,
    @Param('programId') programId: string,
  ) {
    return this.service.listProgramVersions(user.tid, programId);
  }

  @Get('program-versions/:id')
  getProgramVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getProgramVersion(user.tid, id);
  }

  @Post('program-versions')
  @RequirePermissions('academic:manage')
  createVersion(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateProgramVersionDto,
  ) {
    return this.service.createProgramVersion(user, dto);
  }

  @Post('program-versions/:id/publish')
  @RequirePermissions('academic:manage')
  publishVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.publishProgramVersion(user, id);
  }

  @Post('program-versions/:id/archive')
  @RequirePermissions('academic:manage')
  archiveVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveProgramVersion(user, id);
  }

  @Post('program-versions/:id/duplicate')
  @RequirePermissions('academic:manage')
  duplicateVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.duplicateProgramVersion(user, id);
  }

  @Delete('program-versions/:id')
  @RequirePermissions('academic:manage')
  deleteVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteProgramVersion(user.tid, id);
  }

  @Delete('program-versions/:id/purge')
  @RequirePermissions('academic:manage')
  purgeVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.purgeProgramVersion(user.tid, id);
  }

  @Patch('program-versions/:id/relabel')
  @RequirePermissions('academic:manage')
  relabelVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RelabelProgramVersionDto,
  ) {
    return this.service.relabelProgramVersion(user.tid, id, dto.version);
  }

  @Post('program-versions/normalize')
  @RequirePermissions('academic:manage')
  normalizeVersions(
    @CurrentUser() user: JwtUser,
    @Body() dto: NormalizeProgramVersionsDto,
  ) {
    return this.service.normalizeProgramVersions(user, dto);
  }

  @Get('data-cleanup/report')
  @RequirePermissions('academic:manage')
  dataCleanupReport(@CurrentUser() user: JwtUser) {
    return this.service.getProgramDataCleanupReport(user.tid);
  }

  @Delete('data-cleanup/versions/:id')
  @RequirePermissions('academic:manage')
  purgeCleanupVersion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.purgeCleanupVersion(user.tid, id);
  }

  @Delete('data-cleanup/programs/:id')
  @RequirePermissions('academic:manage')
  removeUnusedProgram(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.removeUnusedProgram(user.tid, id);
  }

  @Delete('data-cleanup/orphans/:programCode')
  @RequirePermissions('academic:manage')
  purgeOrphanProgramVersions(
    @CurrentUser() user: JwtUser,
    @Param('programCode') programCode: string,
  ) {
    return this.service.purgeOrphanProgramVersions(user.tid, programCode);
  }

  @Get('courses')
  courses(@CurrentUser() user: JwtUser, @Query() query: CourseListQueryDto) {
    return this.service.listCourses(user.tid, query);
  }

  @Get('courses/duplicate-check')
  checkCourseDuplicates(
    @CurrentUser() user: JwtUser,
    @Query('code') code?: string,
    @Query('title') title?: string,
    @Query('departmentId') departmentId?: string,
    @Query('excludeCourseId') excludeCourseId?: string,
  ) {
    return this.service.checkCourseDuplicates(user.tid, {
      code,
      title,
      departmentId,
      excludeCourseId,
    });
  }

  @Get('courses/export')
  @RequirePermissions('academic:manage')
  async exportCourses(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buffer = await this.courseImport.exportCourses(user.tid);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="courses_export_${date}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('courses/:id')
  getCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getCourse(user.tid, id);
  }

  @Post('courses')
  createCourse(@CurrentUser() user: JwtUser, @Body() dto: CreateCourseDto) {
    return this.service.createCourse(user.tid, dto);
  }

  @Patch('courses/:id')
  updateCourse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.service.updateCourse(user.tid, id, dto);
  }

  @Delete('courses/:id')
  deleteCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.softDeleteCourse(user.tid, id);
  }

  @Get('courses/:id/eligibility')
  getCourseEligibility(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.courseEligibility.getCourseRules(user.tid, id);
  }

  @Put('courses/:id/eligibility')
  @RequirePermissions('academic:manage')
  updateCourseEligibility(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseEligibilityDto,
  ) {
    return this.courseEligibility.updateCourseRules(
      user.tid,
      id,
      dto.eligibilityRules,
    );
  }

  @Post('courses/:id/eligibility/preview')
  previewCourseEligibility(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CourseEligibilityPreviewDto,
  ) {
    return this.courseEligibility.preview(user.tid, id, dto);
  }

  @Post('courses/:id/eligibility/stats')
  courseEligibilityStats(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CourseEligibilityStatsDto,
  ) {
    return this.courseEligibility.countPopulation(user.tid, id, dto);
  }

  @Get('offerings')
  offerings(
    @CurrentUser() user: JwtUser,
    @Query('programVersionId') programVersionId?: string,
  ) {
    return this.service.listOfferings(user.tid, programVersionId);
  }

  @Get('curriculum-offerings')
  curriculumOfferings(
    @CurrentUser() user: JwtUser,
    @Query() query: CurriculumOfferingListQueryDto,
  ) {
    return this.service.listCurriculumOfferings(user.tid, query);
  }

  @Post('offerings')
  createOffering(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCourseOfferingDto,
  ) {
    return this.service.createOffering(user.tid, dto);
  }

  @Patch('offerings/:id')
  updateOffering(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseOfferingDto,
  ) {
    return this.service.updateOffering(user.tid, id, dto);
  }

  @Delete('offerings/:id')
  deleteOffering(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteOffering(user.tid, id);
  }

  @Get('offerings/:offeringId/sections')
  listOfferingSections(
    @CurrentUser() user: JwtUser,
    @Param('offeringId') offeringId: string,
  ) {
    return this.service.listOfferingSections(user, offeringId);
  }

  @Post('offerings/:offeringId/sections')
  @RequireAnyPermission('academic:manage', 'academic-engine:manage')
  createOfferingSection(
    @CurrentUser() user: JwtUser,
    @Param('offeringId') offeringId: string,
    @Body() dto: CreateOfferingSectionDto,
  ) {
    return this.service.createOfferingSection(user, offeringId, dto);
  }

  @Patch('sections/:sectionId')
  @RequireAnyPermission('academic:manage', 'academic-engine:manage')
  updateOfferingSection(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateOfferingSectionDto,
  ) {
    return this.service.updateOfferingSection(user, sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @RequireAnyPermission('academic:manage', 'academic-engine:manage')
  deleteOfferingSection(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.deleteOfferingSection(user, sectionId);
  }
}
