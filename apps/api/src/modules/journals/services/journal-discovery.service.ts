import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Injectable()
export class JournalDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async sitemapEntries(tenantId: string, journalId: string) {
    const articles = await this.prisma.journalArticle.findMany({
      where: { tenantId, journalId, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 2000,
    });
    return articles.map((a) => ({
      id: a.id,
      path: `/articles/${a.id}`,
      title: a.title,
      updatedAt: (a.updatedAt || a.publishedAt || new Date()).toISOString(),
    }));
  }

  private async publishedArticles(tenantId: string, journalId: string) {
    return this.prisma.journalArticle.findMany({
      where: { tenantId, journalId, status: 'PUBLISHED' },
      include: {
        authors: { orderBy: { sortOrder: 'asc' } },
        issue: { include: { volume: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });
  }

  private identifier(journalSlug: string, articleId: string) {
    return `oai:${journalSlug}:${articleId}`;
  }

  private recordXml(
    journal: {
      name: string;
      slug: string;
      issn: string | null;
      publisher: string | null;
    },
    article: {
      id: string;
      title: string;
      abstract: string | null;
      doi: string | null;
      publishedAt: Date | null;
      authors: Array<{ fullName: string }>;
    },
    baseUrl: string,
  ) {
    const id = this.identifier(journal.slug, article.id);
    const datestamp = (article.publishedAt || new Date())
      .toISOString()
      .slice(0, 10);
    const creators = article.authors
      .map((a) => `<dc:creator>${escapeXml(a.fullName)}</dc:creator>`)
      .join('');
    const articleUrl = `${baseUrl.replace(/\/$/, '')}/articles/${article.id}`;
    return `<record>
  <header>
    <identifier>${escapeXml(id)}</identifier>
    <datestamp>${datestamp}</datestamp>
    <setSpec>${escapeXml(journal.slug)}</setSpec>
  </header>
  <metadata>
    <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
      <dc:title>${escapeXml(article.title)}</dc:title>
      ${creators}
      <dc:publisher>${escapeXml(journal.publisher || journal.name)}</dc:publisher>
      <dc:date>${datestamp}</dc:date>
      <dc:type>article</dc:type>
      <dc:identifier>${escapeXml(article.doi ? `https://doi.org/${article.doi}` : articleUrl)}</dc:identifier>
      <dc:source>${escapeXml(journal.name)}${journal.issn ? ` (ISSN ${escapeXml(journal.issn)})` : ''}</dc:source>
      ${article.abstract ? `<dc:description>${escapeXml(article.abstract.slice(0, 2000))}</dc:description>` : ''}
      <dc:language>en</dc:language>
      <dc:rights>open access</dc:rights>
    </oai_dc:dc>
  </metadata>
</record>`;
  }

  async oai(
    tenantId: string,
    journalId: string,
    query: {
      verb?: string;
      metadataPrefix?: string;
      identifier?: string;
      baseUrl?: string;
    },
  ) {
    const journal = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
    });
    if (!journal) throw new NotFoundException('Journal not found');

    const verb = (query.verb || 'Identify').trim();
    const baseUrl =
      query.baseUrl ||
      process.env.JOURNALS_PUBLIC_URL ||
      `https://${journal.slug}.donboscocollege.ac.in`;
    const oaiEndpoint = `${baseUrl.replace(/\/$/, '')}/oai`;
    const responseDate = new Date().toISOString();

    const wrap = (body: string) =>
      `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="${escapeXml(verb)}">${escapeXml(oaiEndpoint)}</request>
  ${body}
</OAI-PMH>`;

    if (verb === 'Identify') {
      return {
        contentType: 'text/xml; charset=utf-8',
        body: wrap(`<Identify>
  <repositoryName>${escapeXml(journal.name)}</repositoryName>
  <baseURL>${escapeXml(oaiEndpoint)}</baseURL>
  <protocolVersion>2.0</protocolVersion>
  <adminEmail>${escapeXml(journal.contactEmail || 'noreply@donboscocollege.ac.in')}</adminEmail>
  <earliestDatestamp>2020-01-01</earliestDatestamp>
  <deletedRecord>no</deletedRecord>
  <granularity>YYYY-MM-DD</granularity>
</Identify>`),
      };
    }

    if (verb === 'ListMetadataFormats') {
      return {
        contentType: 'text/xml; charset=utf-8',
        body: wrap(`<ListMetadataFormats>
  <metadataFormat>
    <metadataPrefix>oai_dc</metadataPrefix>
    <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
    <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
  </metadataFormat>
</ListMetadataFormats>`),
      };
    }

    if (verb === 'ListSets') {
      return {
        contentType: 'text/xml; charset=utf-8',
        body: wrap(`<ListSets>
  <set>
    <setSpec>${escapeXml(journal.slug)}</setSpec>
    <setName>${escapeXml(journal.name)}</setName>
  </set>
</ListSets>`),
      };
    }

    if (verb === 'ListRecords' || verb === 'ListIdentifiers') {
      if (query.metadataPrefix && query.metadataPrefix !== 'oai_dc') {
        return {
          contentType: 'text/xml; charset=utf-8',
          body: wrap(
            `<error code="cannotDisseminateFormat">Only oai_dc is supported</error>`,
          ),
        };
      }
      const articles = await this.publishedArticles(tenantId, journalId);
      if (verb === 'ListIdentifiers') {
        const headers = articles
          .map((a) => {
            const datestamp = (a.publishedAt || a.createdAt)
              .toISOString()
              .slice(0, 10);
            return `<header>
  <identifier>${escapeXml(this.identifier(journal.slug, a.id))}</identifier>
  <datestamp>${datestamp}</datestamp>
  <setSpec>${escapeXml(journal.slug)}</setSpec>
</header>`;
          })
          .join('\n');
        return {
          contentType: 'text/xml; charset=utf-8',
          body: wrap(`<ListIdentifiers>${headers}</ListIdentifiers>`),
        };
      }
      const records = articles
        .map((a) => this.recordXml(journal, a, baseUrl))
        .join('\n');
      return {
        contentType: 'text/xml; charset=utf-8',
        body: wrap(`<ListRecords>${records}</ListRecords>`),
      };
    }

    if (verb === 'GetRecord') {
      if (!query.identifier) {
        return {
          contentType: 'text/xml; charset=utf-8',
          body: wrap(`<error code="badArgument">identifier required</error>`),
        };
      }
      const parts = query.identifier.split(':');
      const articleId = parts[parts.length - 1];
      const article = await this.prisma.journalArticle.findFirst({
        where: {
          id: articleId,
          tenantId,
          journalId,
          status: 'PUBLISHED',
        },
        include: {
          authors: { orderBy: { sortOrder: 'asc' } },
          issue: { include: { volume: true } },
        },
      });
      if (!article) {
        return {
          contentType: 'text/xml; charset=utf-8',
          body: wrap(`<error code="idDoesNotExist">Unknown identifier</error>`),
        };
      }
      return {
        contentType: 'text/xml; charset=utf-8',
        body: wrap(
          `<GetRecord>${this.recordXml(journal, article, baseUrl)}</GetRecord>`,
        ),
      };
    }

    return {
      contentType: 'text/xml; charset=utf-8',
      body: wrap(`<error code="badVerb">Illegal OAI verb</error>`),
    };
  }
}
