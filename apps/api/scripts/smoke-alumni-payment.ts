/**
 * Smoke test: alumni portal info + demo payment → receipt PDF.
 * Usage: npx tsx scripts/smoke-alumni-payment.ts
 */
import { PrismaClient } from '@prisma/client';

const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';
const HOST = process.env.ALUMNI_HOST ?? 'alumni.demo.localhost';

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Login-Host': HOST,
      'X-Forwarded-Host': HOST,
      ...(init?.headers ?? {}),
    },
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: buf, headers: res.headers, ok: res.ok };
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  // Nest interceptor wraps payloads as { success, data }
  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    (body as { success?: boolean }).success === true
  ) {
    body = (body as { data: unknown }).data;
  }
  return { status: res.status, body, headers: res.headers, ok: res.ok };
}

async function main() {
  const prisma = new PrismaClient();
  const checks: string[] = [];

  try {
    const info = await req('/v1/alumni/portal/info');
    if (!info.ok)
      throw new Error(
        `info failed: ${info.status} ${JSON.stringify(info.body)}`,
      );
    checks.push('✓ portal info');

    const email = `alumni.smoke.${Date.now()}@example.com`;
    const types = (info.body as { membershipTypes?: Array<{ id: string }> })
      .membershipTypes;
    const membershipTypeId = types?.[0]?.id;
    if (!membershipTypeId) throw new Error('No membership types');

    const register = await req('/v1/alumni/portal/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Smoke Test Alumni',
        email,
        phone: '9999999999',
        gender: 'Male',
        department: 'Computer Science',
        graduationYear: 2020,
        membershipTypeId,
        certifyTrue: true,
        agreeCommunications: true,
        state: 'Meghalaya',
        country: 'India',
      }),
    });
    if (!register.ok) {
      throw new Error(
        `register failed: ${register.status} ${JSON.stringify(register.body)}`,
      );
    }
    const reg = register.body as {
      id: string;
      payment: { id: string; paymentToken: string; amountInr: number } | null;
    };
    if (!reg.payment?.id || !reg.payment.paymentToken) {
      throw new Error('register did not return payment handshake');
    }
    checks.push(`✓ register + payment (${reg.payment.amountInr})`);

    const initiate = await req('/v1/alumni/portal/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({
        alumniId: reg.id,
        paymentId: reg.payment.id,
        paymentToken: reg.payment.paymentToken,
        forceDemo: true,
      }),
    });
    if (!initiate.ok) {
      throw new Error(
        `initiate failed: ${initiate.status} ${JSON.stringify(initiate.body)}`,
      );
    }
    const initBody = initiate.body as {
      demo?: boolean;
      checkout?: { mode?: string };
    };
    if (!initBody.demo && initBody.checkout?.mode !== 'SAFE_MOCK') {
      throw new Error(
        `expected demo checkout, got ${JSON.stringify(initBody)}`,
      );
    }
    checks.push('✓ demo initiate (SAFE_MOCK)');

    const confirm = await req('/v1/alumni/portal/payments/confirm-mock', {
      method: 'POST',
      body: JSON.stringify({
        alumniId: reg.id,
        paymentId: reg.payment.id,
        paymentToken: reg.payment.paymentToken,
      }),
    });
    if (!confirm.ok) {
      throw new Error(
        `confirm-mock failed: ${confirm.status} ${JSON.stringify(confirm.body)}`,
      );
    }
    checks.push('✓ confirm demo payment');

    const status = await req(
      `/v1/alumni/portal/payments/status?alumniId=${reg.id}&paymentId=${reg.payment.id}&paymentToken=${reg.payment.paymentToken}`,
    );
    if (!status.ok) throw new Error(`status failed: ${status.status}`);
    const st = status.body as {
      payment: { status: string; receiptNumber: string | null };
      canDownloadReceipt: boolean;
    };
    if (st.payment.status !== 'PAID' || !st.canDownloadReceipt) {
      throw new Error(`expected PAID+receipt, got ${JSON.stringify(st)}`);
    }
    checks.push(`✓ paid status (${st.payment.receiptNumber})`);

    const receipt = await req(
      `/v1/alumni/portal/payments/receipt.pdf?alumniId=${reg.id}&paymentId=${reg.payment.id}&paymentToken=${reg.payment.paymentToken}`,
    );
    if (!receipt.ok) {
      throw new Error(`receipt.pdf failed: ${receipt.status}`);
    }
    const ctype = receipt.headers.get('content-type') ?? '';
    if (!ctype.includes('application/pdf')) {
      throw new Error(`expected PDF content-type, got ${ctype}`);
    }
    const pdfLen = Buffer.isBuffer(receipt.body)
      ? receipt.body.length
      : Buffer.byteLength(String(receipt.body));
    if (pdfLen < 500) throw new Error(`PDF too small (${pdfLen})`);
    if (
      Buffer.isBuffer(receipt.body) &&
      receipt.body.subarray(0, 4).toString() !== '%PDF'
    ) {
      throw new Error('PDF magic header missing');
    }
    checks.push(`✓ receipt PDF (${pdfLen} bytes)`);

    // Activate via prisma (admin auth not needed for smoke) then verify card PDF generation path exists.
    const year = new Date().getFullYear();
    const membershipNumber = `ALU-SMOKE-${year}-${String(Date.now()).slice(-4)}`;
    await prisma.alumniProfile.update({
      where: { id: reg.id },
      data: {
        status: 'ACTIVE',
        membershipNumber,
        activatedAt: new Date(),
      },
    });
    const membership = await prisma.alumniMembership.findFirst({
      where: { alumniId: reg.id },
    });
    if (membership) {
      await prisma.alumniMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', startsAt: new Date() },
      });
    }
    checks.push(`✓ activate membership (${membershipNumber})`);

    const card = await req(
      `/v1/alumni/portal/membership-card.pdf?alumniId=${reg.id}&paymentId=${reg.payment.id}&paymentToken=${reg.payment.paymentToken}`,
    );
    if (!card.ok) throw new Error(`membership-card.pdf failed: ${card.status}`);
    const cardType = card.headers.get('content-type') ?? '';
    if (!cardType.includes('application/pdf')) {
      throw new Error(`expected card PDF, got ${cardType}`);
    }
    const cardLen = Buffer.isBuffer(card.body) ? card.body.length : 0;
    if (cardLen < 400) throw new Error(`card PDF too small (${cardLen})`);
    checks.push(`✓ membership card PDF (${cardLen} bytes)`);

    // Cleanup smoke alumni (best-effort)
    await prisma.alumniPayment.deleteMany({ where: { alumniId: reg.id } });
    await prisma.alumniMembership.deleteMany({ where: { alumniId: reg.id } });
    await prisma.alumniProfile.deleteMany({ where: { id: reg.id } });
    checks.push('✓ cleanup');

    console.log('\nAlumni smoke test PASSED\n');
    for (const c of checks) console.log(c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nAlumni smoke test FAILED\n', e);
  process.exit(1);
});
