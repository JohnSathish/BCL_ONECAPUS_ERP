import { createHmac, timingSafeEqual } from 'crypto';

export type WhatsappSendTemplateInput = {
  to: string;
  templateName: string;
  language: string;
  components?: unknown[];
};

export type WhatsappSendTextInput = {
  to: string;
  body: string;
};

export type WhatsappSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
};

export type WhatsappTemplateRemote = {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: unknown[];
};

export interface WhatsappMessagingProvider {
  readonly key: string;
  sendText(
    creds: MetaCloudCredentials,
    input: WhatsappSendTextInput,
  ): Promise<WhatsappSendResult>;
  sendTemplate(
    creds: MetaCloudCredentials,
    input: WhatsappSendTemplateInput,
  ): Promise<WhatsappSendResult>;
  testConnection(creds: MetaCloudCredentials): Promise<{
    ok: boolean;
    displayPhone?: string;
    verifiedName?: string;
    qualityRating?: string;
    error?: string;
  }>;
  listTemplates(creds: MetaCloudCredentials): Promise<WhatsappTemplateRemote[]>;
}

export type MetaCloudCredentials = {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  appSecret?: string;
  apiVersion: string;
};

type GraphError = { error?: { message?: string; code?: number } };

export class MetaWhatsappProvider implements WhatsappMessagingProvider {
  readonly key = 'META';

  private url(version: string, path: string) {
    return `https://graph.facebook.com/${version}/${path}`;
  }

  private async graph<T>(
    creds: MetaCloudCredentials,
    path: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; status: number; data: T & GraphError }> {
    const res = await fetch(this.url(creds.apiVersion, path), {
      ...init,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const data = (await res.json().catch(() => ({}))) as T & GraphError;
    return { ok: res.ok, status: res.status, data };
  }

  async sendText(creds: MetaCloudCredentials, input: WhatsappSendTextInput) {
    const graph = await this.graph<{ messages?: { id: string }[] }>(
      creds,
      `${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'text',
          text: { body: input.body, preview_url: false },
        }),
      },
    );
    if (!graph.ok) {
      return {
        ok: false,
        provider: this.key,
        error: graph.data.error?.message ?? 'Meta API error',
        errorCode: String(graph.data.error?.code ?? graph.status),
      };
    }
    return {
      ok: true,
      provider: this.key,
      providerMessageId: graph.data.messages?.[0]?.id,
    };
  }

  async sendTemplate(
    creds: MetaCloudCredentials,
    input: WhatsappSendTemplateInput,
  ) {
    const graph = await this.graph<{ messages?: { id: string }[] }>(
      creds,
      `${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: input.language },
            components: input.components ?? [],
          },
        }),
      },
    );
    if (!graph.ok) {
      return {
        ok: false,
        provider: this.key,
        error: graph.data.error?.message ?? 'Meta API error',
        errorCode: String(graph.data.error?.code ?? graph.status),
      };
    }
    return {
      ok: true,
      provider: this.key,
      providerMessageId: graph.data.messages?.[0]?.id,
    };
  }

  async testConnection(creds: MetaCloudCredentials) {
    const graph = await this.graph<{
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    }>(
      creds,
      `${creds.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    );
    if (!graph.ok) {
      return {
        ok: false,
        error: graph.data.error?.message ?? 'Connection failed',
      };
    }
    return {
      ok: true,
      displayPhone: graph.data.display_phone_number,
      verifiedName: graph.data.verified_name,
      qualityRating: graph.data.quality_rating,
    };
  }

  async listTemplates(creds: MetaCloudCredentials) {
    if (!creds.wabaId) return [];
    const graph = await this.graph<{
      data?: Array<{
        id: string;
        name: string;
        language: string;
        status: string;
        category?: string;
        components?: unknown[];
      }>;
    }>(creds, `${creds.wabaId}/message_templates?limit=200`);
    if (!graph.ok) {
      throw new Error(graph.data.error?.message ?? 'Template sync failed');
    }
    return (graph.data.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      language: row.language,
      status: row.status,
      category: row.category,
      components: row.components,
    }));
  }
}

export function verifyMetaSignature(
  appSecret: string,
  rawBody: string,
  header: string | undefined,
) {
  if (!header || !appSecret) return false;
  const expected =
    'sha256=' +
    createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function exchangeEmbeddedSignupCode(input: {
  appId: string;
  appSecret: string;
  code: string;
  apiVersion: string;
}): Promise<{ accessToken?: string; error?: string }> {
  const url = `https://graph.facebook.com/${input.apiVersion}/oauth/access_token?client_id=${encodeURIComponent(input.appId)}&client_secret=${encodeURIComponent(input.appSecret)}&code=${encodeURIComponent(input.code)}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    return { error: data.error?.message ?? 'Token exchange failed' };
  }
  return { accessToken: data.access_token };
}
