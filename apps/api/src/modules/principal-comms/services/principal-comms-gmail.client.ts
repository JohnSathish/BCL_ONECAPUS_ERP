import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StoredGoogleTokens } from './principal-comms-token-vault.service';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'openid',
  'email',
  'profile',
].join(' ');

export type GmailHeader = { name: string; value: string };
export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
  headers?: GmailHeader[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

@Injectable()
export class PrincipalCommsGmailClient {
  private readonly logger = new Logger(PrincipalCommsGmailClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('GOOGLE_COMMS_CLIENT_ID') &&
      this.config.get<string>('GOOGLE_COMMS_CLIENT_SECRET') &&
      this.config.get<string>('GOOGLE_COMMS_REDIRECT_URI'),
    );
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google Gmail OAuth is not configured. Set GOOGLE_COMMS_CLIENT_ID, GOOGLE_COMMS_CLIENT_SECRET, and GOOGLE_COMMS_REDIRECT_URI.',
      );
    }
  }

  buildAuthUrl(state: string) {
    this.assertConfigured();
    const clientId = this.config.getOrThrow<string>('GOOGLE_COMMS_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>(
      'GOOGLE_COMMS_REDIRECT_URI',
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
  ): Promise<StoredGoogleTokens & { email?: string }> {
    this.assertConfigured();
    const body = new URLSearchParams({
      code,
      client_id: this.config.getOrThrow<string>('GOOGLE_COMMS_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>(
        'GOOGLE_COMMS_CLIENT_SECRET',
      ),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_COMMS_REDIRECT_URI'),
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(`Token exchange failed: ${JSON.stringify(json)}`);
      throw new BadRequestException('Google OAuth token exchange failed');
    }
    const accessToken = String(json.access_token ?? '');
    const refreshToken = String(json.refresh_token ?? '');
    if (!accessToken || !refreshToken) {
      throw new BadRequestException(
        'Google did not return refresh_token. Reconnect with consent prompted.',
      );
    }
    const expiresIn = Number(json.expires_in ?? 3600);
    const email = await this.fetchUserEmail(accessToken);
    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      scope: String(json.scope ?? GMAIL_SCOPES),
      tokenType: String(json.token_type ?? 'Bearer'),
      email,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<
    Omit<StoredGoogleTokens, 'refreshToken'> & { refreshToken: string }
  > {
    this.assertConfigured();
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_COMMS_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>(
        'GOOGLE_COMMS_CLIENT_SECRET',
      ),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new BadRequestException('Failed to refresh Google access token');
    }
    return {
      accessToken: String(json.access_token ?? ''),
      refreshToken,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
      scope: String(json.scope ?? ''),
      tokenType: String(json.token_type ?? 'Bearer'),
    };
  }

  private async fetchUserEmail(accessToken: string) {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return undefined;
    const json = (await res.json()) as { emailAddress?: string };
    return json.emailAddress;
  }

  async listMessageIds(
    accessToken: string,
    opts: { q?: string; maxResults?: number; pageToken?: string },
  ) {
    const params = new URLSearchParams({
      maxResults: String(opts.maxResults ?? 50),
    });
    if (opts.q) params.set('q', opts.q);
    if (opts.pageToken) params.set('pageToken', opts.pageToken);
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new BadRequestException('Gmail list messages failed');
    }
    return (await res.json()) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
      resultSizeEstimate?: number;
    };
  }

  async getMessage(accessToken: string, messageId: string, format = 'full') {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=${format}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new BadRequestException(`Gmail get message failed: ${messageId}`);
    }
    return (await res.json()) as GmailMessage;
  }

  async modifyLabels(
    accessToken: string,
    messageId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      },
    );
    if (!res.ok) {
      throw new BadRequestException('Gmail modify labels failed');
    }
    return (await res.json()) as GmailMessage;
  }

  async sendRaw(accessToken: string, rawBase64Url: string) {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawBase64Url }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`Gmail send failed: ${err}`);
      throw new BadRequestException('Gmail send failed');
    }
    return (await res.json()) as {
      id: string;
      threadId: string;
      labelIds?: string[];
    };
  }

  async getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string,
  ) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new BadRequestException('Gmail attachment download failed');
    }
    return (await res.json()) as { data: string; size: number };
  }
}
