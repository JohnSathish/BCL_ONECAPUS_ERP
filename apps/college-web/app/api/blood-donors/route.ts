import { NextResponse } from 'next/server';
import { cmsBase, cmsHeaders, safeTenant } from '@/lib/cms-client';
import { bloodDonorSchema, rateLimit, requestPayload } from '@/lib/forms';

export async function POST(request: Request) {
  const rate = rateLimit(request, 'blood-donor', 4);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const parsed = bloodDonorSchema.safeParse(await requestPayload(request));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Please check the highlighted information.',
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const base = cmsBase();
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Registration service is not configured. Please try again later.',
      },
      { status: 503 },
    );
  }

  const url = new URL(`${base}/v1/website/public/blood-donors`);
  const tenant = safeTenant();
  if (tenant) url.searchParams.set('tenant', tenant);

  const { company: _honeypot, ...payload } = parsed.data;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...cmsHeaders(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    const result = (await response.json().catch(() => null)) as {
      message?: string;
      data?: { id?: string; status?: string };
      success?: boolean;
    } | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            result?.message ?? 'Registration is temporarily unavailable. Please try again later.',
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'accepted',
        id: result && 'data' in result ? result.data?.id : undefined,
        message: 'Registration accepted. We will contact you when your blood group is needed.',
      },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Registration is temporarily unavailable. Please try again later.',
      },
      { status: 502 },
    );
  }
}
