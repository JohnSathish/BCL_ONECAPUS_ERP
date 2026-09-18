import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { createSign } from 'crypto';
import * as admin from 'firebase-admin';
import { PUSH_CHANNELS } from './school-sis-push.catalog';
import { classifyPushFailure } from './school-sis-push-errors';

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

const APP_NAME = 'stlukes-school-sis';
const MULTICAST_LIMIT = 500;
/** expo-notifications plugin copies assets/notification-icon.png to this drawable. */
const ANDROID_SMALL_ICON = 'notification_icon';
const ANDROID_ICON_COLOR = '#1A237E';

@Injectable()
export class SchoolSisFcmProvider implements NotificationProvider {
  private readonly logger = new Logger(SchoolSisFcmProvider.name);
  private cached: { value: string; exp: number } | null = null;
  private adminApp: admin.app.App | null = null;
  private adminTried = false;

  constructor(private readonly config: ConfigService) {}

  isDemo() {
    const school = this.config.get('SCHOOL_FCM_DEMO_MODE');
    if (school === 'true' || school === 'false') return school === 'true';
    return this.config.get('FCM_DEMO_MODE') === 'true';
  }

  isConfigured() {
    if (this.isDemo()) return true;
    return Boolean(
      this.projectId() && (this.serviceAccount() || this.legacyKeyPair()),
    );
  }

  connectionStatus() {
    return {
      configured: this.isConfigured(),
      demo: this.isDemo(),
      engine: this.isDemo()
        ? 'demo'
        : this.adminApp || this.serviceAccount()
          ? 'firebase-admin'
          : this.legacyKeyPair()
            ? 'fcm-http-v1'
            : 'unconfigured',
      projectId: this.projectId(),
    };
  }

  private projectId() {
    return this.serviceAccount()?.project_id || null;
  }

  private parseJsonAccount(raw?: string | null) {
    if (!raw?.trim().startsWith('{')) return null;
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      this.logger.warn('Firebase service account JSON is not valid');
      return null;
    }
  }

  private readAccountFile(file?: string | null) {
    if (!file || !existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    } catch {
      this.logger.warn('Firebase service account file could not be read');
      return null;
    }
  }

  private accountFromParts(
    email?: string | null,
    raw?: string | null,
    projectId?: string | null,
  ) {
    if (!email || !raw || !projectId) return null;
    return {
      type: 'service_account',
      project_id: projectId,
      client_email: email,
      private_key: raw.replace(/\\n/g, '\n'),
    };
  }

  private serviceAccount(): Record<string, string> | null {
    const schoolJson = this.parseJsonAccount(
      this.config.get<string>('SCHOOL_FIREBASE_SERVICE_ACCOUNT_JSON'),
    );
    if (schoolJson) return schoolJson;
    const schoolFile = this.readAccountFile(
      this.config.get<string>('SCHOOL_FIREBASE_SERVICE_ACCOUNT_FILE'),
    );
    if (schoolFile) return schoolFile;
    const schoolParts = this.accountFromParts(
      this.config.get<string>('SCHOOL_FCM_CLIENT_EMAIL'),
      this.config.get<string>('SCHOOL_FCM_PRIVATE_KEY'),
      this.config.get<string>('SCHOOL_FCM_PROJECT_ID'),
    );
    if (schoolParts) return schoolParts;
    if (
      this.config.get('SCHOOL_FIREBASE_SERVICE_ACCOUNT_FILE') ||
      this.config.get('SCHOOL_FIREBASE_SERVICE_ACCOUNT_JSON') ||
      this.config.get('SCHOOL_FCM_CLIENT_EMAIL')
    ) {
      this.logger.warn(
        'School FCM env is set but incomplete. Use st-lukes-school-6f471 credentials (not the college Firebase project).',
      );
      return null;
    }
    const json = this.parseJsonAccount(
      this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
    );
    if (json) return json;
    const file = this.readAccountFile(
      this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_FILE') ||
        this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS'),
    );
    if (file) return file;
    return this.accountFromParts(
      this.config.get<string>('FIREBASE_CLIENT_EMAIL') ||
        this.config.get<string>('FCM_CLIENT_EMAIL'),
      this.config.get<string>('FIREBASE_PRIVATE_KEY') ??
        this.config.get<string>('FCM_PRIVATE_KEY'),
      this.config.get<string>('FIREBASE_PROJECT_ID') ||
        this.config.get<string>('FCM_PROJECT_ID'),
    );
  }

  private legacyKeyPair() {
    return Boolean(
      (this.config.get('FIREBASE_CLIENT_EMAIL') ||
        this.config.get('FCM_CLIENT_EMAIL')) &&
      (this.config.get('FIREBASE_PRIVATE_KEY') ||
        this.config.get('FCM_PRIVATE_KEY')),
    );
  }

  private messaging(): admin.messaging.Messaging | null {
    if (this.isDemo()) return null;
    if (this.adminTried) return this.adminApp?.messaging() ?? null;
    this.adminTried = true;
    const cred = this.serviceAccount();
    if (!cred) return null;
    try {
      const existing = admin.apps.find((a) => a?.name === APP_NAME);
      this.adminApp =
        existing ??
        admin.initializeApp(
          {
            credential: admin.credential.cert(cred as admin.ServiceAccount),
            projectId: this.projectId() ?? undefined,
          },
          APP_NAME,
        );
      return this.adminApp.messaging();
    } catch (err) {
      this.logger.warn(
        `Firebase Admin SDK init failed: ${err instanceof Error ? err.message : 'error'}`,
      );
      this.adminApp = null;
      return null;
    }
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
    const tokens = [
      ...new Set(
        input.tokens.filter(
          (t) =>
            t &&
            !t.startsWith('ExponentPushToken') &&
            !t.startsWith('ExpoPushToken'),
        ),
      ),
    ];
    if (!tokens.length) {
      return {
        ok: false,
        provider: 'fcm',
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        perToken: [],
      };
    }
    if (this.isDemo()) {
      this.logger.log(`[FCM demo] ${tokens.length} device(s)`);
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
    const messaging = this.messaging();
    if (messaging) {
      return this.sendWithAdmin(messaging, tokens, input);
    }
    return this.sendWithHttpV1(tokens, input);
  }

  private async sendWithAdmin(
    messaging: admin.messaging.Messaging,
    tokens: string[],
    input: {
      title: string;
      body: string;
      category?: string;
      priority?: string;
      imageUrl?: string;
      data?: Record<string, string>;
    },
  ): Promise<PushSendResult> {
    const channel =
      PUSH_CHANNELS[input.category ?? ''] || 'stlukes_school_default';
    const high = input.priority === 'HIGH' || input.priority === 'URGENT';
    const image =
      input.imageUrl && /^https?:\/\//i.test(input.imageUrl)
        ? input.imageUrl
        : undefined;
    const data = Object.fromEntries(
      Object.entries(input.data ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    );
    const perToken: PushSendResult['perToken'] = [];
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
      const batch = tokens.slice(i, i + MULTICAST_LIMIT);
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: input.title,
          body: input.body,
          ...(image ? { imageUrl: image } : {}),
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: channel,
            sound: 'default',
            icon: ANDROID_SMALL_ICON,
            color: ANDROID_ICON_COLOR,
            ...(image ? { imageUrl: image } : {}),
          },
        },
        apns: {
          headers: { 'apns-priority': high ? '10' : '5' },
          payload: { aps: { sound: 'default', 'mutable-content': 1 } },
          ...(image ? { fcmOptions: { imageUrl: image } } : {}),
        },
      });
      res.responses.forEach((row, idx) => {
        const token = batch[idx];
        if (row.success) {
          successCount += 1;
          perToken.push({ token, ok: true, ref: row.messageId });
          return;
        }
        failureCount += 1;
        const code = row.error?.code ?? 'UNKNOWN';
        const invalid =
          /registration-token-not-registered|invalid-registration-token|invalid-argument|mismatched-credential/i.test(
            code,
          );
        if (invalid) invalidTokens.push(token);
        this.logger.warn(`FCM failed (${code})`);
        const classified = classifyPushFailure(code, row.error?.message);
        perToken.push({
          token,
          ok: false,
          code,
          reason: classified.label,
          retryable: classified.retryable,
        });
      });
    }
    return {
      ok: successCount > 0,
      provider: 'firebase-admin',
      successCount,
      failureCount,
      invalidTokens,
      perToken,
    };
  }

  private async sendWithHttpV1(
    tokens: string[],
    input: {
      title: string;
      body: string;
      category?: string;
      priority?: string;
      imageUrl?: string;
      data?: Record<string, string>;
    },
  ): Promise<PushSendResult> {
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
    const projectId = this.projectId();
    if (!bearer || !projectId) {
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
    const channel =
      PUSH_CHANNELS[input.category ?? ''] || 'stlukes_school_default';
    const high = input.priority === 'HIGH' || input.priority === 'URGENT';
    const image =
      input.imageUrl && /^https?:\/\//i.test(input.imageUrl)
        ? input.imageUrl
        : undefined;
    const invalidTokens: string[] = [];
    const perToken: PushSendResult['perToken'] = [];
    let successCount = 0;
    let failureCount = 0;
    for (const token of tokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
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
                priority: 'HIGH',
                notification: {
                  channelId: channel,
                  sound: 'default',
                  icon: ANDROID_SMALL_ICON,
                  color: ANDROID_ICON_COLOR,
                  ...(image ? { image } : {}),
                },
              },
              apns: {
                headers: { 'apns-priority': high ? '10' : '5' },
                payload: { aps: { sound: 'default', 'mutable-content': 1 } },
              },
            },
          }),
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
      if (res.ok) {
        successCount += 1;
        perToken.push({ token, ok: true, ref: body.name });
      } else {
        failureCount += 1;
        const code =
          body.error?.details?.find((d) => d.errorCode)?.errorCode ??
          body.error?.status ??
          'UNKNOWN';
        const invalid =
          /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND|SENDER_ID_MISMATCH/i.test(
            code,
          );
        if (invalid) invalidTokens.push(token);
        this.logger.warn(`FCM failed (${code})`);
        const classified = classifyPushFailure(code, body.error?.message);
        perToken.push({
          token,
          ok: false,
          code,
          reason: classified.label,
          retryable: classified.retryable,
        });
      }
    }
    return {
      ok: successCount > 0,
      provider: 'fcm-http-v1',
      successCount,
      failureCount,
      invalidTokens,
      perToken,
    };
  }

  private async accessToken() {
    if (this.isDemo()) return 'demo';
    if (this.cached && this.cached.exp > Date.now() + 60_000)
      return this.cached.value;
    const sa = this.serviceAccount();
    const clientEmail = sa?.client_email;
    const privateKey = sa?.private_key;
    if (!clientEmail || !privateKey) return null;
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
}
