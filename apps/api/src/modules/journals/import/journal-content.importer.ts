import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { resolveUploadRoot } from '../../../common/uploads/upload-paths';
import type {
  ImportReport,
  ImportReportItem,
  JournalImportManifest,
} from './types';

type StorageLike = {
  put: (
    key: string,
    data: Buffer,
    opts?: { contentType?: string },
  ) => Promise<unknown>;
};

export class JournalContentImporter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageLike,
  ) {}

  async run(opts: {
    tenantId: string;
    journalSlug: string;
    manifest: JournalImportManifest;
    dryRun?: boolean;
  }): Promise<ImportReport> {
    const dryRun = Boolean(opts.dryRun);
    const items: ImportReportItem[] = [];
    const report: ImportReport = {
      journalSlug: opts.journalSlug,
      source: opts.manifest.source,
      dryRun,
      startedAt: new Date().toISOString(),
      counts: {
        imported: 0,
        skipped: 0,
        failed: 0,
        warnings: 0,
        pendingReview: 0,
      },
      items,
    };

    const journal = await this.prisma.journal.findFirst({
      where: { tenantId: opts.tenantId, slug: opts.journalSlug },
    });
    if (!journal) {
      this.push(report, {
        entity: 'journal',
        key: opts.journalSlug,
        status: 'failed',
        message: 'Journal not found — run ensure-journals-portal.ts first',
      });
      report.finishedAt = new Date().toISOString();
      return report;
    }

    const importRun = dryRun
      ? null
      : await this.prisma.journalImportRun.create({
          data: {
            tenantId: opts.tenantId,
            journalId: journal.id,
            source: opts.manifest.source,
            status: 'RUNNING',
          },
        });

    // —— Journal metadata ——
    const j = opts.manifest.journal;
    if (!dryRun) {
      await this.prisma.journal.update({
        where: { id: journal.id },
        data: {
          ...(j.name ? { name: j.name } : {}),
          ...(j.shortName ? { shortName: j.shortName } : {}),
          ...(j.issn ? { issn: j.issn } : {}),
          ...(j.tagline ? { tagline: j.tagline } : {}),
          ...(j.contactEmail ? { contactEmail: j.contactEmail } : {}),
          ...(j.publisher ? { publisher: j.publisher } : {}),
          ...(j.institution ? { institution: j.institution } : {}),
          ...(j.description ? { description: j.description } : {}),
          defaultLanguage: 'en',
        },
      });
    }
    this.push(report, {
      entity: 'journal',
      key: opts.journalSlug,
      status: 'imported',
      message: `ISSN=${j.issn ?? journal.issn}; email=${j.contactEmail ?? journal.contactEmail}`,
    });

    // —— Pages ——
    for (const page of opts.manifest.pages ?? []) {
      try {
        const existing = await this.prisma.journalPage.findFirst({
          where: { journalId: journal.id, key: page.key },
        });
        if (dryRun) {
          this.push(report, {
            entity: 'page',
            key: page.key,
            status: existing ? 'skipped' : 'imported',
            message: existing ? 'would update' : 'would create',
          });
          continue;
        }
        if (existing) {
          await this.prisma.journalPage.update({
            where: { id: existing.id },
            data: {
              title: page.title,
              bodyHtml: page.bodyHtml,
              seoTitle: page.seoTitle ?? existing.seoTitle,
              seoDescription: page.seoDescription ?? existing.seoDescription,
              seoKeywords: page.seoKeywords ?? existing.seoKeywords,
              isPublished: page.isPublished ?? true,
            },
          });
          this.push(report, {
            entity: 'page',
            key: page.key,
            status: 'imported',
            message: 'updated',
          });
        } else {
          await this.prisma.journalPage.create({
            data: {
              tenantId: opts.tenantId,
              journalId: journal.id,
              key: page.key,
              title: page.title,
              bodyHtml: page.bodyHtml,
              seoTitle: page.seoTitle,
              seoDescription: page.seoDescription,
              seoKeywords: page.seoKeywords ?? [],
              sortOrder: page.sortOrder ?? 0,
              isPublished: page.isPublished ?? true,
            },
          });
          this.push(report, {
            entity: 'page',
            key: page.key,
            status: 'imported',
            message: 'created',
          });
        }
      } catch (err) {
        this.push(report, {
          entity: 'page',
          key: page.key,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // —— Board ——
    for (const member of opts.manifest.board ?? []) {
      const key = `${member.boardType}|${member.fullName}|${member.email ?? ''}`;
      try {
        const existing = await this.prisma.journalEditorialMember.findFirst({
          where: {
            journalId: journal.id,
            fullName: member.fullName,
            boardType: member.boardType,
            ...(member.email ? { email: member.email } : {}),
          },
        });
        if (dryRun) {
          this.push(report, {
            entity: 'board',
            key,
            status: existing ? 'skipped' : 'imported',
          });
          continue;
        }
        if (existing) {
          await this.prisma.journalEditorialMember.update({
            where: { id: existing.id },
            data: {
              roleTitle: member.roleTitle,
              institution: member.institution,
              department: member.department,
              country: member.country,
              email: member.email,
              orcid: member.orcid,
              bio: member.bio,
              sortOrder: member.sortOrder ?? existing.sortOrder,
              isActive: true,
              importStatus: 'IMPORTED',
            },
          });
          this.push(report, {
            entity: 'board',
            key,
            status: 'skipped',
            message: 'updated existing',
          });
        } else {
          await this.prisma.journalEditorialMember.create({
            data: {
              tenantId: opts.tenantId,
              journalId: journal.id,
              fullName: member.fullName,
              roleTitle: member.roleTitle,
              boardType: member.boardType,
              institution: member.institution,
              department: member.department,
              country: member.country,
              email: member.email,
              orcid: member.orcid,
              bio: member.bio,
              sortOrder: member.sortOrder ?? 0,
              importStatus: 'IMPORTED',
            },
          });
          this.push(report, { entity: 'board', key, status: 'imported' });
        }
      } catch (err) {
        this.push(report, {
          entity: 'board',
          key,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // —— Volumes + optional PDF/cover downloads ——
    for (const vol of opts.manifest.volumes ?? []) {
      const key = `v${vol.volumeNumber}-${vol.year}`;
      try {
        let volume = await this.prisma.journalVolume.findFirst({
          where: {
            journalId: journal.id,
            volumeNumber: vol.volumeNumber,
            year: vol.year,
          },
        });
        if (!dryRun) {
          if (!volume) {
            volume = await this.prisma.journalVolume.create({
              data: {
                tenantId: opts.tenantId,
                journalId: journal.id,
                volumeNumber: vol.volumeNumber,
                year: vol.year,
                label: vol.label ?? `Volume ${vol.volumeNumber}`,
              },
            });
            this.push(report, {
              entity: 'volume',
              key,
              status: 'imported',
              message: 'created',
            });
          } else {
            volume = await this.prisma.journalVolume.update({
              where: { id: volume.id },
              data: { label: vol.label ?? volume.label },
            });
            this.push(report, {
              entity: 'volume',
              key,
              status: 'skipped',
              message: 'exists',
            });
          }

          let issue = await this.prisma.journalIssue.findFirst({
            where: { volumeId: volume.id, issueNumber: 1 },
          });
          if (!issue) {
            issue = await this.prisma.journalIssue.create({
              data: {
                tenantId: opts.tenantId,
                journalId: journal.id,
                volumeId: volume.id,
                issueNumber: 1,
                title: vol.label ?? `Volume ${vol.volumeNumber}`,
                isCurrent: vol.volumeNumber === 10,
                isPublished: true,
                publicationDate: new Date(`${vol.year}-01-01`),
              },
            });
          }

          if (vol.coverUrl) {
            const asset = await this.ingestRemoteAsset({
              tenantId: opts.tenantId,
              journalId: journal.id,
              url: vol.coverUrl,
              kind: 'COVER',
              dryRun,
              folder: 'media',
            });
            if (asset?.publicUrl) {
              await this.prisma.journalIssue.update({
                where: { id: issue.id },
                data: { coverUrl: asset.publicUrl },
              });
              this.push(report, {
                entity: 'media',
                key: `cover-${key}`,
                status: 'imported',
                message: asset.publicUrl,
              });
            } else if (!dryRun) {
              this.push(report, {
                entity: 'media',
                key: `cover-${key}`,
                status: 'pendingReview',
                message: `Could not download cover: ${vol.coverUrl}`,
              });
            }
          } else {
            this.push(report, {
              entity: 'media',
              key: `cover-${key}`,
              status: 'pendingReview',
              message: 'No cover URL discovered for volume',
            });
          }

          if (vol.pdfUrl) {
            const asset = await this.ingestRemoteAsset({
              tenantId: opts.tenantId,
              journalId: journal.id,
              url: vol.pdfUrl,
              kind: 'OTHER',
              dryRun,
              folder: 'downloads',
              fileName: vol.pdfFileName,
            });
            if (asset?.publicUrl && !dryRun) {
              const existingDl = await this.prisma.journalDownload.findFirst({
                where: {
                  journalId: journal.id,
                  volumeId: volume.id,
                  category: 'VOLUME_PDF',
                },
              });
              if (!existingDl) {
                await this.prisma.journalDownload.create({
                  data: {
                    tenantId: opts.tenantId,
                    journalId: journal.id,
                    title: `${vol.label ?? `Volume ${vol.volumeNumber}`} PDF`,
                    category: 'VOLUME_PDF',
                    volumeId: volume.id,
                    issueId: issue.id,
                    fileUrl: asset.publicUrl,
                    fileName:
                      vol.pdfFileName ?? `volume-${vol.volumeNumber}.pdf`,
                    sortOrder: 100 - vol.volumeNumber,
                    isPublished: true,
                    importStatus: 'IMPORTED',
                  },
                });
              }
              this.push(report, {
                entity: 'download',
                key: `pdf-${key}`,
                status: 'imported',
                message: asset.publicUrl,
              });
            } else if (!dryRun) {
              this.push(report, {
                entity: 'download',
                key: `pdf-${key}`,
                status: 'pendingReview',
                message: `Could not download PDF: ${vol.pdfUrl}`,
              });
            }
          } else {
            this.push(report, {
              entity: 'download',
              key: `pdf-${key}`,
              status: 'pendingReview',
              message:
                'No PDF URL discovered — volume row created without download',
            });
          }
        } else {
          this.push(report, {
            entity: 'volume',
            key,
            status: volume ? 'skipped' : 'imported',
          });
        }
      } catch (err) {
        this.push(report, {
          entity: 'volume',
          key,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // —— Explicit downloads ——
    for (const dl of opts.manifest.downloads ?? []) {
      const key = dl.fileName || dl.fileUrl;
      try {
        if (dryRun) {
          this.push(report, { entity: 'download', key, status: 'imported' });
          continue;
        }
        const existing = await this.prisma.journalDownload.findFirst({
          where: {
            journalId: journal.id,
            OR: [
              ...(dl.fileName ? [{ fileName: dl.fileName }] : []),
              { fileUrl: dl.fileUrl },
            ],
          },
        });
        if (existing) {
          this.push(report, {
            entity: 'download',
            key,
            status: 'skipped',
            message: 'exists',
          });
          continue;
        }
        let fileUrl = dl.fileUrl;
        if (/^https?:\/\//i.test(dl.fileUrl)) {
          const asset = await this.ingestRemoteAsset({
            tenantId: opts.tenantId,
            journalId: journal.id,
            url: dl.fileUrl,
            kind: 'OTHER',
            dryRun: false,
            folder: 'downloads',
            fileName: dl.fileName,
          });
          if (asset?.publicUrl) fileUrl = asset.publicUrl;
        }
        let volumeId: string | undefined;
        if (dl.volumeNumber != null && dl.year != null) {
          const v = await this.prisma.journalVolume.findFirst({
            where: {
              journalId: journal.id,
              volumeNumber: dl.volumeNumber,
              year: dl.year,
            },
          });
          volumeId = v?.id;
        }
        await this.prisma.journalDownload.create({
          data: {
            tenantId: opts.tenantId,
            journalId: journal.id,
            title: dl.title,
            category: dl.category || 'OTHER',
            volumeId,
            fileUrl,
            fileName: dl.fileName,
            sortOrder: dl.sortOrder ?? 0,
            isPublished: true,
            importStatus: 'IMPORTED',
          },
        });
        this.push(report, { entity: 'download', key, status: 'imported' });
      } catch (err) {
        this.push(report, {
          entity: 'download',
          key,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // —— Media (logo/banner etc.) ——
    for (const media of opts.manifest.media ?? []) {
      try {
        if (dryRun) {
          this.push(report, {
            entity: 'media',
            key: media.url,
            status: 'imported',
          });
          continue;
        }
        const existing = await this.prisma.journalMediaAsset.findFirst({
          where: { journalId: journal.id, originalUrl: media.url },
        });
        if (existing) {
          this.push(report, {
            entity: 'media',
            key: media.url,
            status: 'skipped',
          });
          if (media.kind === 'LOGO') {
            await this.prisma.journal.update({
              where: { id: journal.id },
              data: { logoUrl: existing.publicUrl },
            });
          }
          if (media.kind === 'BANNER') {
            await this.prisma.journal.update({
              where: { id: journal.id },
              data: { bannerUrl: existing.publicUrl },
            });
          }
          continue;
        }
        const asset = await this.ingestRemoteAsset({
          tenantId: opts.tenantId,
          journalId: journal.id,
          url: media.url,
          kind: media.kind,
          dryRun: false,
          folder: 'media',
          fileName: media.fileName,
        });
        if (!asset) {
          this.push(report, {
            entity: 'media',
            key: media.url,
            status: 'pendingReview',
            message: 'download failed',
          });
          continue;
        }
        if (media.kind === 'LOGO') {
          await this.prisma.journal.update({
            where: { id: journal.id },
            data: { logoUrl: asset.publicUrl },
          });
        }
        if (media.kind === 'BANNER') {
          await this.prisma.journal.update({
            where: { id: journal.id },
            data: { bannerUrl: asset.publicUrl },
          });
        }
        this.push(report, {
          entity: 'media',
          key: media.url,
          status: 'imported',
          message: asset.publicUrl,
        });
      } catch (err) {
        this.push(report, {
          entity: 'media',
          key: media.url,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // —— Redirects ——
    for (const redir of opts.manifest.redirects ?? []) {
      const fromPath = normalizePath(redir.fromPath);
      try {
        if (dryRun) {
          this.push(report, {
            entity: 'redirect',
            key: fromPath,
            status: 'imported',
          });
          continue;
        }
        const existing = await this.prisma.journalRedirect.findFirst({
          where: { journalId: journal.id, fromPath },
        });
        if (existing) {
          await this.prisma.journalRedirect.update({
            where: { id: existing.id },
            data: {
              toPath: redir.toPath,
              statusCode: redir.statusCode ?? 301,
            },
          });
          this.push(report, {
            entity: 'redirect',
            key: fromPath,
            status: 'skipped',
            message: 'updated',
          });
        } else {
          await this.prisma.journalRedirect.create({
            data: {
              tenantId: opts.tenantId,
              journalId: journal.id,
              fromPath,
              toPath: redir.toPath,
              statusCode: redir.statusCode ?? 301,
            },
          });
          this.push(report, {
            entity: 'redirect',
            key: fromPath,
            status: 'imported',
          });
        }
      } catch (err) {
        this.push(report, {
          entity: 'redirect',
          key: fromPath,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    report.finishedAt = new Date().toISOString();

    if (importRun) {
      await this.prisma.journalImportRun.update({
        where: { id: importRun.id },
        data: {
          status:
            report.counts.failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
          reportJson: report as object,
          finishedAt: new Date(),
        },
      });
    }

    return report;
  }

  async writeReportFile(
    report: ImportReport,
    journalSlug: string,
  ): Promise<string> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `journals/import-reports/${journalSlug}-${stamp}.json`;
    const body = Buffer.from(JSON.stringify(report, null, 2), 'utf8');
    await this.storage.put(key, body, { contentType: 'application/json' });
    const uploadPath = join(resolveUploadRoot(), key);
    await mkdir(dirname(uploadPath), { recursive: true });
    await writeFile(uploadPath, body);
    return key;
  }

  private push(report: ImportReport, item: ImportReportItem) {
    report.items.push(item);
    if (item.status === 'imported') report.counts.imported += 1;
    else if (item.status === 'skipped') report.counts.skipped += 1;
    else if (item.status === 'failed') report.counts.failed += 1;
    else if (item.status === 'warning') report.counts.warnings += 1;
    else if (item.status === 'pendingReview') report.counts.pendingReview += 1;
  }

  private async ingestRemoteAsset(opts: {
    tenantId: string;
    journalId: string;
    url: string;
    kind: string;
    dryRun: boolean;
    folder: 'media' | 'downloads';
    fileName?: string;
  }): Promise<{ storageKey: string; publicUrl: string } | null> {
    if (opts.dryRun) return null;
    if (opts.url.includes('sites.google.com') && !opts.url.includes('/d/')) {
      // Google Sites page URLs are not direct assets
    }
    try {
      const res = await fetch(opts.url, {
        headers: {
          'User-Agent': 'OneCampus-JournalImporter/1.0',
          Accept: '*/*',
        },
        redirect: 'follow',
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) return null;
      const contentType = res.headers.get('content-type') || undefined;
      const ext =
        guessExt(opts.fileName || opts.url, contentType) ||
        (contentType?.includes('pdf') ? '.pdf' : '.bin');
      const hash = createHash('sha1')
        .update(opts.url)
        .digest('hex')
        .slice(0, 10);
      const safe =
        (opts.fileName || `asset-${hash}`).replace(/[^a-zA-Z0-9._-]/g, '_') ||
        `asset-${hash}${ext}`;
      const storageKey = `journals/${opts.tenantId}/${opts.journalId}/${opts.folder}/${randomUUID()}-${safe}`;
      await this.storage.put(storageKey, buf, { contentType });
      const uploadPath = join(resolveUploadRoot(), storageKey);
      await mkdir(dirname(uploadPath), { recursive: true });
      await writeFile(uploadPath, buf);
      const publicUrl = `/uploads/${storageKey}`;
      await this.prisma.journalMediaAsset.create({
        data: {
          tenantId: opts.tenantId,
          journalId: opts.journalId,
          kind: opts.kind,
          storageKey,
          publicUrl,
          originalUrl: opts.url,
          fileName: opts.fileName || safe,
          mimeType: contentType,
          bytes: buf.length,
        },
      });
      return { storageKey, publicUrl };
    } catch {
      return null;
    }
  }
}

function normalizePath(path: string) {
  const raw = path.trim();
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function guessExt(name: string, contentType?: string) {
  const m = name.match(/\.(pdf|png|jpe?g|gif|webp|svg)(?:\?|$)/i);
  if (m) return `.${m[1].toLowerCase().replace('jpeg', 'jpg')}`;
  if (contentType?.includes('pdf')) return '.pdf';
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg'))
    return '.jpg';
  return '';
}
