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
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  CreateMasterLookupDto,
  ReorderMasterLookupsDto,
  UpdateMasterLookupDto,
} from './dto/master-lookup.dto';
import { MasterDataService } from './master-data.service';

@ApiBearerAuth()
@ApiTags('master-lookups')
@Controller({ path: 'master-lookups', version: '1' })
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  @Get('types')
  @RequireAnyPermission('lookups:read', 'lookups:manage', 'students:read')
  listTypes() {
    return this.service.listGroupedTypes();
  }

  @Get()
  @RequireAnyPermission('lookups:read', 'lookups:manage', 'students:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('type') lookupType?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.list(user.tid, lookupType, activeOnly !== 'false');
  }

  @Post()
  @RequireAnyPermission('lookups:manage', 'students:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMasterLookupDto) {
    return this.service.create(user.tid, dto);
  }

  @Patch('reorder/:lookupType')
  @RequireAnyPermission('lookups:manage', 'students:manage')
  reorder(
    @CurrentUser() user: JwtUser,
    @Param('lookupType') lookupType: string,
    @Body() dto: ReorderMasterLookupsDto,
  ) {
    return this.service.reorder(user.tid, lookupType, dto.ids);
  }

  @Patch(':id')
  @RequireAnyPermission('lookups:manage', 'students:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMasterLookupDto,
  ) {
    return this.service.update(user.tid, id, dto);
  }
}
