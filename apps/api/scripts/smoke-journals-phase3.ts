/**
 * Smoke: journals Phase 3 — production → publish → DOI → cite → similarity → ERP continue.
 *
 * Prerequisites:
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   API running on :3001
 *
 *   npx tsx scripts/smoke-journals-phase3.ts
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
  const token = (login.body as { accessToken: string }).accessToken;
  if (!token) throw new Error('no admin accessToken');
  return token;
}

async function main() {
  const prisma = new PrismaClient();
  const checks: string[] = [];
  const stamp = Date.now();
  const authorEmail = `author.p3.${stamp}@example.com`;
  const password = 'SmokeTest!234';

  try {
    const register = await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: authorEmail,
        password,
        displayName: 'Phase3 Smoke Author',
        affiliation: 'Don Bosco College',
      }),
    });
    if (!register.ok) {
      throw new Error(
        `register failed: ${register.status} ${JSON.stringify(register.body)}`,
      );
    }
    checks.push('✓ author registered');

    const login = await req('/v1/journals/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: authorEmail, password }),
    });
    if (!login.ok) throw new Error(`author login failed: ${login.status}`);
    const authorToken = (login.body as { accessToken: string }).accessToken;
    checks.push('✓ author login');

    const draft = await req('/v1/journals/portal/author/submissions', {
      method: 'POST',
      token: authorToken,
      body: JSON.stringify({
        title: `Phase 3 Smoke Manuscript ${stamp}`,
        abstract: 'Phase 3 production + DOI smoke.',
        keywords: ['phase3'],
        coAuthors: [
          {
            fullName: 'Phase3 Smoke Author',
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
    checks.push('✓ draft created');

    const tmpPdf = path.join(os.tmpdir(), `smoke-p3-${stamp}.pdf`);
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
    if (!upload.ok) {
      throw new Error(
        `upload failed: ${upload.status} ${JSON.stringify(upload.body)}`,
      );
    }
    checks.push('✓ manuscript uploaded');

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

    const tenant = await prisma.tenant.findFirst({
      where: { slug: TENANT_SLUG, deletedAt: null },
    });
    if (!tenant) throw new Error('demo tenant missing');
    const journal = await prisma.journal.findFirst({
      where: { tenantId: tenant.id, slug: SLUG },
    });
    if (!journal) throw new Error('transient journal missing');

    const adminUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        isActive: true,
        roles: {
          some: { role: { slug: { in: ['college-admin', 'super-admin'] } } },
        },
      },
    });
    if (!adminUser) throw new Error('No college-admin user for smoke');

    // Fast-path accept (Phase 2 review covered by smoke-journals-workflow)
    await prisma.journalEditorialDecision.create({
      data: {
        tenantId: tenant.id,
        submissionId,
        decision: 'ACCEPT',
        notesHtml: '<p>Accepted for Phase 3 smoke.</p>',
        decidedByUserId: adminUser.id,
      },
    });
    await prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'ACCEPTED' },
    });
    checks.push('✓ ACCEPTED (db)');

    const adminToken = await adminLogin();
    checks.push('✓ admin login');

    const simForm = new FormData();
    simForm.append(
      'file',
      new Blob([fs.readFileSync(tmpPdf)], { type: 'application/pdf' }),
      'similarity.pdf',
    );
    simForm.append('score', '12.5');
    const sim = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/similarity`,
      { method: 'POST', token: adminToken, formData: simForm },
    );
    if (!sim.ok) {
      throw new Error(
        `similarity failed: ${sim.status} ${JSON.stringify(sim.body)}`,
      );
    }
    checks.push('✓ similarity report + score');

    const start = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/production/start`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!start.ok) {
      throw new Error(
        `start production failed: ${start.status} ${JSON.stringify(start.body)}`,
      );
    }
    checks.push('✓ COPYEDITING');

    const toProof = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/production/advance`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!toProof.ok) {
      throw new Error(`advance to proofing failed: ${toProof.status}`);
    }
    checks.push('✓ PROOFING');

    const proofForm = new FormData();
    proofForm.append(
      'file',
      new Blob([fs.readFileSync(tmpPdf)], { type: 'application/pdf' }),
      'proof.pdf',
    );
    proofForm.append('kind', 'PROOF');
    const proofUp = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/files`,
      { method: 'POST', token: adminToken, formData: proofForm },
    );
    if (!proofUp.ok) {
      throw new Error(
        `proof upload failed: ${proofUp.status} ${JSON.stringify(proofUp.body)}`,
      );
    }
    checks.push('✓ proof uploaded');

    const approve = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/approve-proof`,
      { method: 'POST', token: authorToken, body: '{}' },
    );
    if (!approve.ok) {
      throw new Error(
        `approve proof failed: ${approve.status} ${JSON.stringify(approve.body)}`,
      );
    }
    checks.push('✓ author proof approved → READY_TO_PUBLISH');

    const issue = await prisma.journalIssue.findFirst({
      where: { journalId: journal.id, isPublished: true },
    });
    if (!issue) throw new Error('published issue missing');

    const published = await req(
      `/v1/journals/${journal.id}/submissions/${submissionId}/publish`,
      {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ issueId: issue.id, pageRange: '99-108' }),
      },
    );
    if (!published.ok) {
      throw new Error(
        `publish failed: ${published.status} ${JSON.stringify(published.body)}`,
      );
    }
    const articleId = (published.body as { id: string }).id;
    if (!articleId) throw new Error('publish returned no article id');
    checks.push('✓ published to issue');

    const reserved = await req(
      `/v1/journals/${journal.id}/articles/${articleId}/doi/reserve`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!reserved.ok) {
      throw new Error(
        `doi reserve failed: ${reserved.status} ${JSON.stringify(reserved.body)}`,
      );
    }
    const doi =
      (reserved.body as { doi?: string; article?: { doi?: string } }).doi ??
      (reserved.body as { article?: { doi?: string } }).article?.doi;
    if (!doi) {
      // reserve may return record or article — check body shape
      const body = reserved.body as Record<string, unknown>;
      const nested =
        body.doi ?? (body as { record?: { doi?: string } }).record?.doi;
      if (!nested) {
        throw new Error(
          `doi missing in reserve response: ${JSON.stringify(reserved.body)}`,
        );
      }
      checks.push(`✓ DOI reserved: ${nested}`);
    } else {
      checks.push(`✓ DOI reserved: ${doi}`);
    }

    const deposited = await req(
      `/v1/journals/${journal.id}/articles/${articleId}/doi/deposit`,
      { method: 'POST', token: adminToken, body: '{}' },
    );
    if (!deposited.ok) {
      throw new Error(
        `doi deposit failed: ${deposited.status} ${JSON.stringify(deposited.body)}`,
      );
    }
    checks.push('✓ DOI deposit (dry-run ok)');

    const cite = await req(
      `/v1/journals/portal/articles/${articleId}/cite?format=csl`,
    );
    if (!cite.ok) {
      throw new Error(
        `cite failed: ${cite.status} ${JSON.stringify(cite.body)}`,
      );
    }
    const csl = cite.body as { title?: string; type?: string };
    if (!csl?.title && !(cite.body as { title?: string })?.title) {
      // CSL may be nested
      const title =
        (cite.body as { title?: string }).title ??
        (cite.body as { data?: { title?: string } }).data?.title;
      if (!title)
        throw new Error(`cite CSL missing title: ${JSON.stringify(cite.body)}`);
    }
    checks.push('✓ cite CSL');

    const info = await req('/v1/journals/portal/info');
    if (!info.ok) throw new Error(`portal info failed: ${info.status}`);
    const infoBody = info.body as {
      topViewed?: unknown[];
      topDownloaded?: unknown[];
    };
    if (
      !Array.isArray(infoBody.topViewed) ||
      !Array.isArray(infoBody.topDownloaded)
    ) {
      throw new Error('portal info missing topViewed/topDownloaded');
    }
    checks.push('✓ portal top viewed/downloaded');

    // Continue with ERP: admin JWT hits auth/me (ensureAuthorAccess)
    const me = await req('/v1/journals/portal/auth/me', { token: adminToken });
    if (!me.ok) {
      throw new Error(
        `ERP continue (auth/me) failed: ${me.status} ${JSON.stringify(me.body)}`,
      );
    }
    checks.push('✓ Continue with ERP path (auth/me)');

    console.log('\nJournals Phase 3 smoke PASSED');
    for (const c of checks) console.log(c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nJournals Phase 3 smoke FAILED');
  console.error(e);
  process.exit(1);
});
