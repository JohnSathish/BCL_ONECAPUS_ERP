/**
 * Smoke: journals Phase 4 — editorial notification triggers.
 *
 * Prerequisites:
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   API running on :3001
 *
 *   npx tsx scripts/smoke-journals-phase4.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';
const HOST = 'transient.demo.localhost';
const SLUG = 'transient';
const TENANT_SLUG = 'demo';
const ADMIN_EMAIL = 'admin@demo.edu';
const ADMIN_PASSWORD = 'Admin@123';

const EXPECTED_CODES = [
  'JOURNAL_SUBMISSION_RECEIVED',
  'JOURNAL_SUBMISSION_TO_EDITOR',
  'JOURNAL_REVIEWER_INVITE',
  'JOURNAL_DECISION',
  'JOURNAL_PROOF_READY',
  'JOURNAL_PUBLISHED',
] as const;

async function req(
  pathName: string,
  init?: RequestInit & { token?: string; formData?: FormData },
) {
  const headers: Record<string, string> = {
    'X-Login-Host': HOST,
    'X-Forwarded-Host': HOST,
    'X-Journal-Slug': SLUG,
    'X-Tenant-Slug': TENANT_SLUG,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  if (!init?.formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${pathName}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.formData ?? init?.body,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep */
  }
  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    (body as { success?: boolean }).success === true
  ) {
    body = (body as { data: unknown }).data;
  }
  return { status: res.status, body, ok: res.ok };
}

function solveChallenge(expression: string): number {
  const n = expression.replace(/×/g, '*').replace(/x/gi, '*').trim();
  const m = n.match(/^(-?\d+)\s*([+\-*])\s*(-?\d+)$/);
  if (!m) throw new Error(`Bad challenge: ${expression}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (m[2] === '+') return a + b;
  if (m[2] === '-') return a - b;
  return a * b;
}

async function adminLogin(): Promise<string> {
  const ch = await req('/v1/auth/challenge');
  if (!ch.ok) throw new Error(`challenge failed: ${ch.status}`);
  const challenge = ch.body as { token: string; expression: string };
  const login = await req('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      challengeToken: challenge.token,
      challengeAnswer: solveChallenge(challenge.expression),
      rememberMe: false,
    }),
  });
  if (!login.ok) {
    throw new Error(
      `admin login failed: ${login.status} ${JSON.stringify(login.body)}`,
    );
  }
  return (login.body as { accessToken: string }).accessToken;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = new PrismaClient();
  const checks: string[] = [];
  const stamp = Date.now();
  const authorEmail = `author.p4.${stamp}@example.com`;
  const reviewerEmail = `reviewer.p4.${stamp}@example.com`;
  const password = 'SmokeTest!234';

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: TENANT_SLUG, deletedAt: null },
    });
    if (!tenant) throw new Error('demo tenant missing');
    const journal = await prisma.journal.findFirst({
      where: { tenantId: tenant.id, slug: SLUG },
    });
    if (!journal) throw new Error('transient journal missing');

    // Templates must exist (ensure script)
    for (const code of EXPECTED_CODES) {
      const tpl = await prisma.communicationTemplate.findFirst({
        where: { tenantId: tenant.id, code, deletedAt: null, isActive: true },
      });
      if (!tpl) {
        throw new Error(
          `Missing template ${code} — run ensure-journals-portal.ts`,
        );
      }
    }
    checks.push('✓ JOURNAL_* templates seeded');

    const register = await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: authorEmail,
        password,
        displayName: 'Phase4 Smoke Author',
        affiliation: 'Don Bosco College',
      }),
    });
    if (!register.ok) {
      throw new Error(
        `register failed: ${register.status} ${JSON.stringify(register.body)}`,
      );
    }

    const login = await req('/v1/journals/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authorEmail, password }),
    });
    if (!login.ok) throw new Error(`author login failed: ${login.status}`);
    const authorToken = (login.body as { accessToken: string }).accessToken;

    const draft = await req('/v1/journals/portal/author/submissions', {
      method: 'POST',
      token: authorToken,
      body: JSON.stringify({
        title: `Phase 4 Notify Manuscript ${stamp}`,
        abstract: 'Phase 4 notification smoke.',
        keywords: ['phase4'],
        correspondingEmail: authorEmail,
        coAuthors: [
          {
            fullName: 'Phase4 Smoke Author',
            email: authorEmail,
            isCorresponding: true,
          },
        ],
      }),
    });
    if (!draft.ok) {
      throw new Error(
        `draft failed: ${draft.status} ${JSON.stringify(draft.body)}`,
      );
    }
    const submissionId = (draft.body as { id: string }).id;

    const tmpPdf = path.join(os.tmpdir(), `smoke-p4-${stamp}.pdf`);
    fs.writeFileSync(
      tmpPdf,
      Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8'),
    );
    const form = new FormData();
    form.append(
      'file',
      new Blob([fs.readFileSync(tmpPdf)], { type: 'application/pdf' }),
      'smoke.pdf',
    );
    form.append('kind', 'MANUSCRIPT');
    const upload = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/files`,
      { method: 'POST', token: authorToken, formData: form },
    );
    if (!upload.ok) throw new Error(`upload failed: ${upload.status}`);

    const submitted = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/submit`,
      { method: 'POST', token: authorToken, body: '{}' },
    );
    if (!submitted.ok) {
      throw new Error(
        `submit failed: ${submitted.status} ${JSON.stringify(submitted.body)}`,
      );
    }
    checks.push('✓ submitted');

    const adminToken = await adminLogin();

    const round = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/review-rounds`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!round.ok) {
      throw new Error(
        `open round failed: ${round.status} ${JSON.stringify(round.body)}`,
      );
    }

    const invite = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/invite-reviewer`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({
          email: reviewerEmail,
          displayName: 'Phase4 Reviewer',
        }),
      },
    );
    if (!invite.ok) {
      throw new Error(
        `invite failed: ${invite.status} ${JSON.stringify(invite.body)}`,
      );
    }
    checks.push('✓ reviewer invited');

    const decide = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/decide`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({
          decision: 'ACCEPT',
          notesHtml: '<p>Accept</p>',
        }),
      },
    );
    if (!decide.ok) {
      throw new Error(
        `decide failed: ${decide.status} ${JSON.stringify(decide.body)}`,
      );
    }
    checks.push('✓ ACCEPT decision');

    const start = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/production/start`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!start.ok) throw new Error(`start production failed: ${start.status}`);

    const toProof = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/production/advance`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!toProof.ok)
      throw new Error(`advance to proofing failed: ${toProof.status}`);
    checks.push('✓ PROOFING');

    const approve = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/approve-proof`,
      { method: 'POST', token: authorToken, body: '{}' },
    );
    if (!approve.ok) {
      throw new Error(
        `approve proof failed: ${approve.status} ${JSON.stringify(approve.body)}`,
      );
    }

    const issue = await prisma.journalIssue.findFirst({
      where: { journalId: journal.id, isPublished: true },
    });
    if (!issue) throw new Error('published issue missing');

    const published = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/publish`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ issueId: issue.id, pageRange: '1-8' }),
      },
    );
    if (!published.ok) {
      throw new Error(
        `publish failed: ${published.status} ${JSON.stringify(published.body)}`,
      );
    }
    checks.push('✓ published');

    // Allow async void notifications to flush
    await sleep(1500);

    const campaigns = await prisma.communicationCampaign.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: new Date(stamp - 60_000) },
      },
      select: { id: true, metadata: true, subject: true },
      orderBy: { createdAt: 'asc' },
    });

    const codes = new Set<string>();
    for (const c of campaigns) {
      const meta = c.metadata as {
        templateCode?: string;
        entityId?: string;
      } | null;
      if (meta?.entityId === submissionId && meta.templateCode) {
        codes.add(meta.templateCode);
      }
      // Invite uses assignment entityId — match by template code + recent subject
      if (meta?.templateCode === 'JOURNAL_REVIEWER_INVITE') {
        codes.add('JOURNAL_REVIEWER_INVITE');
      }
    }

    for (const code of EXPECTED_CODES) {
      if (!codes.has(code)) {
        throw new Error(
          `Missing campaign for ${code}. Found: ${[...codes].join(', ') || '(none)'}`,
        );
      }
      checks.push(`✓ notify ${code}`);
    }

    console.log('\nJournals Phase 4 smoke PASSED');
    for (const c of checks) console.log(c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nJournals Phase 4 smoke FAILED');
  console.error(e);
  process.exit(1);
});
