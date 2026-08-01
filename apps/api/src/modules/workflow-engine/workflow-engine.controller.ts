import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import {
  ApprovalWorkflowService,
  type ApprovalAction,
} from './services/approval-workflow.service';
import { WorkflowEngineService } from './services/workflow-engine.service';

@ApiBearerAuth()
@ApiTags('workflow')
@RequireModule('workflow')
@Controller({ path: 'workflow', version: '1' })
export class WorkflowEngineController {
  constructor(
    private readonly workflow: WorkflowEngineService,
    private readonly approvals: ApprovalWorkflowService,
  ) {}

  @Get('definitions')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:read',
    'naac-iqac:manage',
  )
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

  @Post('definitions/naac-approvals')
  @RequireAnyPermission('workflow:manage', 'naac-iqac:manage')
  ensureNaacApprovals(@CurrentUser() user: JwtUser) {
    return this.approvals.ensureNaacDefinitions(user.tid);
  }

  @Post('instances/start')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:collect',
    'naac-iqac:manage',
  )
  start(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      entityType: string;
      entityId: string;
      definitionCode?: string;
      link?: string;
      title?: string;
    },
  ) {
    if (body.definitionCode?.startsWith('NAAC_')) {
      return this.approvals.start(user, {
        entityType: body.entityType,
        entityId: body.entityId,
        definitionCode: body.definitionCode,
        link: body.link,
        title: body.title,
      });
    }
    return this.workflow.startInstance(
      user,
      body.entityType,
      body.entityId,
      body.definitionCode,
    );
  }

  @Post('instances/:id/action')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:collect',
    'naac-iqac:manage',
    'naac-iqac:read',
  )
  action(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      action: ApprovalAction | 'COMPLETE';
      note?: string;
      link?: string;
      title?: string;
    },
  ) {
    if (
      body.action === 'REQUEST_CHANGES' ||
      body.action === 'COMMENT' ||
      body.action === 'REOPEN' ||
      body.action === 'APPROVE' ||
      body.action === 'REJECT'
    ) {
      return this.approvals.act(user, id, body.action, body.note, {
        link: body.link,
        title: body.title,
      });
    }
    return this.workflow.action(user, id, body.action, body.note);
  }

  @Get('inbox')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:read',
    'naac-iqac:manage',
    'naac-iqac:collect',
  )
  inbox(@CurrentUser() user: JwtUser) {
    return this.approvals.myInbox(user);
  }

  @Get('instances/:id/audit')
  @RequireAnyPermission('workflow:read', 'workflow:manage', 'naac-iqac:read')
  audit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.audit(user.tid, id);
  }

  @Get('status')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:read',
    'naac-iqac:manage',
  )
  status(
    @CurrentUser() user: JwtUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.approvals.getStatus(user.tid, entityType, entityId);
  }

  @Get('timeline')
  @RequireAnyPermission(
    'workflow:read',
    'workflow:manage',
    'naac-iqac:read',
    'naac-iqac:manage',
  )
  timeline(
    @CurrentUser() user: JwtUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.approvals.getTimeline(user.tid, entityType, entityId);
  }
}
