import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import { PrismaService } from '../../../database/prisma.service';
import { JournalCitationService } from './journal-citation.service';
import { JournalResolutionService } from './journal-resolution.service';

@Injectable()
export class JournalDoiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: JournalResolutionService,
    private readonly citations: JournalCitationService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async updateCrossrefSettings(
    user: JwtUser,
    journalId: string,
    dto: {
      doiPrefix?: string;
      crossrefEnabled?: boolean;
      crossrefDepositorName?: string;
      crossrefDepositorEmail?: string;
      crossrefRegistrant?: string;
      crossrefUsername?: string;
      crossrefPassword?: string;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    return this.prisma.journal.update({
      where: { id: journalId },
      data: {
        ...(dto.doiPrefix !== undefined ? { doiPrefix: dto.doiPrefix } : {}),
        ...(dto.crossrefEnabled !== undefined
          ? { crossrefEnabled: dto.crossrefEnabled }
          : {}),
        ...(dto.crossrefDepositorName !== undefined
          ? { crossrefDepositorName: dto.crossrefDepositorName }
          : {}),
        ...(dto.crossrefDepositorEmail !== undefined
          ? { crossrefDepositorEmail: dto.crossrefDepositorEmail }
          : {}),
        ...(dto.crossrefRegistrant !== undefined
          ? { crossrefRegistrant: dto.crossrefRegistrant }
          : {}),
        ...(dto.crossrefUsername !== undefined
          ? { crossrefUsername: dto.crossrefUsername }
          : {}),
        ...(dto.crossrefPassword !== undefined
          ? {
              crossrefPasswordEnc: this.crypto.encrypt(dto.crossrefPassword),
            }
          : {}),
      },
      select: {
        id: true,
        doiPrefix: true,
        crossrefEnabled: true,
        crossrefDepositorName: true,
        crossrefDepositorEmail: true,
        crossrefRegistrant: true,
        crossrefUsername: true,
        doiSequence: true,
      },
    });
  }

  getCrossrefSettings(tenantId: string, journalId: string) {
    return this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
      select: {
        id: true,
        doiPrefix: true,
        crossrefEnabled: true,
        crossrefDepositorName: true,
        crossrefDepositorEmail: true,
        crossrefRegistrant: true,
        crossrefUsername: true,
        doiSequence: true,
        // never return password
      },
    });
  }

  async reserveForArticle(user: JwtUser, journalId: string, articleId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const journal = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId: user.tid },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    const article = await this.prisma.journalArticle.findFirst({
      where: { id: articleId, tenantId: user.tid, journalId },
      include: { authors: true, issue: { include: { volume: true } } },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (article.doi) {
      return this.prisma.journalDoiRecord.findFirst({
        where: { journalId, doi: article.doi },
      });
    }

    const prefix = journal.doiPrefix || '10.0000';
    const year = article.issue?.volume?.year || new Date().getFullYear();
    const updated = await this.prisma.journal.update({
      where: { id: journalId },
      data: { doiSequence: { increment: 1 } },
    });
    const doi = `${prefix}/${journal.slug}.${year}.${String(updated.doiSequence).padStart(4, '0')}`;

    const xml = this.citations.buildCrossrefXml(journal, article, doi);
    const record = await this.prisma.journalDoiRecord.create({
      data: {
        tenantId: user.tid,
        journalId,
        articleId,
        doi,
        status: 'RESERVED',
        requestXml: xml,
      },
    });

    const csl = this.citations.buildCsl(journal, article, doi);
    await this.prisma.journalArticle.update({
      where: { id: articleId },
      data: { doi, cslJson: csl },
    });

    return record;
  }

  async deposit(user: JwtUser, journalId: string, articleId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const journal = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId: user.tid },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    const article = await this.prisma.journalArticle.findFirst({
      where: { id: articleId, tenantId: user.tid, journalId },
      include: { authors: true, issue: { include: { volume: true } } },
    });
    if (!article) throw new NotFoundException('Article not found');

    let record = article.doi
      ? await this.prisma.journalDoiRecord.findFirst({
          where: { journalId, doi: article.doi },
        })
      : null;
    if (!record) {
      record = await this.reserveForArticle(user, journalId, articleId);
    }
    if (!record) throw new BadRequestException('DOI reserve failed');

    const xml =
      record.requestXml ||
      this.citations.buildCrossrefXml(journal, article, record.doi);

    if (
      journal.crossrefEnabled &&
      journal.crossrefUsername &&
      journal.crossrefPasswordEnc
    ) {
      const password = this.crypto.decrypt(journal.crossrefPasswordEnc);
      try {
        const endpoint =
          process.env.CROSSREF_DEPOSIT_URL ||
          'https://doi.crossref.org/servlet/deposit';
        const form = new URLSearchParams();
        form.set('operation', 'doMDUpload');
        form.set('login_id', journal.crossrefUsername);
        form.set('login_passwd', password || '');
        form.set('fname', xml);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const body = await res.text();
        return this.prisma.journalDoiRecord.update({
          where: { id: record.id },
          data: {
            status: res.ok ? 'DEPOSITED' : 'FAILED',
            requestXml: xml,
            responseBody: body.slice(0, 8000),
            depositedAt: res.ok ? new Date() : null,
          },
        });
      } catch (e) {
        return this.prisma.journalDoiRecord.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            requestXml: xml,
            responseBody: String(e).slice(0, 2000),
          },
        });
      }
    }

    // Dry-run (demo-safe)
    return this.prisma.journalDoiRecord.update({
      where: { id: record.id },
      data: {
        status: 'DEPOSITED',
        requestXml: xml,
        responseBody: 'DRY_RUN: Crossref credentials not configured',
        depositedAt: new Date(),
      },
    });
  }
}
