import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { SUPPORT_CATEGORIES } from './constants/support-centre.constants';
import { SupportAnalyticsService } from './services/support-analytics.service';
import { SupportAiService } from './services/support-ai.service';
import { SupportChatService } from './services/support-chat.service';
import { SupportFaqService } from './services/support-faq.service';
import { SupportSettingsService } from './services/support-settings.service';
import { SupportStudentContextService } from './services/support-student-context.service';
import { SupportTicketService } from './services/support-ticket.service';

@ApiBearerAuth()
@ApiTags('support-centre')
@RequireModule('helpdesk')
@Controller({ path: 'helpdesk', version: '1' })
export class HelpdeskController {
  constructor(
    private readonly tickets: SupportTicketService,
    private readonly chat: SupportChatService,
    private readonly faq: SupportFaqService,
    private readonly settings: SupportSettingsService,
    private readonly analytics: SupportAnalyticsService,
    private readonly ai: SupportAiService,
    private readonly studentContext: SupportStudentContextService,
  ) {}

  @Get('meta/categories')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  categories() {
    return SUPPORT_CATEGORIES;
  }

  @Get('dashboard')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.dashboard(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Put('settings')
  @RequirePermissions('helpdesk:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settings.updateSettings(user.tid, body as any);
  }

  @Get('departments')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  departments(@CurrentUser() user: JwtUser) {
    return this.settings.listDepartments(user.tid);
  }

  @Get('routing-rules')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  routing(@CurrentUser() user: JwtUser) {
    return this.settings.listRoutingRules(user.tid);
  }

  @Put('routing-rules')
  @RequirePermissions('helpdesk:manage')
  upsertRouting(
    @CurrentUser() user: JwtUser,
    @Body() body: { category: string; departmentId: string },
  ) {
    return this.settings.upsertRoutingRule(
      user.tid,
      body.category,
      body.departmentId,
    );
  }

  @Get('agents')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  agents(@CurrentUser() user: JwtUser) {
    return this.settings.listAgents(user.tid);
  }

  @Post('agents')
  @RequirePermissions('helpdesk:manage')
  upsertAgent(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      userId: string;
      departmentId?: string | null;
      displayName?: string;
      preferredLang?: string;
      maxConcurrent?: number;
      isActive?: boolean;
    },
  ) {
    return this.settings.upsertAgent(user.tid, body);
  }

  @Post('agents/presence')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  presence(
    @CurrentUser() user: JwtUser,
    @Body()
    body: { isOnline: boolean; displayName?: string; preferredLang?: string },
  ) {
    return this.settings.setAgentPresence(
      user.tid,
      user.sub,
      body.isOnline,
      body.displayName,
      body.preferredLang,
    );
  }

  @Post('tickets')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
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
    return this.tickets.create(user, { ...body, requesterType: 'STAFF' });
  }

  @Get('tickets')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  listTickets(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    return this.tickets.list(user.tid, {
      status,
      assigneeUserId,
      category,
      q,
    });
  }

  @Get('tickets/:id')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  getTicket(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tickets.get(user.tid, id, { staff: true });
  }

  @Post('tickets/:id/assign')
  @RequirePermissions('helpdesk:manage')
  assignTicket(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { assigneeUserId: string },
  ) {
    return this.tickets.assign(user, id, body.assigneeUserId);
  }

  @Post('tickets/:id/comments')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  commentTicket(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string; isInternal?: boolean },
  ) {
    return this.tickets.comment(user, id, body.body, body.isInternal);
  }

  @Patch('tickets/:id/status')
  @RequirePermissions('helpdesk:manage')
  transitionTicket(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.tickets.transition(user, id, body.status);
  }

  @Get('chats')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  listChats(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('q') q?: string,
    @Query('bucket') bucket?: string,
  ) {
    return this.chat.listThreads(user.tid, {
      status,
      departmentId,
      q,
      bucket,
      agentUserId: user.sub,
    });
  }

  @Get('chats/:id/student-context')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  studentContextForChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.studentContext.forChatThread(user.tid, id);
  }

  @Post('chats/:id/ai-assist')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  aiAssist(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.ai.assistThread(user.tid, id);
  }

  @Post('chats/:id/convert-ticket')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  convertChatToTicket(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      category?: string;
      subject?: string;
      description?: string;
      priority?: string;
      assigneeUserId?: string;
    },
  ) {
    return this.tickets.createFromChat(user, id, body);
  }

  @Get('chats/:id')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  getChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.assertParticipant(user, id, true);
  }

  @Post('chats/:id/messages')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  sendChatMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string; replyToId?: string },
  ) {
    return this.chat.sendMessage(user, id, {
      body: body.body,
      asStudent: false,
      replyToId: body.replyToId,
    });
  }

  @Post('chats/:id/read')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  readChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.markRead(user, id, true);
  }

  @Post('chats/:id/assign')
  @RequirePermissions('helpdesk:manage')
  assignChat(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { agentId: string },
  ) {
    return this.chat.assignAgent(user, id, body.agentId);
  }

  @Post('chats/:id/messages/:messageId/retranslate')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  retranslateMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() body: { targetLang?: string },
  ) {
    return this.chat.retranslateMessage(user, id, messageId, body.targetLang);
  }

  @Post('chats/:id/retranslate')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  async retranslateThread(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { targetLang?: string },
  ) {
    const thread = await this.chat.assertParticipant(user, id, true);
    const msgs = (thread.messages ?? []).filter(
      (m: { senderRole: string; bodyTranslated?: string | null }) =>
        m.senderRole === 'STUDENT' && !m.bodyTranslated,
    );
    const updated = [];
    for (const m of msgs) {
      updated.push(
        await this.chat.retranslateMessage(user, id, m.id, body.targetLang),
      );
    }
    return { count: updated.length, messages: updated };
  }

  @Post('chats/:id/close')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  closeChat(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.closeThread(user, id, true);
  }

  @Post('chats/:id/typing')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  typing(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { isTyping?: boolean },
  ) {
    return this.chat.typing(user, id, body.isTyping !== false);
  }

  @Post('chats/:id/upload')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadChat(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.chat.assertParticipant(user, id, true);
    const meta = await this.chat.persistUpload(user.tid, id, file);
    return this.chat.sendMessage(user, id, {
      body: `Attachment: ${meta.fileName}`,
      asStudent: false,
      attachments: [meta],
    });
  }

  @Get('faq')
  @RequireAnyPermission('helpdesk:read', 'helpdesk:manage')
  listFaq(@CurrentUser() user: JwtUser) {
    return this.faq.listAdmin(user.tid);
  }

  @Post('faq/categories')
  @RequirePermissions('helpdesk:manage')
  createFaqCategory(
    @CurrentUser() user: JwtUser,
    @Body() body: { code: string; name: string; sortOrder?: number },
  ) {
    return this.faq.createCategory(user.tid, body);
  }

  @Post('faq/articles')
  @RequirePermissions('helpdesk:manage')
  createFaqArticle(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      categoryId: string;
      question: string;
      answer: string;
      keywords?: string[];
      isPublished?: boolean;
    },
  ) {
    return this.faq.createArticle(user.tid, body);
  }

  @Patch('faq/articles/:id')
  @RequirePermissions('helpdesk:manage')
  updateFaqArticle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      question: string;
      answer: string;
      keywords: string[];
      isPublished: boolean;
      sortOrder: number;
    }>,
  ) {
    return this.faq.updateArticle(user.tid, id, body);
  }
}
