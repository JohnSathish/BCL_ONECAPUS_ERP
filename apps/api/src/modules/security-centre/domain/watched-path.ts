import path from 'path';

export const WATCHED_RELATIVE_PATHS = [
  'package.json',
  'prisma/schema.prisma',
  'src/main.ts',
  'src/app.module.ts',
] as const;

/** Resolve a watched relative path and refuse anything that escapes the root. */
export function resolveWatchedPath(
  root: string,
  relativePath: string,
): string | null {
  const normalizedRelative = relativePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (
    !normalizedRelative ||
    normalizedRelative.includes('\0') ||
    normalizedRelative.split('/').some((part) => part === '..')
  ) {
    return null;
  }
  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, normalizedRelative);
  const relative = path.relative(rootResolved, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    return null;
  return target;
}
