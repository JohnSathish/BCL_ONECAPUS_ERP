import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ImportBatchRepository } from './import-batch.repository';
import { ImportEngine } from './import-engine';

@Module({
  imports: [PrismaModule],
  providers: [ImportBatchRepository, ImportEngine],
  exports: [ImportBatchRepository, ImportEngine],
})
export class ImportModule {}
