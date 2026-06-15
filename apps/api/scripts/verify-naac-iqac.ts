/**
 * NIMS NAAC & IQAC — smoke verification.
 *
 *   npx ts-node --transpile-only scripts/verify-naac-iqac.ts
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
  console.log('\n=== NAAC & IQAC (NIMS) Verification ===\n');

  const token = await login('admin@demo.edu');
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Slug': TENANT_SLUG,
  };

  const dashboard = await fetch(`${API_BASE}/v1/naac-iqac/dashboard`, {
    headers,
  });
  console.log(
    dashboard.status === 200 ? 'PASS' : 'FAIL',
    'GET /v1/naac-iqac/dashboard →',
    dashboard.status,
  );
  if (dashboard.status === 404) {
    console.error('NAAC routes not registered. Restart API: npm run dev');
    process.exit(1);
  }

  const criteria = await fetch(`${API_BASE}/v1/naac-iqac/criteria`, {
    headers,
  });
  const criteriaData = unwrap<unknown[]>(await criteria.json());
  console.log(
    criteria.status === 200 && criteriaData.length >= 7 ? 'PASS' : 'FAIL',
    'GET /criteria →',
    criteria.status,
    `(${criteriaData.length} criteria)`,
  );

  const evidence = await fetch(
    `${API_BASE}/v1/naac-iqac/evidence?academicYear=2025-26`,
    { headers },
  );
  console.log(
    evidence.status === 200 ? 'PASS' : 'FAIL',
    'GET /evidence →',
    evidence.status,
  );

  const aqars = await fetch(`${API_BASE}/v1/naac-iqac/aqar`, { headers });
  const aqarList = unwrap<Array<{ id: string }>>(await aqars.json());
  console.log(
    aqars.status === 200 ? 'PASS' : 'FAIL',
    'GET /aqar →',
    aqars.status,
    `(${aqarList.length} AQARs)`,
  );

  if (aqarList[0]?.id) {
    const sync = await fetch(
      `${API_BASE}/v1/naac-iqac/aqar/${aqarList[0].id}/sync`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionKey: 'criterion_3' }),
      },
    );
    console.log(
      sync.status === 201 || sync.status === 200 ? 'PASS' : 'FAIL',
      'POST /aqar/:id/sync →',
      sync.status,
    );
  }

  const dvv = await fetch(`${API_BASE}/v1/naac-iqac/dvv/readiness`, {
    headers,
  });
  console.log(
    dvv.status === 200 ? 'PASS' : 'FAIL',
    'GET /dvv/readiness →',
    dvv.status,
  );

  const iqac = await fetch(`${API_BASE}/v1/naac-iqac/iqac/summary`, {
    headers,
  });
  console.log(
    iqac.status === 200 ? 'PASS' : 'FAIL',
    'GET /iqac/summary →',
    iqac.status,
  );

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
