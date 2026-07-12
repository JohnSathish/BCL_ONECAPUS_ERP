import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateFeedbackCampaignDto,
  ReplaceFeedbackQuestionsDto,
  SubmitFeedbackResponseDto,
  UpdateFeedbackCampaignDto,
} from './dto/feedback.dto';
import { FeedbackSurveyService } from './services/feedback-survey.service';

const NIQ_READ = [
  'naac-iqac:read',
  'naac-iqac:manage',
  'naac-iqac:collect',
  'naac-iqac:reports',
] as const;
const NIQ_MANAGE = ['naac-iqac:manage', 'naac-iqac:collect'] as const;
const NIQ_REPORTS = ['naac-iqac:reports', 'naac-iqac:manage'] as const;

@ApiBearerAuth()
@ApiTags('feedback-surveys')
@Controller({ path: 'feedback', version: '1' })
export class FeedbackSurveyController {
  constructor(private readonly feedback: FeedbackSurveyService) {}

  @Get('scale')
  scale() {
    return this.feedback.scale();
  }

  // ---- Respondent (student / teacher / alumni) ----
  @Get('me/campaigns')
  listMine(@CurrentUser() user: JwtUser, @Query('audience') audience?: string) {
    return this.feedback.listOpenForMe(user, audience);
  }

  @Post('me/campaigns/:id/submit')
  submitMine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackResponseDto,
  ) {
    return this.feedback.submitAsMe(user, id, dto);
  }

  // ---- Admin / IQAC ----
  @Get('campaigns')
  @RequireAnyPermission(...NIQ_READ)
  listCampaigns(
    @CurrentUser() user: JwtUser,
    @Query('audience') audience?: string,
  ) {
    return this.feedback.listCampaigns(user.tid, audience);
  }

  @Post('campaigns')
  @RequireAnyPermission(...NIQ_MANAGE)
  createCampaign(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFeedbackCampaignDto,
  ) {
    return this.feedback.createCampaign(user, dto);
  }

  @Get('campaigns/:id')
  @RequireAnyPermission(...NIQ_READ)
  getCampaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.getCampaign(user.tid, id);
  }

  @Patch('campaigns/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  updateCampaign(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackCampaignDto,
  ) {
    return this.feedback.updateCampaign(user, id, dto);
  }

  @Delete('campaigns/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  deleteCampaign(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.deleteCampaign(user, id);
  }

  @Post('campaigns/:id/questions')
  @RequireAnyPermission(...NIQ_MANAGE)
  replaceQuestions(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReplaceFeedbackQuestionsDto,
  ) {
    return this.feedback.replaceQuestions(user, id, dto);
  }

  @Post('campaigns/:id/seed-student-defaults')
  @RequireAnyPermission(...NIQ_MANAGE)
  seedStudentDefaults(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.seedDefaultQuestions(user, id, 'STUDENT');
  }

  @Post('campaigns/:id/seed-defaults')
  @RequireAnyPermission(...NIQ_MANAGE)
  seedDefaults(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.seedDefaultQuestions(user, id);
  }

  @Get('campaigns/:id/responses')
  @RequireAnyPermission(...NIQ_MANAGE)
  listResponses(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.listResponses(user.tid, id);
  }

  @Get('campaigns/:id/analytics')
  @RequireAnyPermission(...NIQ_REPORTS, ...NIQ_READ)
  analytics(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feedback.analytics(user.tid, id);
  }

  @Get('campaigns/:id/export.xlsx')
  @RequireAnyPermission(...NIQ_REPORTS, ...NIQ_READ)
  async exportXlsx(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.feedback.exportXlsx(user.tid, id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="feedback-${id}.xlsx"`,
    );
    res.send(buf);
  }

  @Get('campaigns/:id/export.pdf')
  @RequireAnyPermission(...NIQ_REPORTS, ...NIQ_READ)
  async exportPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.feedback.exportPdf(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="feedback-${id}.pdf"`,
    );
    res.send(buf);
  }
}
