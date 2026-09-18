export type ApitxtSendResult = {
  accepted: boolean;
  providerMessageId?: string;
  status: 'SUBMITTED' | 'SENT' | 'FAILED' | 'REJECTED';
  errorCode?: string;
  errorMessage?: string;
  errorClass?: 'TEMPORARY' | 'PERMANENT';
  raw?: unknown;
};

export const APITXT_SEND_OTP_URL = 'https://apitxt.com/api/sendOTP';

export type ApitxtOtpInput = {
  authkey: string;
  mobile: string;
  otp: string;
  channel?: string;
  templateId?: string;
  templateName?: string;
  country?: string;
  projectRefId?: string;
  apiUrl?: string;
};

export function extractOtpCode(body: string) {
  const m = body.match(/\b(\d{4,8})\b/);
  return m?.[1] ?? null;
}

export function buildApitxtOtpUrl(input: ApitxtOtpInput) {
  const url = new URL(input.apiUrl || APITXT_SEND_OTP_URL);
  url.searchParams.set('authkey', input.authkey);
  url.searchParams.set('mobile', input.mobile);
  url.searchParams.set('otp', input.otp);
  const channel = (input.channel || 'sms').trim();
  if (channel && channel !== 'sms') url.searchParams.set('channel', channel);
  if (input.templateId) url.searchParams.set('template_id', input.templateId);
  if (input.templateName)
    url.searchParams.set('template_name', input.templateName);
  if (input.country) url.searchParams.set('country', input.country);
  if (input.projectRefId)
    url.searchParams.set('project_ref_id', input.projectRefId);
  return url;
}

export async function sendApitxtOtp(
  input: ApitxtOtpInput,
): Promise<ApitxtSendResult> {
  if (!input.authkey) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'NO_KEY',
      errorMessage: 'Apitxt authkey missing',
      errorClass: 'PERMANENT',
    };
  }
  if (!input.mobile || !input.otp) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'BAD_REQUEST',
      errorMessage: 'Mobile and OTP are required',
      errorClass: 'PERMANENT',
    };
  }
  const url = buildApitxtOtpUrl(input);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  const bag =
    json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const status = String(bag.status ?? '').toLowerCase();
  const data =
    bag.data && typeof bag.data === 'object'
      ? (bag.data as Record<string, unknown>)
      : {};
  const requestId = data.request_id ? String(data.request_id) : undefined;
  if (!res.ok || (status && status !== 'success')) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: String(res.status),
      errorMessage: String(bag.message ?? text).slice(0, 400),
      errorClass: res.status >= 500 ? 'TEMPORARY' : 'PERMANENT',
      raw: json,
    };
  }
  return {
    accepted: true,
    status: 'SUBMITTED',
    providerMessageId: requestId,
    raw: json,
  };
}
