import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { JournalContentService } from './services/journal-content.service';
import { JournalDoiService } from './services/journal-doi.service';
import { JournalEditorialService } from './services/journal-editorial.service';
import { JournalFilesService } from './services/journal-files.service';
import { JournalPlagiarismService } from './services/journal-plagiarism.service';
import { JournalProductionService } from './services/journal-production.service';
import { JournalReviewService } from './services/journal-review.service';
import { JournalSubmissionService } from './services/journal-submission.service';
import { JournalsService } from './services/journals.service';

@ApiBearerAuth()
@ApiTags('journals')
@RequireModule('journals')
@Controller({ path: 'journals', version: '1' })
export class JournalsController {
  constructor(
    private readonly journals: JournalsService,
    private readonly content: JournalContentService,
    private readonly submissions: JournalSubmissionService,
    private readonly reviews: JournalReviewService,
    private readonly files: JournalFilesService,
    private readonly editorial: JournalEditorialService,
    private readonly production: JournalProductionService,
    private readonly doi: JournalDoiService,
    private readonly plagiarism: JournalPlagiarismService,
  ) {}

  @Post('seed-defaults')
  @RequirePermissions('journals:manage')
  seedDefaults(@CurrentUser() user: JwtUser) {
    return this.journals.seedDefaults(user.tid);
  }

  @Get()
  @RequireAnyPermission('journals:read', 'journals:manage')
  list(@CurrentUser() user: JwtUser) {
    return this.journals.listJournals(user.tid);
  }

  @Post()
  @RequirePermissions('journals:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      name: string;
      shortName: string;
      slug: string;
      issn?: string;
      tagline?: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      frequency?: string;
    },
  ) {
    return this.journals.createJournal(user, body);
  }

  @Patch(':journalId')
  @RequirePermissions('journals:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: Partial<{
      name: string;
      shortName: string;
      issn: string;
      tagline: string;
      description: string;
      contactEmail: string;
      contactPhone: string;
      logoUrl: string;
      bannerUrl: string;
      frequency: string;
      status: string;
      publisher: string;
      institution: string;
      homeAnnouncementsImageUrl: string | null;
      homeAnnouncementsHeadline: string | null;
      homeAnnouncementsSubtext: string | null;
    }>,
  ) {
    return this.journals.updateJournal(user, journalId, body);
  }

  @Get(':journalId/pages')
  @RequireAnyPermission('journals:read', 'journals:manage')
  pages(@CurrentUser() user: JwtUser, @Param('journalId') journalId: string) {
    return this.journals.listAdminPages(user.tid, journalId);
  }

  @Post(':journalId/pages')
  @RequirePermissions('journals:manage')
  upsertPage(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      key: string;
      title: string;
      bodyHtml?: string;
      isPublished?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
      seoKeywords?: string[];
    },
  ) {
    return this.journals.upsertPage(user, journalId, body);
  }

  @Get(':journalId/announcements')
  @RequireAnyPermission('journals:read', 'journals:manage')
  announcements(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
  ) {
    return this.journals.listAdminAnnouncements(user.tid, journalId);
  }

  @Post(':journalId/announcements')
  @RequirePermissions('journals:manage')
  createAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      title: string;
      bodyHtml?: string;
      isPinned?: boolean;
      isPublished?: boolean;
    },
  ) {
    return this.journals.createAnnouncement(user, journalId, body);
  }

  @Get(':journalId/board')
  @RequireAnyPermission('journals:read', 'journals:manage')
  board(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Query('boardType') boardType?: string,
  ) {
    return this.journals.listAdminBoard(user.tid, journalId, boardType);
  }

  @Post(':journalId/board')
  @RequirePermissions('journals:manage')
  createBoardMember(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      fullName: string;
      roleTitle: string;
      boardType?: string;
      institution?: string;
      department?: string;
      country?: string;
      email?: string;
      orcid?: string;
      bio?: string;
      researchAreas?: string;
      photoUrl?: string | null;
      sortOrder?: number;
    },
  ) {
    return this.journals.createBoardMember(user, journalId, body);
  }

  @Patch(':journalId/board/:memberId')
  @RequirePermissions('journals:manage')
  updateBoardMember(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('memberId') memberId: string,
    @Body()
    body: Partial<{
      fullName: string;
      roleTitle: string;
      boardType: string;
      institution: string | null;
      department: string | null;
      country: string | null;
      email: string | null;
      orcid: string | null;
      bio: string | null;
      researchAreas: string | null;
      sortOrder: number;
      isActive: boolean;
      photoUrl: string | null;
    }>,
  ) {
    return this.journals.updateBoardMember(user, journalId, memberId, body);
  }

  @Delete(':journalId/board/:memberId')
  @RequirePermissions('journals:manage')
  deleteBoardMember(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.journals.deleteBoardMember(user, journalId, memberId);
  }

  @Get(':journalId/downloads')
  @RequireAnyPermission('journals:read', 'journals:manage')
  listDownloads(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Query('category') category?: string,
  ) {
    return this.content.listDownloads(user.tid, journalId, { category });
  }

  @Post(':journalId/downloads')
  @RequirePermissions('journals:manage')
  createDownload(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      title: string;
      category?: string;
      volumeId?: string;
      issueId?: string;
      fileUrl: string;
      fileName?: string;
      sortOrder?: number;
      isPublished?: boolean;
    },
  ) {
    return this.content.createDownload(user, journalId, body);
  }

  @Patch(':journalId/downloads/:downloadId')
  @RequirePermissions('journals:manage')
  updateDownload(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('downloadId') downloadId: string,
    @Body()
    body: Partial<{
      title: string;
      category: string;
      volumeId: string | null;
      issueId: string | null;
      fileUrl: string;
      fileName: string | null;
      sortOrder: number;
      isPublished: boolean;
    }>,
  ) {
    return this.content.updateDownload(user, journalId, downloadId, body);
  }

  @Delete(':journalId/downloads/:downloadId')
  @RequirePermissions('journals:manage')
  deleteDownload(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('downloadId') downloadId: string,
  ) {
    return this.content.deleteDownload(user, journalId, downloadId);
  }

  @Get(':journalId/media')
  @RequireAnyPermission('journals:read', 'journals:manage')
  listMedia(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Query('kind') kind?: string,
  ) {
    return this.content.listMedia(user.tid, journalId, kind);
  }

  @Post(':journalId/media')
  @RequirePermissions('journals:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 40 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { kind?: string; originalUrl?: string },
  ) {
    return this.content.uploadMedia(user, journalId, file, {
      kind: body.kind,
      originalUrl: body.originalUrl,
    });
  }

  @Delete(':journalId/media/:mediaId')
  @RequirePermissions('journals:manage')
  deleteMedia(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.content.deleteMedia(user, journalId, mediaId);
  }

  @Get(':journalId/redirects')
  @RequireAnyPermission('journals:read', 'journals:manage')
  listRedirects(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
  ) {
    return this.content.listRedirects(user.tid, journalId);
  }

  @Post(':journalId/redirects')
  @RequirePermissions('journals:manage')
  upsertRedirect(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body() body: { fromPath: string; toPath: string; statusCode?: number },
  ) {
    return this.content.upsertRedirect(user, journalId, body);
  }

  @Delete(':journalId/redirects/:redirectId')
  @RequirePermissions('journals:manage')
  deleteRedirect(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('redirectId') redirectId: string,
  ) {
    return this.content.deleteRedirect(user, journalId, redirectId);
  }

  @Get(':journalId/volumes')
  @RequireAnyPermission('journals:read', 'journals:manage')
  volumes(@CurrentUser() user: JwtUser, @Param('journalId') journalId: string) {
    return this.journals.listAdminVolumes(user.tid, journalId);
  }

  @Post(':journalId/volumes')
  @RequirePermissions('journals:manage')
  createVolume(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body() body: { volumeNumber: number; year: number; label?: string },
  ) {
    return this.journals.createVolume(user, journalId, body);
  }

  @Post(':journalId/issues')
  @RequirePermissions('journals:manage')
  createIssue(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      volumeId: string;
      issueNumber: number;
      title?: string;
      summary?: string;
      publicationDate?: string;
      isCurrent?: boolean;
      coverUrl?: string;
    },
  ) {
    return this.journals.createIssue(user, journalId, body);
  }

  @Patch(':journalId/issues/:issueId')
  @RequirePermissions('journals:manage')
  updateIssue(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('issueId') issueId: string,
    @Body()
    body: Partial<{
      title: string | null;
      summary: string | null;
      coverUrl: string | null;
      publicationDate: string | null;
      isCurrent: boolean;
      isPublished: boolean;
    }>,
  ) {
    return this.journals.updateIssue(user, journalId, issueId, body);
  }

  @Get(':journalId/articles')
  @RequireAnyPermission('journals:read', 'journals:manage')
  articles(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
  ) {
    return this.journals.listAdminArticles(user.tid, journalId);
  }

  @Post(':journalId/articles')
  @RequirePermissions('journals:manage')
  createArticle(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      issueId: string;
      title: string;
      abstract?: string;
      keywords?: string[];
      doi?: string;
      pageRange?: string;
      pdfUrl?: string;
      htmlContent?: string;
      category?: string;
      authors?: Array<{
        fullName: string;
        affiliation?: string;
        email?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    return this.journals.createArticle(user, journalId, body);
  }

  @Get(':journalId/submissions')
  @RequireAnyPermission('journals:read', 'journals:manage')
  listSubmissions(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Query('status') status?: string,
  ) {
    return this.submissions.listAdmin(user.tid, journalId, status);
  }

  @Get(':journalId/submissions/:submissionId')
  @RequireAnyPermission('journals:read', 'journals:manage')
  getSubmission(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissions.getAdmin(user.tid, journalId, submissionId);
  }

  @Post(':journalId/submissions/:submissionId/review-rounds')
  @RequirePermissions('journals:manage')
  openRound(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.reviews.openRound(user, journalId, submissionId);
  }

  @Post(':journalId/submissions/:submissionId/invite-reviewer')
  @RequirePermissions('journals:manage')
  inviteReviewer(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      email: string;
      displayName?: string;
      dueAt?: string;
      roundId?: string;
    },
  ) {
    return this.reviews.inviteReviewer(user, journalId, submissionId, body);
  }

  @Post(':journalId/submissions/:submissionId/decide')
  @RequirePermissions('journals:manage')
  decide(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      decision: string;
      notesHtml?: string;
      roundId?: string;
    },
  ) {
    return this.editorial.decide(user, journalId, submissionId, body);
  }

  @Post(':journalId/submissions/:submissionId/publish')
  @RequirePermissions('journals:manage')
  publish(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body()
    body: {
      issueId: string;
      pageRange?: string;
      doi?: string;
      category?: string;
    },
  ) {
    return this.editorial.publishToIssue(user, journalId, submissionId, body);
  }

  @Get(':journalId/production')
  @RequireAnyPermission('journals:read', 'journals:manage')
  productionQueue(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
  ) {
    return this.production.listProductionQueue(user.tid, journalId);
  }

  @Post(':journalId/submissions/:submissionId/production/advance')
  @RequirePermissions('journals:manage')
  advanceProduction(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body()
    body: { targetStatus?: string; notes?: string; skipToReady?: boolean },
  ) {
    return this.production.advance(user, journalId, submissionId, body);
  }

  @Post(':journalId/submissions/:submissionId/production/start')
  @RequirePermissions('journals:manage')
  startProduction(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.production.sendToProduction(user, journalId, submissionId);
  }

  @Post(':journalId/submissions/:submissionId/files')
  @RequirePermissions('journals:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadProductionFile(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body('kind') kind: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const fileKind = kind || 'PROOF';
    if (!['GALLEY', 'PROOF', 'SIMILARITY_REPORT'].includes(fileKind)) {
      throw new BadRequestException(
        'kind must be GALLEY, PROOF, or SIMILARITY_REPORT',
      );
    }
    return this.files.uploadSubmissionFile(
      user,
      journalId,
      submissionId,
      file,
      fileKind,
    );
  }

  @Get(':journalId/crossref-settings')
  @RequireAnyPermission('journals:read', 'journals:manage')
  crossrefSettings(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
  ) {
    return this.doi.getCrossrefSettings(user.tid, journalId);
  }

  @Patch(':journalId/crossref-settings')
  @RequirePermissions('journals:manage')
  updateCrossref(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Body()
    body: {
      doiPrefix?: string;
      crossrefEnabled?: boolean;
      crossrefDepositorName?: string;
      crossrefDepositorEmail?: string;
      crossrefRegistrant?: string;
      crossrefUsername?: string;
      crossrefPassword?: string;
    },
  ) {
    return this.doi.updateCrossrefSettings(user, journalId, body);
  }

  @Post(':journalId/articles/:articleId/doi/reserve')
  @RequirePermissions('journals:manage')
  reserveDoi(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.doi.reserveForArticle(user, journalId, articleId);
  }

  @Post(':journalId/articles/:articleId/doi/deposit')
  @RequirePermissions('journals:manage')
  depositDoi(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('articleId') articleId: string,
  ) {
    return this.doi.deposit(user, journalId, articleId);
  }

  @Post(':journalId/submissions/:submissionId/similarity')
  @RequirePermissions('journals:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async setSimilarity(
    @CurrentUser() user: JwtUser,
    @Param('journalId') journalId: string,
    @Param('submissionId') submissionId: string,
    @Body('score') score: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.plagiarism.setScoreAndReport(
      user,
      journalId,
      submissionId,
      Number(score),
      file,
    );
  }
}
