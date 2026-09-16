import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SkipSchoolLicense } from './school-sis-license.decorators';
import { SchoolSaasLicenseIssuerService } from './school-saas-license-issuer.service';
import {
  IssueSchoolLicenseDto,
  SchoolLicenseActionDto,
} from './dto/school-license.dto';
import { allSchoolLicenseModuleIds } from './school-sis-license.catalog';

@ApiBearerAuth()
@ApiTags('bcl-school-licenses')
@SkipSchoolLicense()
@Controller({ path: 'bcl-licenses', version: '1' })
export class SchoolSaasLicenseIssuerController {
  constructor(private readonly issuer: SchoolSaasLicenseIssuerService) {}

  @Get()
  @RequirePermissions('platform:licenses:read')
  list(@CurrentUser() user: JwtUser) {
    this.issuer.assertIssuer(user);
    return this.issuer.list();
  }

  @Get('catalog')
  @RequirePermissions('platform:licenses:read')
  catalog() {
    return { modules: allSchoolLicenseModuleIds() };
  }

  @Get(':id')
  @RequirePermissions('platform:licenses:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.issuer.assertIssuer(user);
    return this.issuer.get(id);
  }

  @Post('issue')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('platform:licenses:manage')
  issue(@CurrentUser() user: JwtUser, @Body() body: IssueSchoolLicenseDto) {
    this.issuer.assertIssuer(user);
    return this.issuer.issue(user, body);
  }

  @Post(':id/activate')
  @RequirePermissions('platform:licenses:manage')
  activate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    this.issuer.assertIssuer(user);
    return this.issuer.activateIssued(id, user);
  }

  @Post(':id/suspend')
  @RequirePermissions('platform:licenses:manage')
  suspend(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolLicenseActionDto,
  ) {
    this.issuer.assertIssuer(user);
    return this.issuer.suspend(id, user, body.reason);
  }

  @Post(':id/revoke')
  @RequirePermissions('platform:licenses:manage')
  revoke(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolLicenseActionDto,
  ) {
    this.issuer.assertIssuer(user);
    return this.issuer.revoke(id, user, body.reason);
  }

  @Post(':id/renew')
  @RequirePermissions('platform:licenses:manage')
  renew(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolLicenseActionDto,
  ) {
    this.issuer.assertIssuer(user);
    return this.issuer.renew(id, user, body.days ?? 365);
  }

  @Post(':id/extend')
  @RequirePermissions('platform:licenses:manage')
  extend(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolLicenseActionDto,
  ) {
    this.issuer.assertIssuer(user);
    return this.issuer.extend(id, user, body.days ?? 30);
  }

  @Patch(':id/entitlements')
  @RequirePermissions('platform:licenses:manage')
  entitlements(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SchoolLicenseActionDto,
  ) {
    this.issuer.assertIssuer(user);
    return this.issuer.patchLimits(id, user, body);
  }
}
