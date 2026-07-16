/**
 * Smoke test: journals portal info for Transient + Source.
 *
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   npx tsx scripts/smoke-journals-portal.ts
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';

async function req(
  path: string,
  host: string,
  slug: string,
  init?: RequestInit,
) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Login-Host': host,
      'X-Forwarded-Host': host,
      'X-Journal-Slug': slug,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
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
  const checks: string[] = [];

  const transient = await req(
    '/v1/journals/portal/info',
    'transient.demo.localhost',
    'transient',
  );
  if (!transient.ok) {
    throw new Error(
      `transient info failed: ${transient.status} ${JSON.stringify(transient.body)}`,
    );
  }
  const tBody = transient.body as {
    journal?: { slug?: string; issn?: string; name?: string };
  };
  if (tBody.journal?.slug !== 'transient') {
    throw new Error(`expected transient slug, got ${tBody.journal?.slug}`);
  }
  if (tBody.journal?.issn !== '2583-9987') {
    throw new Error(`expected ISSN 2583-9987, got ${tBody.journal?.issn}`);
  }
  checks.push(`✓ transient portal info (${tBody.journal?.name})`);

  const source = await req(
    '/v1/journals/portal/info',
    'source.demo.localhost',
    'source',
  );
  if (!source.ok) {
    throw new Error(
      `source info failed: ${source.status} ${JSON.stringify(source.body)}`,
    );
  }
  const sBody = source.body as { journal?: { slug?: string } };
  if (sBody.journal?.slug !== 'source') {
    throw new Error(`expected source slug, got ${sBody.journal?.slug}`);
  }
  checks.push('✓ source portal info');

  const board = await req(
    '/v1/journals/portal/board',
    'transient.demo.localhost',
    'transient',
  );
  if (!board.ok) throw new Error(`board failed: ${board.status}`);
  checks.push('✓ transient board');

  const issues = await req(
    '/v1/journals/portal/issues',
    'transient.demo.localhost',
    'transient',
  );
  if (!issues.ok) throw new Error(`issues failed: ${issues.status}`);
  checks.push('✓ transient issues');

  const articles = await req(
    '/v1/journals/portal/articles',
    'transient.demo.localhost',
    'transient',
  );
  if (!articles.ok) throw new Error(`articles failed: ${articles.status}`);
  checks.push('✓ transient articles list');

  const about = await req(
    '/v1/journals/portal/pages/about',
    'transient.demo.localhost',
    'transient',
  );
  if (!about.ok) throw new Error(`about page failed: ${about.status}`);
  checks.push('✓ transient about page');

  console.log('\nJournals portal smoke PASSED');
  for (const c of checks) console.log(c);
}

main().catch((e) => {
  console.error('\nJournals portal smoke FAILED');
  console.error(e);
  process.exit(1);
});
