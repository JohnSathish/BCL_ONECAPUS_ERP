import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

@Injectable()
export class BackupCryptoService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const secret =
      this.config.get<string>('BACKUP_ENCRYPTION_KEY') ??
      this.config.get<string>('ENCRYPTION_KEY') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      'dev-backup-encryption-key-change-me';
    return scryptSync(secret, 'nep-backup-salt', 32);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  }

  maskSecret(value?: string | null) {
    if (!value) return null;
    if (value.length <= 4) return '****';
    return `${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
  }
}
