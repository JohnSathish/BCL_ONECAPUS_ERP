/**
 * Inventory Phase 1 — stores, items, issue/return transactions.
 *
 *   npm run verify:inventory-phase1 -w api
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_SLUG = 'demo';
const PASSWORD = 'Admin@123';
const API_BASE = (
  process.argv.find((a) => a.startsWith('--api='))?.slice(6) ??
  'http://127.0.0.1:3001/api'
).replace(/\/$/, '');

type Check = { level: 'pass' | 'fail' | 'warn'; step: string; message: string };
const checks: Check[] = [];

function log(level: Check['level'], step: string, message: string) {
  checks.push({ level, step, message });
  console.log(
    `  ${level === 'pass' ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL'}  [${step}] ${message}`,
  );
}

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

async function login(email: string, password: string): Promise<string> {
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
      password,
      challengeToken: ch.token,
      challengeAnswer: solveChallenge(ch.expression),
      rememberMe: false,
    }),
  });
  if (!res.ok) throw new Error(`login ${email} → ${res.status}`);
  return unwrap<{ accessToken: string }>(await res.json()).accessToken;
}

async function apiJson<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: unwrap<T>(JSON.parse(text)) };
  } catch {
    return { status: res.status, data: text as T };
  }
}

async function main() {
  console.log('\n=== Inventory Phase 1 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  let token: string;
  try {
    token = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  const dash = await apiJson<{ activeStores: number }>(
    token,
    'GET',
    '/v1/inventory/dashboard',
  );
  if (dash.status === 200) log('pass', 'dashboard', 'Dashboard KPIs');
  else log('fail', 'dashboard', `Status ${dash.status}`);

  const stamp = Date.now();
  const store = await apiJson<{ id: string; code: string }>(
    token,
    'POST',
    '/v1/inventory/stores',
    {
      code: `ST${String(stamp).slice(-3)}`,
      name: `Main Store ${stamp}`,
      location: 'Campus Block A',
    },
  );
  let storeId = '';
  if (store.status === 200 || store.status === 201) {
    storeId = (store.data as { id: string }).id;
    log('pass', 'stores', `Created ${(store.data as { code: string }).code}`);
  } else {
    log('fail', 'stores', `Create status ${store.status}`);
  }

  let itemId = '';
  if (storeId) {
    const item = await apiJson<{ id: string; sku: string }>(
      token,
      'POST',
      '/v1/inventory/items',
      {
        storeId,
        sku: `SKU${String(stamp).slice(-5)}`,
        name: 'A4 Paper Ream',
        category: 'Stationery',
        unit: 'PCS',
        quantityOnHand: 100,
        reorderLevel: 20,
      },
    );
    if (item.status === 200 || item.status === 201) {
      itemId = (item.data as { id: string }).id;
      log('pass', 'items', `Created ${(item.data as { sku: string }).sku}`);
    } else {
      log('fail', 'items', `Create status ${item.status}`);
    }
  }

  if (itemId) {
    const issue = await apiJson(
      token,
      'POST',
      '/v1/inventory/transactions/issue',
      {
        itemId,
        quantity: 10,
        department: 'Computer Science',
        issuedToName: 'Lab In-charge',
      },
    );
    if (issue.status === 200 || issue.status === 201) {
      log('pass', 'transactions', 'Stock issued');
      const ret = await apiJson(
        token,
        'POST',
        '/v1/inventory/transactions/return',
        {
          itemId,
          quantity: 3,
          department: 'Computer Science',
          issuedToName: 'Lab In-charge',
        },
      );
      if (ret.status === 200 || ret.status === 201)
        log('pass', 'transactions', 'Stock returned');
      else log('fail', 'transactions', `Return status ${ret.status}`);
    } else {
      log('fail', 'transactions', `Issue status ${issue.status}`);
    }
  }

  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
