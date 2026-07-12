import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  normalizeClass12Board,
  normalizeClass12Stream,
  normalizeClass12SubjectKey,
} from '../domain/class12-subjects.util';

export type Class12SubjectDto = {
  id: string;
  subjectName: string;
  sortOrder: number;
  boardCode: string;
  streamCode: string;
};

@Injectable()
export class Class12SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByBoardAndStream(
    tenantId: string,
    board?: string,
    stream?: string,
  ): Promise<Class12SubjectDto[]> {
    const boardRaw = normalizeClass12Board(board);
    const streamCode = normalizeClass12Stream(stream);
    if (!boardRaw || !streamCode) {
      throw new BadRequestException(
        'board and stream query params are required',
      );
    }

    const boardAliases = await this.resolveBoardAliases(tenantId, boardRaw);
    // Subjects seeded as boardType GENERAL are shared across all boards.
    const uniqueAliases = [
      ...new Set(
        [...boardAliases, 'GENERAL', 'ALL', 'COMMON']
          .map((a) => a.trim())
          .filter(Boolean),
      ),
    ];

    const rows = await this.prisma.supportBoardSubject.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        category: { equals: streamCode, mode: 'insensitive' },
        OR: uniqueAliases.map((alias) => ({
          boardType: { equals: alias, mode: 'insensitive' as const },
        })),
      },
      orderBy: [{ sortOrder: 'asc' }, { subjectName: 'asc' }],
      select: {
        id: true,
        subjectName: true,
        sortOrder: true,
        boardType: true,
        category: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      subjectName: row.subjectName,
      sortOrder: row.sortOrder,
      boardCode: String(row.boardType ?? boardRaw).toUpperCase(),
      streamCode: String(row.category ?? streamCode).toUpperCase(),
    }));
  }

  private async resolveBoardAliases(
    tenantId: string,
    boardRaw: string,
  ): Promise<string[]> {
    const aliases = new Set<string>([boardRaw, 'GENERAL', 'ALL', 'COMMON']);
    const lookup = await this.prisma.masterLookup.findFirst({
      where: {
        tenantId,
        lookupType: 'BOARD_NAME',
        isActive: true,
        archivedAt: null,
        OR: [
          { label: { equals: boardRaw, mode: 'insensitive' } },
          { code: { equals: boardRaw, mode: 'insensitive' } },
        ],
      },
      select: { label: true, code: true },
    });
    if (lookup?.label) aliases.add(normalizeClass12Board(lookup.label));
    if (lookup?.code) aliases.add(normalizeClass12Board(lookup.code));
    return [...aliases].filter(Boolean);
  }

  /**
   * Validate subject marks against the Class XII Subject Master for board+stream.
   * Requires min 5 named subjects, no duplicates, all names in master.
   */
  async assertSubjectMarksValid(
    tenantId: string,
    board: string | null | undefined,
    stream: string | null | undefined,
    subjects: Array<{ subjectName?: string | null }>,
    options?: { requireMinFive?: boolean },
  ) {
    const requireMinFive = options?.requireMinFive !== false;
    const named = subjects
      .map((s) => String(s.subjectName ?? '').trim())
      .filter(Boolean);

    if (requireMinFive && named.length < 5) {
      throw new BadRequestException(
        'Enter at least 5 Class XII subjects with marks',
      );
    }
    if (!named.length) return;

    const keys = named.map((n) => normalizeClass12SubjectKey(n));
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      if (seen.has(keys[i])) duplicates.push(named[i]);
      seen.add(keys[i]);
    }
    if (duplicates.length) {
      throw new BadRequestException(
        `Duplicate Class XII subject(s): ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    const boardRaw = normalizeClass12Board(board);
    const streamCode = normalizeClass12Stream(stream);
    if (!boardRaw || !streamCode) {
      throw new BadRequestException(
        'Select Board and Stream before saving Class XII subjects',
      );
    }

    const boardAliases = await this.resolveBoardAliases(tenantId, boardRaw);
    const rows = await this.prisma.supportBoardSubject.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        category: { equals: streamCode, mode: 'insensitive' },
        OR: boardAliases.map((alias) => ({
          boardType: { equals: alias, mode: 'insensitive' as const },
        })),
      },
      select: { subjectName: true, subjectCode: true },
    });

    const allowed = new Set(
      rows.flatMap((row) => [
        normalizeClass12SubjectKey(row.subjectName),
        normalizeClass12SubjectKey(row.subjectCode),
      ]),
    );

    const missing = named.filter((_, i) => !allowed.has(keys[i]));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown Class XII subject(s) for ${boardRaw}/${streamCode}: ${missing.join(
          ', ',
        )}. Add them in Support Data → Board Subjects first.`,
      );
    }
  }
}
