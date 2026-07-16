import { readFile } from 'fs/promises';
import type {
  JournalContentSourceAdapter,
  JournalImportManifest,
  ImportVolume,
} from './types';

const ROMAN_TO_NUM: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

/**
 * Google Sites adapter: prefers a checked-in snapshot for stability,
 * optionally crawls live pages to discover volume PDF/cover links.
 */
export class GoogleSitesAdapter implements JournalContentSourceAdapter {
  constructor(
    private readonly opts: {
      baseUrl: string;
      snapshotPath?: string;
      crawlLive?: boolean;
    },
  ) {}

  async fetchManifest(): Promise<JournalImportManifest> {
    if (!this.opts.snapshotPath) {
      throw new Error(
        'Google Sites adapter requires --snapshot=… (checked-in snapshot) for stable imports',
      );
    }
    const raw = await readFile(this.opts.snapshotPath, 'utf8');
    const manifest = JSON.parse(raw) as JournalImportManifest;
    manifest.baseUrl = this.opts.baseUrl || manifest.baseUrl;
    manifest.source = 'google-sites';

    if (this.opts.crawlLive) {
      try {
        await this.enrichVolumesFromLive(manifest);
      } catch (err) {
        // Non-fatal — snapshot volumes still import
        console.warn(
          `[google-sites] live crawl failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return manifest;
  }

  private async enrichVolumesFromLive(manifest: JournalImportManifest) {
    const volumesUrl = `${manifest.baseUrl.replace(/\/$/, '')}/published-volumes`;
    const html = await fetchText(volumesUrl);
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    const volumeLinks: Array<{ label: string; href: string }> = [];
    $('a').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href') || '';
      if (/^Volume\s+[IVXLC]+$/i.test(text) && href) {
        volumeLinks.push({
          label: text,
          href: absolutize(manifest.baseUrl, href),
        });
      }
    });

    for (const link of volumeLinks) {
      const roman = link.label.replace(/^Volume\s+/i, '').toUpperCase();
      const volumeNumber = ROMAN_TO_NUM[roman];
      if (!volumeNumber) continue;

      let vol = manifest.volumes.find((v) => v.volumeNumber === volumeNumber);
      if (!vol) {
        vol = {
          volumeNumber,
          year: 2010 + volumeNumber,
          label: link.label,
          roman,
        } satisfies ImportVolume;
        manifest.volumes.push(vol);
      }

      try {
        const pageHtml = await fetchText(link.href);
        const $$ = cheerio.load(pageHtml);
        const pdfHref =
          $$('a[href*=".pdf"]').first().attr('href') ||
          $$('a')
            .filter((_, a) => /pdf|download|full\s*text/i.test($$(a).text()))
            .first()
            .attr('href');
        const imgSrc =
          $$('img[src*="googleusercontent"], img[src*="ggpht"], img.image')
            .first()
            .attr('src') || $$('img').first().attr('src');

        if (pdfHref) {
          vol.pdfUrl = absolutize(link.href, pdfHref);
          vol.pdfFileName = `transient-volume-${volumeNumber}.pdf`;
        }
        if (imgSrc && !imgSrc.startsWith('data:')) {
          vol.coverUrl = absolutize(link.href, imgSrc);
        }
      } catch {
        // leave pending for report
      }
    }
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'OneCampus-JournalImporter/1.0 (+https://donboscocollege.ac.in)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function absolutize(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
