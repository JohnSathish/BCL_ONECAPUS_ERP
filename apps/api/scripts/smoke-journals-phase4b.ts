/**
 * Smoke: journals Phase 4b — discovery (OAI/sitemap) + reviewer UX (dueAt, COI).
 *
 * Prerequisites:
 *   npx prisma migrate deploy
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   API on :3001
 *
 *   npx tsx scripts/smoke-journals-phase4b.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';
const HOST = 'transient.demo.localhost';
const SLUG = 'transient';
const TENANT_SLUG = 'demo';
const ADMIN_EMAIL = 'admin@demo.edu';
const ADMIN_PASSWORD = 'Admin@123';

async function req(
  pathName: string,
  init?: RequestInit & { token?: string; formData?: FormData; raw?: boolean },
) {
  const headers: Record<string, string> = {
    'X-Login-Host': HOST,
    'X-Forwarded-Host': HOST,
    'X-Journal-Slug': SLUG,
    'X-Tenant-Slug': TENANT_SLUG,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  if (!init?.formData && !init?.raw)
    headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${pathName}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.formData ?? init?.body,
  });
  const text = await res.text();
  if (init?.raw) return { status: res.status, body: text, ok: res.ok };
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
  if (!login.ok) throw new Error(`admin login failed: ${login.status}`);
  return (login.body as { accessToken: string }).accessToken;
}

async function main() {
  const prisma = new PrismaClient();
  const checks: string[] = [];
  const stamp = Date.now();
  const authorEmail = `author.p4b.${stamp}@example.com`;
  const reviewerEmail = `reviewer.p4b.${stamp}@example.com`;
  const password = 'SmokeTest!234';

  try {
    const oai = await req('/v1/journals/portal/oai?verb=Identify', {
      raw: true,
    });
    if (!oai.ok || !String(oai.body).includes('<Identify>')) {
      throw new Error(`OAI Identify failed: ${oai.status}`);
    }
    checks.push('✓ OAI Identify');

    const listRec = await req(
      '/v1/journals/portal/oai?verb=ListRecords&metadataPrefix=oai_dc',
      { raw: true },
    );
    if (!listRec.ok || !String(listRec.body).includes('ListRecords')) {
      throw new Error(`OAI ListRecords failed: ${listRec.status}`);
    }
    checks.push('✓ OAI ListRecords');

    const sm = await req('/v1/journals/portal/sitemap');
    if (!sm.ok || !Array.isArray(sm.body)) {
      throw new Error(`sitemap failed: ${sm.status}`);
    }
    checks.push(`✓ sitemap (${(sm.body as unknown[]).length} articles)`);

    const register = await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: authorEmail,
        password,
        displayName: 'P4b Author',
      }),
    });
    if (!register.ok) throw new Error('author register failed');
    const login = await req('/v1/journals/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authorEmail, password }),
    });
    const authorToken = (login.body as { accessToken: string }).accessToken;

    const draft = await req('/v1/journals/portal/author/submissions', {
      method: 'POST',
      token: authorToken,
      body: JSON.stringify({
        title: `P4b Review UX ${stamp}`,
        abstract: 'Reviewer due date + COI smoke',
        coAuthors: [
          { fullName: 'P4b Author', email: authorEmail, isCorresponding: true },
        ],
      }),
    });
    const submissionId = (draft.body as { id: string }).id;
    const tmpPdf = path.join(os.tmpdir(), `smoke-p4b-${stamp}.pdf`);
    fs.writeFileSync(tmpPdf, Buffer.from('%PDF-1.4\n%%EOF\n'));
    const form = new FormData();
    form.append(
      'file',
      new Blob([fs.readFileSync(tmpPdf)], { type: 'application/pdf' }),
      'm.pdf',
    );
    form.append('kind', 'MANUSCRIPT');
    await req(`/v1/journals/portal/author/submissions/${submissionId}/files`, {
      method: 'POST',
      token: authorToken,
      formData: form,
    });
    await req(`/v1/journals/portal/author/submissions/${submissionId}/submit`, {
      method: 'POST',
      token: authorToken,
      body: '{}',
    });

    const tenant = await prisma.tenant.findFirst({
      where: { slug: TENANT_SLUG },
    });
    const journal = await prisma.journal.findFirst({
      where: { tenantId: tenant!.id, slug: SLUG },
    });
    const adminToken = await adminLogin();

    const dueAt = new Date(Date.now() + 7 * 86400000).toISOString();

    // Register reviewer before invite so we know the password
    await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: reviewerEmail,
        password,
        displayName: 'P4b Reviewer',
        asReviewer: true,
      }),
    });
    const rl = await req('/v1/journals/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: reviewerEmail, password }),
    });
    if (!rl.ok) throw new Error(`reviewer login failed: ${rl.status}`);
    const revToken = (rl.body as { accessToken: string }).accessToken;

    const invite = await req(
      `/v1/journals/${journal!.id}/submissions/${submissionId}/invite-reviewer`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({
          email: reviewerEmail,
          displayName: 'P4b Reviewer',
          dueAt,
        }),
      },
    );
    if (!invite.ok) {
      throw new Error(
        `invite failed: ${invite.status} ${JSON.stringify(invite.body)}`,
      );
    }
    const assignmentId = (invite.body as { id: string }).id;
    const assignment = await prisma.journalReviewAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment?.dueAt) throw new Error('dueAt not persisted');
    checks.push('✓ invite with dueAt');

    const badAccept = await req(
      `/v1/journals/portal/reviewer/assignments/${assignmentId}/accept`,
      {
        method: 'POST',
        token: revToken,
        body: JSON.stringify({ token: assignment.inviteToken }),
      },
    );
    if (badAccept.ok) throw new Error('accept without COI should fail');
    checks.push('✓ COI required on accept');

    const accept = await req(
      `/v1/journals/portal/reviewer/assignments/${assignmentId}/accept`,
      {
        method: 'POST',
        token: revToken,
        body: JSON.stringify({
          token: assignment.inviteToken,
          conflictOfInterest: false,
        }),
      },
    );
    if (!accept.ok) {
      throw new Error(
        `accept failed: ${accept.status} ${JSON.stringify(accept.body)}`,
      );
    }
    const updated = await prisma.journalReviewAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (updated?.conflictOfInterest !== false) {
      throw new Error('COI flag not stored');
    }
    checks.push('✓ accept with COI=false');

    const list = await req('/v1/journals/portal/reviewer/assignments', {
      token: revToken,
    });
    if (!list.ok || !Array.isArray(list.body))
      throw new Error('assignments list failed');
    const row = (list.body as Array<{ id: string; dueAt?: string }>).find(
      (r) => r.id === assignmentId,
    );
    if (!row?.dueAt) throw new Error('dueAt missing in list API');
    checks.push('✓ reviewer list includes dueAt');

    console.log('\nJournals Phase 4b smoke PASSED');
    for (const c of checks) console.log(c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nJournals Phase 4b smoke FAILED');
  console.error(e);
  process.exit(1);
});
