import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { SUPPORT_CATEGORIES } from './constants/support-centre.constants';
import { SupportChatService } from './services/support-chat.service';
import { SupportFaqService } from './services/support-faq.service';
import { SupportSettingsService } from './services/support-settings.service';
import { SupportTicketService } from './services/support-ticket.service';

@ApiBearerAuth()
@ApiTags('student-support')
@RequireModule('helpdesk')
@Controller({ path: 'student/support', version: '1' })
export class StudentSupportController {
  constructor(
    private readonly tickets: SupportTicketService,
    private readonly chat: SupportChatService,
    private readonly faq: SupportFaqService,
    private readonly settings: SupportSettingsService,
  ) {}

  @Get('meta')
  @RequireAnyPermission('student:portal:self')
  async meta(@CurrentUser() user: JwtUser) {
    const settings = await this.settings.getSettings(user.tid);
    const departments = await this.settings.listDepartments(user.tid);
    const agents = await this.settings.listAgents(user.tid);
    const onlineByDept = new Map<string, number>();
    for (const a of agents as Array<{
      departmentId?: string | null;
      isOnline?: boolean;
      isActive?: boolean;
    }>) {
      if (!a.departmentId || !a.isOnline || a.isActive === false) continue;
      onlineByDept.set(
        a.departmentId,
        (onlineByDept.get(a.departmentId) ?? 0) + 1,
      );
    }
    return {
      categories: SUPPORT_CATEGORIES,
      settings: {
        contactEmail: settings?.contactEmail,
        contactPhone: settings?.contactPhone,
        supportHours: settings?.supportHours,
        welcomeMessage: settings?.welcomeMessage,
        translationEnabled: settings?.translationEnabled,
      },
      offices: (
        departments as Array<{
          id: string;
          code: string;
          name: string;
          description?: string | null;
          isActive?: boolean;
        }>
      )
        .filter((d) => d.isActive !== false)
        .map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          description: d.description ?? null,
          onlineAgents: onlineByDept.get(d.id) ?? 0,
          isOnline: (onlineByDept.get(d.id) ?? 0) > 0,
        })),
    };
  }

  @Get('faq')
  @RequireAnyPermission('student:portal:self')
  faqList(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.faq.listPublished(user.tid, q);
  }

  @Get('tickets')
  @RequireAnyPermission('student:portal:self')
  myTickets(@CurrentUser() user: JwtUser) {
    return this.tickets.list(user.tid, { requesterUserId: user.sub });
  }

  @Post('tickets')
  @RequireAnyPermission('student:portal:self')
  createTicket(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      category?: string;
      subject: string;
      description?: string;
      priority?: string;
    },
  ) {
    return this.tickets.create(user, { ...body, requesterType: 'STUDENT' });
  }

  @Get('tickets/:id')
  @RequireAnyPermission('student:portal:self')
  getTicket(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tickets.get(user.tid, id, { forUserId: user.sub });
  }

  @Post('tickets/:id/comments')
  @RequireAnyPermission('student:portal:self')
  comment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.tickets.studentComment(user, id, body.body);
  }

  @Post('tickets/:id/rate')
  @RequireAnyPermission('student:portal:self')
  rate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { score: number; note?: string },
  ) {
    return this.tickets.rate(user, id, body.score, body.note);
  }

  @Get('chats')
  @RequireAnyPermission('student:portal:self')
  myChats(@CurrentUser() user: JwtUser) {
    return this.chat.listThreads(user.tid, { studentUserId: user.sub });
  }

  @Post('chats')
  @RequireAnyPermission('student:portal:self')
  openChat(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      category?: string;
      subject?: string;
      studentLang?: string;
      initialMessage?: string;
    },
  ) {
    return this.chat.openThread(user, body);
  }

  @Get('chats/:id')
  @RequireAnyPermission('student:portal:self')
  getChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.assertParticipant(user, id, false);
  }

  @Post('chats/:id/messages')
  @RequireAnyPermission('student:portal:self')
  sendMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string; replyToId?: string },
  ) {
    return this.chat.sendMessage(user, id, {
      body: body.body,
      asStudent: true,
      replyToId: body.replyToId,
    });
  }

  @Post('chats/:id/read')
  @RequireAnyPermission('student:portal:self')
  read(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.markRead(user, id, false);
  }

  @Post('chats/:id/close')
  @RequireAnyPermission('student:portal:self')
  closeChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.closeThread(user, id, false);
  }

  @Post('chats/:id/typing')
  @RequireAnyPermission('student:portal:self')
  typing(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { isTyping?: boolean },
  ) {
    return this.chat.typing(user, id, body.isTyping !== false);
  }

  @Post('chats/:id/upload')
  @RequireAnyPermission('student:portal:self')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.chat.assertParticipant(user, id, false);
    const meta = await this.chat.persistUpload(user.tid, id, file);
    return this.chat.sendMessage(user, id, {
      body: `Attachment: ${meta.fileName}`,
      asStudent: true,
      attachments: [meta],
    });
  }
}
