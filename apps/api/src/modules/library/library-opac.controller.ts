import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  OpacRenewDto,
  OpacReserveDto,
  OpacSearchQueryDto,
  UpdateOpacSettingsDto,
} from './dto/library-opac.dto';
import { LibraryOpacService } from './services/library-opac.service';

@ApiTags('opac')
@ApiBearerAuth()
@Controller({ path: 'opac', version: '1' })
export class LibraryOpacController {
  constructor(
    private readonly opac: LibraryOpacService,
    private readonly cls: ClsService,
  ) {}

  @Public()
  @Get('home')
  async home(@Headers('x-login-host') host?: string) {
    return this.opac.home(await this.publicTenant(host));
  }

  @Public()
  @Get('search')
  async search(
    @Query() query: OpacSearchQueryDto,
    @Headers('x-login-host') host?: string,
  ) {
    return this.opac.search(
      await this.publicTenant(host),
      query,
      null,
      'public',
    );
  }

  @Public()
  @Get('books/:id')
  async book(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-login-host') host?: string,
  ) {
    return this.opac.book(await this.publicTenant(host), id);
  }

  @Public()
  @Get('info')
  async info(@Headers('x-login-host') host?: string) {
    return this.opac.info(await this.publicTenant(host));
  }

  @Public()
  @Get('departments')
  async departments(@Headers('x-login-host') host?: string) {
    return this.opac.departments(await this.publicTenant(host));
  }

  @Public()
  @Get('digital')
  async digital(
    @Query('q') q: string | undefined,
    @Headers('x-login-host') host?: string,
  ) {
    return this.opac.digital(await this.publicTenant(host), q);
  }

  @Get('catalogue')
  catalogue(@CurrentUser() user: JwtUser, @Query() query: OpacSearchQueryDto) {
    return this.opac.search(user.tid, query, user.sub, 'member');
  }

  @Get('catalogue/:id')
  catalogueBook(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.opac.book(user.tid, id, user.sub);
  }

  @Get('account')
  account(@CurrentUser() user: JwtUser) {
    return this.opac.account(user);
  }

  @Post('reservations')
  reserve(@CurrentUser() user: JwtUser, @Body() dto: OpacReserveDto) {
    return this.opac.reserve(user, dto.bookId);
  }

  @Post('reservations/:id/cancel')
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.opac.cancelReservation(user, id);
  }

  @Post('renew')
  renew(@CurrentUser() user: JwtUser, @Body() dto: OpacRenewDto) {
    return this.opac.renew(user, dto.barcode);
  }

  @Get('admin/settings')
  @RequirePermissions('library:manage')
  adminSettings(@CurrentUser() user: JwtUser) {
    return this.opac.getAdminSettings(user.tid);
  }

  @Patch('admin/settings')
  @RequirePermissions('library:manage')
  saveAdminSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateOpacSettingsDto,
  ) {
    return this.opac.saveAdminSettings(user.tid, dto);
  }

  @Get('admin/usage')
  @RequirePermissions('library:manage')
  usage(@CurrentUser() user: JwtUser) {
    return this.opac.usage(user.tid);
  }

  private async publicTenant(host?: string) {
    const fromCls = this.cls.get<string>(CLS_TENANT_ID);
    if (fromCls) return fromCls;
    const tenantId = host ? await this.opac.tenantIdForHost(host) : null;
    if (!tenantId) {
      throw new NotFoundException(
        'The library catalogue is not available for this address.',
      );
    }
    return tenantId;
  }
}
