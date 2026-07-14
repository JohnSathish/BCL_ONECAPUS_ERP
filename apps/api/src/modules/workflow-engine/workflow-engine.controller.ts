import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { WorkflowEngineService } from './services/workflow-engine.service';

@ApiBearerAuth()
@ApiTags('workflow')
@RequireModule('workflow')
@Controller({ path: 'workflow', version: '1' })
export class WorkflowEngineController {
  constructor(private readonly workflow: WorkflowEngineService) {}

  @Get('definitions')
  @RequireAnyPermission('workflow:read', 'workflow:manage')
  listDefinitions(@CurrentUser() user: JwtUser) {
    return this.workflow.listDefinitions(user.tid);
  }

  @Post('definitions')
  @RequirePermissions('workflow:manage')
  upsertDefinition(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      id?: string;
      code: string;
      name: string;
      description?: string;
      entityType: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
      steps?: Array<{
        stepOrder: number;
        name: string;
        assigneeRole?: string;
        assigneePermission?: string;
        slaHours?: number;
        isParallel?: boolean;
      }>;
    },
  ) {
    return this.workflow.upsertDefinition(user, body, body.id);
  }

  @Post('definitions/official-document-pilot')
  @RequirePermissions('workflow:manage')
  ensurePilot(@CurrentUser() user: JwtUser) {
    return this.workflow.ensureOfficialDocumentPilot(user.tid);
  }

  @Post('instances/start')
  @RequireAnyPermission('workflow:read', 'workflow:manage')
  start(
    @CurrentUser() user: JwtUser,
    @Body()
    body: { entityType: string; entityId: string; definitionCode?: string },
  ) {
    return this.workflow.startInstance(
      user,
      body.entityType,
      body.entityId,
      body.definitionCode,
    );
  }

  @Post('instances/:id/action')
  @RequireAnyPermission('workflow:read', 'workflow:manage')
  action(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: { action: 'APPROVE' | 'REJECT' | 'COMPLETE'; note?: string },
  ) {
    return this.workflow.action(user, id, body.action, body.note);
  }

  @Get('inbox')
  @RequireAnyPermission('workflow:read', 'workflow:manage')
  inbox(@CurrentUser() user: JwtUser) {
    return this.workflow.inbox(user);
  }

  @Get('instances/:id/audit')
  @RequireAnyPermission('workflow:read', 'workflow:manage')
  audit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.audit(user.tid, id);
  }
}
