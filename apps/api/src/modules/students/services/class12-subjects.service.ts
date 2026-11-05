import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildClass12SubjectCode,
  class12BoardLookupAliases,
  class12StreamLookupAliases,
  normalizeClass12Board,
  normalizeClass12Stream,
  normalizeClass12SubjectKey,
} from '../domain/class12-subjects.util';

const OTHERS_LANGUAGE_SUBJECTS = [
  { subjectName: 'English', sortOrder: 10 },
  { subjectName: 'Hindi', sortOrder: 20 },
] as const;

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
      return [];
    }

    if (this.isOthersBoard(boardRaw)) {
      await this.ensureOthersLanguageSubjects(tenantId, streamCode);
    }

    const boardAliases = await this.resolveBoardAliases(tenantId, boardRaw);
    const streamAliases = class12StreamLookupAliases(streamCode);
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
        OR: streamAliases.map((alias) => ({
          category: { equals: alias, mode: 'insensitive' as const },
        })),
        AND: {
          OR: uniqueAliases.map((alias) => ({
            boardType: { equals: alias, mode: 'insensitive' as const },
          })),
        },
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

  private isOthersBoard(boardRaw: string) {
    return class12BoardLookupAliases(boardRaw).some(
      (alias) => alias === 'OTHERS' || alias === 'OTHER',
    );
  }

  /**
   * Others has the arts/science/commerce papers, but English and Hindi were
   * never stored on that board. Write them into the subject master so the
   * dropdown and the save check use the same rows.
   */
  private async ensureOthersLanguageSubjects(
    tenantId: string,
    streamCode: string,
  ) {
    const stream = class12StreamLookupAliases(streamCode)[0] || streamCode;
    for (const subject of OTHERS_LANGUAGE_SUBJECTS) {
      const existing = await this.prisma.supportBoardSubject.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          boardType: { equals: 'OTHERS', mode: 'insensitive' },
          category: { equals: stream, mode: 'insensitive' },
          subjectName: { equals: subject.subjectName, mode: 'insensitive' },
        },
        select: { id: true, isActive: true },
      });
      if (existing) {
        if (!existing.isActive) {
          await this.prisma.supportBoardSubject.update({
            where: { id: existing.id },
            data: { isActive: true, sortOrder: subject.sortOrder },
          });
        }
        continue;
      }
      const subjectCode = buildClass12SubjectCode(
        'OTHERS',
        stream,
        subject.subjectName,
      );
      await this.prisma.supportBoardSubject.upsert({
        where: { tenantId_subjectCode: { tenantId, subjectCode } },
        create: {
          tenantId,
          subjectCode,
          subjectName: subject.subjectName,
          boardType: 'OTHERS',
          category: stream,
          sortOrder: subject.sortOrder,
          isActive: true,
        },
        update: {
          subjectName: subject.subjectName,
          boardType: 'OTHERS',
          category: stream,
          sortOrder: subject.sortOrder,
          isActive: true,
          deletedAt: null,
        },
      });
    }
  }

  private async resolveBoardAliases(
    tenantId: string,
    boardRaw: string,
  ): Promise<string[]> {
    const aliases = new Set<string>([
      ...class12BoardLookupAliases(boardRaw),
      'GENERAL',
      'ALL',
      'COMMON',
    ]);
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
   * Software admissions require min 5 named subjects, no duplicates, all names in master.
   * Excel-imported students skip the master (marks are not captured in import).
   */
  async assertSubjectMarksValid(
    tenantId: string,
    board: string | null | undefined,
    stream: string | null | undefined,
    subjects: Array<{ subjectName?: string | null }>,
    options?: { requireMinFive?: boolean; strictMaster?: boolean },
  ) {
    const requireMinFive = options?.requireMinFive !== false;
    const strictMaster = options?.strictMaster !== false;
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

    if (!strictMaster) return;

    const boardRaw = normalizeClass12Board(board);
    const streamCode = normalizeClass12Stream(stream);
    if (!boardRaw || !streamCode) {
      throw new BadRequestException(
        'Select Board and Stream before saving Class XII subjects',
      );
    }

    if (this.isOthersBoard(boardRaw)) {
      await this.ensureOthersLanguageSubjects(tenantId, streamCode);
    }

    const boardAliases = await this.resolveBoardAliases(tenantId, boardRaw);
    const streamAliases = class12StreamLookupAliases(streamCode);
    const rows = await this.prisma.supportBoardSubject.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        OR: streamAliases.map((alias) => ({
          category: { equals: alias, mode: 'insensitive' as const },
        })),
        AND: {
          OR: boardAliases.map((alias) => ({
            boardType: { equals: alias, mode: 'insensitive' as const },
          })),
        },
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
