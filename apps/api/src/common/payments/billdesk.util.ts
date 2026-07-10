import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';

export type BilldeskCredentials = {
  merchantId: string;
  clientId: string;
  signingKey: string;
  encryptionKey?: string;
  signingKeyId?: string;
  encryptionKeyId?: string;
  returnUrl?: string;
  mode?: 'TEST' | 'LIVE';
};

export type BilldeskOrderResponse = {
  objectid?: string;
  orderid: string;
  bdorderid?: string;
  mercid?: string;
  amount?: string;
  currency?: string;
  order_date?: string;
  next_step?: string;
  links?: Array<{
    rel?: string;
    href?: string;
    method?: string;
    headers?: { authorization?: string };
    parameters?: Record<string, string>;
  }>;
};

export type BilldeskTransactionPayload = {
  orderid?: string;
  transactionid?: string;
  transaction_error_type?: string;
  auth_status?: string;
  amount?: string;
  mercid?: string;
};

function billdeskBaseUrl(mode?: 'TEST' | 'LIVE') {
  return mode === 'LIVE'
    ? 'https://api.billdesk.com'
    : 'https://uat1.billdesk.com/u2';
}

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64url');
}

function fromBase64url(input: string) {
  return Buffer.from(input, 'base64url');
}

function deriveAes256Key(secret: string) {
  const trimmed = secret.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  const buf = Buffer.from(trimmed, 'utf8');
  if (buf.length === 32) return buf;
  return createHash('sha256').update(buf).digest();
}

function createJweDirA256Gcm(
  plaintext: string,
  encryptionKey: string,
  keyId: string,
  clientId: string,
) {
  const key = deriveAes256Key(encryptionKey);
  const header = {
    alg: 'dir',
    enc: 'A256GCM',
    kid: keyId,
    clientid: clientId,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${encodedHeader}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;
}

function decryptJweDirA256Gcm(
  compactJwe: string,
  encryptionKey: string,
): string {
  const parts = compactJwe.split('.');
  if (parts.length !== 5) {
    throw new Error('Invalid BillDesk JWE payload.');
  }
  const key = deriveAes256Key(encryptionKey);
  const iv = fromBase64url(parts[2]);
  const ciphertext = fromBase64url(parts[3]);
  const tag = fromBase64url(parts[4]);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

function createJwsHs256(
  payload: string,
  signingKey: string,
  keyId: string,
  clientId: string,
) {
  const header = { alg: 'HS256', kid: keyId, clientid: clientId };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', signingKey)
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64url(signature)}`;
}

function verifyJwsHs256(
  compactJws: string,
  signingKey: string,
  clientId: string,
): { valid: boolean; payload?: string } {
  const parts = compactJws.split('.');
  if (parts.length !== 3) return { valid: false };
  try {
    const header = JSON.parse(fromBase64url(parts[0]).toString('utf8')) as {
      alg?: string;
      clientid?: string;
    };
    if (header.alg !== 'HS256') return { valid: false };
    if (header.clientid && header.clientid !== clientId)
      return { valid: false };
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = createHmac('sha256', signingKey)
      .update(signingInput)
      .digest();
    const actual = fromBase64url(parts[2]);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return { valid: false };
    }
    const payload = fromBase64url(parts[1]).toString('utf8');
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function unwrapBilldeskJoseResponse(
  creds: BilldeskCredentials,
  body: string,
): BilldeskOrderResponse | BilldeskTransactionPayload {
  const signingKey = creds.signingKey;
  const encryptionKey = creds.encryptionKey ?? creds.signingKey;
  const verified = verifyJwsHs256(body.trim(), signingKey, creds.clientId);
  if (!verified.valid || !verified.payload) {
    throw new Error('Invalid BillDesk response signature.');
  }
  const inner = verified.payload.includes('.')
    ? decryptJweDirA256Gcm(verified.payload, encryptionKey)
    : verified.payload;
  return JSON.parse(inner) as BilldeskOrderResponse;
}

function billdeskTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = '+05:30';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`;
}

export function isBilldeskConfigured(
  creds?: Partial<BilldeskCredentials> | null,
) {
  return Boolean(
    creds?.merchantId?.trim() &&
    creds?.clientId?.trim() &&
    creds?.signingKey?.trim(),
  );
}

export function toBilldeskCredentials(input: {
  merchantId?: string | null;
  keyId: string;
  keySecret: string;
  webhookSecret?: string | null;
  successUrl?: string | null;
  mode?: 'TEST' | 'LIVE';
}): BilldeskCredentials | null {
  if (
    !input.merchantId?.trim() ||
    !input.keyId?.trim() ||
    !input.keySecret?.trim()
  ) {
    return null;
  }
  return {
    merchantId: input.merchantId.trim(),
    clientId: input.keyId.trim(),
    signingKey: input.keySecret.trim(),
    encryptionKey: input.webhookSecret?.trim() || input.keySecret.trim(),
    signingKeyId: input.keyId.trim(),
    encryptionKeyId: input.keyId.trim(),
    returnUrl: input.successUrl ?? undefined,
    mode: input.mode,
  };
}

async function billdeskApiRequest(
  creds: BilldeskCredentials,
  path: string,
  payload: Record<string, unknown>,
): Promise<BilldeskOrderResponse> {
  const encryptionKey = creds.encryptionKey ?? creds.signingKey;
  const encKeyId = creds.encryptionKeyId ?? creds.clientId;
  const signKeyId = creds.signingKeyId ?? creds.clientId;
  const jwe = createJweDirA256Gcm(
    JSON.stringify(payload),
    encryptionKey,
    encKeyId,
    creds.clientId,
  );
  const jws = createJwsHs256(jwe, creds.signingKey, signKeyId, creds.clientId);
  const traceId = randomUUID().replace(/-/g, '').slice(0, 20);

  const res = await fetch(`${billdeskBaseUrl(creds.mode)}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/jose',
      Accept: 'application/jose',
      'BD-Traceid': traceId,
      'BD-Timestamp': billdeskTimestamp(),
    },
    body: jws,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text?.slice(0, 240) || `BillDesk request failed (${res.status})`,
    );
  }
  return unwrapBilldeskJoseResponse(creds, text) as BilldeskOrderResponse;
}

export async function createBilldeskOrder(
  creds: BilldeskCredentials,
  payload: {
    orderId: string;
    amount: number;
    currency?: string;
    returnUrl?: string;
    notes?: Record<string, string>;
  },
): Promise<BilldeskOrderResponse> {
  const ru =
    payload.returnUrl ??
    creds.returnUrl ??
    'https://example.com/payments/return';
  const body: Record<string, unknown> = {
    mercid: creds.merchantId,
    orderid: payload.orderId.slice(0, 40),
    amount: payload.amount.toFixed(2),
    order_date: billdeskTimestamp(),
    currency: payload.currency ?? '356',
    ru,
    itemcode: 'DIRECT',
    device: {
      init_channel: 'internet',
      ip: '127.0.0.1',
      user_agent: 'OneCampusERP/1.0',
      accept_header: 'application/json',
    },
    additional_info: {
      additional_info1: payload.notes?.studentId?.slice(0, 64) ?? 'NA',
      additional_info2: payload.notes?.paymentId?.slice(0, 64) ?? 'NA',
    },
  };
  return billdeskApiRequest(creds, '/payments/ve1_2/orders/create', body);
}

export async function retrieveBilldeskOrder(
  creds: BilldeskCredentials,
  orderId: string,
): Promise<BilldeskOrderResponse> {
  return billdeskApiRequest(creds, '/payments/ve1_2/orders/get', {
    mercid: creds.merchantId,
    orderid: orderId,
  });
}

export function extractBilldeskCheckout(order: BilldeskOrderResponse): {
  checkoutUrl?: string;
  authToken?: string;
  bdOrderId?: string;
} {
  const redirect = order.links?.find((l) => l.rel === 'redirect');
  const authToken = redirect?.headers?.authorization;
  return {
    checkoutUrl: redirect?.href,
    authToken,
    bdOrderId: order.bdorderid,
  };
}

export function verifyBilldeskWebhook(
  creds: BilldeskCredentials,
  rawBody: string,
): { valid: boolean; payload?: BilldeskTransactionPayload } {
  const verified = verifyJwsHs256(
    rawBody.trim(),
    creds.signingKey,
    creds.clientId,
  );
  if (!verified.valid || !verified.payload) {
    return { valid: false };
  }
  try {
    const encryptionKey = creds.encryptionKey ?? creds.signingKey;
    const inner = verified.payload.includes('.')
      ? decryptJweDirA256Gcm(verified.payload, encryptionKey)
      : verified.payload;
    return {
      valid: true,
      payload: JSON.parse(inner) as BilldeskTransactionPayload,
    };
  } catch {
    return { valid: false };
  }
}

export function verifyBilldeskPaymentReturn(
  creds: BilldeskCredentials,
  signature: string,
  expectedOrderId: string,
) {
  const result = verifyBilldeskWebhook(creds, signature);
  if (!result.valid || !result.payload) return false;
  const ok =
    result.payload.transaction_error_type === 'success' ||
    result.payload.auth_status === '0300';
  return ok && String(result.payload.orderid ?? '') === expectedOrderId;
}
