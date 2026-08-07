import { NextResponse } from 'next/server';
import { cmsBase, cmsHeaders, safeTenant } from '@/lib/cms-client';
import { fyugInterestSchema, rateLimit } from '@/lib/forms';

const CLOSED_MESSAGE = 'Registration closed — the last date for interest registration has passed.';

async function isRegistrationAccepting(base: string): Promise<boolean> {
  try {
    const url = new URL(`${base}/v1/website/public/fyug-interest/window`);
    const tenant = safeTenant();
    if (tenant) url.searchParams.set('tenant', tenant);
    const response = await fetch(url, {
      headers: { ...cmsHeaders() },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { acceptingRegistrations?: boolean };
    return Boolean(data.acceptingRegistrations);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rate = rateLimit(request, 'fyug-interest', 4);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
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

  const accepting = await isRegistrationAccepting(base);
  if (!accepting) {
    return NextResponse.json({ ok: false, message: CLOSED_MESSAGE }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid form submission.' }, { status: 400 });
  }

  const photograph = form.get('photograph');
  if (!(photograph instanceof File) || photograph.size === 0) {
    return NextResponse.json(
      { ok: false, message: 'Applicant photograph is required.' },
      { status: 400 },
    );
  }
  if (photograph.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, message: 'Photograph must be 2MB or smaller.' },
      { status: 400 },
    );
  }

  const whatsappSameAsMobile = String(form.get('whatsappSameAsMobile') ?? 'true') === 'true';
  const mobile = String(form.get('mobile') ?? '').trim();
  const payload = {
    fullName: String(form.get('fullName') ?? ''),
    gender: String(form.get('gender') ?? ''),
    dateOfBirth: String(form.get('dateOfBirth') ?? ''),
    mobile,
    whatsapp: whatsappSameAsMobile ? mobile : String(form.get('whatsapp') ?? '').trim(),
    email: String(form.get('email') ?? ''),
    state: String(form.get('state') ?? ''),
    district: String(form.get('district') ?? ''),
    pinCode: String(form.get('pinCode') ?? ''),
    bloodGroup: String(form.get('bloodGroup') ?? ''),
    fatherName: String(form.get('fatherName') ?? ''),
    fatherMobile: String(form.get('fatherMobile') ?? ''),
    motherName: String(form.get('motherName') ?? ''),
    motherMobile: String(form.get('motherMobile') ?? ''),
    collegeLastAttended: String(form.get('collegeLastAttended') ?? ''),
    affiliatedUniversity: String(form.get('affiliatedUniversity') ?? ''),
    majorCourse: String(form.get('majorCourse') ?? ''),
    minorCourse: String(form.get('minorCourse') ?? ''),
    applyingHonoursIn: String(form.get('applyingHonoursIn') ?? ''),
    cuetScore: String(form.get('cuetScore') ?? ''),
    cgpaSemesterV: String(form.get('cgpaSemesterV') ?? ''),
    percentageSemesterV: String(form.get('percentageSemesterV') ?? ''),
    hasBackPapers: String(form.get('hasBackPapers') ?? ''),
    declarationAccepted: String(form.get('declarationAccepted') ?? '') === 'true',
    signatureName: String(form.get('signatureName') ?? ''),
    company: String(form.get('company') ?? ''),
    whatsappSameAsMobile,
  };

  const parsed = fyugInterestSchema.safeParse(payload);
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

  const url = new URL(`${base}/v1/website/public/fyug-interest`);
  const tenant = safeTenant();
  if (tenant) url.searchParams.set('tenant', tenant);

  const outbound = new FormData();
  const data = parsed.data;
  outbound.append('fullName', data.fullName);
  outbound.append('gender', data.gender);
  outbound.append('dateOfBirth', data.dateOfBirth);
  outbound.append('mobile', data.mobile);
  outbound.append(
    'whatsapp',
    data.whatsappSameAsMobile ? data.mobile : data.whatsapp || data.mobile,
  );
  outbound.append('email', data.email);
  outbound.append('state', data.state);
  outbound.append('district', data.district);
  outbound.append('pinCode', data.pinCode);
  outbound.append('bloodGroup', data.bloodGroup || '');
  outbound.append('fatherName', data.fatherName);
  outbound.append('fatherMobile', data.fatherMobile);
  outbound.append('motherName', data.motherName);
  outbound.append('motherMobile', data.motherMobile);
  outbound.append('collegeLastAttended', data.collegeLastAttended);
  outbound.append('affiliatedUniversity', data.affiliatedUniversity);
  outbound.append('majorCourse', data.majorCourse);
  outbound.append('minorCourse', data.minorCourse);
  outbound.append('applyingHonoursIn', data.applyingHonoursIn);
  outbound.append('cuetScore', data.cuetScore || '');
  outbound.append('cgpaSemesterV', data.cgpaSemesterV || '');
  outbound.append('percentageSemesterV', data.percentageSemesterV || '');
  outbound.append('hasBackPapers', data.hasBackPapers === 'Yes' ? 'true' : 'false');
  outbound.append('declarationAccepted', data.declarationAccepted ? 'true' : 'false');
  outbound.append('signatureName', data.signatureName);
  outbound.append('photograph', photograph, photograph.name || 'photograph.jpg');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...cmsHeaders(),
      },
      body: outbound,
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });

    const result = (await response.json().catch(() => null)) as {
      message?: string;
      data?: { id?: string };
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
        message:
          'Interest registration submitted. The admissions office will contact you if shortlisted.',
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
