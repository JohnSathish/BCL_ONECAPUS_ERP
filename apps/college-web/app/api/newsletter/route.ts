import { NextResponse } from 'next/server';
import { deliverForm, newsletterSchema, rateLimit, requestPayload } from '@/lib/forms';

export async function POST(request: Request) {
  const rate = rateLimit(request, 'newsletter', 8);
  if (!rate.allowed)
    return NextResponse.json(
      { ok: false, message: 'Too many requests. Please try later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  const parsed = newsletterSchema.safeParse(await requestPayload(request));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, message: 'Enter a valid email address.' },
      { status: 400 },
    );
  try {
    const delivery = await deliverForm('newsletter', parsed.data);
    if (!delivery.configured)
      return NextResponse.json(
        { ok: false, configured: false, message: 'Newsletter delivery is not configured yet.' },
        { status: 503 },
      );
    return NextResponse.json(
      { ok: true, status: 'accepted', message: 'Your subscription has been accepted.' },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, configured: true, message: 'Subscription delivery is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
