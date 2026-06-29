import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import { CourseImportProcessor } from '../../modules/programs-courses/import/course-import.processor';
import { FeeReceiptPdfProcessor } from '../../modules/fees/processors/fee-receipt-pdf.processor';
import { StaffBulkUpdateProcessor } from '../../modules/staff/bulk-update/staff-bulk-update.processor';
import { StaffAttendanceProcessor } from '../../modules/staff-attendance/staff-attendance.processor';
import { StudentBulkUpdateProcessor } from '../../modules/students/bulk-update/student-bulk-update.processor';
import { StudentImportProcessor } from '../../modules/students/import/student-import.processor';
import { StudentPhotoBulkProcessor } from '../../modules/students/photos/student-photo-bulk.processor';
import { isWorkerOwnedExportJob } from './exports-queue.jobs';

/**
 * The only BullMQ worker for the shared `exports` queue in the API process.
 * Do not add other @Processor('exports') classes — CI enforces this rule.
 */
@Injectable()
@Processor('exports')
export class ExportsQueueProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ExportsQueueProcessor.name);

  constructor(
    private readonly studentImport: StudentImportProcessor,
    private readonly courseImport: CourseImportProcessor,
    private readonly studentBulkUpdate: StudentBulkUpdateProcessor,
    private readonly studentPhotoBulk: StudentPhotoBulkProcessor,
    private readonly staffBulkUpdate: StaffBulkUpdateProcessor,
    private readonly staffAttendance: StaffAttendanceProcessor,
    private readonly feeReceiptPdf: FeeReceiptPdfProcessor,
  ) {
    super();
  }

  onModuleInit() {
    this.logger.log(
      'Registered sole exports queue worker (student import, bulk update, course import, etc.)',
    );
  }

  async process(job: Job): Promise<unknown> {
    if (isWorkerOwnedExportJob(job.name)) {
      if (process.env.FEE_RECEIPT_PDF_ON_WORKER === 'true') {
        await job.moveToWait(job.token);
        throw new DelayedError(
          'fee-receipt-pdf is handled by the worker container',
        );
      }
      return this.feeReceiptPdf.process(job);
    }

    const handlers = [
      this.studentImport,
      this.courseImport,
      this.studentBulkUpdate,
      this.studentPhotoBulk,
      this.staffBulkUpdate,
      this.staffAttendance,
    ];

    for (const handler of handlers) {
      const result = await handler.process(job);
      if (result !== null && result !== undefined) {
        return result;
      }
    }

    this.logger.error(`Unhandled exports job ${job.name} (#${job.id})`);
    throw new Error(`Unhandled exports job: ${job.name}`);
  }
}
