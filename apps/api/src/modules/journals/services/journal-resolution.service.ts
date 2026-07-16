import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResolutionService } from '../../tenants/tenant-resolution.service';

const RESERVED_SLUGS = new Set([
  'www',
  'erp',
  'api',
  'alumni',
  'admissions',
  'career',
  'careers',
  'library',
  'demo',
  'app',
  'portal',
  'admin',
  'mail',
  'journals',
  'localhost',
]);

@Injectable()
export class JournalResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  extractSlugFromHost(host: string): string | null {
    const hostname = host.split(':')[0]?.toLowerCase() ?? '';
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length < 2) return null;
    const slug = parts[0];
    if (!slug || RESERVED_SLUGS.has(slug)) return null;
    return slug;
  }

  async resolveTenantAndJournal(input: {
    host: string;
    journalSlug?: string | null;
  }) {
    const slug =
      input.journalSlug?.trim().toLowerCase() ||
      this.extractSlugFromHost(input.host);
    if (!slug) {
      throw new BadRequestException(
        'Journal slug missing. Use a journal subdomain or ?journal=slug',
      );
    }

    const tenant = await this.tenantResolution.resolveHost(input.host);
    if (!tenant) {
      throw new BadRequestException('Unknown journal portal host');
    }

    const journal = await this.prisma.journal.findFirst({
      where: { tenantId: tenant.id, slug, status: 'ACTIVE' },
    });
    if (!journal) {
      throw new NotFoundException(`Journal not found for slug "${slug}"`);
    }

    return { tenant, journal };
  }

  async requireJournal(tenantId: string, journalId: string) {
    const journal = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    return journal;
  }
}
