import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { AcademicCalendarService } from './academic-calendar.service';
import {
  BulkHolidaysDto,
  CreateCalendarEventDto,
  EnsureCalendarDto,
  ListEventsQueryDto,
  MonthSummaryQueryDto,
  RangeQueryDto,
  ResolveQueryDto,
  UpdateCalendarDto,
  UpdateCalendarEventDto,
} from './dto/academic-calendar.dto';

const READ = [
  'academic-calendar:read',
  'academic-calendar:edit',
  'academic-calendar:manage',
  'academic:read',
  'academic:manage',
] as const;

const WRITE = ['academic-calendar:edit', 'academic-calendar:manage'] as const;

const RESOLVE = [
  ...READ,
  'staff-attendance:view',
  'staff-attendance:edit',
  'staff-attendance:settings:view',
  'students:read',
  'students:manage',
] as const;

@ApiBearerAuth()
@ApiTags('academic-calendar')
@Controller({ path: 'academic-calendar', version: '1' })
export class AcademicCalendarController {
  constructor(private readonly calendars: AcademicCalendarService) {}

  @Get('event-types')
  @RequireAnyPermission(...READ)
  eventTypes() {
    return this.calendars.listEventTypes();
  }

  @Get('years')
  @RequireAnyPermission(...READ)
  years(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.calendars.listYears(user.tid, institutionId);
  }

  @Get('resolve')
  @RequireAnyPermission(...RESOLVE)
  resolve(@CurrentUser() user: JwtUser, @Query() query: ResolveQueryDto) {
    return this.calendars.resolveDay(user.tid, query.date, {
      campusId: query.campusId,
      departmentId: query.departmentId,
      calendarId: query.calendarId,
      academicYearId: query.academicYearId,
    });
  }

  @Get('range')
  @RequireAnyPermission(...RESOLVE)
  range(@CurrentUser() user: JwtUser, @Query() query: RangeQueryDto) {
    return this.calendars.resolveRange(user.tid, query.from, query.to, {
      campusId: query.campusId,
      departmentId: query.departmentId,
      calendarId: query.calendarId,
      academicYearId: query.academicYearId,
    });
  }

  @Post('ensure')
  @RequireAnyPermission(...WRITE)
  ensure(@CurrentUser() user: JwtUser, @Body() dto: EnsureCalendarDto) {
    return this.calendars.getOrCreateForYear(user, dto.academicYearId, {
      title: dto.title,
      weekendDays: dto.weekendDays,
    });
  }

  @Get('events/:eventId')
  @RequireAnyPermission(...READ)
  getEvent(@CurrentUser() user: JwtUser, @Param('eventId') eventId: string) {
    return this.calendars.getEvent(user.tid, eventId);
  }

  @Patch('events/:eventId')
  @RequireAnyPermission(...WRITE)
  updateEvent(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendars.updateEvent(user, eventId, dto);
  }

  @Delete('events/:eventId')
  @RequireAnyPermission(...WRITE)
  deleteEvent(@CurrentUser() user: JwtUser, @Param('eventId') eventId: string) {
    return this.calendars.deleteEvent(user, eventId);
  }

  @Post('events/:eventId/duplicate')
  @RequireAnyPermission(...WRITE)
  duplicateEvent(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
  ) {
    return this.calendars.duplicateEvent(user, eventId);
  }

  @Post('events/:eventId/attachments')
  @RequireAnyPermission(...WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  addAttachment(
    @CurrentUser() user: JwtUser,
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.calendars.addAttachment(user, eventId, file);
  }

  @Get(':calendarId/events')
  @RequireAnyPermission(...READ)
  events(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Query() query: ListEventsQueryDto,
  ) {
    const types = query.types
      ? query.types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    return this.calendars.listEvents(user.tid, calendarId, {
      from: query.from,
      to: query.to,
      type: query.type,
      types,
      visibility: query.visibility,
      q: query.q,
      departmentId: query.departmentId,
      expandRecurrence: query.expandRecurrence !== false,
    });
  }

  @Get(':calendarId/month-summary')
  @RequireAnyPermission(...READ)
  monthSummary(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Query() query: MonthSummaryQueryDto,
  ) {
    return this.calendars.monthSummary(
      user.tid,
      calendarId,
      query.year,
      query.month,
    );
  }

  @Get(':calendarId/today')
  @RequireAnyPermission(...READ)
  today(@CurrentUser() user: JwtUser, @Param('calendarId') calendarId: string) {
    return this.calendars.todayEvents(user.tid, calendarId);
  }

  @Get(':calendarId/upcoming')
  @RequireAnyPermission(...READ)
  upcoming(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Query('limit') limit?: string,
  ) {
    return this.calendars.upcomingEvents(
      user.tid,
      calendarId,
      limit ? Number(limit) : 20,
    );
  }

  @Post(':calendarId/events')
  @RequireAnyPermission(...WRITE)
  createEvent(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendars.createEvent(user, calendarId, dto);
  }

  @Post(':calendarId/holidays/bulk')
  @RequireAnyPermission(...WRITE)
  bulkHolidays(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Body() dto: BulkHolidaysDto,
  ) {
    return this.calendars.bulkCreateHolidays(user, calendarId, dto.items);
  }

  @Post(':calendarId/import-staff-holidays')
  @RequireAnyPermission(...WRITE)
  importStaffHolidays(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
  ) {
    return this.calendars.importStaffHolidays(user, calendarId);
  }

  @Post(':calendarId/publish')
  @RequirePermissions('academic-calendar:manage')
  publish(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
  ) {
    return this.calendars.publish(user, calendarId);
  }

  @Post(':calendarId/unpublish')
  @RequirePermissions('academic-calendar:manage')
  unpublish(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
  ) {
    return this.calendars.unpublish(user, calendarId);
  }

  @Get(':calendarId')
  @RequireAnyPermission(...READ)
  get(@CurrentUser() user: JwtUser, @Param('calendarId') calendarId: string) {
    return this.calendars.getCalendar(user.tid, calendarId);
  }

  @Patch(':calendarId')
  @RequireAnyPermission(...WRITE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('calendarId') calendarId: string,
    @Body() dto: UpdateCalendarDto,
  ) {
    return this.calendars.updateCalendar(user, calendarId, dto);
  }
}
