/**
 * Student Profile Verification — Phase 1/2 smoke test.
 * Run: npx tsx scripts/verify-profile-verification.ts
 */
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:3001/api').replace(
  /\/$/,
  '',
);
const PASSWORD = process.env.VERIFY_PASSWORD ?? 'Admin@123';
const TENANT = process.env.VERIFY_TENANT ?? 'demo';

type Result = 'pass' | 'fail' | 'warn';
const results: Array<{ status: Result; step: string; detail: string }> = [];

function log(status: Result, step: string, detail: string) {
  results.push({ status, step, detail });
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '!' : '✗';
  console.log(`${icon} [${step}] ${detail}`);
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function solveChallenge(expression: string): number {
  const normalized = expression.replace(/×/g, '*').replace(/x/gi, '*').trim();
  const match = normalized.match(/^(-?\d+)\s*([+\-*])\s*(-?\d+)$/);
  if (!match) throw new Error(`Cannot parse challenge: ${expression}`);
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return a * b;
}

async function login(email: string, password: string): Promise<string> {
  const challengeRes = await fetch(`${API_BASE}/v1/auth/challenge`);
  if (!challengeRes.ok)
    throw new Error(`challenge HTTP ${challengeRes.status}`);
  const challenge = unwrapData<{ token: string; expression: string }>(
    await challengeRes.json(),
  );
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT,
    },
    body: JSON.stringify({
      email,
      password,
      challengeToken: challenge.token,
      challengeAnswer: solveChallenge(challenge.expression),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `login ${email} → ${res.status}: ${(await res.text()).slice(0, 150)}`,
    );
  }
  const body = unwrapData<{ accessToken?: string }>(await res.json());
  if (!body.accessToken) throw new Error('login response missing accessToken');
  return body.accessToken;
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT,
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json: unwrapData(json) };
}

async function main() {
  console.log(`Profile verification smoke → ${API_BASE}\n`);

  let token: string;
  try {
    token = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'admin@demo.edu');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  const policy = await api(
    token,
    'GET',
    '/v1/students/profile-verification/policy',
  );
  if (policy.status === 200 && Array.isArray(policy.json)) {
    log('pass', 'policy', `${policy.json.length} field policy rows`);
  } else {
    log('fail', 'policy', `HTTP ${policy.status}`);
  }

  const softGet = await api(
    token,
    'GET',
    '/v1/students/profile-verification/soft-gates',
  );
  if (
    softGet.status === 200 &&
    softGet.json &&
    typeof softGet.json.enabled === 'boolean'
  ) {
    log(
      'pass',
      'soft-gates-get',
      `enabled=${softGet.json.enabled} min=${softGet.json.minCompletionPercent}`,
    );
  } else {
    log('fail', 'soft-gates-get', `HTTP ${softGet.status}`);
  }

  const softPut = await api(
    token,
    'PUT',
    '/v1/students/profile-verification/soft-gates',
    {
      enabled: Boolean(softGet.json?.enabled),
      minCompletionPercent: Number(softGet.json?.minCompletionPercent ?? 80),
      remindOnLogin: true,
      softBlockRegistration: Boolean(softGet.json?.softBlockRegistration),
      softBlockCertificates: Boolean(softGet.json?.softBlockCertificates),
    },
  );
  if (softPut.status === 200) {
    log('pass', 'soft-gates-put', 'saved');
  } else {
    log('fail', 'soft-gates-put', `HTTP ${softPut.status}`);
  }

  const pending = await api(
    token,
    'GET',
    '/v1/students/profile-verification/pending',
  );
  if (pending.status === 200 && Array.isArray(pending.json)) {
    log('pass', 'pending', `${pending.json.length} pending request(s)`);
  } else {
    log('fail', 'pending', `HTTP ${pending.status}`);
  }

  const dash = await api(
    token,
    'GET',
    '/v1/students/profile-verification/completion-dashboard',
  );
  if (
    dash.status === 200 &&
    dash.json &&
    typeof dash.json.overallAverage === 'number'
  ) {
    log(
      'pass',
      'completion',
      `avg=${dash.json.overallAverage}% incomplete=${dash.json.incompleteCount}`,
    );
  } else {
    log('fail', 'completion', `HTTP ${dash.status}`);
  }

  const report = await fetch(
    `${API_BASE}/v1/students/profile-verification/reports/incomplete?format=xlsx`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': TENANT,
      },
    },
  );
  if (report.ok) {
    const buf = Buffer.from(await report.arrayBuffer());
    log('pass', 'report-xlsx', `${buf.length} bytes`);
  } else {
    log('fail', 'report-xlsx', `HTTP ${report.status}`);
  }

  const bulk = await api(
    token,
    'POST',
    '/v1/students/profile-verification/requests/bulk-review',
    {
      requestIds: [],
      action: 'APPROVE',
    },
  );
  if (bulk.status === 200 || bulk.status === 201 || bulk.status === 400) {
    log(
      'pass',
      'bulk-review',
      `HTTP ${bulk.status} processed=${bulk.json?.processed ?? 'n/a'}`,
    );
  } else if (bulk.status === 403) {
    log(
      'fail',
      'bulk-review',
      '403 — re-login after grant-profile-verification-permissions',
    );
  } else {
    log('fail', 'bulk-review', `HTTP ${bulk.status}`);
  }

  const failed = results.filter((r) => r.status === 'fail').length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
