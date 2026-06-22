import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import {
  CareersApplicationStatusDto,
  CareersDocumentUploadDto,
  SubmitCareersApplicationDto,
} from './dto/careers-portal.dto';
import { CareersPortalService } from './services/careers-portal.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiTags('careers-portal')
@Controller({ path: 'careers/portal', version: '1' })
export class CareersPortalController {
  constructor(
    private readonly portal: CareersPortalService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private resolveCareersHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    return (
      this.tenantResolution.extractHostFromHeaders(
        req.headers.host,
        req.headers['x-forwarded-host'],
      ) || 'career.demo.localhost'
    );
  }

  private async resolveTenantId(req: Request): Promise<string> {
    const host = this.resolveCareersHost(req);
    const tenant = await this.tenantResolution.resolveHost(host);
    if (!tenant) throw new BadRequestException('Unknown careers portal host');
    return tenant.id;
  }

  @Public()
  @Get('info')
  async info(@Req() req: Request) {
    const tenantId = await this.resolveTenantId(req);
    return this.portal.getPortalInfo(tenantId);
  }

  @Public()
  @Get('sitemap')
  async sitemap(@Req() req: Request) {
    const tenantId = await this.resolveTenantId(req);
    const jobs = await this.portal.listPublishedJobs(tenantId);
    return jobs
      .filter((j: { slug?: string | null }) => j.slug)
      .map((j: { slug: string; title: string; updatedAt?: Date }) => ({
        slug: j.slug,
        title: j.title,
        updatedAt: j.updatedAt,
      }));
  }

  @Public()
  @Get('jobs')
  async listJobs(@Req() req: Request) {
    const tenantId = await this.resolveTenantId(req);
    return this.portal.listPublishedJobs(tenantId);
  }

  @Public()
  @Get('jobs/:slug')
  async getJob(@Req() req: Request, @Param('slug') slug: string) {
    const tenantId = await this.resolveTenantId(req);
    return this.portal.getJobBySlug(tenantId, slug);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  @Post('apply')
  async apply(@Req() req: Request, @Body() dto: SubmitCareersApplicationDto) {
    const tenantId = await this.resolveTenantId(req);
    const remoteIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;
    return this.portal.submitApplication(tenantId, dto, remoteIp);
  }

  @Public()
  @Post('application-status')
  async applicationStatus(
    @Req() req: Request,
    @Body() dto: CareersApplicationStatusDto,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.portal.getApplicationStatus(
      tenantId,
      dto.applicationNo,
      dto.mobile,
    );
  }

  @Public()
  @Post('upload/:applicationId/:kind')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Req() req: Request,
    @Param('applicationId') applicationId: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const allowed = ['resume', 'photo', 'certificate'];
    if (!allowed.includes(kind)) {
      throw new BadRequestException('Invalid upload kind');
    }
    const tenantId = await this.resolveTenantId(req);
    const result = await this.portal.persistUpload(
      tenantId,
      applicationId,
      kind,
      file,
    );
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 12, ttl: 900_000 } })
  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async uploadDocument(
    @Req() req: Request,
    @Body() dto: CareersDocumentUploadDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const kind = dto.kind?.trim() || 'certificate';
    const allowed = ['resume', 'photo', 'certificate'];
    if (!allowed.includes(kind)) {
      throw new BadRequestException('Invalid upload kind');
    }
    const tenantId = await this.resolveTenantId(req);
    return this.portal.uploadVerifiedDocument(
      tenantId,
      dto.applicationNo,
      dto.mobile,
      kind,
      file,
    );
  }
}
