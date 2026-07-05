import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { AiAssistantService } from './ai-assistant.service';
import { AiChatDto, AiConfirmDto, AiSelectFieldsDto } from './dto/ai-chat.dto';

@ApiTags('ai-assistant')
@ApiBearerAuth()
@Controller({ path: 'ai-assistant', version: '1' })
@RequireAnyPermission(
  'reports:read',
  'academic:read',
  'academic:manage',
  'students:read',
  'fees:read',
  'front-office:read',
  'library:read',
  'staff:read',
)
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Post('chat')
  chat(@CurrentUser() user: JwtUser, @Body() dto: AiChatDto) {
    return this.assistant.chat(user, dto.question, dto.sessionId);
  }

  @Post('select-fields')
  selectFields(@CurrentUser() user: JwtUser, @Body() dto: AiSelectFieldsDto) {
    return this.assistant.selectFields(
      user,
      dto.sessionId,
      dto.columns,
      dto.format,
    );
  }

  @Post('confirm')
  confirm(@CurrentUser() user: JwtUser, @Body() dto: AiConfirmDto) {
    if (dto.confirmationId === 'report-generate') {
      return this.assistant.confirmReport(user, dto.sessionId);
    }
    return this.assistant.confirm(user, dto.sessionId, dto.confirmationId);
  }
}
