import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'enc:v1:';

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_KEY');
    this.key = raw ? createHash('sha256').update(raw).digest() : null;
  }

  isEnabled() {
    return this.key != null;
  }

  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext == null || plaintext === '') return plaintext ?? null;
    if (!this.key) return plaintext;
    if (plaintext.startsWith(PREFIX)) return plaintext;

    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const packed = Buffer.concat([iv, tag, enc]).toString('base64url');
    return `${PREFIX}${packed}`;
  }

  decrypt(stored: string | null | undefined): string | null {
    if (stored == null || stored === '') return stored ?? null;
    if (!stored.startsWith(PREFIX)) return stored;
    if (!this.key) return stored;

    const packed = Buffer.from(stored.slice(PREFIX.length), 'base64url');
    const iv = packed.subarray(0, IV_LEN);
    const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = packed.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key!, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  }
}
