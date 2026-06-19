import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { isSuperAdmin } from '../../common/permissions/permission-registry';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Public()
  @Get('resolve/:slug')
  async resolve(@Param('slug') slug: string) {
    const tenant = await this.tenants.findBySlug(slug);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domains: tenant.domains.map((d) => d.host),
    };
  }

  @ApiBearerAuth()
  @Get()
  @RequirePermissions('platform:licenses:read')
  list(@CurrentUser() user: JwtUser, @Query() query: PaginationQueryDto) {
    if (!isSuperAdmin(user.roles ?? [])) {
      throw new ForbiddenException('Platform admin access required');
    }
    return this.tenants.list(query);
  }
}
