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
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { ResearchService } from './services/research.service';

@ApiBearerAuth()
@ApiTags('research')
@RequireModule('research')
@Controller({ path: 'research', version: '1' })
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Get('grants')
  @RequireAnyPermission('research:read', 'research:manage')
  list(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.research.list(user.tid, status);
  }

  @Post('grants')
  @RequirePermissions('research:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      title: string;
      principalInvestigatorId?: string;
      fundingAgency?: string;
      amount?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.research.create(user, body);
  }

  @Patch('grants/:id')
  @RequirePermissions('research:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      principalInvestigatorId: string;
      fundingAgency: string;
      amount: number;
      startDate: string;
      endDate: string;
      status: string;
      metadata: Record<string, unknown>;
    }>,
  ) {
    return this.research.update(user.tid, id, body);
  }
}
