import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FeeReceiptDocumentService } from '../services/fee-receipt-document.service';

@Processor('exports')
@Injectable()
export class FeeReceiptPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(FeeReceiptPdfProcessor.name);

  constructor(private readonly receiptDocs: FeeReceiptDocumentService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return undefined;
    if (job.name !== 'fee-receipt-pdf') return undefined;
    const { tenantId, receiptId } = job.data as {
      tenantId: string;
      receiptId: string;
    };
    this.logger.log(`Generating receipt PDF ${receiptId}`);
    await this.receiptDocs.generatePdf(tenantId, receiptId);
    return { receiptId, ok: true };
  }
}
