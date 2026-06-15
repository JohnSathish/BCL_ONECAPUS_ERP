/**
 * End-to-end admissions smoke test (register → form → payment → submit → admin review).
 * Run: npx tsx scripts/smoke-admissions-flow.ts
 *
 * Env (optional, from apps/api/.env or shell):
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET — enable online payment paths
 *   RAZORPAY_WEBHOOK_SECRET — used for webhook signature when SMOKE_USE_WEBHOOK=1
 *   SMOKE_USE_WEBHOOK=1 — exercise POST /payment/webhook instead of /payment/verify
 */
import { createHmac } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const WEB = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
const HOST = process.env.ADMISSIONS_HOST ?? 'admissions.demo.localhost';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
const SMOKE_USE_WEBHOOK = process.env.SMOKE_USE_WEBHOOK === '1';

const portalHeaders = {
  'Content-Type': 'application/json',
  Host: `${HOST}:3000`,
  'X-Forwarded-Host': HOST,
  'X-Login-Host': HOST,
};

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${WEB}/api${path}`, {
    method,
    headers: {
      ...portalHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  const envelope = data as { success?: boolean; data?: T };
  if (
    envelope &&
    typeof envelope === 'object' &&
    envelope.success &&
    'data' in envelope
  ) {
    return envelope.data as T;
  }
  return data as T;
}

async function reqExpectFail(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<string> {
  const res = await fetch(`${WEB}/api${path}`, {
    method,
    headers: {
      ...portalHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return text.slice(0, 300);
  }
  const payload = data as { message?: string; data?: { message?: string } };
  return (
    payload.message ??
    payload.data?.message ??
    JSON.stringify(data).slice(0, 300)
  );
}

async function postWebhook(rawBody: string, signature: string) {
  const res = await fetch(`${WEB}/api/v1/admissions/portal/payment/webhook`, {
    method: 'POST',
    headers: {
      ...portalHeaders,
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`webhook → ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(
      `webhook → ${res.status}: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  const envelope = data as { success?: boolean; data?: unknown };
  if (
    envelope &&
    typeof envelope === 'object' &&
    envelope.success &&
    'data' in envelope
  ) {
    return envelope.data;
  }
  return data;
}

async function adminLogin(): Promise<string> {
  const challenge = await req<{ token: string; expression: string }>(
    'GET',
    '/v1/auth/challenge',
  );
  const answer = evalMath(challenge.expression);
  const session = await req<{ accessToken: string }>('POST', '/v1/auth/login', {
    email: 'admin@demo.edu',
    password: 'Admin@123',
    challengeToken: challenge.token,
    challengeAnswer: answer,
  });
  return session.accessToken;
}

function evalMath(expression: string): number {
  const normalized = expression.replace('×', '*').trim();
  if (!/^[\d\s+\-*/().]+$/.test(normalized)) {
    throw new Error(`Unexpected challenge expression: ${expression}`);
  }
  return Math.trunc(
    Function(`"use strict"; return (${normalized});`)() as number,
  );
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function uploadDoc(token: string, slotCode: string) {
  const form = new FormData();
  form.append('slotCode', slotCode);
  form.append(
    'file',
    new Blob([PNG_1X1], { type: 'image/png' }),
    `${slotCode}.png`,
  );

  const { 'Content-Type': _omit, ...headers } = portalHeaders;
  const res = await fetch(`${WEB}/api/v1/admissions/portal/documents/upload`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `upload ${slotCode} → ${res.status}: ${text.slice(0, 200)}`,
    );
  }
}

function webhookSignature(rawBody: string) {
  const secret = RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const email = `applicant.smoke.${stamp}@example.com`;

  console.log('1. Portal info…');
  const info = await req<{
    isOpen: boolean;
    branding?: { displayName: string };
  }>('GET', '/v1/admissions/portal/info');
  console.log('   isOpen:', info.isOpen, '|', info.branding?.displayName);

  console.log('2. Register applicant…');
  const reg = await req<{
    applicationNumber: string;
    generatedPassword?: string;
  }>('POST', '/v1/admissions/portal/register', {
    fullName: 'SMOKE TEST',
    email,
    phone: '9876543210',
    dateOfBirth: '2006-01-15',
    gender: 'MALE',
    acceptedPolicies: true,
    password: 'SmokeTest1!',
  });
  console.log('   app#:', reg.applicationNumber);

  console.log('3. Applicant login…');
  const session = await req<{
    accessToken: string;
    user: { roles: string[] };
  }>('POST', '/v1/admissions/portal/login', {
    applicationNumber: reg.applicationNumber,
    password: 'SmokeTest1!',
  });
  const token = session.accessToken;
  console.log('   roles:', session.user.roles.join(', '));

  console.log('4. Save form draft (complete)…');
  await req(
    'PATCH',
    '/v1/admissions/portal/form/save-draft',
    {
      currentStep: 7,
      progressPercent: 100,
      formData: {
        personal: {
          fullName: 'SMOKE TEST',
          gender: 'MALE',
          category: 'GENERAL',
          dateOfBirth: '2006-01-15',
          email,
          mobile: '9876543210',
        },
        addresses: {
          presentAddress: 'Tura, Meghalaya',
          permanentAddress: 'Tura, Meghalaya',
          state: 'Meghalaya',
          pincode: '794001',
        },
        family: {
          fatherName: 'Test Father',
          motherName: 'Test Mother',
          guardianPhone: '9876543211',
        },
        academic: {
          schoolName: 'Don Bosco HS School',
          class12Board: 'MBOSE',
          boardStream: 'SCIENCE',
          class12Percentage: 78.5,
        },
        declaration: { agreed: true },
      },
    },
    token,
  );

  console.log('5. Fetch applicant me…');
  const me = await req<{
    application: {
      progressPercent: number;
      currentStep: number;
      status: string;
    };
    catalogContext?: { programName: string } | null;
  }>('GET', '/v1/admissions/portal/me', undefined, token);
  console.log(
    '   progress:',
    me.application.progressPercent,
    '| step:',
    me.application.currentStep,
    '| program:',
    me.catalogContext?.programName ?? '—',
  );

  console.log('6. Upload required documents…');
  for (const slot of ['PHOTO', 'STD10', 'STD12'] as const) {
    await uploadDoc(token, slot);
    console.log('   uploaded:', slot);
  }

  console.log('7. Submit without payment (expect blocked)…');
  const blockedMsg = await reqExpectFail(
    'POST',
    '/v1/admissions/portal/form/submit',
    undefined,
    token,
  );
  if (!blockedMsg.toLowerCase().includes('fee')) {
    throw new Error(`Expected fee gate, got: ${blockedMsg}`);
  }
  console.log('   blocked:', blockedMsg.slice(0, 80));

  console.log('8. Application fee payment…');
  const payInfo = await req<{
    configured: boolean;
    canPay: boolean;
    paymentStatus: string;
    applicationFee: number;
  }>('GET', '/v1/admissions/portal/payment/info', undefined, token);

  let paidOnline = false;
  let adminToken: string | undefined;

  if (payInfo.configured && payInfo.canPay && RAZORPAY_KEY_SECRET) {
    const order = await req<{
      configured: boolean;
      orderId?: string;
      amount?: number;
    }>('POST', '/v1/admissions/portal/payment/create-order', undefined, token);

    if (order.configured && order.orderId) {
      const paymentId = `pay_smoke_${stamp}`;

      if (SMOKE_USE_WEBHOOK) {
        const rawBody = JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: paymentId,
                order_id: order.orderId,
                amount: order.amount ?? payInfo.applicationFee * 100,
                status: 'captured',
              },
            },
          },
        });
        const signature = webhookSignature(rawBody);
        const webhookResult = (await postWebhook(rawBody, signature)) as {
          handled?: boolean;
          applicationId?: string;
        };
        if (!webhookResult.handled) {
          throw new Error('Webhook did not mark payment as handled');
        }
        console.log(
          '   Razorpay webhook handled:',
          webhookResult.applicationId,
        );
      } else {
        const signature = createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(`${order.orderId}|${paymentId}`)
          .digest('hex');

        const verified = await req<{
          success: boolean;
          paymentStatus: string;
          amountPaid: number;
        }>(
          'POST',
          '/v1/admissions/portal/payment/verify',
          {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          },
          token,
        );

        console.log(
          '   Razorpay verify:',
          verified.paymentStatus,
          '| ₹',
          verified.amountPaid,
        );
      }

      const afterPay = await req<{ paymentStatus: string }>(
        'GET',
        '/v1/admissions/portal/payment/info',
        undefined,
        token,
      );
      paidOnline = afterPay.paymentStatus === 'PAID';
      if (!paidOnline)
        throw new Error('Payment status still not PAID after online flow');
    }
  } else {
    console.log('   Razorpay skipped — using admin mark before submit');
    adminToken = await adminLogin();
    const appsEarly = await req<{
      data: { id: string; applicationNumber: string }[];
    }>(
      'GET',
      `/v1/admissions/applications?search=${encodeURIComponent(reg.applicationNumber)}&limit=5`,
      undefined,
      adminToken,
    );
    const earlyApp = appsEarly.data[0];
    if (!earlyApp)
      throw new Error('Application not found for early payment mark');
    await req(
      'PATCH',
      `/v1/admissions/admin/applications/${earlyApp.id}/payment`,
      { status: 'PAID', paymentReference: `SMOKE-${stamp}`, amountPaid: 600 },
      adminToken,
    );
    console.log('   admin marked PAID before submit');
  }

  console.log('9. Submit application (after payment)…');
  await req('POST', '/v1/admissions/portal/form/submit', undefined, token);
  console.log('   submitted');

  if (!adminToken) {
    console.log('10. Admin login…');
    adminToken = await adminLogin();
  } else {
    console.log('10. Admin session (reused)…');
  }

  console.log('11. List applications…');
  const apps = await req<{
    data: {
      id: string;
      applicationNumber: string;
      status: string;
      paymentStatus?: string;
      paymentReference?: string | null;
      amountPaid?: number | string | null;
      formData?: Record<string, unknown>;
    }[];
  }>(
    'GET',
    `/v1/admissions/applications?search=${encodeURIComponent(reg.applicationNumber)}&limit=5`,
    undefined,
    adminToken,
  );
  const app = apps.data[0];
  if (!app) throw new Error('Application not found in admin list');
  console.log(
    '   found:',
    app.applicationNumber,
    app.status,
    '| payment:',
    app.paymentStatus,
  );

  if (paidOnline) {
    const paymentMeta = (app.formData?.payment ?? {}) as {
      razorpayOrderId?: string;
    };
    console.log(
      '   Razorpay refs — order:',
      paymentMeta.razorpayOrderId ?? '—',
      '| payment:',
      app.paymentReference ?? '—',
    );
  }

  console.log('12. Documents + audit…');
  const docs = await req<
    { id: string; slotCode: string; verificationStatus: string }[]
  >(
    'GET',
    `/v1/admissions/admin/applications/${app.id}/documents`,
    undefined,
    adminToken,
  );
  console.log('   documents:', docs.length);

  const audit = await req<{ action: string }[]>(
    'GET',
    `/v1/admissions/admin/audit/application/${app.id}`,
    undefined,
    adminToken,
  );
  console.log('   audit entries:', audit.length);

  console.log('\nSmoke test complete.');
  console.log(`Applicant: ${reg.applicationNumber} / SmokeTest1!`);
  console.log(`Portal: http://${HOST}:3000/admissions-portal/login`);
  console.log(`Admin: http://demo.localhost:3000/admin/admissions`);
  if (SMOKE_USE_WEBHOOK) {
    console.log('Payment path: Razorpay webhook');
  } else if (paidOnline) {
    console.log('Payment path: Razorpay verify');
  } else {
    console.log('Payment path: admin manual');
  }
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e.message);
  process.exit(1);
});
