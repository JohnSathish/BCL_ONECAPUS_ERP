import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, rename, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { resolveTenantUploadRoot } from '../../../common/uploads/upload-paths';
import {
  KOHA_SOURCE,
  VERIFIED_FIELD_MAP,
  classifyCollectionCode,
  type DepartmentOption,
  type Issue,
  type MappingStatus,
} from './koha-catalogue.mapper';
import {
  KohaCatalogueReadError,
  readKohaCatalogueFile,
  type StagedBookDraft,
  type StagedCopyDraft,
} from './koha-catalogue.reader';

const IMPORTABLE = new Set([
  'DRY_RUN',
  'SAMPLE_IMPORTED',
  'IMPORTING',
  'COMPLETED_WITH_ERRORS',
]);
const SAMPLE_SIZE = 100;

type StagedBookRow = {
  id: string;
  sourceBibliographicId: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publicationYear: string | null;
  publicationPlace: string | null;
  edition: string | null;
  series: string | null;
  pages: string | null;
  classificationNumber: string | null;
  itemTypeCode: string | null;
  validationStatus: string;
  issues: Prisma.JsonValue;
  bookId: string | null;
};

type StagedCopyRow = {
  id: string;
  sourceItemId: string;
  sourceBibliographicId: string;
  barcode: string | null;
  accessionNumber: string | null;
  callNumber: string | null;
  collectionCode: string | null;
  homeBranchCode: string | null;
  shelvingLocation: string | null;
  itemTypeCode: string | null;
  acquisitionDate: string | null;
  acquisitionPrice: string | null;
  copyStatus: string | null;
  validationStatus: string;
  issues: Prisma.JsonValue;
  copyId: string | null;
};

@Injectable()
export class KohaImportService {
  private readonly logger = new Logger(KohaImportService.name);
  private readonly running = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async upload(
    tenantId: string,
    actorId: string,
    file: Express.Multer.File,
    importName?: string,
  ) {
    if (!file?.path)
      throw new BadRequestException('Choose a catalogue file to upload.');
    const safeName = sanitizeFileName(
      file.originalname || 'koha-catalogue.xlsx',
    );
    const extension = extname(safeName).toLowerCase();
    if (!['.xlsx', '.csv', '.zip'].includes(extension)) {
      throw new BadRequestException(
        'Upload an .xlsx workbook, a .csv file, or a .zip of those files.',
      );
    }
    const batch = await this.prisma.libraryKohaImportBatch.create({
      data: {
        tenantId,
        importName: (importName || safeName).slice(0, 180),
        sourceSystem: KOHA_SOURCE,
        uploadedFileName: safeName,
        uploadedById: actorId,
        status: 'UPLOADED',
      },
    });
    const directory = join(
      resolveTenantUploadRoot(),
      tenantId,
      'library-koha',
      batch.id,
    );
    await mkdir(directory, { recursive: true });
    const stored = join(directory, `source${extension}`);
    await rename(file.path, stored);
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batch.id },
      data: { storedFilePath: stored },
    });
    await this.audit(tenantId, actorId, 'UPLOAD', batch.id, {
      fileName: safeName,
    });
    try {
      await this.stage(tenantId, batch.id);
    } catch (error) {
      const message =
        error instanceof KohaCatalogueReadError
          ? error.message
          : 'The catalogue file could not be read.';
      await this.prisma.libraryKohaImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          summary: { error: message },
        },
      });
      throw new BadRequestException(message);
    }
    return this.getBatch(tenantId, batch.id);
  }

  async listBatches(tenantId: string) {
    const rows = await this.prisma.libraryKohaImportBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        importName: true,
        sourceSystem: true,
        uploadedFileName: true,
        status: true,
        totalSourceRecords: true,
        totalCopies: true,
        validRecords: true,
        importedBooks: true,
        importedCopies: true,
        skippedRecords: true,
        duplicateRecords: true,
        failedRecords: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });
    return {
      items: rows.map((row) => ({
        ...row,
        totalBibliographicRecords: row.totalSourceRecords,
        totalPhysicalCopies: row.totalCopies,
      })),
    };
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.requireBatch(tenantId, batchId);
    const [bookGroups, copyGroups, missingBarcodes, collections] =
      await Promise.all([
        this.prisma.libraryKohaStagedBook.groupBy({
          by: ['validationStatus'],
          where: { batchId },
          _count: { _all: true },
        }),
        this.prisma.libraryKohaStagedCopy.groupBy({
          by: ['validationStatus'],
          where: { batchId },
          _count: { _all: true },
        }),
        this.prisma.libraryKohaStagedCopy.count({
          where: { batchId, OR: [{ barcode: null }, { barcode: '' }] },
        }),
        this.prisma.libraryKohaStagedCopy.groupBy({
          by: ['collectionCode'],
          where: { batchId },
          _count: { _all: true },
        }),
      ]);
    const codes = collections.map((row) => row.collectionCode ?? '');
    const mappings = codes.length
      ? await this.prisma.libraryCollectionDepartmentMapping.findMany({
          where: { tenantId, sourceCollectionCode: { in: codes } },
        })
      : [];
    const summary = asRecord(batch.summary);
    return {
      id: batch.id,
      importName: batch.importName,
      sourceSystem: batch.sourceSystem,
      uploadedFileName: batch.uploadedFileName,
      status: batch.status,
      totalBibliographicRecords: batch.totalSourceRecords,
      totalPhysicalCopies: batch.totalCopies,
      validRecords: countStatus(bookGroups, 'VALID'),
      invalidRecords:
        countStatus(bookGroups, 'INVALID') + countStatus(copyGroups, 'INVALID'),
      duplicateCandidates:
        countStatus(bookGroups, 'DUPLICATE') +
        countStatus(copyGroups, 'DUPLICATE'),
      missingAccessionNumbers: missingBarcodes,
      missingBarcodes,
      mappedDepartments: mappings.filter(
        (row) => row.mappingStatus === 'MAPPED',
      ).length,
      unmappedCollectionCodes: mappings.filter(
        (row) => row.mappingStatus === 'UNMAPPED',
      ).length,
      needsReview: mappings.filter(
        (row) => row.mappingStatus === 'NEEDS_REVIEW',
      ).length,
      notApplicable: mappings.filter(
        (row) => row.mappingStatus === 'NOT_APPLICABLE',
      ).length,
      importedBooks: batch.importedBooks,
      importedCopies: batch.importedCopies,
      skippedRecords: batch.skippedRecords,
      failedRecords: batch.failedRecords,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      progress: typeof summary.progress === 'number' ? summary.progress : null,
      notes: Array.isArray(summary.notes) ? summary.notes : [],
      fieldMap: VERIFIED_FIELD_MAP,
      detectedBookHeaders: summary.bookHeaders ?? [],
      detectedCopyHeaders: summary.copyHeaders ?? [],
      branches: summary.branches ?? [],
      itemTypes: summary.itemTypes ?? [],
    };
  }

  async listMappings(tenantId: string, batchId: string) {
    await this.requireBatch(tenantId, batchId);
    const counts = await this.prisma.libraryKohaStagedCopy.groupBy({
      by: ['collectionCode'],
      where: { batchId },
      _count: { _all: true },
    });
    const codes = counts.map((row) => row.collectionCode ?? '');
    const mappings =
      await this.prisma.libraryCollectionDepartmentMapping.findMany({
        where: { tenantId, sourceCollectionCode: { in: codes } },
        orderBy: { sourceCollectionCode: 'asc' },
      });
    const departments = await this.departments(tenantId);
    const byCode = new Map(
      mappings.map((row) => [row.sourceCollectionCode, row]),
    );
    return {
      departments,
      items: counts
        .map((row) => {
          const code = row.collectionCode ?? '';
          const mapping = byCode.get(code);
          return {
            id: mapping?.id ?? null,
            sourceCollectionCode: code,
            sourceCollectionDescription:
              mapping?.sourceCollectionDescription ?? '',
            copyCount: row._count._all,
            departmentId: mapping?.departmentId ?? null,
            mappingStatus: mapping?.mappingStatus ?? 'UNMAPPED',
            mappingMethod: mapping?.mappingMethod ?? 'NONE',
            verifiedAt: mapping?.verifiedAt ?? null,
          };
        })
        .sort((a, b) => b.copyCount - a.copyCount),
    };
  }

  async updateMapping(
    tenantId: string,
    actorId: string,
    mappingId: string,
    input: { mappingStatus: MappingStatus; departmentId?: string | null },
  ) {
    const mapping =
      await this.prisma.libraryCollectionDepartmentMapping.findFirst({
        where: { id: mappingId, tenantId },
      });
    if (!mapping)
      throw new NotFoundException('Collection mapping was not found.');
    const status = input.mappingStatus;
    if (
      !['MAPPED', 'NEEDS_REVIEW', 'UNMAPPED', 'NOT_APPLICABLE'].includes(status)
    ) {
      throw new BadRequestException('Choose a mapping status.');
    }
    let departmentId = input.departmentId?.trim() || null;
    if (status === 'MAPPED') {
      if (!departmentId)
        throw new BadRequestException(
          'A mapped collection needs an academic department.',
        );
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!department)
        throw new BadRequestException(
          'That department is not in this college.',
        );
    } else if (status === 'UNMAPPED' || status === 'NOT_APPLICABLE') {
      departmentId = null;
    } else if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!department)
        throw new BadRequestException(
          'That department is not in this college.',
        );
    }
    const verified = status === 'MAPPED' || status === 'NOT_APPLICABLE';
    const updated = await this.prisma.libraryCollectionDepartmentMapping.update(
      {
        where: { id: mapping.id },
        data: {
          mappingStatus: status,
          departmentId,
          mappingMethod: 'MANUAL',
          verifiedById: verified ? actorId : null,
          verifiedAt: verified ? new Date() : null,
        },
      },
    );
    await this.audit(tenantId, actorId, 'MAP', mapping.id, {
      code: mapping.sourceCollectionCode,
      status,
      departmentId,
    });
    return updated;
  }

  async dryRun(tenantId: string, actorId: string, batchId: string) {
    const batch = await this.requireBatch(tenantId, batchId);
    if (
      ![
        'STAGED',
        'DRY_RUN',
        'SAMPLE_IMPORTED',
        'COMPLETED_WITH_ERRORS',
      ].includes(batch.status)
    ) {
      throw new BadRequestException(
        'Stage the catalogue before running a test.',
      );
    }
    const beforeBooks = await this.prisma.libraryBook.count({
      where: { tenantId, deletedAt: null },
    });
    await this.refreshCounters(batchId);
    const afterBooks = await this.prisma.libraryBook.count({
      where: { tenantId, deletedAt: null },
    });
    if (afterBooks !== beforeBooks) {
      this.logger.error(
        `Dry run changed library book count for tenant ${tenantId}`,
      );
    }
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: { status: 'DRY_RUN' },
    });
    await this.audit(tenantId, actorId, 'DRY_RUN', batchId, {
      libraryBooksUnchanged: afterBooks === beforeBooks,
    });
    return this.getBatch(tenantId, batchId);
  }

  async importSample(tenantId: string, actorId: string, batchId: string) {
    const batch = await this.requireBatch(tenantId, batchId);
    if (
      !['DRY_RUN', 'SAMPLE_IMPORTED', 'COMPLETED_WITH_ERRORS'].includes(
        batch.status,
      )
    ) {
      throw new BadRequestException(
        'Run the test import before importing a sample.',
      );
    }
    const ids = await this.sampleBookIds(batchId);
    if (!ids.length)
      throw new BadRequestException(
        'No valid bibliographic records are waiting to import.',
      );
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: { status: 'IMPORTING', startedAt: batch.startedAt ?? new Date() },
    });
    await this.commitBooks(tenantId, actorId, batchId, ids);
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: { status: 'SAMPLE_IMPORTED' },
    });
    await this.audit(tenantId, actorId, 'SAMPLE', batchId, {
      requested: ids.length,
    });
    return this.getBatch(tenantId, batchId);
  }

  async startImport(
    tenantId: string,
    actorId: string,
    batchId: string,
    approved: boolean,
  ) {
    if (!approved) {
      throw new BadRequestException(
        'Confirm that the validation and department mappings were reviewed.',
      );
    }
    const batch = await this.requireBatch(tenantId, batchId);
    if (!IMPORTABLE.has(batch.status) && batch.status !== 'STAGED') {
      throw new BadRequestException(
        'Run a test import and review the report before the full import.',
      );
    }
    if (batch.status === 'STAGED') {
      throw new BadRequestException(
        'Run a test import before the full import.',
      );
    }
    if (this.running.has(batchId)) return this.getBatch(tenantId, batchId);
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'IMPORTING',
        startedAt: batch.startedAt ?? new Date(),
        completedAt: null,
      },
    });
    this.running.add(batchId);
    void this.commitBooks(tenantId, actorId, batchId)
      .then(async () => {
        const remaining = await this.prisma.libraryKohaStagedBook.count({
          where: { batchId, bookId: null, validationStatus: 'VALID' },
        });
        const current = await this.prisma.libraryKohaImportBatch.findUnique({
          where: { id: batchId },
          select: { failedRecords: true },
        });
        const status =
          remaining > 0 || (current?.failedRecords ?? 0) > 0
            ? 'COMPLETED_WITH_ERRORS'
            : 'COMPLETED';
        await this.refreshCounters(batchId);
        await this.prisma.libraryKohaImportBatch.update({
          where: { id: batchId },
          data: { status, completedAt: new Date() },
        });
        await this.audit(tenantId, actorId, 'IMPORT', batchId, { status });
      })
      .catch(async (error: unknown) => {
        this.logger.error(
          `Koha import ${batchId} failed`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.prisma.libraryKohaImportBatch.update({
          where: { id: batchId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            summary: {
              ...asRecord(batch.summary),
              error: 'The import stopped. Imported records were kept.',
            },
          },
        });
      })
      .finally(() => this.running.delete(batchId));
    return this.getBatch(tenantId, batchId);
  }

  async retry(tenantId: string, actorId: string, batchId: string) {
    const batch = await this.requireBatch(tenantId, batchId);
    if (
      !['FAILED', 'COMPLETED_WITH_ERRORS', 'IMPORTING'].includes(batch.status)
    ) {
      throw new BadRequestException('There is no failed import to resume.');
    }
    return this.startImport(tenantId, actorId, batchId, true);
  }

  async reportCsv(
    tenantId: string,
    batchId: string,
    kind: 'validation' | 'errors',
  ) {
    await this.requireBatch(tenantId, batchId);
    const books = await this.prisma.libraryKohaStagedBook.findMany({
      where: { batchId },
      select: {
        sourceBibliographicId: true,
        title: true,
        validationStatus: true,
        issues: true,
      },
    });
    const copies = await this.prisma.libraryKohaStagedCopy.findMany({
      where: { batchId },
      select: {
        sourceItemId: true,
        barcode: true,
        validationStatus: true,
        issues: true,
      },
    });
    const lines = ['level,sourceId,label,status,issues'];
    for (const book of books) {
      const issues = readIssues(book.issues);
      if (!shouldReport(book.validationStatus, issues, kind)) continue;
      lines.push(
        csvLine([
          'book',
          book.sourceBibliographicId,
          book.title,
          book.validationStatus,
          issues.map((issue) => issue.message).join(' | '),
        ]),
      );
    }
    for (const copy of copies) {
      const issues = readIssues(copy.issues);
      if (!shouldReport(copy.validationStatus, issues, kind)) continue;
      lines.push(
        csvLine([
          'copy',
          copy.sourceItemId,
          copy.barcode || '',
          copy.validationStatus,
          issues.map((issue) => issue.message).join(' | '),
        ]),
      );
    }
    const directory = join(
      resolveTenantUploadRoot(),
      tenantId,
      'library-koha',
      batchId,
    );
    await mkdir(directory, { recursive: true });
    const fileName =
      kind === 'errors' ? 'error-report.csv' : 'validation-report.csv';
    await writeFile(join(directory, fileName), lines.join('\n'), 'utf8');
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: { errorReportPath: fileName },
    });
    return lines.join('\n');
  }

  private async stage(tenantId: string, batchId: string) {
    const batch = await this.requireBatch(tenantId, batchId);
    if (!batch.storedFilePath)
      throw new KohaCatalogueReadError('The uploaded file is missing.');
    const catalogue = await readKohaCatalogueFile(
      batch.storedFilePath,
      batch.uploadedFileName,
    );
    await this.prisma.libraryKohaStagedCopy.deleteMany({ where: { batchId } });
    await this.prisma.libraryKohaStagedBook.deleteMany({ where: { batchId } });
    for (const chunk of chunks(catalogue.books, 400)) {
      await this.prisma.libraryKohaStagedBook.createMany({
        data: chunk.map((book) => this.bookDraft(tenantId, batchId, book)),
      });
    }
    for (const chunk of chunks(catalogue.copies, 400)) {
      await this.prisma.libraryKohaStagedCopy.createMany({
        data: chunk.map((copy) => this.copyDraft(tenantId, batchId, copy)),
      });
    }
    await this.flagExistingConflicts(tenantId, batchId);
    await this.syncMappings(tenantId, catalogue.copies);
    const [bookGroups, copyGroups] = await Promise.all([
      this.prisma.libraryKohaStagedBook.groupBy({
        by: ['validationStatus'],
        where: { batchId },
        _count: { _all: true },
      }),
      this.prisma.libraryKohaStagedCopy.groupBy({
        by: ['validationStatus'],
        where: { batchId },
        _count: { _all: true },
      }),
    ]);
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'STAGED',
        totalSourceRecords: catalogue.books.length,
        totalCopies: catalogue.copies.length,
        validRecords: countStatus(bookGroups, 'VALID'),
        skippedRecords:
          countStatus(bookGroups, 'INVALID') +
          countStatus(bookGroups, 'DUPLICATE') +
          countStatus(copyGroups, 'INVALID') +
          countStatus(copyGroups, 'DUPLICATE'),
        duplicateRecords:
          countStatus(bookGroups, 'DUPLICATE') +
          countStatus(copyGroups, 'DUPLICATE'),
        summary: {
          notes: catalogue.notes,
          bookHeaders: catalogue.bookHeaders,
          copyHeaders: catalogue.copyHeaders,
          branches: catalogue.branches,
          itemTypes: catalogue.itemTypes,
          progress: 0,
        },
      },
    });
  }

  private bookDraft(tenantId: string, batchId: string, book: StagedBookDraft) {
    return {
      tenantId,
      batchId,
      sourceBibliographicId: book.sourceBibliographicId,
      title: book.title.slice(0, 1000),
      subtitle: emptyToNull(book.subtitle),
      author: emptyToNull(book.author),
      isbnRaw: emptyToNull(book.isbnRaw),
      isbn10: emptyToNull(book.isbn10),
      isbn13: emptyToNull(book.isbn13),
      publisher: emptyToNull(book.publisher),
      publicationYear: emptyToNull(book.publicationYear),
      publicationPlace: emptyToNull(book.publicationPlace),
      edition: emptyToNull(book.edition),
      series: emptyToNull(book.series),
      pages: emptyToNull(book.pages),
      classificationNumber: emptyToNull(book.classificationNumber),
      itemTypeCode: emptyToNull(book.itemTypeCode),
      sourceUrl: emptyToNull(book.sourceUrl),
      validationStatus: book.validationStatus,
      issues: book.issues as unknown as Prisma.InputJsonValue,
    };
  }

  private copyDraft(tenantId: string, batchId: string, copy: StagedCopyDraft) {
    return {
      tenantId,
      batchId,
      sourceItemId: copy.sourceItemId,
      sourceBibliographicId: copy.sourceBibliographicId,
      barcode: emptyToNull(copy.barcode),
      accessionNumber: emptyToNull(copy.accessionNumber),
      callNumber: emptyToNull(copy.callNumber),
      collectionCode: emptyToNull(copy.collectionCode),
      homeBranchCode: emptyToNull(copy.homeBranchCode),
      shelvingLocation: emptyToNull(copy.shelvingLocation),
      itemTypeCode: emptyToNull(copy.itemTypeCode),
      acquisitionDate: emptyToNull(copy.acquisitionDate),
      acquisitionPrice: emptyToNull(copy.acquisitionPrice),
      withdrawn: emptyToNull(copy.withdrawn),
      itemLost: emptyToNull(copy.itemLost),
      damaged: emptyToNull(copy.damaged),
      notForLoan: emptyToNull(copy.notForLoan),
      copyStatus: emptyToNull(copy.copyStatus),
      validationStatus: copy.validationStatus,
      issues: copy.issues as unknown as Prisma.InputJsonValue,
    };
  }

  private async flagExistingConflicts(tenantId: string, batchId: string) {
    const staged = await this.prisma.libraryKohaStagedCopy.findMany({
      where: { batchId, barcode: { not: null } },
      select: {
        id: true,
        barcode: true,
        accessionNumber: true,
        sourceItemId: true,
        issues: true,
        validationStatus: true,
      },
    });
    for (const chunk of chunks(staged, 500)) {
      const barcodes = chunk
        .map((row) => row.barcode)
        .filter((value): value is string => Boolean(value));
      if (!barcodes.length) continue;
      const existing = await this.prisma.libraryBookCopy.findMany({
        where: { tenantId, barcode: { in: barcodes } },
        select: { barcode: true, sourceSystem: true, sourceItemId: true },
      });
      const byBarcode = new Map(existing.map((row) => [row.barcode, row]));
      for (const row of chunk) {
        const match = row.barcode ? byBarcode.get(row.barcode) : undefined;
        if (!match) continue;
        const sameItem =
          match.sourceSystem === KOHA_SOURCE &&
          match.sourceItemId === row.sourceItemId;
        const issues = readIssues(row.issues);
        if (sameItem) {
          issues.push({
            code: 'ALREADY_IMPORTED',
            severity: 'warning',
            message:
              'This Koha item was imported before. Running the import again updates it.',
          });
          await this.prisma.libraryKohaStagedCopy.update({
            where: { id: row.id },
            data: { issues: issues as unknown as Prisma.InputJsonValue },
          });
          continue;
        }
        issues.push({
          code: 'DUPLICATE_BARCODE',
          severity: 'error',
          message: `Barcode ${row.barcode} is already used by another library copy.`,
        });
        await this.prisma.libraryKohaStagedCopy.update({
          where: { id: row.id },
          data: {
            validationStatus: 'DUPLICATE',
            issues: issues as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  private async syncMappings(tenantId: string, copies: StagedCopyDraft[]) {
    const departments = await this.departments(tenantId);
    const codes = new Set<string>();
    for (const copy of copies) codes.add(copy.collectionCode.trim());
    for (const code of codes) {
      const suggestion = classifyCollectionCode(code, departments);
      const existing =
        await this.prisma.libraryCollectionDepartmentMapping.findUnique({
          where: {
            tenantId_sourceCollectionCode: {
              tenantId,
              sourceCollectionCode: code,
            },
          },
        });
      if (!existing) {
        await this.prisma.libraryCollectionDepartmentMapping.create({
          data: {
            tenantId,
            sourceCollectionCode: code,
            sourceCollectionDescription: suggestion.description,
            departmentId: suggestion.departmentId,
            mappingStatus: suggestion.status,
            mappingMethod: suggestion.method,
          },
        });
        continue;
      }
      if (
        existing.mappingMethod === 'MANUAL' ||
        existing.mappingStatus === 'MAPPED'
      )
        continue;
      await this.prisma.libraryCollectionDepartmentMapping.update({
        where: { id: existing.id },
        data: {
          sourceCollectionDescription: suggestion.description,
          departmentId: suggestion.departmentId,
          mappingStatus: suggestion.status,
          mappingMethod: suggestion.method,
        },
      });
    }
  }

  private async sampleBookIds(batchId: string) {
    const books = await this.prisma.libraryKohaStagedBook.findMany({
      where: { batchId, validationStatus: 'VALID', bookId: null },
      select: {
        id: true,
        sourceBibliographicId: true,
        isbn13: true,
        isbn10: true,
      },
    });
    const copies = await this.prisma.libraryKohaStagedCopy.findMany({
      where: { batchId, validationStatus: 'VALID' },
      select: { sourceBibliographicId: true, collectionCode: true },
    });
    const byBook = new Map<string, { count: number; codes: Set<string> }>();
    for (const copy of copies) {
      const bucket = byBook.get(copy.sourceBibliographicId) ?? {
        count: 0,
        codes: new Set<string>(),
      };
      bucket.count += 1;
      if (copy.collectionCode) bucket.codes.add(copy.collectionCode);
      byBook.set(copy.sourceBibliographicId, bucket);
    }
    const ranked = books
      .map((book) => {
        const stats = byBook.get(book.sourceBibliographicId);
        return {
          id: book.id,
          multi: (stats?.count ?? 0) > 1,
          missingIsbn: !book.isbn13 && !book.isbn10,
          codes: [...(stats?.codes ?? [])],
        };
      })
      .sort(
        (a, b) =>
          Number(b.multi) - Number(a.multi) ||
          Number(b.missingIsbn) - Number(a.missingIsbn),
      );
    const chosen: typeof ranked = [];
    const seenCodes = new Set<string>();
    for (const book of ranked) {
      if (chosen.length >= SAMPLE_SIZE) break;
      const fresh = book.codes.some((code) => !seenCodes.has(code));
      if (book.multi || book.missingIsbn || fresh || chosen.length < 20) {
        chosen.push(book);
        book.codes.forEach((code) => seenCodes.add(code));
      }
    }
    for (const book of ranked) {
      if (chosen.length >= SAMPLE_SIZE) break;
      if (!chosen.includes(book)) chosen.push(book);
    }
    return chosen.slice(0, SAMPLE_SIZE).map((book) => book.id);
  }

  private async commitBooks(
    tenantId: string,
    actorId: string,
    batchId: string,
    onlyIds?: string[],
  ) {
    const mappings =
      await this.prisma.libraryCollectionDepartmentMapping.findMany({
        where: { tenantId },
      });
    const mapped = new Map(
      mappings
        .filter((row) => row.mappingStatus === 'MAPPED' && row.departmentId)
        .map((row) => [row.sourceCollectionCode, row.departmentId as string]),
    );
    const categories = await this.prisma.libraryCategory.findMany({
      where: { tenantId },
      select: { id: true, code: true },
    });
    const categoryByCode = new Map(
      categories.map((row) => [row.code.toUpperCase(), row.id]),
    );
    const books = await this.prisma.libraryKohaStagedBook.findMany({
      where: {
        batchId,
        validationStatus: 'VALID',
        bookId: null,
        ...(onlyIds ? { id: { in: onlyIds } } : {}),
      },
      orderBy: { sourceBibliographicId: 'asc' },
    });
    if (!onlyIds) await this.applyMappedDepartments(tenantId, batchId, mapped);
    const copies = await this.prisma.libraryKohaStagedCopy.findMany({
      where: { batchId, validationStatus: 'VALID', copyId: null },
    });
    const copiesByBook = new Map<string, StagedCopyRow[]>();
    for (const copy of copies) {
      const list = copiesByBook.get(copy.sourceBibliographicId) ?? [];
      list.push(copy);
      copiesByBook.set(copy.sourceBibliographicId, list);
    }
    let done = 0;
    let failed = 0;
    for (const book of books) {
      try {
        await this.commitOne(
          tenantId,
          book,
          copiesByBook.get(book.sourceBibliographicId) ?? [],
          mapped,
          categoryByCode,
        );
      } catch (error) {
        failed += 1;
        const issues = readIssues(book.issues);
        issues.push({
          code: 'IMPORT_FAILED',
          severity: 'error',
          message:
            'This record could not be saved. It was left unchanged so the import can be resumed.',
        });
        await this.prisma.libraryKohaStagedBook.update({
          where: { id: book.id },
          data: { issues: issues as unknown as Prisma.InputJsonValue },
        });
        this.logger.warn(
          `Koha book ${book.sourceBibliographicId} was not saved: ${error instanceof Error ? error.message : 'error'}`,
        );
      }
      done += 1;
      if (done % 25 === 0) {
        const current = await this.prisma.libraryKohaImportBatch.findUnique({
          where: { id: batchId },
          select: { summary: true },
        });
        await this.prisma.libraryKohaImportBatch.update({
          where: { id: batchId },
          data: {
            summary: {
              ...asRecord(current?.summary ?? {}),
              progress: done,
              total: books.length,
              failed,
            },
          },
        });
      }
    }
    await this.refreshCounters(batchId);
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: { failedRecords: failed },
    });
    await this.audit(
      tenantId,
      actorId,
      onlyIds ? 'SAMPLE_COMMIT' : 'COMMIT',
      batchId,
      {
        attempted: books.length,
        failed,
      },
    );
  }

  private async applyMappedDepartments(
    tenantId: string,
    batchId: string,
    mapped: Map<string, string>,
  ) {
    const books = await this.prisma.libraryKohaStagedBook.findMany({
      where: { batchId, validationStatus: 'VALID', bookId: { not: null } },
      select: { bookId: true, sourceBibliographicId: true },
    });
    if (!books.length) return;
    const copies = await this.prisma.libraryKohaStagedCopy.findMany({
      where: { batchId, validationStatus: 'VALID' },
      select: { sourceBibliographicId: true, collectionCode: true },
    });
    const codesByBook = new Map<string, string[]>();
    for (const copy of copies) {
      const list = codesByBook.get(copy.sourceBibliographicId) ?? [];
      if (copy.collectionCode) list.push(copy.collectionCode);
      codesByBook.set(copy.sourceBibliographicId, list);
    }
    for (const book of books) {
      if (!book.bookId) continue;
      const departmentIds = [
        ...new Set(
          (codesByBook.get(book.sourceBibliographicId) ?? [])
            .map((code) => mapped.get(code.trim()))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      await this.prisma.$transaction([
        this.prisma.libraryBook.update({
          where: { id: book.bookId },
          data: {
            departmentId: departmentIds.length === 1 ? departmentIds[0] : null,
          },
        }),
        this.prisma.libraryBookDepartment.deleteMany({
          where: { bookId: book.bookId },
        }),
        ...(departmentIds.length
          ? [
              this.prisma.libraryBookDepartment.createMany({
                data: departmentIds.map((departmentId) => ({
                  tenantId,
                  bookId: book.bookId as string,
                  departmentId,
                })),
              }),
            ]
          : []),
      ]);
    }
  }

  private async commitOne(
    tenantId: string,
    book: StagedBookRow,
    copies: StagedCopyRow[],
    mapped: Map<string, string>,
    categoryByCode: Map<string, string>,
  ) {
    const departmentIds = [
      ...new Set(
        copies
          .map((copy) => mapped.get((copy.collectionCode ?? '').trim()))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const departmentId = departmentIds.length === 1 ? departmentIds[0] : null;
    const itemType = (
      book.itemTypeCode ||
      copies.find((copy) => copy.itemTypeCode)?.itemTypeCode ||
      ''
    ).toUpperCase();
    const categoryId = itemType ? (categoryByCode.get(itemType) ?? null) : null;
    const primaryBarcode = copies.find((copy) => copy.barcode)?.barcode ?? null;
    const price =
      copies.find((copy) => copy.acquisitionPrice)?.acquisitionPrice ?? null;

    await this.prisma.$transaction(async (tx) => {
      let saved = await tx.libraryBook.findFirst({
        where: {
          tenantId,
          sourceSystem: KOHA_SOURCE,
          sourceBibliographicId: book.sourceBibliographicId,
          deletedAt: null,
        },
      });
      const bibliographic = {
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        isbn: book.isbn13 || book.isbn10,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        publicationPlace: book.publicationPlace,
        edition: book.edition,
        series: book.series,
        description: book.pages ? `${book.pages} pages` : null,
        classificationNumber: book.classificationNumber,
        departmentId,
        categoryId,
        price: price ? new Prisma.Decimal(price) : null,
        totalCopies: copies.length,
        sourceSystem: KOHA_SOURCE,
        sourceBibliographicId: book.sourceBibliographicId,
      };
      if (!saved) {
        const accessionNo = await this.freeAccession(
          tx,
          tenantId,
          primaryBarcode,
          book.sourceBibliographicId,
        );
        saved = await tx.libraryBook.create({
          data: {
            tenantId,
            accessionNo,
            bookNumber: primaryBarcode,
            ...bibliographic,
          },
        });
      } else {
        saved = await tx.libraryBook.update({
          where: { id: saved.id },
          data: bibliographic,
        });
      }

      const existingCopies = await tx.libraryBookCopy.findMany({
        where: { bookId: saved.id },
        select: { id: true, copyNumber: true, sourceItemId: true },
      });
      let nextNumber =
        existingCopies.reduce(
          (max, copy) => Math.max(max, copy.copyNumber),
          0,
        ) + 1;
      const bySource = new Map(
        existingCopies
          .filter((copy) => copy.sourceItemId)
          .map((copy) => [copy.sourceItemId as string, copy]),
      );
      for (const copy of copies) {
        const current = bySource.get(copy.sourceItemId);
        const data = {
          accessionNumber: copy.accessionNumber,
          status: copy.copyStatus || 'AVAILABLE',
          sourceSystem: KOHA_SOURCE,
          sourceItemId: copy.sourceItemId,
          collectionCode: copy.collectionCode,
          shelvingLocation: copy.shelvingLocation,
          callNumber: copy.callNumber,
          acquisitionDate: copy.acquisitionDate
            ? new Date(`${copy.acquisitionDate}T00:00:00.000Z`)
            : null,
          acquisitionPrice: copy.acquisitionPrice
            ? new Prisma.Decimal(copy.acquisitionPrice)
            : null,
          homeBranchCode: copy.homeBranchCode,
          itemTypeCode: copy.itemTypeCode,
        };
        if (!copy.barcode) continue;
        const savedCopy = current
          ? await tx.libraryBookCopy.update({
              where: { id: current.id },
              data: { ...data, barcode: copy.barcode },
            })
          : await tx.libraryBookCopy.create({
              data: {
                tenantId,
                bookId: saved.id,
                copyNumber: nextNumber,
                ...data,
                barcode: copy.barcode,
              },
            });
        if (!current) nextNumber += 1;
        await tx.libraryKohaStagedCopy.update({
          where: { id: copy.id },
          data: { copyId: savedCopy.id },
        });
      }

      await tx.libraryBookDepartment.deleteMany({
        where: { bookId: saved.id },
      });
      if (departmentIds.length) {
        await tx.libraryBookDepartment.createMany({
          data: departmentIds.map((id) => ({
            tenantId,
            bookId: saved.id,
            departmentId: id,
          })),
        });
      }
      await tx.libraryKohaStagedBook.update({
        where: { id: book.id },
        data: { bookId: saved.id },
      });
    });
  }

  private async freeAccession(
    tx: Prisma.TransactionClient,
    tenantId: string,
    barcode: string | null,
    sourceBibliographicId: string,
  ) {
    const candidates = [
      barcode,
      `${KOHA_SOURCE}-${sourceBibliographicId}`,
      `${KOHA_SOURCE}-${sourceBibliographicId}-${randomUUID().slice(0, 8)}`,
    ].filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      const taken = await tx.libraryBook.findFirst({
        where: { tenantId, accessionNo: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${KOHA_SOURCE}-${sourceBibliographicId}-${randomUUID()}`;
  }

  private async refreshCounters(batchId: string) {
    const [
      importedBooks,
      importedCopies,
      skipped,
      duplicates,
      duplicateCopies,
    ] = await Promise.all([
      this.prisma.libraryKohaStagedBook.count({
        where: { batchId, bookId: { not: null } },
      }),
      this.prisma.libraryKohaStagedCopy.count({
        where: { batchId, copyId: { not: null } },
      }),
      this.prisma.libraryKohaStagedBook.count({
        where: { batchId, validationStatus: 'INVALID' },
      }),
      this.prisma.libraryKohaStagedBook.count({
        where: { batchId, validationStatus: 'DUPLICATE' },
      }),
      this.prisma.libraryKohaStagedCopy.count({
        where: { batchId, validationStatus: 'DUPLICATE' },
      }),
    ]);
    const invalidCopies = await this.prisma.libraryKohaStagedCopy.count({
      where: { batchId, validationStatus: 'INVALID' },
    });
    await this.prisma.libraryKohaImportBatch.update({
      where: { id: batchId },
      data: {
        importedBooks,
        importedCopies,
        skippedRecords: skipped + invalidCopies,
        duplicateRecords: duplicates + duplicateCopies,
      },
    });
  }

  private async departments(tenantId: string): Promise<DepartmentOption[]> {
    return this.prisma.department.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });
  }

  private async requireBatch(tenantId: string, batchId: string) {
    const batch = await this.prisma.libraryKohaImportBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException('Import batch was not found.');
    return batch;
  }

  private async audit(
    tenantId: string,
    actorId: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.prisma.libraryAuditLog.create({
      data: {
        tenantId,
        actorId,
        action: 'KOHA_IMPORT',
        entityType: action,
        entityId,
        metadata,
      },
    });
  }
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size));
  return out;
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function readIssues(value: Prisma.JsonValue): Issue[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Issue => {
    if (!item || typeof item !== 'object') return false;
    const record = item as {
      code?: unknown;
      severity?: unknown;
      message?: unknown;
    };
    return (
      typeof record.code === 'string' && typeof record.message === 'string'
    );
  });
}

function countStatus(
  groups: { validationStatus: string; _count: { _all: number } }[],
  status: string,
) {
  return (
    groups.find((group) => group.validationStatus === status)?._count._all ?? 0
  );
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function shouldReport(
  status: string,
  issues: Issue[],
  kind: 'validation' | 'errors',
) {
  if (kind === 'errors')
    return (
      issues.some((issue) => issue.severity === 'error') ||
      status === 'INVALID' ||
      status === 'DUPLICATE'
    );
  return status !== 'VALID' || issues.length > 0;
}

function csvLine(cells: string[]) {
  return cells
    .map((cell) =>
      /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
    )
    .join(',');
}

function sanitizeFileName(name: string) {
  const base = basename(name)
    .replace(/[^\w.\- ()]+/g, '_')
    .slice(0, 180);
  return base || 'koha-catalogue.xlsx';
}
