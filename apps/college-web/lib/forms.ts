import { z } from 'zod';

const honeypot = z.string().max(0, 'Automated submission rejected').optional().default('');

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().max(30).optional().default(''),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(5000),
  company: honeypot,
});

export const newsletterSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  company: honeypot,
});

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(request: Request, scope: string, limit = 5, windowMs = 10 * 60_000) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = `${scope}:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= limit)
    return { allowed: false, retryAfter: Math.ceil((bucket.resetsAt - now) / 1000) };
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function requestPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function deliverForm(
  kind: 'contact' | 'newsletter',
  payload: Record<string, unknown>,
) {
  const endpoint = process.env.COLLEGE_FORMS_URL?.replace(/\/+$/, '');
  const recipient = process.env.COLLEGE_CONTACT_RECIPIENT?.trim();
  if (!endpoint) return { configured: false as const };
  const response = await fetch(`${endpoint}/${kind}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.COLLEGE_FORMS_TOKEN
        ? { authorization: `Bearer ${process.env.COLLEGE_FORMS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ ...payload, ...(kind === 'contact' && recipient ? { recipient } : {}) }),
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Form delivery responded ${response.status}`);
  return { configured: true as const };
}
