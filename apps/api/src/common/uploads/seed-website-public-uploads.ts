import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { resolveStorageRoot, resolveUploadRoot } from './upload-paths';

function copyMissingTree(srcDir: string, destDir: string) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  for (const name of readdirSync(srcDir)) {
    const from = join(srcDir, name);
    const to = join(destDir, name);
    if (statSync(from).isDirectory()) {
      copyMissingTree(from, to);
      continue;
    }
    if (!existsSync(to)) {
      mkdirSync(destDir, { recursive: true });
      cpSync(from, to);
    }
  }
}

/**
 * Homepage CMS files are stored under STORAGE_ROOT/website but served from
 * /uploads/.... Copy bundled + storage copies into both roots so a wiped
 * Docker volume does not 404 the hero slider and news images.
 */
export function seedWebsitePublicUploads() {
  const bundled = join(process.cwd(), 'assets', 'website-public');
  const uploadWebsite = join(resolveUploadRoot(), 'website');
  const storageWebsite = join(resolveStorageRoot(), 'website');

  copyMissingTree(bundled, uploadWebsite);
  copyMissingTree(bundled, storageWebsite);
  copyMissingTree(storageWebsite, uploadWebsite);
}
