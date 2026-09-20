import { Prisma } from '@prisma/client';

const SECRET_PAIR =
  /(?:authkey|api[_-]?key|api[_-]?secret|auth[_-]?token|password|authorization|bearer|sid|token)[=:\s]+[^\s,&;]+/gi;
const LONG_TOKEN = /(?:key|token|secret|authkey)=[^&\s]+/gi;

export function sanitizeSmsError(raw: unknown): string {
  let text =
    typeof raw === 'string'
      ? raw
      : raw instanceof Error
        ? raw.message
        : raw == null
          ? ''
          : JSON.stringify(raw);
  text = text.replace(SECRET_PAIR, (m) => `${m.split(/[=:\s]/)[0]}=[redacted]`);
  text = text.replace(LONG_TOKEN, (m) => `${m.split('=', 1)[0]}=[redacted]`);
  text = text.replace(/https?:\/\/[^\s]+/gi, (url) => {
    try {
      const u = new URL(url);
      u.search = '';
      u.password = '';
      return u.toString();
    } catch {
      return '[url]';
    }
  });
  return text.replace(/\s+/g, ' ').trim().slice(0, 400);
}

export function formatClassLabel(
  gradeName?: string | null,
  sectionName?: string | null,
): string {
  return `${gradeName ?? ''} ${sectionName ?? ''}`.replace(/\s+/g, ' ').trim();
}

export function providerSendsTransactionalSms(provider: string): boolean {
  const key = (provider || '').toUpperCase();
  return key !== 'APITXT';
}

export function enrollmentSearchWhere(
  term: string,
): Prisma.SchoolEnrollmentWhereInput | null {
  const q = term.trim();
  if (q.length < 2) return null;
  const digits = q.replace(/\D/g, '');
  const phoneNeedle =
    digits.length >= 10 ? digits.slice(-10) : digits.length >= 4 ? digits : '';
  const tokens = q.split(/\s+/).filter(Boolean);
  const or: Prisma.SchoolEnrollmentWhereInput[] = [
    { rollNumber: { contains: q, mode: 'insensitive' } },
    {
      student: { fullName: { contains: q, mode: 'insensitive' } },
    },
    {
      student: { admissionNumber: { contains: q, mode: 'insensitive' } },
    },
    { section: { name: { contains: q, mode: 'insensitive' } } },
    {
      section: { grade: { name: { contains: q, mode: 'insensitive' } } },
    },
    {
      section: { grade: { code: { contains: q, mode: 'insensitive' } } },
    },
  ];
  if (phoneNeedle) {
    or.push({ student: { phone: { contains: phoneNeedle } } });
    or.push({
      student: {
        guardians: {
          some: { guardian: { phone: { contains: phoneNeedle } } },
        },
      },
    });
  }
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1] ?? '';
    const gradePart = tokens.slice(0, -1).join(' ');
    or.push({
      AND: [
        {
          section: {
            grade: {
              OR: [
                { name: { contains: gradePart, mode: 'insensitive' } },
                { code: { contains: gradePart, mode: 'insensitive' } },
              ],
            },
          },
        },
        { section: { name: { contains: last, mode: 'insensitive' } } },
      ],
    });
  }
  return { OR: or };
}

export function collectGatewayConfigIssues(input: {
  provider: string;
  status: string;
  apiUrl?: string | null;
  senderId?: string | null;
  defaultSenderId?: string | null;
  creds: Record<string, string>;
}): string[] {
  const issues: string[] = [];
  const provider = (input.provider || '').toUpperCase();
  if (input.status !== 'ACTIVE') {
    issues.push('No active default SMS gateway is selected.');
  }
  const hasKey = Boolean(
    input.creds.apiKey ||
    input.creds.authkey ||
    input.creds.authToken ||
    input.creds.token,
  );
  if (provider === 'TWILIO') {
    if (!input.creds.accountSid) issues.push('Twilio Account SID is missing.');
    if (!input.creds.authToken && !input.creds.apiSecret) {
      issues.push('Twilio Auth Token is missing.');
    }
  } else if (provider === 'CUSTOM_HTTP' || provider === 'EXOTEL') {
    if (!input.apiUrl) issues.push('Gateway API URL is missing.');
    if (!hasKey) issues.push('Gateway API key or token is missing.');
  } else if (!hasKey) {
    issues.push('Gateway API key / authkey is missing.');
  }
  if (!input.senderId && !input.defaultSenderId && provider !== 'APITXT') {
    issues.push('Sender ID is not set on the gateway or SMS settings.');
  }
  if (!providerSendsTransactionalSms(provider)) {
    issues.push(
      'Apitxt is configured for login OTP only. Add MSG91, Twilio, or a custom HTTP gateway for individual SMS.',
    );
  }
  return issues;
}
