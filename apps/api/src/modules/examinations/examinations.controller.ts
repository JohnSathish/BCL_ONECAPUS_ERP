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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  AllocateRoomsDto,
  ExamPaperDto,
  ExamQueryDto,
  ExamSessionDto,
  GenerateSeatingDto,
  InvigilatorDto,
  SaveExamMarksDto,
} from './dto/examinations.dto';
import { ExaminationsService } from './examinations.service';

@ApiBearerAuth()
@ApiTags('examinations')
@Controller({ path: 'examinations', version: '1' })
export class ExaminationsController {
  constructor(private readonly service: ExaminationsService) {}

  @Get('dashboard')
  @RequireAnyPermission('exam:view', 'exam:admin', 'academic:read')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Get('sessions')
  @RequireAnyPermission('exam:view', 'exam:admin', 'academic:read')
  sessions(@CurrentUser() user: JwtUser, @Query() query: ExamQueryDto) {
    return this.service.listSessions(user.tid, query);
  }

  @Post('sessions')
  @RequireAnyPermission('exam:create', 'exam:admin')
  createSession(@CurrentUser() user: JwtUser, @Body() dto: ExamSessionDto) {
    return this.service.createSession(user, dto);
  }

  @Patch('sessions/:id')
  @RequireAnyPermission('exam:edit', 'exam:admin')
  updateSession(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<ExamSessionDto>,
  ) {
    return this.service.updateSession(user, id, dto);
  }

  @Delete('sessions/:id')
  @RequireAnyPermission('exam:delete', 'exam:admin')
  archiveSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.archiveSession(user, id);
  }

  @Get('papers')
  @RequireAnyPermission('exam:view', 'exam:admin', 'academic:read')
  papers(@CurrentUser() user: JwtUser, @Query() query: ExamQueryDto) {
    return this.service.listPapers(user.tid, query);
  }

  @Get('portal/admit-card')
  @RequireAnyPermission('student:portal:self', 'exam:view')
  admitCard(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.service.studentAdmitCard(user, sessionId);
  }

  @Get('portal/results')
  @RequireAnyPermission('student:portal:self', 'exam:view')
  studentResults(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.service.studentResults(user, sessionId);
  }

  @Post('sessions/:id/calculate-results')
  @RequireAnyPermission('exam:results', 'exam:admin')
  calculateResults(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.calculateResults(user, id);
  }

  @Post('sessions/:id/publish-results')
  @RequireAnyPermission('exam:results', 'exam:admin')
  publishResults(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.publishResults(user, id);
  }

  @Get('results')
  @RequireAnyPermission(
    'exam:results',
    'exam:reports',
    'exam:view',
    'exam:admin',
  )
  resultReports(@CurrentUser() user: JwtUser, @Query() query: ExamQueryDto) {
    return this.service.resultReports(user.tid, query);
  }

  @Get('print/:type')
  @RequireAnyPermission('exam:reports', 'exam:view', 'exam:admin')
  printData(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ExamQueryDto,
  ) {
    return this.service.printData(user.tid, type, query);
  }

  @Get('export/:type')
  @RequireAnyPermission('exam:reports', 'exam:view', 'exam:admin')
  async export(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ExamQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(user.tid, type, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="exam-${type}.csv"`,
    );
    res.send(csv);
  }

  @Post('papers')
  @RequireAnyPermission('exam:create', 'exam:admin')
  createPaper(@CurrentUser() user: JwtUser, @Body() dto: ExamPaperDto) {
    return this.service.createPaper(user, dto);
  }

  @Patch('papers/:id')
  @RequireAnyPermission('exam:edit', 'exam:admin')
  updatePaper(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<ExamPaperDto>,
  ) {
    return this.service.updatePaper(user, id, dto);
  }

  @Get('papers/:id')
  @RequireAnyPermission('exam:view', 'exam:admin', 'academic:read')
  paperDetails(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.details(user.tid, id);
  }

  @Get('papers/:id/marks')
  @RequireAnyPermission('exam:marks', 'exam:admin', 'academic:read')
  markRoster(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.markRoster(user.tid, id);
  }

  @Post('papers/:id/marks')
  @RequireAnyPermission('exam:marks', 'exam:admin')
  saveMarks(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveExamMarksDto,
  ) {
    return this.service.saveMarks(user, id, dto);
  }

  @Post('papers/:id/allocate-rooms')
  @RequireAnyPermission('exam:allocate', 'exam:admin')
  allocateRooms(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AllocateRoomsDto,
  ) {
    return this.service.allocateRooms(user, id, dto);
  }

  @Post('papers/:id/generate-seating')
  @RequireAnyPermission('exam:allocate', 'exam:admin')
  generateSeating(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: GenerateSeatingDto,
  ) {
    return this.service.generateSeating(user, id, dto);
  }

  @Post('papers/:id/invigilators')
  @RequireAnyPermission('exam:invigilate', 'exam:admin')
  assignInvigilator(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: InvigilatorDto,
  ) {
    return this.service.assignInvigilator(user, id, dto);
  }

  @Get('reports/:type')
  @RequireAnyPermission('exam:reports', 'exam:view', 'exam:admin')
  reports(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ExamQueryDto,
  ) {
    return this.service.reports(user.tid, type, query);
  }
}
