import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import { PUSH_CHANNELS } from './school-sis-push.catalog';

export type PushSendResult = {
  ok: boolean;
  provider: string;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  perToken: Array<{
    token: string;
    ok: boolean;
    ref?: string;
    code?: string;
    reason?: string;
    retryable?: boolean;
  }>;
};

export interface NotificationProvider {
  send(input: {
    tokens: string[];
    title: string;
    body: string;
    category?: string;
    priority?: string;
    imageUrl?: string;
    data?: Record<string, string>;
  }): Promise<PushSendResult>;
}

@Injectable()
export class SchoolSisFcmProvider implements NotificationProvider {
  private readonly logger = new Logger(SchoolSisFcmProvider.name);
  private cached: { value: string; exp: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    if (this.config.get('FCM_DEMO_MODE') === 'true') return true;
    return Boolean(
      (this.config.get('FIREBASE_PROJECT_ID') ||
        this.config.get('FCM_PROJECT_ID')) &&
      (this.config.get('FIREBASE_CLIENT_EMAIL') ||
        this.config.get('FCM_CLIENT_EMAIL')) &&
      (this.config.get('FIREBASE_PRIVATE_KEY') ||
        this.config.get('FCM_PRIVATE_KEY')),
    );
  }

  connectionStatus() {
    return {
      configured: this.isConfigured(),
      demo: this.config.get('FCM_DEMO_MODE') === 'true',
      projectId:
        this.config.get<string>('FIREBASE_PROJECT_ID') ||
        this.config.get<string>('FCM_PROJECT_ID') ||
        null,
    };
  }

  private async accessToken() {
    if (this.config.get('FCM_DEMO_MODE') === 'true') return 'demo';
    if (this.cached && this.cached.exp > Date.now() + 60_000)
      return this.cached.value;
    const clientEmail =
      this.config.get<string>('FIREBASE_CLIENT_EMAIL') ||
      this.config.get<string>('FCM_CLIENT_EMAIL');
    const raw =
      this.config.get<string>('FIREBASE_PRIVATE_KEY') ??
      this.config.get<string>('FCM_PRIVATE_KEY') ??
      '';
    if (!clientEmail || !raw) return null;
    const privateKey = raw.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const claim = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');
    const unsigned = `${header}.${claim}`;
    const sign = createSign('RSA-SHA256');
    sign.update(unsigned);
    const jwt = `${unsigned}.${sign.sign(privateKey, 'base64url')}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    const body = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !body.access_token) return null;
    this.cached = {
      value: body.access_token,
      exp: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  async send(input: {
    tokens: string[];
    title: string;
    body: string;
    category?: string;
    priority?: string;
    imageUrl?: string;
    data?: Record<string, string>;
  }): Promise<PushSendResult> {
    const tokens = [...new Set(input.tokens.filter(Boolean))];
    const perToken: PushSendResult['perToken'] = [];
    if (!tokens.length) {
      return {
        ok: false,
        provider: 'fcm',
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        perToken,
      };
    }
    if (this.config.get('FCM_DEMO_MODE') === 'true') {
      this.logger.log(`[FCM demo] ${tokens.length} device(s): ${input.title}`);
      return {
        ok: true,
        provider: 'fcm-demo',
        successCount: tokens.length,
        failureCount: 0,
        invalidTokens: [],
        perToken: tokens.map((token) => ({
          token,
          ok: true,
          ref: `demo-${Date.now()}`,
        })),
      };
    }
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: 'fcm',
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        perToken: tokens.map((token) => ({
          token,
          ok: false,
          code: 'NOT_CONFIGURED',
          reason: 'Unable to send notification',
          retryable: false,
        })),
      };
    }
    const bearer = await this.accessToken();
    if (!bearer) {
      return {
        ok: false,
        provider: 'fcm',
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        perToken: tokens.map((token) => ({
          token,
          ok: false,
          code: 'AUTH',
          reason: 'Unable to send notification',
          retryable: true,
        })),
      };
    }
    const projectId =
      this.config.get<string>('FIREBASE_PROJECT_ID') ||
      this.config.get<string>('FCM_PROJECT_ID');
    if (!projectId) {
      return {
        ok: false,
        provider: 'fcm',
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
        perToken: tokens.map((token) => ({
          token,
          ok: false,
          code: 'NOT_CONFIGURED',
          reason: 'Unable to send notification',
          retryable: false,
        })),
      };
    }
    const channel =
      PUSH_CHANNELS[input.category ?? ''] || 'stlukes_school_default';
    const high = input.priority === 'HIGH' || input.priority === 'URGENT';
    const image =
      input.imageUrl && /^https?:\/\//i.test(input.imageUrl)
        ? input.imageUrl
        : undefined;
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    for (const token of tokens) {
      const message = {
        token,
        notification: {
          title: input.title,
          body: input.body,
          ...(image ? { image } : {}),
        },
        data: Object.fromEntries(
          Object.entries(input.data ?? {}).map(([k, v]) => [
            k,
            String(v ?? ''),
          ]),
        ),
        android: {
          priority: high ? 'HIGH' : 'NORMAL',
          notification: {
            channelId: channel,
            sound: 'default',
            visibility: 'PUBLIC',
            ...(image ? { image } : {}),
          },
        },
        apns: {
          headers: { 'apns-priority': high ? '10' : '5' },
          payload: { aps: { sound: 'default', 'mutable-content': 1 } },
          ...(image ? { fcm_options: { image } } : {}),
        },
      };
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        },
      );
      const body = (await res.json()) as {
        name?: string;
        error?: {
          message?: string;
          status?: string;
          details?: Array<{ errorCode?: string }>;
        };
      };
      if (!res.ok) {
        failureCount += 1;
        const code =
          body.error?.details?.find((d) => d.errorCode)?.errorCode ??
          body.error?.status ??
          'UNKNOWN';
        const reason = body.error?.message ?? 'Unable to send notification';
        const invalid =
          /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND|SENDER_ID_MISMATCH/i.test(
            `${code} ${reason}`,
          );
        if (invalid) invalidTokens.push(token);
        this.logger.warn(`FCM failed (${code})`);
        perToken.push({
          token,
          ok: false,
          code,
          reason: invalid
            ? 'Device unregistered'
            : 'Unable to send notification',
          retryable:
            !invalid &&
            /UNAVAILABLE|INTERNAL|RESOURCE_EXHAUSTED|quota/i.test(
              `${code} ${reason}`,
            ),
        });
      } else {
        successCount += 1;
        perToken.push({ token, ok: true, ref: body.name });
      }
    }
    return {
      ok: successCount > 0,
      provider: 'fcm',
      successCount,
      failureCount,
      invalidTokens,
      perToken,
    };
  }
}
