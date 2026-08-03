import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';

export type StoredGoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
};

@Injectable()
export class PrincipalCommsTokenVault {
  constructor(
    private readonly fieldCrypto: FieldEncryptionService,
    private readonly config: ConfigService,
  ) {}

  private dedicatedKey(): Buffer | null {
    const raw =
      this.config.get<string>('PRINCIPAL_COMMS_TOKEN_KEY') ||
      this.config.get<string>('ENCRYPTION_KEY');
    return raw ? createHash('sha256').update(raw).digest() : null;
  }

  encryptTokens(tokens: StoredGoogleTokens): string {
    const payload = JSON.stringify(tokens);
    // Prefer FieldEncryptionService (ENCRYPTION_KEY); still works if unset (stores plaintext for local only).
    const encrypted = this.fieldCrypto.encrypt(payload);
    return encrypted ?? payload;
  }

  decryptTokens(cipher: string): StoredGoogleTokens {
    const plain = this.fieldCrypto.decrypt(cipher) ?? cipher;
    return JSON.parse(plain) as StoredGoogleTokens;
  }

  isCryptoEnabled() {
    return this.fieldCrypto.isEnabled() || Boolean(this.dedicatedKey());
  }
}
