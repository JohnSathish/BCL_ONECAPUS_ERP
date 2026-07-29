import { NextResponse } from 'next/server';
import { cmsBase, cmsHeaders, safeTenant } from '@/lib/cms-client';
import { newsletterSchema, rateLimit, requestPayload } from '@/lib/forms';

export async function POST(request: Request) {
  const rate = rateLimit(request, 'newsletter', 8);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Please try later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const parsed = newsletterSchema.safeParse(await requestPayload(request));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Enter a valid email address.' },
      { status: 400 },
    );
  }

  const base = cmsBase();
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Newsletter service is not configured. Please try again later.',
      },
      { status: 503 },
    );
  }

  const url = new URL(`${base}/v1/website/public/newsletter`);
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
      body: JSON.stringify({ ...payload, source: 'FOOTER' }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    const result = (await response.json().catch(() => null)) as {
      message?: string;
      success?: boolean;
      data?: {
        id?: string;
        email?: string;
        status?: string;
        alreadySubscribed?: boolean;
      };
    } | null;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            result?.message ?? 'Subscription is temporarily unavailable. Please try again later.',
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const already = Boolean(result?.data?.alreadySubscribed);
    return NextResponse.json(
      {
        ok: true,
        status: 'accepted',
        id: result?.data?.id,
        alreadySubscribed: already,
        message: already
          ? 'You are already subscribed to our newsletter.'
          : 'Thank you for subscribing to our newsletter.',
      },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Subscription is temporarily unavailable. Please try again later.',
      },
      { status: 502 },
    );
  }
}
