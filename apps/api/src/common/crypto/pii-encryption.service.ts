import { Injectable } from '@nestjs/common';
import { FieldEncryptionService } from '../crypto/field-encryption.service';

/** Application-level encryption for sensitive PII fields at rest. */
@Injectable()
export class PiiEncryptionService {
  constructor(private readonly crypto: FieldEncryptionService) {}

  encryptAadhaar(value: string | null | undefined) {
    return this.crypto.encrypt(value ?? null);
  }

  decryptAadhaar(value: string | null | undefined) {
    return this.crypto.decrypt(value ?? null);
  }

  encryptBankAccount(value: string | null | undefined) {
    return this.crypto.encrypt(value ?? null);
  }

  decryptBankAccount(value: string | null | undefined) {
    return this.crypto.decrypt(value ?? null);
  }
}
