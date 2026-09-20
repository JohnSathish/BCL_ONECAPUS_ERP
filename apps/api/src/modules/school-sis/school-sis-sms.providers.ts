import { extractOtpCode, sendApitxtOtp } from './school-sis-apitxt-otp';

export type SmsSendInput = {
  to: string;
  body: string;
  senderId?: string | null;
  dltTemplateId?: string | null;
  entityId?: string | null;
  header?: string | null;
  idempotencyKey: string;
};

export type SmsSendResult = {
  accepted: boolean;
  providerMessageId?: string;
  status: 'SUBMITTED' | 'SENT' | 'FAILED' | 'REJECTED';
  errorCode?: string;
  errorMessage?: string;
  errorClass?: 'TEMPORARY' | 'PERMANENT';
  raw?: unknown;
};

export type SmsBalance = {
  credits?: number;
  amount?: number;
  currency?: string;
  error?: string;
  reachable?: boolean;
};

export interface SmsGatewayProvider {
  id: string;
  sendSms(
    input: SmsSendInput,
    creds: Record<string, string>,
    apiUrl?: string | null,
  ): Promise<SmsSendResult>;
  sendBulkSms(
    messages: SmsSendInput[],
    creds: Record<string, string>,
    apiUrl?: string | null,
  ): Promise<SmsSendResult[]>;
  getBalance(
    creds: Record<string, string>,
    apiUrl?: string | null,
  ): Promise<SmsBalance>;
  validateConfiguration(
    creds: Record<string, string>,
    apiUrl?: string | null,
  ): Promise<boolean>;
}

function form(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { ok: res.ok, status: res.status, json, text };
}

export const msg91Provider: SmsGatewayProvider = {
  id: 'MSG91',
  async validateConfiguration(creds) {
    return Boolean(creds.apiKey || creds.authkey);
  },
  async getBalance(creds) {
    const key = creds.apiKey || creds.authkey;
    if (!key) return { error: 'MSG91 authkey missing', reachable: false };
    const url = `https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(key)}&type=4`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      const n = Number(text.trim());
      if (Number.isFinite(n)) return { credits: n, reachable: true };
      const hint = /invalid|unauthor|auth/i.test(text)
        ? 'MSG91 rejected the authkey.'
        : 'MSG91 did not return a credit balance.';
      return { error: hint, reachable: res.ok };
    } catch {
      return { error: 'Could not reach MSG91.', reachable: false };
    }
  },
  async sendSms(input, creds, apiUrl) {
    const key = creds.apiKey || creds.authkey;
    if (!key) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: 'NO_KEY',
        errorMessage: 'MSG91 authkey missing',
        errorClass: 'PERMANENT',
      };
    }
    const url = apiUrl || 'https://control.msg91.com/api/v5/flow';
    const { ok, json, text, status } = await postJson(
      url,
      { authkey: key },
      {
        sender: input.senderId,
        short_url: '0',
        DLT_TE_ID: input.dltTemplateId,
        recipients: [{ mobiles: input.to, message: input.body }],
        message: input.body,
        mobiles: input.to,
        request_id: input.idempotencyKey,
      },
    );
    const id =
      typeof json === 'object' && json && 'message' in json
        ? String((json as { message?: unknown }).message ?? '')
        : undefined;
    if (!ok) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: String(status),
        errorMessage: text.slice(0, 400),
        errorClass: status >= 500 ? 'TEMPORARY' : 'PERMANENT',
        raw: json,
      };
    }
    return {
      accepted: true,
      status: 'SUBMITTED',
      providerMessageId: id,
      raw: json,
    };
  },
  async sendBulkSms(messages, creds, apiUrl) {
    const out: SmsSendResult[] = [];
    for (const m of messages) out.push(await this.sendSms(m, creds, apiUrl));
    return out;
  },
};

export const twilioProvider: SmsGatewayProvider = {
  id: 'TWILIO',
  async validateConfiguration(creds) {
    return Boolean(creds.accountSid && (creds.apiSecret || creds.authToken));
  },
  async getBalance(creds) {
    const sid = creds.accountSid;
    const token = creds.authToken || creds.apiSecret;
    if (!sid || !token) {
      return { error: 'Twilio credentials missing', reachable: false };
    }
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
        {
          headers: {
            Authorization:
              'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) {
        return {
          error: 'Twilio rejected the credentials.',
          reachable: res.status < 500,
        };
      }
      const json = (await res.json()) as {
        balance?: string;
        currency?: string;
      };
      return {
        amount: Number(json.balance),
        currency: json.currency,
        reachable: true,
      };
    } catch {
      return { error: 'Could not reach Twilio.', reachable: false };
    }
  },
  async sendSms(input, creds, apiUrl) {
    const sid = creds.accountSid;
    const token = creds.authToken || creds.apiSecret;
    if (!sid || !token) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: 'NO_KEY',
        errorMessage: 'Twilio credentials missing',
        errorClass: 'PERMANENT',
      };
    }
    const url =
      apiUrl ||
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form({
        To: `+${input.to}`,
        From: input.senderId || creds.from || '',
        Body: input.body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: String(res.status),
        errorMessage: json.message || `Twilio HTTP ${res.status}`,
        errorClass: res.status >= 500 ? 'TEMPORARY' : 'PERMANENT',
        raw: json,
      };
    }
    return {
      accepted: true,
      status: 'SUBMITTED',
      providerMessageId: json.sid,
      raw: json,
    };
  },
  async sendBulkSms(messages, creds, apiUrl) {
    const out: SmsSendResult[] = [];
    for (const m of messages) out.push(await this.sendSms(m, creds, apiUrl));
    return out;
  },
};

export const customHttpProvider: SmsGatewayProvider = {
  id: 'CUSTOM_HTTP',
  async validateConfiguration(creds, apiUrl) {
    return Boolean(apiUrl && (creds.apiKey || creds.token));
  },
  async getBalance(_creds, apiUrl) {
    if (!apiUrl)
      return { error: 'Custom HTTP API URL missing', reachable: false };
    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      return {
        reachable: true,
        error: res.status >= 500 ? `Gateway HTTP ${res.status}` : undefined,
      };
    } catch {
      return {
        error: 'Could not reach the custom HTTP gateway.',
        reachable: false,
      };
    }
  },
  async sendSms(input, creds, apiUrl) {
    if (!apiUrl) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: 'NO_URL',
        errorMessage: 'Custom HTTP API URL missing',
        errorClass: 'PERMANENT',
      };
    }
    const { ok, json, text, status } = await postJson(
      apiUrl,
      {
        ...(creds.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {}),
        ...(creds.token ? { 'X-Api-Key': creds.token } : {}),
      },
      {
        to: input.to,
        message: input.body,
        sender: input.senderId,
        dltTemplateId: input.dltTemplateId,
        idempotencyKey: input.idempotencyKey,
      },
    );
    const id =
      typeof json === 'object' && json && 'id' in json
        ? String((json as { id?: unknown }).id ?? '')
        : undefined;
    if (!ok) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: String(status),
        errorMessage: text.slice(0, 400),
        errorClass: status >= 500 ? 'TEMPORARY' : 'PERMANENT',
        raw: json,
      };
    }
    return {
      accepted: true,
      status: 'SUBMITTED',
      providerMessageId: id,
      raw: json,
    };
  },
  async sendBulkSms(messages, creds, apiUrl) {
    const out: SmsSendResult[] = [];
    for (const m of messages) out.push(await this.sendSms(m, creds, apiUrl));
    return out;
  },
};

export const apitxtProvider: SmsGatewayProvider = {
  id: 'APITXT',
  async validateConfiguration(creds) {
    return Boolean(creds.apiKey || creds.authkey);
  },
  getBalance() {
    return Promise.resolve({
      reachable: false,
      error:
        'Apitxt does not expose a credit-balance API. It is for login OTP only.',
    });
  },
  async sendSms(input, creds, apiUrl) {
    const otp = extractOtpCode(input.body);
    if (!otp) {
      return {
        accepted: false,
        status: 'FAILED',
        errorCode: 'OTP_ONLY',
        errorMessage:
          'Apitxt sendOTP is for login OTP. Use a 4–8 digit code in the message, or another gateway for bulk SMS.',
        errorClass: 'PERMANENT',
      };
    }
    return sendApitxtOtp({
      authkey: creds.apiKey || creds.authkey,
      mobile: input.to,
      otp,
      channel: creds.otpChannel || creds.channel || 'sms',
      templateId:
        creds.otpTemplateId ||
        creds.templateId ||
        input.dltTemplateId ||
        undefined,
      templateName: creds.otpTemplateName || creds.templateName,
      country: creds.otpCountry || creds.country || '91',
      projectRefId: creds.projectRefId,
      apiUrl: apiUrl || undefined,
    });
  },
  async sendBulkSms(messages, creds, apiUrl) {
    const out: SmsSendResult[] = [];
    for (const m of messages) out.push(await this.sendSms(m, creds, apiUrl));
    return out;
  },
};

export function resolveSmsProvider(id: string): SmsGatewayProvider {
  const key = id.toUpperCase();
  if (key === 'TWILIO') return twilioProvider;
  if (key === 'APITXT') return apitxtProvider;
  if (key === 'CUSTOM_HTTP' || key === 'CUSTOM_SMPP' || key === 'EXOTEL')
    return customHttpProvider;
  return msg91Provider;
}
