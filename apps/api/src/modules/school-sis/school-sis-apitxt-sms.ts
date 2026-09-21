import type { ApitxtSendResult } from './school-sis-apitxt-otp';

export const APITXT_SEND_MSG_URL = 'https://apitxt.com/api/sendMsg';
export const APITXT_SEND_FLOW_URL = 'https://apitxt.com/api/sendFlow';

export type ApitxtSendMsgInput = {
  authkey: string;
  mobiles: string;
  message: string;
  sender: string;
  route?: string;
  templateId: string;
  peId: string;
  schtime?: string;
  flash?: string | number;
  unicode?: string | number;
  apiUrl?: string;
};

export function apitxtTenDigit(mobile: string) {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(-10);
  return digits.slice(-10);
}

export function buildApitxtSendMsgUrl(input: ApitxtSendMsgInput) {
  const url = new URL(input.apiUrl || APITXT_SEND_MSG_URL);
  const mobiles = String(input.mobiles || '')
    .split(/[,\s]+/)
    .map((m) => apitxtTenDigit(m))
    .filter((m) => m.length === 10)
    .join(',');
  url.searchParams.set('authkey', input.authkey);
  url.searchParams.set('mobiles', mobiles);
  url.searchParams.set('message', input.message);
  url.searchParams.set('sender', String(input.sender || '').toUpperCase());
  url.searchParams.set('route', String(input.route || '4'));
  url.searchParams.set('template_id', input.templateId);
  url.searchParams.set('pe_id', input.peId);
  if (input.schtime) url.searchParams.set('schtime', input.schtime);
  if (input.flash != null && String(input.flash) !== '') {
    url.searchParams.set('flash', String(input.flash));
  }
  if (input.unicode != null && String(input.unicode) !== '') {
    url.searchParams.set('unicode', String(input.unicode));
  }
  return url;
}

function bagOf(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== 'object') return {};
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : {};
  return { ...data, ...root };
}

export function isApitxtSendMsgSuccess(
  json: unknown,
  httpOk: boolean,
): boolean {
  const bag = bagOf(json);
  const status = bag.status;
  const message = String(bag.message ?? '').toLowerCase();
  if (
    status === 200 ||
    status === '200' ||
    String(status).toLowerCase() === 'success'
  ) {
    return true;
  }
  return httpOk && message === 'success';
}

export async function sendApitxtMsg(
  input: ApitxtSendMsgInput,
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
  const mobiles = String(input.mobiles || '')
    .split(/[,\s]+/)
    .map((m) => apitxtTenDigit(m))
    .filter((m) => m.length === 10);
  if (!mobiles.length) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'BAD_REQUEST',
      errorMessage: 'A 10-digit mobile number is required',
      errorClass: 'PERMANENT',
    };
  }
  if (!input.message?.trim()) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'BAD_REQUEST',
      errorMessage: 'Message body is required',
      errorClass: 'PERMANENT',
    };
  }
  const sender = String(input.sender || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{6}$/.test(sender)) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'BAD_SENDER',
      errorMessage: 'Sender ID must be 6 uppercase letters (DLT header).',
      errorClass: 'PERMANENT',
    };
  }
  if (!input.templateId) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'NO_TEMPLATE',
      errorMessage: 'Approved DLT template_id is required',
      errorClass: 'PERMANENT',
    };
  }
  if (!input.peId) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'NO_PE',
      errorMessage: 'Principal Entity ID (pe_id) is required',
      errorClass: 'PERMANENT',
    };
  }
  const url = buildApitxtSendMsgUrl({ ...input, mobiles: mobiles.join(',') });
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
  const bag = bagOf(json);
  const requestId = bag.request_id ? String(bag.request_id) : undefined;
  if (!isApitxtSendMsgSuccess(json, res.ok)) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: String(bag.status ?? res.status),
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

export type ApitxtFlowRecipient = {
  mobiles: string;
  variables?: Record<string, string>;
};

export type ApitxtSendFlowInput = {
  authkey: string;
  templateId: string;
  route?: string;
  recipients: ApitxtFlowRecipient[];
  schtime?: string;
  flash?: string | number;
  apiUrl?: string;
};

export function apitxtFlowVariables(
  vars: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value == null || value === '') continue;
    out[key] = String(value);
  }
  if (!out.name) {
    const name = out.parent_name || out.student_name || out.parentName;
    if (name) out.name = name;
  }
  if (!out.class && out.class_name) out.class = out.class_name;
  if (!out.student && out.student_name) out.student = out.student_name;
  if (!out.parent && out.parent_name) out.parent = out.parent_name;
  return out;
}

export function buildApitxtFlowPayload(input: ApitxtSendFlowInput) {
  const recipients = input.recipients
    .map((r) => {
      const mobiles = apitxtTenDigit(r.mobiles);
      if (mobiles.length < 10) return null;
      const variables = apitxtFlowVariables(r.variables ?? {});
      return {
        mobiles,
        ...(Object.keys(variables).length ? { variables } : {}),
      };
    })
    .filter(
      (row): row is { mobiles: string; variables?: Record<string, string> } =>
        Boolean(row),
    );
  const payload: Record<string, unknown> = {
    authkey: input.authkey,
    template_id: input.templateId,
    route: String(input.route || '4'),
    recipients,
  };
  if (input.schtime) payload.schtime = input.schtime;
  if (input.flash != null && String(input.flash) !== '') {
    payload.flash = Number(input.flash);
  }
  return payload;
}

export async function sendApitxtFlow(
  input: ApitxtSendFlowInput,
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
  if (!input.templateId) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'NO_TEMPLATE',
      errorMessage: 'Approved DLT template_id is required for sendFlow',
      errorClass: 'PERMANENT',
    };
  }
  const payload = buildApitxtFlowPayload(input);
  const recipients = payload.recipients as unknown[];
  if (!recipients.length) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: 'BAD_REQUEST',
      errorMessage: 'A 10-digit mobile number is required',
      errorClass: 'PERMANENT',
    };
  }
  const url = input.apiUrl || APITXT_SEND_FLOW_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }
  const bag = bagOf(json);
  const requestId = bag.request_id ? String(bag.request_id) : undefined;
  if (!isApitxtSendMsgSuccess(json, res.ok)) {
    return {
      accepted: false,
      status: 'FAILED',
      errorCode: String(bag.status ?? res.status),
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
