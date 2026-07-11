import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';

type FcmSendResult = {
  ok: boolean;
  provider: string;
  providerRef?: string;
  error?: string;
  /** Tokens FCM reported as permanently invalid — caller should deactivate. */
  invalidTokens?: string[];
  successCount?: number;
  failureCount?: number;
};

const ANDROID_CHANNEL_ID = 'onecampus_default';

function isExpoPushToken(token: string) {
  return (
    token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
  );
}

@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isDemoMode(): boolean {
    return this.config.get<string>('FCM_DEMO_MODE', 'false') === 'true';
  }

  isConfigured(): boolean {
    if (this.isDemoMode()) return true;
    return Boolean(
      this.config.get<string>('FCM_PROJECT_ID') &&
      this.config.get<string>('FCM_CLIENT_EMAIL') &&
      this.config.get<string>('FCM_PRIVATE_KEY'),
    );
  }

  private normalizedPrivateKey() {
    const raw = this.config.get<string>('FCM_PRIVATE_KEY') ?? '';
    return raw.replace(/\\n/g, '\n');
  }

  private async accessToken(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }
    const clientEmail = this.config.getOrThrow<string>('FCM_CLIENT_EMAIL');
    const privateKey = this.normalizedPrivateKey();
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
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${unsigned}.${signature}`;

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
      error?: string;
    };
    if (!res.ok || !body.access_token) {
      this.logger.warn(`FCM token error: ${body.error ?? res.status}`);
      return null;
    }
    this.cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  async sendToTokens(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
      imageUrl?: string;
    },
  ): Promise<FcmSendResult> {
    const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
    const expoTokens = unique.filter(isExpoPushToken);
    const fcmTokens = unique.filter((t) => !isExpoPushToken(t));

    if (!unique.length) {
      return { ok: false, provider: 'fcm', error: 'No push tokens' };
    }

    if (!fcmTokens.length && expoTokens.length) {
      return {
        ok: false,
        provider: 'fcm',
        error:
          'Device registered Expo push token; rebuild the app with google-services.json for FCM',
        invalidTokens: expoTokens,
      };
    }

    if (this.isDemoMode()) {
      this.logger.log(
        `[FCM demo] Would send to ${fcmTokens.length} device(s): "${payload.title}" — ${payload.body}${payload.imageUrl ? ` [image=${payload.imageUrl}]` : ''}`,
      );
      return {
        ok: true,
        provider: 'fcm-demo',
        providerRef: `demo-${Date.now()}`,
        successCount: fcmTokens.length,
        failureCount: 0,
      };
    }
    if (!this.isConfigured()) {
      return { ok: false, provider: 'fcm', error: 'FCM not configured' };
    }
    const token = await this.accessToken();
    if (!token) {
      return { ok: false, provider: 'fcm', error: 'FCM auth failed' };
    }
    const projectId = this.config.getOrThrow<string>('FCM_PROJECT_ID');
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload.data ?? {})) {
      data[key] = value == null ? '' : String(value);
    }
    if (payload.imageUrl) {
      data.imageUrl = payload.imageUrl;
    }

    let lastRef: string | undefined;
    let failures = 0;
    let successes = 0;
    const invalidTokens: string[] = [...expoTokens];

    for (const pushToken of fcmTokens) {
      const message: Record<string, unknown> = {
        token: pushToken,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
        },
        data,
        android: {
          priority: 'HIGH',
          notification: {
            channelId: ANDROID_CHANNEL_ID,
            ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: {
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
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
        failures++;
        const errCode =
          body.error?.details?.find((d) => d.errorCode)?.errorCode ??
          body.error?.status ??
          '';
        const msg = body.error?.message ?? String(res.status);
        this.logger.warn(`FCM send failed (${errCode || 'ERR'}): ${msg}`);
        if (
          /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND|SENDER_ID_MISMATCH/i.test(
            `${errCode} ${msg}`,
          )
        ) {
          invalidTokens.push(pushToken);
        }
      } else {
        successes++;
        lastRef = body.name;
      }
    }

    if (successes === 0) {
      return {
        ok: false,
        provider: 'fcm',
        error: 'All FCM deliveries failed',
        invalidTokens,
        successCount: 0,
        failureCount: failures,
      };
    }
    return {
      ok: true,
      provider: 'fcm',
      providerRef: lastRef,
      invalidTokens: invalidTokens.length ? invalidTokens : undefined,
      successCount: successes,
      failureCount: failures,
    };
  }
}
