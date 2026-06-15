import { createHmac, timingSafeEqual } from 'crypto';

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
};

export function isRazorpayConfigured(
  creds?: Partial<RazorpayCredentials> | null,
) {
  return Boolean(creds?.keyId?.trim() && creds?.keySecret?.trim());
}

export type RazorpayPaymentLink = {
  id: string;
  short_url: string;
  amount: number;
  status: string;
};

export type RazorpayQrCode = {
  id: string;
  image_url: string;
  payment_amount: number;
  status: string;
};

export async function createRazorpayPaymentLink(
  creds: RazorpayCredentials,
  payload: {
    amountPaise: number;
    description: string;
    referenceId: string;
    customer?: { name?: string; email?: string; contact?: string };
    expireByUnix?: number;
    notes?: Record<string, string>;
  },
): Promise<RazorpayPaymentLink> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString(
    'base64',
  );
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: payload.amountPaise,
      currency: 'INR',
      description: payload.description.slice(0, 255),
      reference_id: payload.referenceId.slice(0, 40),
      customer: payload.customer,
      expire_by: payload.expireByUnix,
      notes: payload.notes ?? {},
      notify: { sms: false, email: false },
    }),
  });
  const body = (await res.json()) as RazorpayPaymentLink & {
    error?: { description?: string };
  };
  if (!res.ok)
    throw new Error(
      body.error?.description ?? `Razorpay payment link failed (${res.status})`,
    );
  return body;
}

export async function createRazorpayUpiQr(
  creds: RazorpayCredentials,
  payload: {
    amountPaise: number;
    description: string;
    referenceId: string;
    closeByUnix: number;
    notes?: Record<string, string>;
  },
): Promise<RazorpayQrCode> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString(
    'base64',
  );
  const res = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'upi_qr',
      name: payload.description.slice(0, 64),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: payload.amountPaise,
      description: payload.description.slice(0, 255),
      customer_id: payload.referenceId.slice(0, 40),
      close_by: payload.closeByUnix,
      notes: payload.notes ?? {},
    }),
  });
  const body = (await res.json()) as RazorpayQrCode & {
    error?: { description?: string };
  };
  if (!res.ok)
    throw new Error(
      body.error?.description ?? `Razorpay QR failed (${res.status})`,
    );
  return body;
}

export async function createRazorpayOrder(
  creds: RazorpayCredentials,
  payload: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  },
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString(
    'base64',
  );
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: payload.amountPaise,
      currency: payload.currency ?? 'INR',
      receipt: payload.receipt.slice(0, 40),
      notes: payload.notes ?? {},
    }),
  });

  const body = (await res.json()) as RazorpayOrder & {
    error?: { description?: string };
  };
  if (!res.ok) {
    throw new Error(
      body.error?.description ?? `Razorpay order failed (${res.status})`,
    );
  }
  return body;
}

export function verifyRazorpayPaymentSignature(
  creds: RazorpayCredentials,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = createHmac('sha256', creds.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

export function verifyRazorpayWebhookSignature(
  creds: RazorpayCredentials,
  rawBody: string,
  signature: string,
) {
  const secret = creds.webhookSecret ?? creds.keySecret;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
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
