import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ListAuditLogsQueryDto } from '../dto/audit.dto';
import { AuditService } from '../services/audit.service';

@ApiBearerAuth()
@ApiTags('admin-audit')
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@CurrentUser() user: JwtUser, @Query() query: ListAuditLogsQueryDto) {
    return this.audit.list(user.tid, query);
  }
}
