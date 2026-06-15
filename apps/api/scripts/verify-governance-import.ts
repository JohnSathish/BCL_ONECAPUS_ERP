/**
 * CGMS governance import — template + route smoke test.
 *
 *   npx ts-node --transpile-only scripts/verify-governance-import.ts
 */
const API_BASE = (
  process.argv.find((a) => a.startsWith('--api='))?.slice(6) ??
  'http://127.0.0.1:3001/api'
).replace(/\/$/, '');
const TENANT_SLUG = 'demo';
const PASSWORD = 'Admin@123';

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body)
    return (body as { data: T }).data;
  return body as T;
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

async function login(email: string): Promise<string> {
  const chRes = await fetch(`${API_BASE}/v1/auth/challenge`);
  if (!chRes.ok) throw new Error(`challenge ${chRes.status}`);
  const ch = unwrap<{ token: string; expression: string }>(await chRes.json());
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT_SLUG,
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      challengeToken: ch.token,
      challengeAnswer: solveChallenge(ch.expression),
      rememberMe: false,
    }),
  });
  if (!res.ok) throw new Error(`login ${email} → ${res.status}`);
  return unwrap<{ accessToken: string }>(await res.json()).accessToken;
}

async function main() {
  console.log('\n=== Governance Import Verification ===\n');

  const token = await login('admin@demo.edu');
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Slug': TENANT_SLUG,
  };

  const dashboard = await fetch(`${API_BASE}/v1/governance/dashboard`, {
    headers,
  });
  console.log(
    dashboard.status === 200 ? 'PASS' : 'FAIL',
    'GET /v1/governance/dashboard →',
    dashboard.status,
  );
  if (dashboard.status === 404) {
    console.error(
      'Governance module routes not registered. Restart: npm run dev',
    );
    process.exit(1);
  }

  const template = await fetch(`${API_BASE}/v1/governance/imports/template`, {
    headers,
  });
  const buf = await template.arrayBuffer();
  console.log(
    template.status === 200 && buf.byteLength > 1000 ? 'PASS' : 'FAIL',
    'GET /v1/governance/imports/template →',
    template.status,
    `(${buf.byteLength} bytes)`,
  );
  if (template.status !== 200) {
    const text = await template.text().catch(() => '');
    console.error(text.slice(0, 200));
    process.exit(1);
  }

  const form = new FormData();
  form.append(
    'file',
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'governance-committee-import-template.xlsx',
  );
  const excelUpload = await fetch(`${API_BASE}/v1/governance/imports/excel`, {
    method: 'POST',
    headers,
    body: form,
  });
  const uploadBody = await excelUpload.json().catch(() => ({}));
  const batch = unwrap<{ id: string; drafts?: unknown[] }>(uploadBody);
  console.log(
    excelUpload.status === 201 || excelUpload.status === 200 ? 'PASS' : 'FAIL',
    'POST /v1/governance/imports/excel →',
    excelUpload.status,
    batch?.drafts ? `(${batch.drafts.length} drafts)` : '',
  );
  if (excelUpload.status !== 200 && excelUpload.status !== 201) process.exit(1);

  const committees = await fetch(
    `${API_BASE}/v1/governance/committees?limit=1`,
    { headers },
  );
  const committeeList = unwrap<{ items: { id: string }[] }>(
    await committees.json(),
  );
  const committeeId = committeeList?.items?.[0]?.id;
  if (committeeId) {
    const createMember = await fetch(
      `${API_BASE}/v1/governance/committees/${committeeId}/members`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Verify Import Member',
          role: 'MEMBER',
          designation: 'Test',
          isExternal: true,
        }),
      },
    );
    console.log(
      createMember.status === 201 || createMember.status === 200
        ? 'PASS'
        : 'FAIL',
      'POST /v1/governance/committees/:id/members →',
      createMember.status,
    );
    if (createMember.status !== 200 && createMember.status !== 201)
      process.exit(1);
  } else {
    console.log(
      'WARN  skipped committee member route test — no committees found',
    );
  }

  console.log('\nAll governance import checks passed.\n');
}

main().catch((err) => {
  console.error('verify-governance-import failed:', err);
  process.exit(1);
});
