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
  /** APNs device token replaced by the Firebase registration token FCM accepted. */
  replacedTokens?: Array<{ from: string; to: string }>;
  successCount?: number;
  failureCount?: number;
};

/** College campus app. School apps must not reuse this bundle for APNs import. */
export const COLLEGE_IOS_BUNDLE_ID = 'edu.onecampus.mobile';

/** Expo iOS `getDevicePushTokenAsync` returns this 64-character APNs token. */
export function isApnsDeviceToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token.trim());
}

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
  /** APNs hex token → FCM registration token, for the life of this process. */
  private readonly apnsImportCache = new Map<string, string>();

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
      androidChannelId?: string;
      /**
       * When set, 64-hex iOS tokens are exchanged for an FCM registration token
       * before send. College callers pass COLLEGE_IOS_BUNDLE_ID. Callers that
       * omit it leave raw APNs tokens untouched.
       */
      apnsBundleId?: string;
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
    const replacedTokens: Array<{ from: string; to: string }> = [];
    let apnsImportFailed = false;

    for (const pushToken of fcmTokens) {
      const publicImage =
        payload.imageUrl && /^https?:\/\//i.test(payload.imageUrl)
          ? payload.imageUrl
          : undefined;
      if (payload.imageUrl && !publicImage) {
        this.logger.warn(
          `Skipping FCM image — URL is not absolute http(s): ${payload.imageUrl}`,
        );
      }

      let deliverToken = pushToken;
      if (isApnsDeviceToken(pushToken)) {
        if (!payload.apnsBundleId) {
          failures++;
          apnsImportFailed = true;
          continue;
        }
        const imported = await this.fcmTokenForApns(
          pushToken,
          payload.apnsBundleId,
          token,
        );
        if (!imported) {
          failures++;
          apnsImportFailed = true;
          continue;
        }
        deliverToken = imported;
      }

      const message: Record<string, unknown> = {
        token: deliverToken,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(publicImage ? { image: publicImage } : {}),
        },
        data,
        android: {
          priority: 'HIGH',
          notification: {
            channelId: payload.androidChannelId || ANDROID_CHANNEL_ID,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'PUBLIC',
            notificationPriority: 'PRIORITY_HIGH',
            ...(publicImage ? { image: publicImage } : {}),
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: 'default',
              'interruption-level': 'active',
              ...(publicImage ? { 'mutable-content': 1 } : {}),
            },
          },
          ...(publicImage ? { fcm_options: { image: publicImage } } : {}),
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
        if (deliverToken !== pushToken) {
          replacedTokens.push({ from: pushToken, to: deliverToken });
        }
      }
    }

    const importError = apnsImportFailed
      ? 'An iPhone Apple push token could not be registered with Firebase'
      : undefined;
    if (successes === 0) {
      return {
        ok: false,
        provider: 'fcm',
        error: importError ?? 'All FCM deliveries failed',
        invalidTokens,
        replacedTokens: replacedTokens.length ? replacedTokens : undefined,
        successCount: 0,
        failureCount: failures,
      };
    }
    return {
      ok: true,
      provider: 'fcm',
      providerRef: lastRef,
      error: failures > 0 ? importError : undefined,
      invalidTokens: invalidTokens.length ? invalidTokens : undefined,
      replacedTokens: replacedTokens.length ? replacedTokens : undefined,
      successCount: successes,
      failureCount: failures,
    };
  }

  /**
   * FCM HTTP v1 accepts a Firebase registration token. Expo on iOS only gives
   * the APNs device token, so exchange it once and cache the FCM token.
   * Production tokens use the APNs production gateway (TestFlight and App Store).
   */
  private async fcmTokenForApns(
    apnsToken: string,
    bundleId: string,
    accessToken: string,
  ): Promise<string | null> {
    const cached = this.apnsImportCache.get(apnsToken);
    if (cached) return cached;
    const sandbox =
      this.config.get<string>('APNS_USE_SANDBOX', 'false') === 'true';
    try {
      const res = await fetch('https://iid.googleapis.com/iid/v1:batchImport', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          access_token_auth: 'true',
        },
        body: JSON.stringify({
          application: bundleId,
          sandbox,
          apns_tokens: [apnsToken],
        }),
      });
      const body = (await res.json()) as {
        results?: Array<{ registration_token?: string; status?: string }>;
      };
      const row = body.results?.[0];
      const registration = row?.registration_token?.trim();
      if (!res.ok || !registration || (row?.status && row.status !== 'OK')) {
        this.logger.warn(
          `APNs token import failed (${res.status}${row?.status ? ` ${row.status}` : ''})`,
        );
        return null;
      }
      this.apnsImportCache.set(apnsToken, registration);
      return registration;
    } catch (err) {
      this.logger.warn(
        `APNs token import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
