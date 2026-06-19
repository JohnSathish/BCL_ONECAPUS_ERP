import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import { PiiEncryptionService } from './pii-encryption.service';

@Global()
@Module({
  providers: [FieldEncryptionService, PiiEncryptionService],
  exports: [FieldEncryptionService, PiiEncryptionService],
})
export class CryptoModule {}
