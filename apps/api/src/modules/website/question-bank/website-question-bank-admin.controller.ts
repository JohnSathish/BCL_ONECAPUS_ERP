import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { QuestionBankSettingsDto } from './website-question-bank.dto';
import { WebsiteQuestionBankService } from './website-question-bank.service';

@ApiBearerAuth()
@ApiTags('website-admin')
@Controller({ path: 'website/admin/question-bank', version: '1' })
export class WebsiteQuestionBankAdminController {
  constructor(private readonly questionBank: WebsiteQuestionBankService) {}

  @Get('settings')
  @RequireAnyPermission('website:read', 'website:edit', 'website:manage')
  settings(@CurrentUser() user: JwtUser) {
    return this.questionBank.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission('website:edit', 'website:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: QuestionBankSettingsDto,
  ) {
    return this.questionBank.updateSettings(user, dto);
  }
}
