import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

type JournalLike = {
  name: string;
  shortName: string;
  issn: string | null;
  publisher: string | null;
  crossrefDepositorName: string | null;
  crossrefDepositorEmail: string | null;
  crossrefRegistrant: string | null;
};

type ArticleLike = {
  id: string;
  title: string;
  abstract: string | null;
  publishedAt: Date | null;
  pageRange: string | null;
  doi: string | null;
  authors: Array<{ fullName: string; orcid: string | null }>;
  issue?: {
    issueNumber: number;
    publicationDate: Date | null;
    volume?: { volumeNumber: number; year: number } | null;
  } | null;
};

@Injectable()
export class JournalCitationService {
  constructor(private readonly prisma: PrismaService) {}

  buildCsl(journal: JournalLike, article: ArticleLike, doi?: string) {
    return {
      type: 'article-journal',
      id: article.id,
      title: article.title,
      author: article.authors.map((a) => {
        const parts = a.fullName.trim().split(/\s+/);
        const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return { family, given };
      }),
      'container-title': journal.name,
      ISSN: journal.issn || undefined,
      volume: article.issue?.volume?.volumeNumber
        ? String(article.issue.volume.volumeNumber)
        : undefined,
      issue: article.issue ? String(article.issue.issueNumber) : undefined,
      page: article.pageRange || undefined,
      issued: {
        'date-parts': [
          [
            article.issue?.volume?.year ||
              article.publishedAt?.getFullYear() ||
              new Date().getFullYear(),
          ],
        ],
      },
      DOI: doi || article.doi || undefined,
      publisher: journal.publisher || undefined,
      abstract: article.abstract || undefined,
    };
  }

  buildCrossrefXml(journal: JournalLike, article: ArticleLike, doi: string) {
    const year =
      article.issue?.volume?.year ||
      article.publishedAt?.getFullYear() ||
      new Date().getFullYear();
    const authors = article.authors
      .map((a) => {
        const parts = a.fullName.trim().split(/\s+/);
        const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return `<person_name sequence="first" contributor_role="author"><given_name>${escapeXml(given)}</given_name><surname>${escapeXml(surname || 'Unknown')}</surname></person_name>`;
      })
      .join('');
    const depositor =
      journal.crossrefDepositorName || journal.publisher || 'Journal Office';
    const email = journal.crossrefDepositorEmail || 'doi@donboscocollege.ac.in';
    const registrant = journal.crossrefRegistrant || depositor;

    return `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="4.4.2" xmlns="http://www.crossref.org/schema/4.4.2">
  <head>
    <doi_batch_id>${escapeXml(article.id)}</doi_batch_id>
    <timestamp>${Date.now()}</timestamp>
    <depositor>
      <depositor_name>${escapeXml(depositor)}</depositor_name>
      <email_address>${escapeXml(email)}</email_address>
    </depositor>
    <registrant>${escapeXml(registrant)}</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata>
        <full_title>${escapeXml(journal.name)}</full_title>
        <abbrev_title>${escapeXml(journal.shortName)}</abbrev_title>
        ${journal.issn ? `<issn media_type="electronic">${escapeXml(journal.issn)}</issn>` : ''}
      </journal_metadata>
      <journal_issue>
        <publication_date media_type="online"><year>${year}</year></publication_date>
        ${article.issue?.volume ? `<journal_volume><volume>${article.issue.volume.volumeNumber}</volume></journal_volume>` : ''}
        ${article.issue ? `<issue>${article.issue.issueNumber}</issue>` : ''}
      </journal_issue>
      <journal_article publication_type="full_text">
        <titles><title>${escapeXml(article.title)}</title></titles>
        <contributors>${authors}</contributors>
        <doi_data><doi>${escapeXml(doi)}</doi><resource>https://doi.org/${escapeXml(doi)}</resource></doi_data>
      </journal_article>
    </journal>
  </body>
</doi_batch>`;
  }

  buildRis(journal: JournalLike, article: ArticleLike, doi?: string) {
    const lines = [
      'TY  - JOUR',
      `TI  - ${article.title}`,
      ...article.authors.map((a) => `AU  - ${a.fullName}`),
      `JO  - ${journal.name}`,
      journal.issn ? `SN  - ${journal.issn}` : '',
      article.issue?.volume ? `VL  - ${article.issue.volume.volumeNumber}` : '',
      article.issue ? `IS  - ${article.issue.issueNumber}` : '',
      article.pageRange ? `SP  - ${article.pageRange}` : '',
      `PY  - ${article.issue?.volume?.year || article.publishedAt?.getFullYear() || new Date().getFullYear()}`,
      doi || article.doi ? `DO  - ${doi || article.doi}` : '',
      'ER  -',
    ];
    return lines.filter(Boolean).join('\n');
  }

  async citeArticle(
    tenantId: string,
    journalId: string,
    articleId: string,
    format: 'csl' | 'crossref-xml' | 'ris',
  ) {
    const journal = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    const article = await this.prisma.journalArticle.findFirst({
      where: { id: articleId, tenantId, journalId, status: 'PUBLISHED' },
      include: {
        authors: { orderBy: { sortOrder: 'asc' } },
        issue: { include: { volume: true } },
      },
    });
    if (!article) throw new NotFoundException('Article not found');

    const doi = article.doi || undefined;
    if (format === 'csl') {
      const csl =
        (article.cslJson as object | null) ||
        this.buildCsl(journal, article, doi);
      return { format, body: csl, contentType: 'application/json' };
    }
    if (format === 'ris') {
      return {
        format,
        body: this.buildRis(journal, article, doi),
        contentType: 'application/x-research-info-systems',
      };
    }
    return {
      format,
      body: this.buildCrossrefXml(
        journal,
        article,
        doi || `pending/${article.id}`,
      ),
      contentType: 'application/xml',
    };
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
