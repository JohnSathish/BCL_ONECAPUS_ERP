import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { toPublicUploadUrl } from './public-upload-url';
import { resolveUploadRoot } from './upload-paths';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function localPathCandidates(publicPath: string): string[] {
  const relative = publicPath.replace(/^\//, '');
  const uploadRoot = resolveUploadRoot();
  const cwd = process.cwd();
  const withoutUploadsPrefix = relative.replace(/^uploads\//, '');

  return [
    join(uploadRoot, withoutUploadsPrefix),
    join(uploadRoot, relative),
    join(cwd, relative),
    join(cwd, 'apps', 'api', relative),
    join(cwd, '..', 'web', 'public', relative),
  ];
}

function readAsDataUri(absolutePath: string): string | null {
  try {
    const ext = extname(absolutePath).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    const buf = readFileSync(absolutePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Resolve browser-style upload URLs to embedded data URIs for Puppeteer PDF rendering.
 * Relative `/uploads/...` paths do not load inside page.setContent() without this.
 */
export function resolvePdfImageSrc(assetUrl?: string | null): string | null {
  if (!assetUrl?.trim()) return null;

  let url = assetUrl.trim();
  if (url.startsWith('data:')) return url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (
        parsed.pathname.startsWith('/uploads/') ||
        parsed.pathname.startsWith('/branding/')
      ) {
        url = parsed.pathname;
      } else {
        return url;
      }
    } catch {
      return url;
    }
  }

  const publicUrl = url.startsWith('/') ? url : toPublicUploadUrl(url);
  if (!publicUrl) return null;

  if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
    return resolvePdfImageSrc(publicUrl);
  }

  if (publicUrl.startsWith('/uploads/') || publicUrl.startsWith('/branding/')) {
    for (const absolute of localPathCandidates(publicUrl)) {
      if (existsSync(absolute)) {
        return readAsDataUri(absolute) ?? pathToFileURL(absolute).href;
      }
    }
  }

  return null;
}
