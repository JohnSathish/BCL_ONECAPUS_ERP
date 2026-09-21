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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SchoolSisAccessService } from './school-sis-access.service';
import {
  SIS_STUDENTS_CREATE,
  SIS_STUDENTS_UPDATE,
  SIS_STUDENTS_VIEW,
} from './school-sis-iam.perms';
import {
  AddPreviousSchoolDto,
  AddStudentDocumentDto,
  AssignClassTeacherDto,
  AssignSchoolRollNumbersDto,
  AssignSubjectTeacherDto,
  ConvertApplicationDto,
  CreateAdmissionCycleDto,
  CreateSchoolSectionDto,
  CreateSchoolStaffDto,
  CreateSchoolStudentDto,
  EnrollStudentDto,
  PatchApplicationStatusDto,
  PromoteStudentDto,
  SaveSchoolClassSubjectsDto,
  SaveSchoolSubjectGradesDto,
  SaveSchoolStaffDto,
  SaveSchoolStudentMasterDto,
  SaveSchoolSubjectDto,
  SaveSchoolSubjectTypeDto,
  SaveSchoolTimetableBellsDto,
  SaveSchoolTimetableSlotDto,
  MoveSchoolTimetableSlotDto,
  CopySchoolTimetableDto,
  BulkSchoolTimetableSlotsDto,
  CreateSchoolRoomDto,
  UpdateSchoolFeeLineDto,
  UpdateSchoolFeeInstallmentDto,
} from './dto/school-sis.dto';
import { SchoolSisAdmissionService } from './school-sis-admission.service';
import { SchoolSisCurriculumService } from './school-sis-curriculum.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisStudentMasterService } from './school-sis-student-master.service';
import { SchoolSisFeesService } from './school-sis-fees.service';
import { SchoolSisTimetableService } from './school-sis-timetable.service';

@ApiBearerAuth()
@ApiTags('school-sis')
@Controller({ path: 'school-sis', version: '1' })
export class SchoolSisController {
  constructor(
    private readonly sis: SchoolSisService,
    private readonly admission: SchoolSisAdmissionService,
    private readonly curriculum: SchoolSisCurriculumService,
    private readonly master: SchoolSisStudentMasterService,
    private readonly timetable: SchoolSisTimetableService,
    private readonly fees: SchoolSisFeesService,
    private readonly access: SchoolSisAccessService,
  ) {}

  private canManageMedical(user: JwtUser) {
    return user.permissions?.includes(SCHOOL_SIS_PERMISSION_MANAGE) ?? false;
  }

  @Get('overview')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  overview(@CurrentUser() user: JwtUser) {
    return this.sis.overview(user.tid);
  }

  @Get('masters')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  masters(@CurrentUser() user: JwtUser) {
    return this.sis.listMasters(user.tid);
  }

  @Post('sections')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createSection(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSchoolSectionDto,
  ) {
    return this.sis.createSection(user.tid, dto);
  }

  @Get('curriculum')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  curriculumBundle(@CurrentUser() user: JwtUser) {
    return this.curriculum.listBundle(user.tid);
  }

  @Post('subject-types')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createSubjectType(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolSubjectTypeDto,
  ) {
    return this.curriculum.createType(user.tid, dto);
  }

  @Patch('subject-types/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchSubjectType(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolSubjectTypeDto,
  ) {
    return this.curriculum.updateType(user.tid, id, dto);
  }

  @Delete('subject-types/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deleteSubjectType(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.curriculum.deleteType(user.tid, id);
  }

  @Post('subjects')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createSubject(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolSubjectDto,
  ) {
    return this.curriculum.createSubject(user.tid, dto);
  }

  @Patch('subjects/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchSubject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolSubjectDto,
  ) {
    return this.curriculum.updateSubject(user.tid, id, dto);
  }

  @Delete('subjects/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deleteSubject(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.curriculum.deleteSubject(user.tid, id);
  }

  @Put('subjects/:id/grades')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  assignSubjectGrades(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolSubjectGradesDto,
  ) {
    return this.curriculum.assignSubjectGrades(user.tid, id, dto.gradeIds);
  }

  @Put('class-subjects')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveClassSubjects(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolClassSubjectsDto,
  ) {
    return this.curriculum.saveClassSubjects(user.tid, dto);
  }

  @Get('students')
  @RequireAnyPermission(...SIS_STUDENTS_VIEW)
  async students(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('gradeId') gradeId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ) {
    if (sectionId) {
      await this.access.assertSectionAccess(user.tid, user, sectionId);
    }
    const allowed = await this.access.sectionIdsForUser(user.tid, user.sub);
    return this.sis.listStudents(
      user.tid,
      q,
      gradeId,
      sectionId,
      status,
      allowed,
    );
  }

  @Post('students/master')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createMaster(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolStudentMasterDto,
  ) {
    return this.master.saveMaster(
      user.tid,
      user.sub,
      dto,
      undefined,
      this.canManageMedical(user),
    );
  }

  @Post('students/assign-roll-numbers')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  assignRollNumbers(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignSchoolRollNumbersDto,
  ) {
    return this.sis.assignRollNumbers(user.tid, dto.studentIds);
  }

  @Get('students/:id')
  @RequireAnyPermission(...SIS_STUDENTS_VIEW)
  async student(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const master = await this.master.getMaster(
      user.tid,
      id,
      this.canManageMedical(user),
    );
    const sectionId =
      master.enrollments?.find(
        (row: { status?: string; sectionId?: string }) =>
          row.status === 'ACTIVE',
      )?.sectionId ?? master.enrollments?.[0]?.sectionId;
    if (sectionId) {
      await this.access.assertSectionAccess(user.tid, user, sectionId);
    }
    return master;
  }

  @Post('students')
  @RequireAnyPermission(...SIS_STUDENTS_CREATE)
  createStudent(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSchoolStudentDto,
  ) {
    return this.sis.createStudent(user.tid, dto, user.sub);
  }

  @Patch('students/:id')
  @RequireAnyPermission(...SIS_STUDENTS_UPDATE)
  patchStudent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolStudentMasterDto,
  ) {
    return this.master.saveMaster(
      user.tid,
      user.sub,
      dto,
      id,
      this.canManageMedical(user),
    );
  }

  @Post('students/:id/photo')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind?: string,
  ) {
    const k = (kind ?? 'STUDENT').toUpperCase();
    const allowed = ['STUDENT', 'FATHER', 'MOTHER', 'GUARDIAN'] as const;
    if (!allowed.includes(k as (typeof allowed)[number])) {
      return this.master.savePhoto(user.tid, id, user.sub, 'STUDENT', file);
    }
    return this.master.savePhoto(
      user.tid,
      id,
      user.sub,
      k as (typeof allowed)[number],
      file,
    );
  }

  @Delete('students/:id/photo')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  removePhoto(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.master.removePhoto(user.tid, id, user.sub, 'STUDENT');
  }

  @Post('students/:id/documents/upload')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('slot') slot?: string,
  ) {
    return this.master.uploadDocument(
      user.tid,
      id,
      user.sub,
      slot || 'OTHER',
      file,
    );
  }

  @Get('students/:id/documents/:documentId/file')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  documentFile(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.master.streamDocument(user.tid, id, documentId);
  }

  @Delete('students/:id/documents/:documentId')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deleteDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.master.deleteDocument(user.tid, id, documentId, user.sub);
  }

  @Post('students/:id/previous-schools')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  previousSchool(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddPreviousSchoolDto,
  ) {
    return this.sis.addPreviousSchool(user.tid, id, dto);
  }

  @Post('students/:id/documents')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  document(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddStudentDocumentDto,
  ) {
    return this.sis.addDocument(user.tid, id, dto);
  }

  @Get('staff')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  staff(@CurrentUser() user: JwtUser) {
    return this.sis.listStaff(user.tid);
  }

  @Get('staff/next-employee-code')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  nextStaffEmployeeCode(
    @CurrentUser() user: JwtUser,
    @Query('staffType') staffType?: string,
  ) {
    return this.sis.previewStaffEmployeeCode(user.tid, staffType);
  }

  @Post('staff')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createStaff(@CurrentUser() user: JwtUser, @Body() dto: CreateSchoolStaffDto) {
    return this.sis.createStaff(user.tid, dto);
  }

  @Get('staff/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  staffOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sis.getStaff(user.tid, id);
  }

  @Patch('staff/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchStaff(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveSchoolStaffDto,
  ) {
    return this.sis.updateStaff(user.tid, id, dto);
  }

  @Post('staff/:id/photo')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  uploadStaffPhoto(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.sis.saveStaffPhoto(user.tid, id, file);
  }

  @Delete('staff/:id/photo')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  removeStaffPhoto(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sis.removeStaffPhoto(user.tid, id);
  }

  @Post('staff/:id/documents/upload')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  uploadStaffDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('slot') slot?: string,
  ) {
    return this.sis.saveStaffDocument(user.tid, id, slot || 'RESUME', file);
  }

  @Post('enrollments')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  enroll(@CurrentUser() user: JwtUser, @Body() dto: EnrollStudentDto) {
    return this.sis.enroll(user.tid, dto);
  }

  @Post('enrollments/promote')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  promote(@CurrentUser() user: JwtUser, @Body() dto: PromoteStudentDto) {
    return this.sis.promote(user.tid, dto, user.sub);
  }

  @Get('allocations')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  allocations(@CurrentUser() user: JwtUser) {
    return this.sis.listAllocations(user.tid);
  }

  @Post('allocations/class-teacher')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  classTeacher(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignClassTeacherDto,
  ) {
    return this.sis.assignClassTeacher(user.tid, dto);
  }

  @Post('allocations/subject-teacher')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  subjectTeacher(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssignSubjectTeacherDto,
  ) {
    return this.sis.assignSubjectTeacher(user.tid, dto);
  }

  @Get('admission/cycles')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  cycles(@CurrentUser() user: JwtUser) {
    return this.admission.listCycles(user.tid);
  }

  @Post('admission/cycles')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createCycle(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAdmissionCycleDto,
  ) {
    return this.admission.createCycle(user.tid, dto);
  }

  @Get('admission/applications')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  applications(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.admission.listApplications(user.tid, status);
  }

  @Patch('admission/applications/:id/status')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  patchApplication(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PatchApplicationStatusDto,
  ) {
    return this.admission.patchStatus(user.tid, id, dto);
  }

  @Post('admission/applications/:id/convert')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  convert(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConvertApplicationDto,
  ) {
    return this.admission.convert(user.tid, id, dto, user.sub);
  }

  @Get('timetable/setup')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  timetableSetup(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.timetable.ensureSetup(user.tid, academicYearId);
  }

  @Post('timetable/bells')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveBells(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolTimetableBellsDto,
  ) {
    return this.timetable.saveBells(user.tid, dto);
  }

  @Get('timetable/rooms')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  rooms(@CurrentUser() user: JwtUser) {
    return this.timetable.listRooms(user.tid);
  }

  @Post('timetable/rooms')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createRoom(@CurrentUser() user: JwtUser, @Body() dto: CreateSchoolRoomDto) {
    return this.timetable.createRoom(user.tid, dto.name);
  }

  @Delete('timetable/rooms/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deleteRoom(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.deleteRoom(user.tid, id);
  }

  @Get('timetable/class/:sectionId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  classTimetable(
    @CurrentUser() user: JwtUser,
    @Param('sectionId') sectionId: string,
  ) {
    const publishedOnly = !user.permissions?.includes(
      SCHOOL_SIS_PERMISSION_MANAGE,
    );
    return this.timetable.classGrid(user.tid, sectionId, publishedOnly);
  }

  @Get('timetable/teacher/:staffId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  teacherTimetable(
    @CurrentUser() user: JwtUser,
    @Param('staffId') staffId: string,
  ) {
    return this.timetable.teacherGrid(user.tid, staffId, false);
  }

  @Get('timetable/student/:studentId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  studentTimetable(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.timetable.studentGrid(user.tid, studentId);
  }

  @Get('timetable/master')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  masterTimetable(
    @CurrentUser() user: JwtUser,
    @Query('dayOfWeek') dayOfWeek?: string,
    @Query('sectionId') sectionId?: string,
    @Query('staffId') staffId?: string,
    @Query('room') room?: string,
  ) {
    return this.timetable.master(user.tid, {
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
      sectionId,
      staffId,
      room,
    });
  }

  @Get('timetable/validate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  validateTimetable(@CurrentUser() user: JwtUser) {
    return this.timetable.validate(user.tid);
  }

  @Post('timetable/publish')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  publishTimetable(@CurrentUser() user: JwtUser) {
    return this.timetable.publish(user.tid);
  }

  @Post('timetable/slots')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveSlot(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolTimetableSlotDto,
  ) {
    return this.timetable.upsertSlot(user.tid, dto);
  }

  @Post('timetable/slots/move')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  moveSlot(
    @CurrentUser() user: JwtUser,
    @Body() dto: MoveSchoolTimetableSlotDto,
  ) {
    return this.timetable.moveSlot(user.tid, dto);
  }

  @Post('timetable/copy')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  copyTimetable(
    @CurrentUser() user: JwtUser,
    @Body() dto: CopySchoolTimetableDto,
  ) {
    return this.timetable.copy(user.tid, dto);
  }

  @Post('timetable/slots/bulk')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  bulkSlots(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkSchoolTimetableSlotsDto,
  ) {
    return this.timetable.bulkUpsert(user.tid, dto);
  }

  @Get('timetable/dashboard')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  timetableDashboard(@CurrentUser() user: JwtUser) {
    return this.timetable.dashboard(user.tid);
  }

  @Get('timetable/today')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  timetableToday(
    @CurrentUser() user: JwtUser,
    @Query('sectionId') sectionId?: string,
    @Query('staffId') staffId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.timetable.todayBoard(user.tid, {
      sectionId,
      staffId,
      studentId,
    });
  }

  @Get('timetable/mine')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  myTimetable(@CurrentUser() user: JwtUser) {
    return this.timetable.myTimetable(user.tid, user);
  }

  @Get('timetable/print')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  async timetablePrint(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('dayOfWeek') dayOfWeek?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    const html = await this.timetable.printHtml(user.tid, {
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
      sectionId,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('timetable/pdf')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  async timetablePdf(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('dayOfWeek') dayOfWeek?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    const buf = await this.timetable.printPdf(user.tid, {
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
      sectionId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="st-lukes-timetable.pdf"',
    );
    res.send(buf);
  }

  @Get('timetable/excel')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  async timetableExcel(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('dayOfWeek') dayOfWeek?: string,
  ) {
    const buf = await this.timetable.exportExcel(
      user.tid,
      dayOfWeek ? Number(dayOfWeek) : undefined,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="st-lukes-timetable.xlsx"',
    );
    res.send(buf);
  }

  @Get('fees/structures')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  feeStructures(@CurrentUser() user: JwtUser) {
    return this.fees.list(user.tid);
  }

  @Get('fees/structures/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  feeStructureOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fees.one(user.tid, id);
  }

  @Patch('fees/structures/:id/lines/:lineId')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateFeeLine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateSchoolFeeLineDto,
  ) {
    return this.fees.updateLine(user.tid, id, lineId, dto);
  }

  @Patch('fees/structures/:id/installments/:installmentId')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateFeeInstallment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: UpdateSchoolFeeInstallmentDto,
  ) {
    return this.fees.updateInstallment(user.tid, id, installmentId, dto.amount);
  }

  @Get('fees/student/:studentId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  studentFees(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.fees.forStudent(user.tid, studentId);
  }
}
