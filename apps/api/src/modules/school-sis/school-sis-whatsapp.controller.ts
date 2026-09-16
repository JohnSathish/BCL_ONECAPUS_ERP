import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequiresSchoolLicense } from './school-sis-license.decorators';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  SCHOOL_WHATSAPP_PERMISSION_SEND,
  SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  SCHOOL_WHATSAPP_PERMISSION_VIEW,
} from './school-sis.constants';
import {
  AssignConversationDto,
  AudienceFilterDto,
  ConfirmCampaignDto,
  ConversationNoteDto,
  EmbeddedSignupDto,
  SaveAutomationDto,
  SaveCampaignDto,
  SaveFlowDto,
  SaveOptInDto,
  SaveTemplateDto,
  SaveWhatsappAccountDto,
  SaveWhatsappNumberDto,
  SaveWhatsappSettingsDto,
  SendTemplateMessageDto,
  SendTextMessageDto,
} from './dto/school-whatsapp.dto';
import {
  SchoolSisWhatsappService,
  type WaActor,
} from './school-sis-whatsapp.service';

function actor(user: JwtUser, ip?: string): WaActor {
  const perms = user.permissions ?? [];
  const star =
    perms.includes('*') || perms.includes(SCHOOL_SIS_PERMISSION_MANAGE);
  return {
    userId: user.sub,
    email: user.email,
    ip,
    manage: star || perms.includes(SCHOOL_WHATSAPP_PERMISSION_MANAGE),
    send:
      star ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_SEND) ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_MANAGE),
    campaigns:
      star ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS) ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_MANAGE),
    settings:
      star ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_SETTINGS) ||
      perms.includes(SCHOOL_WHATSAPP_PERMISSION_MANAGE),
  };
}

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_WHATSAPP_PERMISSION_VIEW,
  SCHOOL_WHATSAPP_PERMISSION_MANAGE,
] as const;

@ApiBearerAuth()
@ApiTags('school-sis-whatsapp')
@RequiresSchoolLicense('whatsapp')
@Controller({ path: 'school-sis/whatsapp', version: '1' })
export class SchoolSisWhatsappController {
  constructor(private readonly wa: SchoolSisWhatsappService) {}

  @Get('dashboard')
  @RequireAnyPermission(...VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.wa.dashboard(user.tid);
  }

  @Get('embedded-config')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  embedded() {
    return this.wa.embeddedConfig();
  }

  @Get('accounts')
  @RequireAnyPermission(...VIEW)
  accounts(@CurrentUser() user: JwtUser) {
    return this.wa.listAccounts(user.tid);
  }

  @Post('accounts')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  saveAccount(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveWhatsappAccountDto,
  ) {
    return this.wa.saveAccount(user.tid, dto, actor(user));
  }

  @Patch('accounts/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  updateAccount(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveWhatsappAccountDto,
  ) {
    return this.wa.saveAccount(user.tid, dto, actor(user), id);
  }

  @Post('accounts/connect')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  connect(@CurrentUser() user: JwtUser, @Body() dto: EmbeddedSignupDto) {
    return this.wa.completeEmbeddedSignup(user.tid, dto, actor(user));
  }

  @Post('accounts/test')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  test(
    @CurrentUser() user: JwtUser,
    @Query('phoneNumberId') phoneNumberId?: string,
  ) {
    return this.wa.testConnection(user.tid, actor(user), phoneNumberId);
  }

  @Post('accounts/:id/disconnect')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  disconnect(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.wa.disconnect(user.tid, id, actor(user));
  }

  @Post('numbers')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  number(@CurrentUser() user: JwtUser, @Body() dto: SaveWhatsappNumberDto) {
    return this.wa.saveNumber(user.tid, dto, actor(user));
  }

  @Get('settings')
  @RequireAnyPermission(...VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.wa.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveWhatsappSettingsDto,
  ) {
    return this.wa.saveSettings(user.tid, dto, actor(user));
  }

  @Get('templates')
  @RequireAnyPermission(...VIEW)
  templates(@CurrentUser() user: JwtUser) {
    return this.wa.listTemplates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  )
  saveTemplate(@CurrentUser() user: JwtUser, @Body() dto: SaveTemplateDto) {
    return this.wa.saveTemplate(user.tid, dto, actor(user));
  }

  @Post('templates/sync')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SETTINGS,
  )
  syncTemplates(@CurrentUser() user: JwtUser) {
    return this.wa.syncTemplates(user.tid, actor(user));
  }

  @Get('contacts')
  @RequireAnyPermission(...VIEW)
  contacts(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.wa.listContacts(user.tid, q);
  }

  @Post('contacts/sync')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  )
  syncContacts(@CurrentUser() user: JwtUser) {
    return this.wa.syncContacts(user.tid, actor(user));
  }

  @Get('conversations')
  @RequireAnyPermission(...VIEW)
  conversations(
    @CurrentUser() user: JwtUser,
    @Query('filter') filter?: string,
  ) {
    return this.wa.listConversations(user.tid, filter);
  }

  @Get('conversations/:id')
  @RequireAnyPermission(...VIEW)
  conversation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.wa.getConversation(user.tid, id);
  }

  @Patch('conversations/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SEND,
  )
  assign(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.wa.assignConversation(user.tid, id, dto, actor(user));
  }

  @Post('conversations/:id/notes')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SEND,
  )
  note(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConversationNoteDto,
  ) {
    return this.wa.addNote(user.tid, id, dto, actor(user));
  }

  @Post('messages/send')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SEND,
  )
  sendText(@CurrentUser() user: JwtUser, @Body() dto: SendTextMessageDto) {
    return this.wa.sendText(user.tid, dto, actor(user));
  }

  @Post('messages/send-template')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SEND,
  )
  sendTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: SendTemplateMessageDto,
  ) {
    return this.wa.sendTemplate(user.tid, dto, actor(user));
  }

  @Get('messages/:id')
  @RequireAnyPermission(...VIEW)
  async message(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const rows = await this.wa.deliveryStatus(user.tid);
    return rows.find((r) => r.id === id) ?? null;
  }

  @Post('messages/:id/retry')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_SEND,
  )
  retry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.wa.retryFailed(user.tid, id, actor(user));
  }

  @Post('audience/preview')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  )
  audience(@CurrentUser() user: JwtUser, @Body() dto: AudienceFilterDto) {
    return this.wa.previewAudience(user.tid, dto);
  }

  @Get('campaigns')
  @RequireAnyPermission(...VIEW)
  campaigns(@CurrentUser() user: JwtUser) {
    return this.wa.listCampaigns(user.tid);
  }

  @Post('campaigns')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  )
  createCampaign(@CurrentUser() user: JwtUser, @Body() dto: SaveCampaignDto) {
    return this.wa.createCampaign(user.tid, dto, actor(user));
  }

  @Get('campaigns/:id')
  @RequireAnyPermission(...VIEW)
  campaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.wa.getCampaign(user.tid, id);
  }

  @Post('campaigns/:id/send')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  )
  sendCampaign(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ConfirmCampaignDto,
  ) {
    return this.wa.sendCampaign(user.tid, id, actor(user), dto.confirm);
  }

  @Post('campaigns/:id/schedule')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  )
  schedule(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { scheduledAt: string },
  ) {
    return this.wa.scheduleCampaign(user.tid, id, dto.scheduledAt, actor(user));
  }

  @Post('campaigns/:id/pause')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_CAMPAIGNS,
  )
  pause(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.wa.pauseCampaign(user.tid, id, actor(user));
  }

  @Get('delivery-status')
  @RequireAnyPermission(...VIEW)
  delivery(
    @CurrentUser() user: JwtUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.wa.deliveryStatus(user.tid, campaignId);
  }

  @Get('opt-ins')
  @RequireAnyPermission(...VIEW)
  optIns(@CurrentUser() user: JwtUser) {
    return this.wa.listOptIns(user.tid);
  }

  @Post('opt-ins')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  )
  saveOptIn(@CurrentUser() user: JwtUser, @Body() dto: SaveOptInDto) {
    return this.wa.saveOptIn(user.tid, dto, actor(user));
  }

  @Get('automations')
  @RequireAnyPermission(...VIEW)
  automations(@CurrentUser() user: JwtUser) {
    return this.wa.listAutomations(user.tid);
  }

  @Post('automations')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  )
  saveAuto(@CurrentUser() user: JwtUser, @Body() dto: SaveAutomationDto) {
    return this.wa.saveAutomation(user.tid, dto, actor(user));
  }

  @Get('media')
  @RequireAnyPermission(...VIEW)
  media(@CurrentUser() user: JwtUser) {
    return this.wa.listMedia(user.tid);
  }

  @Get('flows')
  @RequireAnyPermission(...VIEW)
  flows(@CurrentUser() user: JwtUser) {
    return this.wa.listFlows(user.tid);
  }

  @Post('flows')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_WHATSAPP_PERMISSION_MANAGE,
  )
  saveFlow(@CurrentUser() user: JwtUser, @Body() dto: SaveFlowDto) {
    return this.wa.saveFlow(user.tid, dto, actor(user));
  }

  @Get('analytics')
  @RequireAnyPermission(...VIEW)
  analytics(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.wa.analytics(user.tid, from, to);
  }

  @Get('logs')
  @RequireAnyPermission(...VIEW)
  logs(@CurrentUser() user: JwtUser) {
    return this.wa.logs(user.tid);
  }
}
