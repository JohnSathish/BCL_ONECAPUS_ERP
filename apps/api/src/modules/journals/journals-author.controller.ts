import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { JournalFilesService } from './services/journal-files.service';
import { JournalProductionService } from './services/journal-production.service';
import { JournalResolutionService } from './services/journal-resolution.service';
import { JournalSubmissionService } from './services/journal-submission.service';

@ApiBearerAuth()
@ApiTags('journals-author')
@Controller({ path: 'journals/portal/author', version: '1' })
export class JournalsAuthorController {
  constructor(
    private readonly submissions: JournalSubmissionService,
    private readonly files: JournalFilesService,
    private readonly production: JournalProductionService,
    private readonly resolution: JournalResolutionService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private resolveHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    return (
      this.tenantResolution.extractHostFromHeaders(
        req.headers.host,
        req.headers['x-forwarded-host'],
      ) || 'transient.demo.localhost'
    );
  }

  private async resolveJournal(req: Request, querySlug?: string) {
    const host = this.resolveHost(req);
    const headerSlug = String(req.headers['x-journal-slug'] ?? '')
      .trim()
      .toLowerCase();
    const slug = headerSlug || querySlug?.trim().toLowerCase() || null;
    return this.resolution.resolveTenantAndJournal({
      host,
      journalSlug: slug,
    });
  }

  @Get('submissions')
  async list(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.listMine(user, j.id);
  }

  @Get('submissions/:id')
  async get(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.getMine(user, j.id, id);
  }

  @Post('submissions')
  async create(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Query('journal') journal: string | undefined,
    @Body()
    body: {
      title: string;
      abstract?: string;
      keywords?: string[];
      correspondingEmail?: string;
      coverLetter?: string;
      coAuthors?: Array<{
        fullName: string;
        email?: string;
        affiliation?: string;
        orcid?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.createDraft(user, j.id, body);
  }

  @Patch('submissions/:id')
  async update(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal: string | undefined,
    @Body()
    body: {
      title?: string;
      abstract?: string;
      keywords?: string[];
      correspondingEmail?: string;
      coverLetter?: string;
      coAuthors?: Array<{
        fullName: string;
        email?: string;
        affiliation?: string;
        orcid?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.updateDraft(user, j.id, id, body);
  }

  @Post('submissions/:id/submit')
  async submit(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.submit(user, j.id, id);
  }

  @Post('submissions/:id/withdraw')
  async withdraw(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.submissions.withdraw(user, j.id, id);
  }

  @Post('submissions/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal: string | undefined,
    @Body('kind') kind: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.files.uploadSubmissionFile(
      user,
      j.id,
      id,
      file,
      kind || 'MANUSCRIPT',
    );
  }

  @Post('submissions/:id/approve-proof')
  async approveProof(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('journal') journal?: string,
  ) {
    const { journal: j } = await this.resolveJournal(req, journal);
    return this.production.approveProof(user, j.id, id);
  }
}
