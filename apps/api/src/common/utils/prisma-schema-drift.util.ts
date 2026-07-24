import { Prisma } from '@prisma/client';

/**
 * Operator-facing hint for Prisma schema drift (missing tables/columns).
 * Avoid module-specific wording — callers may hit unrelated tables.
 */
export function prismaSchemaDriftMessage(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (error.code === 'P2021') {
    const table = String(
      (error.meta as { table?: string } | undefined)?.table ?? 'unknown table',
    );
    const moduleHint = table.includes('syllabus_')
      ? 'Syllabus Repository'
      : table.includes('exam_fee')
        ? 'Examination Fees'
        : table.includes('question_')
          ? 'Question Bank'
          : 'Database';
    return `${moduleHint} tables are missing (${table}). On the VPS run: bash scripts/deploy/vps-migrate.sh then recreate the API container.`;
  }

  if (error.code === 'P2022') {
    return 'Database schema is outdated (missing column). Run migrations and rebuild the API.';
  }

  if (error.code === 'P2002') {
    const target = (error.meta as { target?: string[] | string } | undefined)
      ?.target;
    const fields = Array.isArray(target)
      ? target.join(', ')
      : typeof target === 'string'
        ? target
        : 'unique field';
    return `A record with the same ${fields} already exists. Change the title/slug and try again.`;
  }

  return null;
}
