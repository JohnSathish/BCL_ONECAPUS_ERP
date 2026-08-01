import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';

import { resolveUploadRoot } from '../../common/uploads/upload-paths';

export const DBCT_STUDENT_FRONT_ASSET = 'dbct-student-front.png';
export const DBCT_STUDENT_FRONT_PUBLIC_PATH =
  '/uploads/shared/id-cards/dbct-student-front.png';

/** Locate packaged library artwork (dev monorepo, Docker cwd, or compiled dist). */
export function resolveIdCardLibraryAssetPath(filename: string): string | null {
  const candidates = [
    join(process.cwd(), 'assets', 'id-cards', filename),
    join(process.cwd(), 'apps', 'api', 'assets', 'id-cards', filename),
    join(__dirname, '..', '..', '..', 'assets', 'id-cards', filename),
    join(__dirname, '..', '..', '..', '..', 'assets', 'id-cards', filename),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Copy shared ID-card library images into the Nest upload root so
 * `/uploads/shared/...` is reachable by browser + Puppeteer.
 */
export async function ensureSharedIdCardLibraryAssets(): Promise<{
  frontPublicPath: string;
}> {
  const src = resolveIdCardLibraryAssetPath(DBCT_STUDENT_FRONT_ASSET);
  const dest = join(
    resolveUploadRoot(),
    'shared',
    'id-cards',
    DBCT_STUDENT_FRONT_ASSET,
  );
  if (src) {
    await mkdir(dirname(dest), { recursive: true });
    if (!existsSync(dest)) {
      await copyFile(src, dest);
    }
  }
  return { frontPublicPath: DBCT_STUDENT_FRONT_PUBLIC_PATH };
}
