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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  AssignSchoolClubMembersDto,
  AssignSchoolHouseMembersDto,
  BulkSchoolClassSubjectsDto,
  BulkSchoolPromotionDto,
  CreateSchoolSectionDto,
  PatchSchoolSectionDto,
  SaveSchoolAcademicYearDto,
  SaveSchoolClubActivityDto,
  SaveSchoolClubDto,
  SaveSchoolGradeDto,
  SaveSchoolHouseDto,
  SaveSchoolIdCardTemplateDto,
  SaveSchoolOptionalMappingDto,
} from './dto/school-sis.dto';
import { SchoolSisAcademicService } from './school-sis-academic.service';
import { SchoolSisService } from './school-sis.service';

@ApiBearerAuth()
@ApiTags('school-sis-academic')
@Controller({ path: 'school-sis/academic', version: '1' })
export class SchoolSisAcademicController {
  constructor(
    private readonly academic: SchoolSisAcademicService,
    private readonly sis: SchoolSisService,
  ) {}

  @Get('years')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  years(@CurrentUser() user: JwtUser) {
    return this.academic.listYears(user.tid);
  }

  @Post('years')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createYear(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolAcademicYearDto,
  ) {
    return this.academic.saveYear(user.tid, dto);
  }

  @Patch('years/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchYear(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolAcademicYearDto,
  ) {
    return this.academic.saveYear(user.tid, dto, id);
  }

  @Post('years/:id/activate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  activateYear(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.academic.activateYear(user.tid, id);
  }

  @Post('years/:id/archive')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  archiveYear(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.academic.archiveYear(user.tid, id);
  }

  @Get('classes')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  classes(@CurrentUser() user: JwtUser) {
    return this.academic.listClasses(user.tid);
  }

  @Post('grades')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createGrade(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolGradeDto) {
    return this.academic.saveGrade(user.tid, dto);
  }

  @Patch('grades/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchGrade(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolGradeDto,
  ) {
    return this.academic.saveGrade(user.tid, dto, id);
  }

  @Post('sections')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createSection(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSchoolSectionDto,
  ) {
    return this.sis.createSection(user.tid, dto);
  }

  @Patch('sections/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PatchSchoolSectionDto,
  ) {
    return this.academic.patchSection(user.tid, id, dto);
  }

  @Delete('sections/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deleteSection(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.academic.archiveSection(user.tid, id);
  }

  @Get('class-subjects')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  classSubjects(@CurrentUser() user: JwtUser) {
    return this.academic.classSubjectMatrix(user.tid);
  }

  @Put('class-subjects/bulk')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  bulkClassSubjects(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkSchoolClassSubjectsDto,
  ) {
    return this.academic.bulkMapClassSubjects(user.tid, dto);
  }

  @Get('staff-map')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  staffMap(@CurrentUser() user: JwtUser) {
    return this.academic.staffMap(user.tid);
  }

  @Get('optionals')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  optionals(
    @CurrentUser() user: JwtUser,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academic.listOptionals(user.tid, sectionId);
  }

  @Put('optionals')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveOptionals(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolOptionalMappingDto,
  ) {
    return this.academic.saveOptionalMapping(user.tid, dto);
  }

  @Get('houses')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  houses(@CurrentUser() user: JwtUser) {
    return this.academic.listHouses(user.tid);
  }

  @Post('houses')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createHouse(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolHouseDto) {
    return this.academic.saveHouse(user.tid, dto);
  }

  @Patch('houses/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchHouse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolHouseDto,
  ) {
    return this.academic.saveHouse(user.tid, dto, id);
  }

  @Put('houses/members')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  houseMembers(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignSchoolHouseMembersDto,
  ) {
    return this.academic.assignHouseMembers(user.tid, dto);
  }

  @Get('clubs')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  clubs(@CurrentUser() user: JwtUser) {
    return this.academic.listClubs(user.tid);
  }

  @Post('clubs')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createClub(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolClubDto) {
    return this.academic.saveClub(user.tid, dto);
  }

  @Patch('clubs/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchClub(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolClubDto,
  ) {
    return this.academic.saveClub(user.tid, dto, id);
  }

  @Put('clubs/:id/members')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  clubMembers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignSchoolClubMembersDto,
  ) {
    return this.academic.assignClubMembers(user.tid, id, dto);
  }

  @Post('clubs/:id/activities')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  clubActivity(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolClubActivityDto,
  ) {
    return this.academic.addClubActivity(user.tid, id, dto);
  }

  @Get('promotion')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  promotion(
    @CurrentUser() user: JwtUser,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academic.promotionBoard(user.tid, sectionId);
  }

  @Post('promotion')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  applyPromotion(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkSchoolPromotionDto,
  ) {
    return this.academic.applyPromotion(user.tid, dto, user.sub);
  }

  @Get('id-cards')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  idCards(@CurrentUser() user: JwtUser) {
    return this.academic.listIdCards(user.tid);
  }

  @Post('id-cards')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createIdCard(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolIdCardTemplateDto,
  ) {
    return this.academic.saveIdCard(user.tid, dto);
  }

  @Patch('id-cards/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchIdCard(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolIdCardTemplateDto,
  ) {
    return this.academic.saveIdCard(user.tid, dto, id);
  }

  @Get('id-cards/:id/preview')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  previewIdCard(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.academic.previewIdCard(user.tid, id, studentId);
  }
}
