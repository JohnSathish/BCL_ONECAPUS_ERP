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
  SCHOOL_AUTOMATION_PERMISSION_CREATE,
  SCHOOL_AUTOMATION_PERMISSION_EXECUTE,
  SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  SCHOOL_AUTOMATION_PERMISSION_VIEW,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  AiWorkflowDto,
  RunAutomationDto,
  SaveAutomationSettingsDto,
  SaveAutomationTemplateDto,
  SaveAutomationWorkflowDto,
  TestAutomationDto,
} from './dto/school-automation.dto';
import {
  SchoolSisAutomationService,
  type AutoActor,
} from './school-sis-automation.service';

const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_AUTOMATION_PERMISSION_VIEW,
  SCHOOL_AUTOMATION_PERMISSION_MANAGE,
] as const;

function actor(user: JwtUser): AutoActor {
  const p = user.permissions ?? [];
  const star = p.includes('*') || p.includes(SCHOOL_SIS_PERMISSION_MANAGE);
  return {
    userId: user.sub,
    manage:
      star ||
      p.includes(SCHOOL_AUTOMATION_PERMISSION_MANAGE) ||
      p.includes(SCHOOL_AUTOMATION_PERMISSION_CREATE),
    execute:
      star ||
      p.includes(SCHOOL_AUTOMATION_PERMISSION_EXECUTE) ||
      p.includes(SCHOOL_AUTOMATION_PERMISSION_MANAGE),
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-automation')
@Controller({ path: 'school-sis/automation', version: '1' })
export class SchoolSisAutomationController {
  constructor(private readonly auto: SchoolSisAutomationService) {}

  @Get('catalog')
  @RequireAnyPermission(...VIEW)
  catalog() {
    return this.auto.catalog();
  }

  @Get('dashboard')
  @RequireAnyPermission(...VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.auto.dashboard(user.tid);
  }

  @Get('workflows')
  @RequireAnyPermission(...VIEW)
  list(@CurrentUser() user: JwtUser) {
    return this.auto.listWorkflows(user.tid);
  }

  @Post('workflows')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_CREATE,
  )
  create(@CurrentUser() user: JwtUser, @Body() dto: SaveAutomationWorkflowDto) {
    return this.auto.saveWorkflow(user.tid, dto, actor(user));
  }

  @Post('workflows/from-preset/:presetId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_CREATE,
  )
  preset(@CurrentUser() user: JwtUser, @Param('presetId') presetId: string) {
    return this.auto.fromPreset(user.tid, presetId, actor(user));
  }

  @Post('workflows/from-prompt')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_CREATE,
  )
  prompt(@CurrentUser() user: JwtUser, @Body() dto: AiWorkflowDto) {
    return this.auto.fromPrompt(user.tid, dto, actor(user));
  }

  @Get('workflows/:id')
  @RequireAnyPermission(...VIEW)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.getWorkflow(user.tid, id);
  }

  @Patch('workflows/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_CREATE,
  )
  patch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SaveAutomationWorkflowDto,
  ) {
    return this.auto.saveWorkflow(user.tid, dto, actor(user), id);
  }

  @Delete('workflows/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.archive(user.tid, id, actor(user));
  }

  @Post('workflows/:id/activate')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  activate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.setStatus(user.tid, id, 'ACTIVE', actor(user));
  }

  @Post('workflows/:id/pause')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  pause(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.setStatus(user.tid, id, 'PAUSED', actor(user));
  }

  @Post('workflows/:id/test')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_EXECUTE,
  )
  test(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: TestAutomationDto,
  ) {
    return this.auto.test(user.tid, id, dto, actor(user));
  }

  @Post('workflows/:id/run')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_EXECUTE,
  )
  run(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RunAutomationDto,
  ) {
    return this.auto.runNow(user.tid, id, dto, actor(user));
  }

  @Get('executions')
  @RequireAnyPermission(...VIEW)
  executions(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.auto.listExecutions(user.tid, status);
  }

  @Get('executions/:id')
  @RequireAnyPermission(...VIEW)
  execution(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.getExecution(user.tid, id);
  }

  @Get('failed-jobs')
  @RequireAnyPermission(...VIEW)
  failed(@CurrentUser() user: JwtUser) {
    return this.auto.failedJobs(user.tid);
  }

  @Post('failed-jobs/:id/retry')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_EXECUTE,
  )
  retry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.auto.retryStep(user.tid, id, actor(user));
  }

  @Post('failed-jobs/retry-all')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_EXECUTE,
  )
  retryAll(@CurrentUser() user: JwtUser) {
    return this.auto.retryAllFailed(user.tid, actor(user));
  }

  @Get('templates')
  @RequireAnyPermission(...VIEW)
  templates(@CurrentUser() user: JwtUser) {
    return this.auto.listTemplates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  saveTpl(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveAutomationTemplateDto,
  ) {
    return this.auto.saveTemplate(user.tid, dto, actor(user));
  }

  @Get('reports')
  @RequireAnyPermission(...VIEW)
  reports(@CurrentUser() user: JwtUser) {
    return this.auto.reports(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(...VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.auto.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveAutomationSettingsDto,
  ) {
    return this.auto.saveSettings(user.tid, dto, actor(user));
  }

  @Get('logs')
  @RequireAnyPermission(...VIEW)
  logs(@CurrentUser() user: JwtUser) {
    return this.auto.logs(user.tid);
  }

  @Post('webhooks')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_MANAGE,
    SCHOOL_AUTOMATION_PERMISSION_MANAGE,
  )
  webhook(@CurrentUser() user: JwtUser, @Body() body: { name: string }) {
    return this.auto.createIncomingWebhook(
      user.tid,
      body.name || 'Incoming',
      actor(user),
    );
  }
}
