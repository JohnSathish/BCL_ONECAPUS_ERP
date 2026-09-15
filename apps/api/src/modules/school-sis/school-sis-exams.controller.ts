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
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
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
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
  const roleBlob = (user.roles ?? []).join(' ').toLowerCase();
  return {
    userId: user.sub,
    email: user.email,
    manage,
    teacher: /teacher/.test(roleBlob) && !manage,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-exams')
@Controller({ path: 'school-sis/exams', version: '1' })
export class SchoolSisExamsController {
  constructor(private readonly exams: SchoolSisExamsService) {}

  @Get('settings')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.exams.dashboard(user.tid);
  }

  @Get('types')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  types(@CurrentUser() user: JwtUser) {
    return this.exams.listTypes(user.tid);
  }

  @Post('types')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  schedules(@CurrentUser() user: JwtUser, @Query('examId') examId?: string) {
    return this.exams.listSchedules(user.tid, examId);
  }

  @Post('schedules')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  schedule(@CurrentUser() user: JwtUser, @Body() dto: SaveExamScheduleDto) {
    return this.exams.saveSchedule(user.tid, dto, actor(user));
  }

  @Get('marks/roster')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  roster(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('sectionId') sectionId: string,
    @Query('componentId') componentId: string,
  ) {
    return this.exams.marksRoster(
      user.tid,
      examId,
      sectionId,
      componentId,
      actor(user),
    );
  }

  @Post('marks')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  publish(@CurrentUser() user: JwtUser, @Body() dto: PublishResultDto) {
    return this.exams.publish(user.tid, dto, actor(user), true);
  }

  @Post('results/unpublish')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  unpublish(@CurrentUser() user: JwtUser, @Body() dto: PublishResultDto) {
    return this.exams.publish(user.tid, dto, actor(user), false);
  }

  @Get('results')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  results(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.exams.listResults(user.tid, examId, sectionId);
  }

  @Get('report-card')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  card(
    @CurrentUser() user: JwtUser,
    @Query('examId') examId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.exams.reportCard(user.tid, examId, studentId, actor(user));
  }

  @Get('reports')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  reports(@CurrentUser() user: JwtUser, @Query('examId') examId: string) {
    return this.exams.reports(user.tid, examId);
  }

  @Get('students/:studentId/published')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  studentPublished(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.exams.studentPublished(user.tid, studentId);
  }

  @Get()
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  list(@CurrentUser() user: JwtUser) {
    return this.exams.listExams(user.tid);
  }

  @Post()
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  create(@CurrentUser() user: JwtUser, @Body() dto: SaveSchoolExamDto) {
    return this.exams.saveExam(user.tid, dto, actor(user));
  }

  @Get(':id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.exams.getExam(user.tid, id);
  }

  @Patch(':id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
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
