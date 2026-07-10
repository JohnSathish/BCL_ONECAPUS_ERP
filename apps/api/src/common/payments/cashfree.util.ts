import { createHmac, timingSafeEqual } from 'crypto';

const API_VERSION = '2023-08-01';

export type CashfreeCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  mode?: 'TEST' | 'LIVE';
};

export type CashfreeOrder = {
  order_id: string;
  cf_order_id?: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
};

export type CashfreePayment = {
  cf_payment_id: string;
  payment_status: string;
  order_id?: string;
};

function cashfreeBaseUrl(mode?: 'TEST' | 'LIVE') {
  return mode === 'LIVE'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function cashfreeHeaders(creds: CashfreeCredentials) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-version': API_VERSION,
    'x-client-id': creds.keyId,
    'x-client-secret': creds.keySecret,
  };
}

export function isCashfreeConfigured(
  creds?: Partial<CashfreeCredentials> | null,
) {
  return Boolean(creds?.keyId?.trim() && creds?.keySecret?.trim());
}

export async function createCashfreeOrder(
  creds: CashfreeCredentials,
  payload: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
    returnUrl?: string;
    notifyUrl?: string;
  },
): Promise<CashfreeOrder> {
  const customerId =
    payload.notes?.studentId?.slice(0, 50) ??
    payload.receipt.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  const body: Record<string, unknown> = {
    order_amount: Number((payload.amountPaise / 100).toFixed(2)),
    order_currency: payload.currency ?? 'INR',
    order_id: payload.receipt.slice(0, 45),
    customer_details: {
      customer_id: customerId || `cust-${Date.now()}`,
      customer_phone: '9999999999',
    },
    order_note: payload.notes?.paymentId
      ? `payment:${payload.notes.paymentId}`
      : undefined,
  };
  if (payload.returnUrl || payload.notifyUrl) {
    body.order_meta = {
      ...(payload.returnUrl ? { return_url: payload.returnUrl } : {}),
      ...(payload.notifyUrl ? { notify_url: payload.notifyUrl } : {}),
    };
  }

  const res = await fetch(`${cashfreeBaseUrl(creds.mode)}/orders`, {
    method: 'POST',
    headers: cashfreeHeaders(creds),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CashfreeOrder & {
    message?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? `Cashfree order failed (${res.status})`);
  }
  return data;
}

export async function fetchCashfreeOrder(
  creds: CashfreeCredentials,
  orderId: string,
): Promise<CashfreeOrder> {
  const res = await fetch(
    `${cashfreeBaseUrl(creds.mode)}/orders/${encodeURIComponent(orderId)}`,
    { headers: cashfreeHeaders(creds) },
  );
  const data = (await res.json()) as CashfreeOrder & { message?: string };
  if (!res.ok) {
    throw new Error(
      data.message ?? `Cashfree order fetch failed (${res.status})`,
    );
  }
  return data;
}

export async function fetchCashfreeOrderPayments(
  creds: CashfreeCredentials,
  orderId: string,
): Promise<CashfreePayment[]> {
  const res = await fetch(
    `${cashfreeBaseUrl(creds.mode)}/orders/${encodeURIComponent(orderId)}/payments`,
    { headers: cashfreeHeaders(creds) },
  );
  const data = (await res.json()) as CashfreePayment[] | { message?: string };
  if (!res.ok) {
    const msg =
      !Array.isArray(data) && data.message
        ? data.message
        : `Cashfree payments fetch failed (${res.status})`;
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export function verifyCashfreePaymentSignature(
  creds: CashfreeCredentials,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = createHmac('sha256', creds.keySecret)
    .update(`${orderId}${paymentId}`)
    .digest('base64');
  return safeEqual(expected, signature);
}

export function verifyCashfreeWebhookSignature(
  creds: CashfreeCredentials,
  rawBody: string,
  signature: string,
  timestamp?: string,
) {
  const secret = creds.webhookSecret ?? creds.keySecret;
  const signedPayload = timestamp ? `${timestamp}${rawBody}` : rawBody;
  const expected = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64');
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string) {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
