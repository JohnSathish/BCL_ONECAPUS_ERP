import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';

type FcmSendResult = {
  ok: boolean;
  provider: string;
  providerRef?: string;
  error?: string;
};

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
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<FcmSendResult> {
    if (!tokens.length) {
      return { ok: false, provider: 'fcm', error: 'No push tokens' };
    }
    if (this.isDemoMode()) {
      this.logger.log(
        `[FCM demo] Would send to ${tokens.length} device(s): "${payload.title}" — ${payload.body}`,
      );
      return {
        ok: true,
        provider: 'fcm-demo',
        providerRef: `demo-${Date.now()}`,
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
    let lastRef: string | undefined;
    let failures = 0;
    for (const pushToken of tokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: pushToken,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
            },
          }),
        },
      );
      const body = (await res.json()) as {
        name?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        failures++;
        this.logger.debug(
          `FCM send failed: ${body.error?.message ?? res.status}`,
        );
      } else {
        lastRef = body.name;
      }
    }
    if (failures === tokens.length) {
      return { ok: false, provider: 'fcm', error: 'All FCM deliveries failed' };
    }
    return { ok: true, provider: 'fcm', providerRef: lastRef };
  }
}
