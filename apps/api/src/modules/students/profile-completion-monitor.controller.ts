import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  ProfileCompletionMonitorService,
  type MonitorFilters,
} from './services/profile-completion-monitor.service';

class MonitorQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() semester?: number;
  @IsOptional() @IsUUID() shiftId?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() missingField?: string;
  @IsOptional() @IsIn(['incomplete', 'complete', 'all']) status?:
    | 'incomplete'
    | 'complete'
    | 'all';
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) pageSize?: number;
}

class SaveMonitorSettingsDto {
  @IsArray() @IsString({ each: true }) requiredKeys!: string[];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reminderIntervalHours?: number;
}

class SendReminderDto extends MonitorQueryDto {
  @IsIn(['WHATSAPP', 'SMS', 'PUSH']) channel!: 'WHATSAPP' | 'SMS' | 'PUSH';
  @IsIn(['incomplete', 'selected', 'missing_field']) audience!:
    | 'incomplete'
    | 'selected'
    | 'missing_field';
  @IsString() @MinLength(10) message!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) studentIds?: string[];
}

const READ = [
  'students:profile-verify',
  'students:read',
  'students:manage',
] as const;
const SEND = ['students:profile-verify', 'students:manage'] as const;

function filtersOf(query: MonitorQueryDto): MonitorFilters {
  return {
    search: query.search,
    departmentId: query.departmentId,
    semester: query.semester && query.semester > 0 ? query.semester : undefined,
    shiftId: query.shiftId,
    gender: query.gender,
    missingField: query.missingField,
    status: query.status,
    academicYearId: query.academicYearId,
  };
}

@ApiTags('students')
@ApiBearerAuth()
@Controller({ path: 'students/profile-completion-monitor', version: '1' })
export class ProfileCompletionMonitorController {
  constructor(private readonly monitor: ProfileCompletionMonitorService) {}

  @Get()
  @RequireAnyPermission(...READ)
  overview(@CurrentUser() user: JwtUser, @Query() query: MonitorQueryDto) {
    return this.monitor.overview(
      user.tid,
      filtersOf(query),
      query.page ?? 1,
      query.pageSize ?? 10,
    );
  }

  @Get('ids')
  @RequireAnyPermission(...READ)
  ids(@CurrentUser() user: JwtUser, @Query() query: MonitorQueryDto) {
    return this.monitor.matchingIds(user.tid, filtersOf(query));
  }

  @Get('analytics')
  @RequireAnyPermission(...READ)
  analytics(@CurrentUser() user: JwtUser, @Query() query: MonitorQueryDto) {
    return this.monitor.analytics(user.tid, filtersOf(query));
  }

  @Get('settings')
  @RequireAnyPermission(...READ)
  settings(@CurrentUser() user: JwtUser) {
    return this.monitor.getSettings(user.tid);
  }

  @Put('settings')
  @RequireAnyPermission('students:profile-policy', 'students:manage')
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveMonitorSettingsDto,
  ) {
    return this.monitor.saveSettings(user.tid, dto);
  }

  @Get('history')
  @RequireAnyPermission(...READ)
  history(@CurrentUser() user: JwtUser, @Query('page') page?: string) {
    return this.monitor.history(user.tid, Number(page || 1));
  }

  @Get('export')
  @RequireAnyPermission(...READ)
  async exportFile(
    @CurrentUser() user: JwtUser,
    @Query() query: MonitorQueryDto,
    @Query('studentIds') studentIds?: string,
  ) {
    const ids = studentIds
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const buffer = await this.monitor.exportWorkbook(
      user.tid,
      filtersOf(query),
      ids,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="profile-completion-monitor.xlsx"',
    });
  }

  @Post('reminders')
  @RequireAnyPermission(...SEND)
  remind(@CurrentUser() user: JwtUser, @Body() dto: SendReminderDto) {
    return this.monitor.sendReminder(user.tid, user.sub, {
      ...filtersOf(dto),
      channel: dto.channel,
      audience: dto.audience,
      message: dto.message,
      studentIds: dto.studentIds,
      missingField: dto.missingField,
    });
  }
}
