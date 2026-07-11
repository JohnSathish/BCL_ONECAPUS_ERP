import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Clear operator-facing message for common Prisma failures. */
export function examFeePrismaMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') {
      const table = String(
        (error.meta as { table?: string } | undefined)?.table ??
          'finance.exam_fee_*',
      );
      return `Examination fee tables are missing (${table}). On the VPS run: bash scripts/deploy/vps-migrate.sh then recreate the API container.`;
    }
    if (error.code === 'P2022') {
      return 'Examination fee schema is outdated (missing column). Run migrations and rebuild the API.';
    }
    if (error.code === 'P2003') {
      return 'Invalid examination fee reference (related record not found).';
    }
  }

  if (
    error instanceof TypeError &&
    /Cannot read propert(y|ies) of undefined/i.test(error.message)
  ) {
    return 'Examination fee Prisma models are missing from this API build. Pull latest code and rebuild the API image.';
  }

  return null;
}

export function rethrowExamFeeError(error: unknown): never {
  const msg = examFeePrismaMessage(error);
  if (msg) throw new BadRequestException(msg);
  throw error;
}

export function requireExamFeeDelegate<T>(
  delegate: T | undefined | null,
  name: string,
): T {
  if (!delegate) {
    throw new ServiceUnavailableException(
      `Examination fee model "${name}" is unavailable. Rebuild/redeploy the API after pulling the exam-fees migration.`,
    );
  }
  return delegate;
}
