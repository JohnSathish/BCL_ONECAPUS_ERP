import { Injectable } from '@nestjs/common';
import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import type { PaymentGatewayCredentials } from '../interfaces/payment-gateway.types';

type GatewayRow = {
  providerCode: string;
  mode: string;
  merchantId?: string | null;
  apiKeyEncrypted?: string | null;
  secretKeyEncrypted?: string | null;
  webhookSecretEncrypted?: string | null;
  successUrl?: string | null;
  failureUrl?: string | null;
};

@Injectable()
export class PaymentGatewayCredentialsService {
  constructor(private readonly crypto: FieldEncryptionService) {}

  encryptFields(input: {
    apiKey?: string | null;
    secretKey?: string | null;
    webhookSecret?: string | null;
  }) {
    return {
      apiKeyEncrypted: input.apiKey
        ? this.crypto.encrypt(input.apiKey)
        : undefined,
      secretKeyEncrypted: input.secretKey
        ? this.crypto.encrypt(input.secretKey)
        : undefined,
      webhookSecretEncrypted: input.webhookSecret
        ? this.crypto.encrypt(input.webhookSecret)
        : undefined,
    };
  }

  decryptCredentials(row: GatewayRow): PaymentGatewayCredentials | null {
    const keyId = this.crypto.decrypt(row.apiKeyEncrypted ?? null) ?? '';
    const keySecret = this.crypto.decrypt(row.secretKeyEncrypted ?? null) ?? '';
    if (!keyId || !keySecret) return null;

    return {
      providerCode:
        row.providerCode.toUpperCase() as PaymentGatewayCredentials['providerCode'],
      mode: row.mode === 'LIVE' ? 'LIVE' : 'TEST',
      merchantId: row.merchantId,
      keyId,
      keySecret,
      webhookSecret: this.crypto.decrypt(row.webhookSecretEncrypted ?? null),
      successUrl: row.successUrl,
      failureUrl: row.failureUrl,
    };
  }

  maskSecret(value?: string | null) {
    if (!value) return null;
    if (value.length <= 4) return '****';
    return `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
  }

  /** Fallback to legacy env credentials for backward compatibility during migration. */
  envFallback(providerCode: string): PaymentGatewayCredentials | null {
    const code = providerCode.toUpperCase();
    if (code === 'RAZORPAY') {
      const keyId = process.env.RAZORPAY_KEY_ID?.trim();
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
      if (!keyId || !keySecret) return null;
      return {
        providerCode: 'RAZORPAY',
        mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST',
        keyId,
        keySecret,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
      };
    }
    if (code === 'NTT_DATA') {
      const merchantId = process.env.NTT_DATA_MERCHANT_ID?.trim();
      const encKey = process.env.NTT_DATA_ENC_KEY?.trim();
      const password = process.env.NTT_DATA_PASSWORD?.trim();
      const decKey =
        process.env.NTT_DATA_DEC_KEY?.trim() ??
        process.env.NTT_DATA_ENC_KEY?.trim();
      if (!merchantId || !encKey || !password || !decKey) return null;
      return {
        providerCode: 'NTT_DATA',
        mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST',
        merchantId,
        keyId: encKey,
        keySecret: password,
        webhookSecret: decKey,
      };
    }
    return null;
  }
}
