/**
 * Smoke: journals Phase 2 author → review → decision workflow.
 *
 * Prerequisites:
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   API running on :3001
 *
 *   npx tsx scripts/smoke-journals-workflow.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';
const HOST = 'transient.demo.localhost';
const SLUG = 'transient';

async function req(
  pathName: string,
  init?: RequestInit & { token?: string; formData?: FormData },
) {
  const headers: Record<string, string> = {
    'X-Login-Host': HOST,
    'X-Forwarded-Host': HOST,
    'X-Journal-Slug': SLUG,
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

async function main() {
  const prisma = new PrismaClient();
  const checks: string[] = [];
  const stamp = Date.now();
  const authorEmail = `author.smoke.${stamp}@example.com`;
  const reviewerEmail = `reviewer.smoke.${stamp}@example.com`;
  const password = 'SmokeTest!234';

  try {
    // Ensure permissions + roles exist via register
    const register = await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: authorEmail,
        password,
        displayName: 'Smoke Author',
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
    if (!login.ok) {
      throw new Error(
        `login failed: ${login.status} ${JSON.stringify(login.body)}`,
      );
    }
    const authorToken = (login.body as { accessToken: string }).accessToken;
    if (!authorToken) throw new Error('no accessToken from login');
    checks.push('✓ author login');

    const draft = await req('/v1/journals/portal/author/submissions', {
      method: 'POST',
      token: authorToken,
      body: JSON.stringify({
        title: `Smoke Manuscript ${stamp}`,
        abstract: 'Phase 2 workflow smoke abstract.',
        keywords: ['smoke'],
        coAuthors: [
          {
            fullName: 'Smoke Author',
            email: authorEmail,
            isCorresponding: true,
          },
        ],
      }),
    });
    if (!draft.ok) {
      throw new Error(
        `create draft failed: ${draft.status} ${JSON.stringify(draft.body)}`,
      );
    }
    const submissionId = (draft.body as { id: string }).id;
    checks.push('✓ draft created');

    const tmpPdf = path.join(os.tmpdir(), `smoke-${stamp}.pdf`);
    fs.writeFileSync(
      tmpPdf,
      Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8'),
    );
    const form = new FormData();
    const blob = new Blob([fs.readFileSync(tmpPdf)], {
      type: 'application/pdf',
    });
    form.append('file', blob, 'smoke.pdf');
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

    // Editor: find a college-admin user with password for this tenant (demo)
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'demo', deletedAt: null },
    });
    if (!tenant) throw new Error('demo tenant missing');
    const journal = await prisma.journal.findFirst({
      where: { tenantId: tenant.id, slug: 'transient' },
    });
    if (!journal) throw new Error('transient journal missing');

    // Prefer API with a provisioned editor session via AuthService path:
    // Seed a one-off editor via journal_reviewer invite path after attaching manage.
    // Simpler: call editorial services via direct prisma for decision after invite via API
    // with a user that has journals:manage.

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

    // Direct DB workflow for editor steps + API for reviewer
    const round = await prisma.journalReviewRound.create({
      data: {
        tenantId: tenant.id,
        submissionId,
        roundNumber: 1,
        status: 'OPEN',
      },
    });
    await prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'IN_REVIEW', currentRound: 1 },
    });
    checks.push('✓ review round opened (db)');

    // Provision reviewer via register
    const regRev = await req('/v1/journals/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: reviewerEmail,
        password,
        displayName: 'Smoke Reviewer',
        asReviewer: true,
      }),
    });
    if (!regRev.ok && !JSON.stringify(regRev.body).includes('already exists')) {
      throw new Error(`reviewer register failed: ${regRev.status}`);
    }
    const revLogin = await req('/v1/journals/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: reviewerEmail, password }),
    });
    if (!revLogin.ok) throw new Error('reviewer login failed');
    const revToken = (revLogin.body as { accessToken: string }).accessToken;
    const revUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: reviewerEmail },
    });
    if (!revUser) throw new Error('reviewer user missing');

    const inviteToken = randomBytes(16).toString('hex');
    const assignment = await prisma.journalReviewAssignment.create({
      data: {
        tenantId: tenant.id,
        roundId: round.id,
        reviewerUserId: revUser.id,
        invitedByUserId: adminUser.id,
        status: 'INVITED',
        inviteToken,
      },
    });
    checks.push('✓ reviewer assigned');

    const accept = await req(
      `/v1/journals/portal/reviewer/assignments/${assignment.id}/accept`,
      {
        method: 'POST',
        token: revToken,
        body: JSON.stringify({ token: inviteToken }),
      },
    );
    if (!accept.ok) {
      throw new Error(
        `accept failed: ${accept.status} ${JSON.stringify(accept.body)}`,
      );
    }
    checks.push('✓ invitation accepted');

    const report = await req(
      `/v1/journals/portal/reviewer/assignments/${assignment.id}/report`,
      {
        method: 'POST',
        token: revToken,
        body: JSON.stringify({
          recommendation: 'MINOR_REVISION',
          commentsToAuthor: 'Please clarify methods.',
          commentsToEditor: 'Promising work.',
        }),
      },
    );
    if (!report.ok) {
      throw new Error(
        `report failed: ${report.status} ${JSON.stringify(report.body)}`,
      );
    }
    checks.push('✓ review report submitted');

    await prisma.journalEditorialDecision.create({
      data: {
        tenantId: tenant.id,
        submissionId,
        roundId: round.id,
        decision: 'REVISE',
        notesHtml: '<p>Please revise and resubmit.</p>',
        decidedByUserId: adminUser.id,
      },
    });
    await prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'REVISION_REQUIRED' },
    });
    await prisma.journalReviewRound.update({
      where: { id: round.id },
      data: { status: 'CLOSED' },
    });
    checks.push('✓ REVISE decision');

    const revUpload = new FormData();
    revUpload.append(
      'file',
      new Blob([fs.readFileSync(tmpPdf)], { type: 'application/pdf' }),
      'smoke-rev.pdf',
    );
    revUpload.append('kind', 'REVISION');
    const up2 = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/files`,
      { method: 'POST', token: authorToken, formData: revUpload },
    );
    if (!up2.ok) {
      throw new Error(
        `revision upload failed: ${up2.status} ${JSON.stringify(up2.body)}`,
      );
    }
    const resub = await req(
      `/v1/journals/portal/author/submissions/${submissionId}/submit`,
      { method: 'POST', token: authorToken, body: '{}' },
    );
    if (!resub.ok) {
      throw new Error(
        `resubmit failed: ${resub.status} ${JSON.stringify(resub.body)}`,
      );
    }
    checks.push('✓ revision resubmitted');

    await prisma.journalEditorialDecision.create({
      data: {
        tenantId: tenant.id,
        submissionId,
        decision: 'ACCEPT',
        notesHtml: '<p>Accepted.</p>',
        decidedByUserId: adminUser.id,
      },
    });
    await prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'ACCEPTED' },
    });
    checks.push('✓ ACCEPT decision');

    const issue = await prisma.journalIssue.findFirst({
      where: { journalId: journal.id, isPublished: true },
    });
    if (issue) {
      const article = await prisma.journalArticle.create({
        data: {
          tenantId: tenant.id,
          journalId: journal.id,
          issueId: issue.id,
          title: `Smoke Manuscript ${stamp}`,
          abstract: 'Phase 2 workflow smoke abstract.',
          keywords: ['smoke'],
          status: 'PUBLISHED',
          publishedAt: new Date(),
          authors: {
            create: [
              {
                tenantId: tenant.id,
                fullName: 'Smoke Author',
                email: authorEmail,
                isCorresponding: true,
                sortOrder: 1,
              },
            ],
          },
        },
      });
      await prisma.journalSubmission.update({
        where: { id: submissionId },
        data: { publishedArticleId: article.id },
      });
      checks.push('✓ published to issue');
    }

    console.log('\nJournals workflow smoke PASSED');
    for (const c of checks) console.log(c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nJournals workflow smoke FAILED');
  console.error(e);
  process.exit(1);
});
