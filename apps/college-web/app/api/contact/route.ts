import { NextResponse } from 'next/server';
import { contactSchema, deliverForm, rateLimit, requestPayload } from '@/lib/forms';

export async function POST(request: Request) {
  const rate = rateLimit(request, 'contact');
  if (!rate.allowed)
    return NextResponse.json(
      { ok: false, message: 'Too many messages. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  const parsed = contactSchema.safeParse(await requestPayload(request));
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        message: 'Please check the highlighted information.',
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  try {
    const delivery = await deliverForm('contact', parsed.data);
    if (!delivery.configured)
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          message: 'Online message delivery is not configured. Please email the college directly.',
        },
        { status: 503 },
      );
    return NextResponse.json(
      { ok: true, status: 'accepted', message: 'Your message has been accepted for delivery.' },
      { status: 202 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, configured: true, message: 'Message delivery is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
