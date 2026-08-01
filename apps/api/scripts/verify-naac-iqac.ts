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

  const tree = await fetch(`${API_BASE}/v1/naac-iqac/criteria/tree`, {
    headers,
  });
  const treeData = unwrap<{
    criteria: Array<{
      metricCount: number;
      keyIndicators: Array<{ metrics: Array<{ code: string }> }>;
    }>;
    academicYear: string;
  }>(await tree.json());
  const metricTotal = (treeData.criteria ?? []).reduce(
    (s, c) => s + (c.metricCount ?? 0),
    0,
  );
  console.log(
    tree.status === 200 && metricTotal >= 30 ? 'PASS' : 'FAIL',
    'GET /criteria/tree →',
    tree.status,
    `(${metricTotal} metrics, year ${treeData.academicYear})`,
  );

  const myWs = await fetch(`${API_BASE}/v1/naac-iqac/my/workspaces`, {
    headers,
  });
  console.log(
    myWs.status === 200 ? 'PASS' : 'FAIL',
    'GET /my/workspaces →',
    myWs.status,
  );

  const sampleCode =
    treeData.criteria?.[0]?.keyIndicators?.[0]?.metrics?.[0]?.code ?? '1.1.1';

  const wsDetail = await fetch(
    `${API_BASE}/v1/naac-iqac/metrics/${encodeURIComponent(sampleCode)}/workspace`,
    { headers },
  );
  const wsBody = unwrap<{ workspace?: { id: string } }>(await wsDetail.json());
  console.log(
    wsDetail.status === 200 ? 'PASS' : 'FAIL',
    `GET /metrics/${sampleCode}/workspace →`,
    wsDetail.status,
  );

  const portalWs = await fetch(`${API_BASE}/v1/naac-iqac/me/workspaces`, {
    headers,
  });
  console.log(
    portalWs.status === 200 || portalWs.status === 403 ? 'PASS' : 'FAIL',
    'GET /me/workspaces →',
    portalWs.status,
  );

  const pullProfile = await fetch(
    `${API_BASE}/v1/naac-iqac/extended-profile/pull`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ academicYear: '2025-26' }),
    },
  );
  console.log(
    pullProfile.status === 200 || pullProfile.status === 201 ? 'PASS' : 'FAIL',
    'POST /extended-profile/pull →',
    pullProfile.status,
  );

  const getProfile = await fetch(
    `${API_BASE}/v1/naac-iqac/extended-profile?academicYear=2025-26`,
    { headers },
  );
  const profileBody = unwrap<{ exists?: boolean }>(await getProfile.json());
  console.log(
    getProfile.status === 200 && profileBody.exists ? 'PASS' : 'FAIL',
    'GET /extended-profile →',
    getProfile.status,
    profileBody.exists ? '(stored)' : '',
  );

  if (wsBody.workspace?.id) {
    const pullWs = await fetch(
      `${API_BASE}/v1/naac-iqac/workspaces/${wsBody.workspace.id}/pull-erp`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    console.log(
      pullWs.status === 200 || pullWs.status === 201 ? 'PASS' : 'FAIL',
      'POST /workspaces/:id/pull-erp →',
      pullWs.status,
    );

    const submitWs = await fetch(
      `${API_BASE}/v1/naac-iqac/workspaces/${wsBody.workspace.id}/submit`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'verify phase3 submit' }),
      },
    );
    console.log(
      submitWs.status === 200 || submitWs.status === 201 ? 'PASS' : 'FAIL',
      'POST /workspaces/:id/submit (approval start) →',
      submitWs.status,
    );

    const detailAfter = await fetch(
      `${API_BASE}/v1/naac-iqac/metrics/${encodeURIComponent(sampleCode)}/workspace`,
      { headers },
    );
    const detailBody = unwrap<{
      approval?: { exists?: boolean; pendingRole?: string | null };
      approvalTimeline?: unknown[];
    }>(await detailAfter.json());
    console.log(
      detailAfter.status === 200 && detailBody.approval?.exists
        ? 'PASS'
        : 'FAIL',
      'workspace approval chain →',
      detailAfter.status,
      detailBody.approval?.exists
        ? `(pending ${detailBody.approval.pendingRole ?? 'n/a'}, timeline ${Array.isArray(detailBody.approvalTimeline) ? detailBody.approvalTimeline.length : 0})`
        : '',
    );

    const approveWs = await fetch(
      `${API_BASE}/v1/naac-iqac/workspaces/${wsBody.workspace.id}/approve`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'manage override approve step' }),
      },
    );
    console.log(
      approveWs.status === 200 || approveWs.status === 201 ? 'PASS' : 'FAIL',
      'POST /workspaces/:id/approve →',
      approveWs.status,
    );
  }

  const dvvCreate = await fetch(`${API_BASE}/v1/naac-iqac/dvv/clarifications`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metricCode: '3.3.1',
      academicYear: '2025-26',
      queryCode: `VERIFY-${Date.now()}`,
      title: 'Verify DVV clarification',
      naacQueryText: 'Please clarify publication counts for 3.3.1',
    }),
  });
  const dvvCreated = unwrap<{ id?: string }>(await dvvCreate.json());
  console.log(
    dvvCreate.status === 200 || dvvCreate.status === 201 ? 'PASS' : 'FAIL',
    'POST /dvv/clarifications →',
    dvvCreate.status,
  );

  if (dvvCreated.id) {
    const dvvResp = await fetch(
      `${API_BASE}/v1/naac-iqac/dvv/clarifications/${dvvCreated.id}/responses`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Publications are maintained in StaffPublication ERP module.',
        }),
      },
    );
    console.log(
      dvvResp.status === 200 || dvvResp.status === 201 ? 'PASS' : 'FAIL',
      'POST /dvv/clarifications/:id/responses →',
      dvvResp.status,
    );

    const dvvSubmit = await fetch(
      `${API_BASE}/v1/naac-iqac/dvv/clarifications/${dvvCreated.id}/submit-for-review`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'ready for IQAC' }),
      },
    );
    console.log(
      dvvSubmit.status === 200 || dvvSubmit.status === 201 ? 'PASS' : 'FAIL',
      'POST /dvv/clarifications/:id/submit-for-review →',
      dvvSubmit.status,
    );

    const dvvList = await fetch(
      `${API_BASE}/v1/naac-iqac/dvv/clarifications?academicYear=2025-26`,
      { headers },
    );
    console.log(
      dvvList.status === 200 ? 'PASS' : 'FAIL',
      'GET /dvv/clarifications →',
      dvvList.status,
    );
  }

  for (const tableMetric of ['1.1.1', '3.3.1', '2.4.2', '3.5.1']) {
    const tablesRes = await fetch(
      `${API_BASE}/v1/naac-iqac/metrics/${encodeURIComponent(tableMetric)}/tables?academicYear=2025-26`,
      { headers },
    );
    const tablesBody = unwrap<{
      tables?: Array<{
        definition?: { code?: string };
        dataset?: { id?: string };
        rows?: unknown[];
      }>;
    }>(await tablesRes.json());
    const hasTables = (tablesBody.tables?.length ?? 0) > 0;
    console.log(
      tablesRes.status === 200 && hasTables ? 'PASS' : 'FAIL',
      `GET /metrics/${tableMetric}/tables →`,
      tablesRes.status,
      hasTables
        ? `(${tablesBody.tables!.length} table(s): ${tablesBody
            .tables!.map((t) => t.definition?.code)
            .join(', ')})`
        : '(no tables)',
    );

    const datasetId = tablesBody.tables?.[0]?.dataset?.id;
    if (!datasetId) continue;

    const pullTable = await fetch(
      `${API_BASE}/v1/naac-iqac/datasets/${datasetId}/pull-erp`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    const pullBody = unwrap<{ rows?: unknown[] }>(await pullTable.json());
    console.log(
      pullTable.status === 200 || pullTable.status === 201 ? 'PASS' : 'FAIL',
      `POST /datasets/:id/pull-erp (${tableMetric}) →`,
      pullTable.status,
      Array.isArray(pullBody.rows) ? `(${pullBody.rows.length} rows)` : '',
    );

    const exportRes = await fetch(
      `${API_BASE}/v1/naac-iqac/datasets/${datasetId}/export-xlsx`,
      { headers },
    );
    const exportOk =
      exportRes.status === 200 &&
      (exportRes.headers.get('content-type') ?? '').includes('spreadsheetml');
    console.log(
      exportOk ? 'PASS' : 'FAIL',
      `GET /datasets/:id/export-xlsx (${tableMetric}) →`,
      exportRes.status,
    );
  }

  if (aqarList[0]?.id) {
    const syncProfile = await fetch(
      `${API_BASE}/v1/naac-iqac/aqar/${aqarList[0].id}/sync`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionKey: 'profile' }),
      },
    );
    console.log(
      syncProfile.status === 200 || syncProfile.status === 201
        ? 'PASS'
        : 'FAIL',
      'POST /aqar/:id/sync profile →',
      syncProfile.status,
    );
  }

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
