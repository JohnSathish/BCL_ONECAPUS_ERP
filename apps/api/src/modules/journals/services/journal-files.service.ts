import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { isSuperAdmin } from '../../../common/permissions/permission-registry';
import { JournalAuthService } from './journal-auth.service';
import { JournalResolutionService } from './journal-resolution.service';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class JournalFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auth: JournalAuthService,
    private readonly resolution: JournalResolutionService,
  ) {}

  async uploadSubmissionFile(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    file: Express.Multer.File,
    kind: string = 'MANUSCRIPT',
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('File is required');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File too large (max 25MB)');
    }
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const isOwner = submission.submittedByUserId === user.sub;
    const isEditor =
      isSuperAdmin(user.roles ?? []) ||
      (user.permissions ?? []).includes('journals:manage');
    if (!isOwner && !isEditor) {
      throw new BadRequestException(
        'Not allowed to upload for this submission',
      );
    }

    if (
      kind === 'REVISION' &&
      submission.status !== 'REVISION_REQUIRED' &&
      !isEditor
    ) {
      throw new BadRequestException(
        'Revisions only allowed when revision is required',
      );
    }

    if (['GALLEY', 'PROOF', 'SIMILARITY_REPORT'].includes(kind) && !isEditor) {
      throw new BadRequestException('Only editors can upload this file type');
    }

    const version =
      (await this.prisma.journalSubmissionFile.count({
        where: { submissionId, kind },
      })) + 1;

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `journals/${user.tid}/${journalId}/${submissionId}/${kind.toLowerCase()}-v${version}-${safeName}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    return this.prisma.journalSubmissionFile.create({
      data: {
        tenantId: user.tid,
        submissionId,
        kind,
        version,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async listFiles(tenantId: string, journalId: string, submissionId: string) {
    return this.prisma.journalSubmissionFile.findMany({
      where: { tenantId, submissionId, submission: { journalId } },
      orderBy: [{ kind: 'asc' }, { version: 'desc' }],
    });
  }
}
