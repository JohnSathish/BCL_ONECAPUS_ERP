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
  ImportHolidaysDto,
  SaveCalendarEventDto,
  SaveHolidayDto,
  SaveHolidayTypeDto,
  SaveOverrideDto,
  SaveTermsDto,
  SaveWeeklyOffDto,
} from './dto/school-calendar.dto';
import {
  SchoolSisCalendarService,
  type CalendarActor,
} from './school-sis-calendar.service';

function actor(user: JwtUser): CalendarActor {
  const perms = user.permissions ?? [];
  const manage =
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) ||
    perms.includes('*') ||
    perms.includes('holiday_calendar.create') ||
    perms.includes('academic_calendar.create') ||
    perms.includes('holiday_calendar.edit') ||
    perms.includes('academic_calendar.edit');
  return { userId: user.sub, manage };
}

@ApiBearerAuth()
@ApiTags('school-sis-calendar')
@Controller({ path: 'school-sis/calendar', version: '1' })
export class SchoolSisCalendarController {
  constructor(private readonly calendar: SchoolSisCalendarService) {}

  @Get('setup')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  setup(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.setup(user.tid, academicYearId);
  }

  @Get('dashboard')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.dashboard(user.tid, academicYearId);
  }

  @Get('month')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  month(
    @CurrentUser() user: JwtUser,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.monthGrid(
      user.tid,
      Number(year),
      Number(month),
      academicYearId,
    );
  }

  @Get('year')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  yearView(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.yearOverview(user.tid, academicYearId);
  }

  @Get('day')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  day(
    @CurrentUser() user: JwtUser,
    @Query('date') date: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.resolveDay(user.tid, date, academicYearId);
  }

  @Get('working-days')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  working(
    @CurrentUser() user: JwtUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.workingDaysInRange(user.tid, from, to, academicYearId);
  }

  @Patch('weekly-off')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  weekly(@CurrentUser() user: JwtUser, @Body() dto: SaveWeeklyOffDto) {
    return this.calendar.saveWeeklyOff(user.tid, dto, actor(user));
  }

  @Post('terms')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  terms(@CurrentUser() user: JwtUser, @Body() dto: SaveTermsDto) {
    return this.calendar.saveTerms(
      user.tid,
      dto.academicYearId,
      dto.terms,
      actor(user),
    );
  }

  @Post('holiday-types')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  type(@CurrentUser() user: JwtUser, @Body() dto: SaveHolidayTypeDto) {
    return this.calendar.saveHolidayType(user.tid, dto, actor(user));
  }

  @Get('holidays')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  holidays(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.listHolidays(user.tid, academicYearId);
  }

  @Post('holidays')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createHoliday(@CurrentUser() user: JwtUser, @Body() dto: SaveHolidayDto) {
    return this.calendar.saveHoliday(user.tid, dto, actor(user));
  }

  @Patch('holidays/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateHoliday(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveHolidayDto,
  ) {
    return this.calendar.saveHoliday(user.tid, dto, actor(user), id);
  }

  @Delete('holidays/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  removeHoliday(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.calendar.deleteHoliday(user.tid, id, actor(user));
  }

  @Post('holidays/:id/duplicate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  dupHoliday(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.calendar.duplicateHoliday(user.tid, id, actor(user));
  }

  @Post('holidays/import')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  importHolidays(@CurrentUser() user: JwtUser, @Body() dto: ImportHolidaysDto) {
    return this.calendar.importHolidays(user.tid, dto, actor(user));
  }

  @Get('overrides')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  overrides(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.listOverrides(user.tid, academicYearId);
  }

  @Post('overrides')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveOverride(@CurrentUser() user: JwtUser, @Body() dto: SaveOverrideDto) {
    return this.calendar.saveOverride(user.tid, dto, actor(user));
  }

  @Delete('overrides/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  delOverride(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.calendar.deleteOverride(user.tid, id, actor(user));
  }

  @Get('events')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  events(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.calendar.listEvents(user.tid, {
      academicYearId,
      categoryId,
      status,
    });
  }

  @Post('events')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  createEvent(@CurrentUser() user: JwtUser, @Body() dto: SaveCalendarEventDto) {
    return this.calendar.saveEvent(user.tid, dto, actor(user));
  }

  @Patch('events/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  updateEvent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveCalendarEventDto,
  ) {
    return this.calendar.saveEvent(user.tid, dto, actor(user), id);
  }

  @Delete('events/:id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  removeEvent(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.calendar.deleteEvent(user.tid, id, actor(user));
  }

  @Get('reports')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  reports(
    @CurrentUser() user: JwtUser,
    @Query('kind') kind?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.calendar.reports(user.tid, kind || 'HOLIDAY', academicYearId);
  }
}
