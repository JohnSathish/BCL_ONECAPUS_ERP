import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  RequiresSchoolLicense,
  SkipSchoolLicense,
} from './school-sis-license.decorators';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_PUSH_PERMISSION_MANAGE,
  SCHOOL_PUSH_PERMISSION_SCHEDULE,
  SCHOOL_PUSH_PERMISSION_SEND,
  SCHOOL_PUSH_PERMISSION_VIEW,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  PushAudienceDto,
  RegisterPushDeviceDto,
  SavePushCampaignDto,
  SavePushPreferenceDto,
  SavePushRuleDto,
  SavePushSettingsDto,
  SavePushTemplateDto,
} from './dto/school-push.dto';
import {
  SchoolSisPushService,
  type PushActor,
} from './school-sis-push.service';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_PUSH_PERMISSION_VIEW,
  SCHOOL_PUSH_PERMISSION_MANAGE,
] as const;

function actor(user: JwtUser): PushActor {
  const p = user.permissions ?? [];
  const star = p.includes('*') || p.includes(SCHOOL_SIS_PERMISSION_MANAGE);
  return {
    userId: user.sub,
    manage: star || p.includes(SCHOOL_PUSH_PERMISSION_MANAGE),
    send:
      star ||
      p.includes(SCHOOL_PUSH_PERMISSION_SEND) ||
      p.includes(SCHOOL_PUSH_PERMISSION_SCHEDULE) ||
      p.includes(SCHOOL_PUSH_PERMISSION_MANAGE),
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-push')
@RequiresSchoolLicense('notifications')
@Controller({ path: 'school-sis/notifications', version: '1' })
export class SchoolSisPushController {
  constructor(private readonly push: SchoolSisPushService) {}

  @Get('dashboard')
  @RequireAnyPermission(...VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.push.dashboard(user.tid);
  }

  @Post('test')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  test(@CurrentUser() user: JwtUser) {
    return this.push.sendTest(user.tid, actor(user));
  }

  @Post('audience/preview')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  preview(@CurrentUser() user: JwtUser, @Body() dto: PushAudienceDto) {
    return this.push.previewAudience(user.tid, dto, user.sub);
  }

  @Post('draft')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  draft(@CurrentUser() user: JwtUser, @Body() dto: SavePushCampaignDto) {
    return this.push.compose(user.tid, dto, actor(user), false);
  }

  @Post('send')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  send(@CurrentUser() user: JwtUser, @Body() dto: SavePushCampaignDto) {
    return this.push.compose(user.tid, dto, actor(user), true);
  }

  @Post('schedule')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SCHEDULE,
  )
  schedule(@CurrentUser() user: JwtUser, @Body() dto: SavePushCampaignDto) {
    return this.push.compose(user.tid, dto, actor(user), true);
  }

  @Get()
  @RequireAnyPermission(...VIEW)
  list(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.push.listCampaigns(user.tid, status);
  }

  @Get('delivery-report')
  @RequireAnyPermission(...VIEW)
  report(
    @CurrentUser() user: JwtUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.push.deliveryReport(user.tid, campaignId);
  }

  @Get('templates')
  @RequireAnyPermission(...VIEW)
  templates(@CurrentUser() user: JwtUser) {
    return this.push.listTemplates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_MANAGE,
  )
  saveTpl(@CurrentUser() user: JwtUser, @Body() dto: SavePushTemplateDto) {
    return this.push.saveTemplate(user.tid, dto, actor(user));
  }

  @Patch('templates/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_MANAGE,
  )
  patchTpl(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SavePushTemplateDto,
  ) {
    return this.push.saveTemplate(user.tid, dto, actor(user), id);
  }

  @Post('media')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5_000_000 },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @UploadedFile()
    file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!file) throw new BadRequestException('Choose an image or PDF');
    return this.push.uploadImage(user.tid, file);
  }

  @Public()
  @SkipSchoolLicense()
  @Get('media-file/:tenantId/:fileName')
  @Header('Cache-Control', 'public, max-age=86400')
  async mediaFile(
    @Param('tenantId') tenantId: string,
    @Param('fileName') fileName: string,
  ) {
    const file = await this.push.readMedia(tenantId, fileName);
    return new StreamableFile(file.buf, {
      type: file.contentType,
      disposition: `inline; filename="${file.fileName}"`,
    });
  }

  @Get('devices')
  @RequireAnyPermission(...VIEW)
  devices(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.push.listDevices(user.tid, q);
  }

  @Post('devices/register')
  register(@CurrentUser() user: JwtUser, @Body() dto: RegisterPushDeviceDto) {
    return this.push.registerDevice({ tid: user.tid, sub: user.sub }, dto);
  }

  @Delete('devices/:id')
  unregister(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.unregisterDevice(user.tid, id);
  }

  @Get('settings')
  @RequireAnyPermission(...VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.push.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_MANAGE,
  )
  saveSettings(@CurrentUser() user: JwtUser, @Body() dto: SavePushSettingsDto) {
    return this.push.saveSettings(user.tid, dto, actor(user));
  }

  @Get('preferences')
  @RequireAnyPermission(...VIEW)
  prefs(@CurrentUser() user: JwtUser) {
    return this.push.listPreferences(user.tid, user.sub);
  }

  @Post('preferences')
  savePref(@CurrentUser() user: JwtUser, @Body() dto: SavePushPreferenceDto) {
    return this.push.savePreference(user.tid, user.sub, dto);
  }

  @Get('rules')
  @RequireAnyPermission(...VIEW)
  rules(@CurrentUser() user: JwtUser) {
    return this.push.listRules(user.tid);
  }

  @Post('rules')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_MANAGE,
  )
  saveRule(@CurrentUser() user: JwtUser, @Body() dto: SavePushRuleDto) {
    return this.push.saveRule(user.tid, dto, actor(user));
  }

  @Get('logs')
  @RequireAnyPermission(...VIEW)
  logs(@CurrentUser() user: JwtUser) {
    return this.push.logs(user.tid);
  }

  @Get(':id')
  @RequireAnyPermission(...VIEW)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.getCampaign(user.tid, id);
  }

  @Post(':id/cancel')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.cancel(user.tid, id, actor(user));
  }

  @Post(':id/retry')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_SEND,
  )
  retry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.retryFailed(user.tid, id, actor(user));
  }

  @Post(':id/opened')
  opened(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.markOpened(user.tid, id, user.sub);
  }

  @Post(':id/read')
  read(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.markOpened(user.tid, id, user.sub);
  }

  @Delete(':id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_PUSH_PERMISSION_MANAGE,
  )
  archive(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.push.archive(user.tid, id, actor(user));
  }
}
