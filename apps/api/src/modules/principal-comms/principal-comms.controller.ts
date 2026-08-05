import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ListMessagesQueryDto,
  MessageActionDto,
  SaveDraftDto,
  SendMailDto,
  StartOAuthDto,
  SyncMailboxDto,
} from './dto/principal-comms.dto';
import { PrincipalCommsAuditService } from './services/principal-comms-audit.service';
import { PrincipalCommsAuthService } from './services/principal-comms-auth.service';
import { PrincipalCommsComposeService } from './services/principal-comms-compose.service';
import { PrincipalCommsMailboxService } from './services/principal-comms-mailbox.service';
import { PrincipalCommsSyncService } from './services/principal-comms-sync.service';

@ApiBearerAuth()
@ApiTags('principal-comms')
@Controller({ path: 'principal-comms', version: '1' })
@RequirePermissions('principal-comms:access')
export class PrincipalCommsController {
  constructor(
    private readonly auth: PrincipalCommsAuthService,
    private readonly syncService: PrincipalCommsSyncService,
    private readonly mailbox: PrincipalCommsMailboxService,
    private readonly compose: PrincipalCommsComposeService,
    private readonly audit: PrincipalCommsAuditService,
    private readonly config: ConfigService,
  ) {}

  @Get('stats')
  stats(@CurrentUser() user: JwtUser, @Query('accountId') accountId?: string) {
    return this.mailbox.stats(user.tid, user.sub, accountId);
  }

  @Get('accounts')
  listAccounts(@CurrentUser() user: JwtUser) {
    return this.mailbox.listAccounts(user.tid, user.sub);
  }

  @Post('accounts/oauth/start')
  startOauth(@CurrentUser() user: JwtUser, @Body() dto: StartOAuthDto) {
    return this.auth.startOAuth(
      user.tid,
      user.sub,
      dto.accountLabel ?? 'PERSONAL',
    );
  }

  /** Browser OAuth redirect — no JWT; state carries principal identity. */
  @Public()
  @Get('accounts/oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    const account = await this.auth.handleOAuthCallback(code, state, {
      userAgent,
    });
    const webBase =
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      'http://localhost:3000';
    const redirect = `${webBase.replace(/\/$/, '')}/principal-desk/communication-hub/settings?connected=1&accountId=${account.id}`;
    return res.redirect(redirect);
  }

  @Delete('accounts/:id')
  disconnect(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.disconnect(user.tid, user.sub, id, { userAgent });
  }

  @Post('sync')
  sync(@CurrentUser() user: JwtUser, @Body() dto: SyncMailboxDto) {
    return this.resolveAccountAndSync(user, dto.accountId, dto.full);
  }

  private async resolveAccountAndSync(
    user: JwtUser,
    accountId?: string,
    full?: boolean,
  ) {
    const id =
      accountId ?? (await this.auth.listAccounts(user.tid, user.sub))[0]?.id;
    if (!id)
      return { imported: 0, newMessages: 0, error: 'No mailbox connected' };
    return this.syncService.syncAccount(user.tid, user.sub, id, {
      full: !!full,
    });
  }

  @Get('folders/:folder/messages')
  listFolder(
    @CurrentUser() user: JwtUser,
    @Param('folder') folder: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.mailbox.listMessages(user.tid, user.sub, {
      folder,
      accountId: query.accountId,
      q: query.q,
      cursor: query.cursor,
      take: query.take,
      unreadOnly: query.unreadOnly,
      starredOnly: query.starredOnly,
    });
  }

  @Get('messages')
  listMessages(
    @CurrentUser() user: JwtUser,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.mailbox.listMessages(user.tid, user.sub, {
      folder: query.folder ?? 'INBOX',
      accountId: query.accountId,
      q: query.q,
      cursor: query.cursor,
      take: query.take,
      unreadOnly: query.unreadOnly,
      starredOnly: query.starredOnly,
    });
  }

  @Get('messages/:id')
  getMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.mailbox.getMessage(user.tid, user.sub, id, { userAgent });
  }

  @Post('messages/:id/actions')
  action(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MessageActionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.mailbox.applyAction(user.tid, user.sub, id, dto.action, {
      userAgent,
    });
  }

  @Get('attachments/:id/download')
  downloadAttachment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.mailbox.downloadAttachment(user.tid, user.sub, id, {
      userAgent,
    });
  }

  @Get('drafts')
  listDrafts(
    @CurrentUser() user: JwtUser,
    @Query('accountId') accountId: string,
  ) {
    return this.compose.listDrafts(user.tid, user.sub, accountId);
  }

  @Post('drafts')
  saveDraft(@CurrentUser() user: JwtUser, @Body() dto: SaveDraftDto) {
    return this.compose.saveDraft(user.tid, user.sub, dto);
  }

  @Patch('drafts/:id')
  updateDraft(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveDraftDto,
  ) {
    return this.compose.saveDraft(user.tid, user.sub, { ...dto, draftId: id });
  }

  @Post('send')
  send(
    @CurrentUser() user: JwtUser,
    @Body() dto: SendMailDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.compose.send(user.tid, user.sub, dto, { userAgent });
  }

  @Post('messages/:id/reply')
  reply(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SendMailDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.compose.send(
      user.tid,
      user.sub,
      { ...dto, replyToMessageId: id },
      { userAgent },
    );
  }

  @Post('messages/:id/forward')
  forward(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SendMailDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.compose.send(user.tid, user.sub, dto, { userAgent });
  }

  @Get('audit')
  auditLog(@CurrentUser() user: JwtUser) {
    return this.audit.list(user.tid, user.sub);
  }

  @Get('oauth/status')
  oauthStatus() {
    return {
      configured: Boolean(
        this.config.get('GOOGLE_COMMS_CLIENT_ID') &&
        this.config.get('GOOGLE_COMMS_CLIENT_SECRET') &&
        this.config.get('GOOGLE_COMMS_REDIRECT_URI'),
      ),
    };
  }
}
