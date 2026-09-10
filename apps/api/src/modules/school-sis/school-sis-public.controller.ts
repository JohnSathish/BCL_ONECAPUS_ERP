import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { SubmitSchoolApplicationDto } from './dto/school-sis.dto';
import { SchoolSisAdmissionService } from './school-sis-admission.service';
import { SchoolSisService } from './school-sis.service';

@ApiTags('school-sis-public')
@Controller({ path: 'school-sis/public', version: '1' })
export class SchoolSisPublicController {
  constructor(
    private readonly tenants: TenantResolutionService,
    private readonly sis: SchoolSisService,
    private readonly admission: SchoolSisAdmissionService,
  ) {}

  private async tenantId(host?: string) {
    const loginHost = host?.trim();
    if (!loginHost) throw new BadRequestException('Missing login host');
    const tenant = await this.tenants.resolveHost(loginHost);
    if (!tenant) throw new BadRequestException('Unknown school host');
    await this.sis.assertSecondarySisTenant(tenant.id);
    return tenant.id;
  }

  @Public()
  @Get('cycles')
  async cycles(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
  ) {
    const tenantId = await this.tenantId(loginHost || forwarded);
    return this.admission.listOpenCycles(tenantId);
  }

  @Public()
  @Post('applications')
  async apply(
    @Body() dto: SubmitSchoolApplicationDto,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
  ) {
    const tenantId = await this.tenantId(loginHost || forwarded);
    return this.admission.submitApplication(tenantId, dto);
  }
}
