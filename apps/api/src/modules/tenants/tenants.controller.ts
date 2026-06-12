import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
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
  list(@Query() query: PaginationQueryDto) {
    return this.tenants.list(query);
  }
}
