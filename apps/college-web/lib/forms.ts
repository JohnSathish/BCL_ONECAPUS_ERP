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

export const bloodDonorSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    dateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth'),
    gender: z.enum(['Male', 'Female', 'Other']),
    phone: z.string().trim().min(8).max(30),
    email: z.email().max(254),
    preferredContact: z.enum(['Email', 'Phone', 'WhatsApp']).default('Email'),
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    lastDonationDate: z.string().trim().max(32).optional().default(''),
    streetAddress: z.string().trim().max(200).optional().default(''),
    city: z.string().trim().max(80).optional().default(''),
    state: z.string().trim().max(80).optional().default(''),
    pincode: z.string().trim().max(12).optional().default(''),
    medicalNotes: z.string().trim().max(2000).optional().default(''),
    eligible: z.boolean(),
    company: honeypot,
  })
  .superRefine((value, ctx) => {
    if (value.lastDonationDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.lastDonationDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastDonationDate'],
        message: 'Enter a valid last donation date',
      });
    }
    if (!value.eligible) {
      ctx.addIssue({
        code: 'custom',
        path: ['eligible'],
        message: 'Please confirm you are eligible to donate blood',
      });
    }
  });

export const fyugInterestSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    gender: z.enum(['Male', 'Female']),
    dateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth'),
    mobile: z.string().trim().min(8).max(30),
    whatsapp: z.string().trim().max(30).optional().default(''),
    whatsappSameAsMobile: z.boolean().optional().default(true),
    email: z.email().max(254),
    state: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2, 'Enter your district').max(120),
    pinCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
    bloodGroup: z.string().trim().max(10).optional().default(''),
    fatherName: z.string().trim().min(2).max(120),
    fatherMobile: z.string().trim().min(8).max(30),
    motherName: z.string().trim().min(2).max(120),
    motherMobile: z.string().trim().min(8).max(30),
    collegeLastAttended: z.string().trim().min(2).max(200),
    affiliatedUniversity: z.string().trim().min(2).max(200),
    majorCourse: z.string().trim().min(2).max(80),
    minorCourse: z.string().trim().min(2).max(80),
    applyingHonoursIn: z.string().trim().min(2).max(80),
    cuetScore: z.string().trim().max(40).optional().default(''),
    cgpaSemesterV: z.string().trim().max(20).optional().default(''),
    percentageSemesterV: z.string().trim().max(20).optional().default(''),
    hasBackPapers: z.enum(['Yes', 'No']),
    declarationAccepted: z.boolean(),
    signatureName: z.string().trim().min(2).max(160),
    company: honeypot,
  })
  .superRefine((value, ctx) => {
    if (value.hasBackPapers === 'Yes') {
      ctx.addIssue({
        code: 'custom',
        path: ['hasBackPapers'],
        message:
          'Applicants with back papers are not eligible for the Fourth-Year Honours Programme',
      });
    }
    if (!value.declarationAccepted) {
      ctx.addIssue({
        code: 'custom',
        path: ['declarationAccepted'],
        message: 'Please accept the declaration to continue',
      });
    }
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
  kind: 'contact' | 'newsletter' | 'blood-donor',
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
    body: JSON.stringify({
      ...payload,
      ...((kind === 'contact' || kind === 'blood-donor') && recipient ? { recipient } : {}),
    }),
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Form delivery responded ${response.status}`);
  return { configured: true as const };
}
