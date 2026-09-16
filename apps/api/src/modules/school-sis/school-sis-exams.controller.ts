import {
  Body,
  Controller,
  Delete,
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
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import {
  SIS_EXAMS_CREATE,
  SIS_EXAMS_MARKS,
  SIS_EXAMS_PUBLISH,
  SIS_EXAMS_VIEW,
} from './school-sis-iam.perms';
import { SchoolSisAccessService } from './school-sis-access.service';
import {
  GenerateResultsDto,
  PublishResultDto,
  ReopenMarksDto,
  SaveExamComponentDto,
  SaveExamMarksDto,
  SaveExamScheduleDto,
  SaveExamSubjectDto,
  SaveGradeSystemDto,
  SaveSchoolExamDto,
  SaveSchoolExamSettingsDto,
  SaveSchoolExamTypeDto,
} from './dto/school-exams.dto';
import {
  SchoolSisExamsService,
  type ExamActor,
} from './school-sis-exams.service';

function actor(user: JwtUser): ExamActor {
  const perms = user.permissions ?? [];
  const manage =
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) ||
    perms.includes('*') ||
    perms.includes('exams.results.publish');
  return {
    userId: user.sub,
    email: user.email,
    manage,
    teacher:
      (perms.includes('exams.marks.enter') ||
        /teacher/.test((user.roles ?? []).join(' '))) &&
      !manage,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-exams')
@Controller({ path: 'school-sis/exams', version: '1' })
export class SchoolSisExamsController {
  constructor(
    private readonly exams: SchoolSisExamsService,
    private readonly access: SchoolSisAccessService,
  ) {}

  @Get('settings')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.exams.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolExamSettingsDto,
  ) {
    return this.exams.saveSettings(user.tid, dto, actor(user));
  }

  @Get('dashboard')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.exams.dashboard(user.tid);
  }

  @Get('types')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  types(@CurrentUser() user: JwtUser) {
    return this.exams.listTypes(user.tid);
  }

  @Post('types')
  @RequireAnyPermission(...SIS_EXAMS_CREATE)
  createType(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolExamTypeDto) {
    return this.exams.saveType(user.tid, dto, actor(user));
  }

  @Patch('types/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateType(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolExamTypeDto,
  ) {
    return this.exams.saveType(user.tid, dto, actor(user), id);
  }

  @Get('grade-systems')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  grades(@CurrentUser() user: JwtUser) {
    return this.exams.listGradeSystems(user.tid);
  }

  @Post('grade-systems')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveGrade(@CurrentUser() user: JwtUser, @Body() dto: SaveGradeSystemDto) {
    return this.exams.saveGradeSystem(user.tid, dto, actor(user));
  }

  @Patch('grade-systems/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateGrade(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveGradeSystemDto,
  ) {
    return this.exams.saveGradeSystem(user.tid, dto, actor(user), id);
  }

  @Get('schedules')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  schedules(@CurrentUser() user: JwtUser, @Query('examId') examId?: string) {
    return this.exams.listSchedules(user.tid, examId);
  }

  @Post('schedules')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  schedule(@CurrentUser() user: JwtUser, @Body() dto: SaveExamScheduleDto) {
    return this.exams.saveSchedule(user.tid, dto, actor(user));
  }

  @Get('marks/roster')
  @RequireAnyPermission(...SIS_EXAMS_MARKS)
  async roster(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('sectionId') sectionId: string,
    @Query('componentId') componentId: string,
  ) {
    if (sectionId) {
      await this.access.assertSectionAccess(user.tid, user, sectionId);
    }
    return this.exams.marksRoster(
      user.tid,
      examId,
      sectionId,
      componentId,
      actor(user),
    );
  }

  @Post('marks')
  @RequireAnyPermission(...SIS_EXAMS_MARKS)
  saveMarks(@CurrentUser() user: JwtUser, @Body() dto: SaveExamMarksDto) {
    return this.exams.saveMarks(user.tid, dto, actor(user));
  }

  @Post('marks/reopen')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  reopen(@CurrentUser() user: JwtUser, @Body() dto: ReopenMarksDto) {
    return this.exams.reopenMarks(user.tid, dto, actor(user));
  }

  @Post('results/generate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  generate(@CurrentUser() user: JwtUser, @Body() dto: GenerateResultsDto) {
    return this.exams.generateResults(user.tid, dto, actor(user));
  }

  @Post('results/publish')
  @RequireAnyPermission(...SIS_EXAMS_PUBLISH)
  publish(@CurrentUser() user: JwtUser, @Body() dto: PublishResultDto) {
    return this.exams.publish(user.tid, dto, actor(user), true);
  }

  @Post('results/unpublish')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  unpublish(@CurrentUser() user: JwtUser, @Body() dto: PublishResultDto) {
    return this.exams.publish(user.tid, dto, actor(user), false);
  }

  @Get('results')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  results(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.exams.listResults(user.tid, examId, sectionId);
  }

  @Get('report-card')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  card(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.exams.reportCard(user.tid, examId, studentId, actor(user));
  }

  @Get('reports')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  reports(@CurrentUser() user: JwtUser, @Query('examId') examId: string) {
    return this.exams.reports(user.tid, examId);
  }

  @Get('students/:studentId/published')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  studentPublished(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.exams.studentPublished(user.tid, studentId);
  }

  @Get()
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  list(@CurrentUser() user: JwtUser) {
    return this.exams.listExams(user.tid);
  }

  @Post()
  @RequireAnyPermission(...SIS_EXAMS_CREATE)
  create(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolExamDto) {
    return this.exams.saveExam(user.tid, dto, actor(user));
  }

  @Get(':id')
  @RequireAnyPermission(...SIS_EXAMS_VIEW)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.exams.getExam(user.tid, id);
  }

  @Patch(':id')
  @RequireAnyPermission(...SIS_EXAMS_CREATE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolExamDto,
  ) {
    return this.exams.saveExam(user.tid, dto, actor(user), id);
  }

  @Delete(':id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.exams.archiveExam(user.tid, id, actor(user));
  }

  @Post(':id/subjects')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  subject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveExamSubjectDto,
  ) {
    return this.exams.saveSubject(user.tid, id, dto, actor(user));
  }

  @Post('subjects/:subjectId/components')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  component(
    @CurrentUser() user: JwtUser,
    @Param('subjectId') subjectId: string,
    @Body() dto: SaveExamComponentDto,
  ) {
    return this.exams.saveComponent(user.tid, subjectId, dto, actor(user));
  }
}
