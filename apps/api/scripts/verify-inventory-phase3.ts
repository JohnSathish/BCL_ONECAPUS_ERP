/**
 * Inventory Phase 3 — requisitions, vendor prices, restock PO, barcode issue.
 *
 *   npm run verify:inventory-phase3 -w api
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
  console.log('\n=== Inventory Phase 3 Verification ===\n');

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

  const dash = await apiJson<{
    pendingRequisitions: number;
    restockSuggestionCount: number;
  }>(token, 'GET', '/v1/inventory/dashboard');
  if (
    dash.status === 200 &&
    typeof dash.data.pendingRequisitions === 'number'
  ) {
    log('pass', 'dashboard', 'Phase 3 KPIs present');
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
  }

  const stamp = Date.now();
  let vendorId = '';
  const vendor = await apiJson<{ id: string }>(
    token,
    'POST',
    '/v1/inventory/vendors',
    {
      code: `VP${String(stamp).slice(-4)}`,
      name: `Phase3 Vendor ${stamp}`,
    },
  );
  if (vendor.status === 200 || vendor.status === 201) {
    vendorId = (vendor.data as { id: string }).id;
    log('pass', 'vendors', 'Vendor ready');
  } else {
    log('fail', 'vendors', `Status ${vendor.status}`);
  }

  let storeId = '';
  const stores = await apiJson<{ id: string }[]>(
    token,
    'GET',
    '/v1/inventory/stores',
  );
  if (stores.status === 200 && (stores.data as { id: string }[])[0]) {
    storeId = (stores.data as { id: string }[])[0].id;
  }

  let itemId = '';
  let barcode = '';
  if (storeId) {
    const item = await apiJson<{ id: string; barcode: string }>(
      token,
      'POST',
      '/v1/inventory/items',
      {
        storeId,
        sku: `P3${String(stamp).slice(-5)}`,
        name: 'Stapler Pins Box',
        quantityOnHand: 2,
        reorderLevel: 20,
      },
    );
    if (item.status === 200 || item.status === 201) {
      itemId = (item.data as { id: string }).id;
      barcode = (item.data as { barcode: string }).barcode;
      log('pass', 'items', `Low-stock item ${barcode}`);
    }
  }

  if (vendorId && itemId) {
    const price = await apiJson(
      token,
      'POST',
      `/v1/inventory/vendors/${vendorId}/prices`,
      {
        itemId,
        unitPrice: 45,
        minOrderQty: 10,
      },
    );
    if (price.status === 200 || price.status === 201)
      log('pass', 'prices', 'Vendor price saved');
    else log('fail', 'prices', `Status ${price.status}`);
  }

  const suggestions = await apiJson<unknown[]>(
    token,
    'GET',
    '/v1/inventory/suggestions/restock',
  );
  if (suggestions.status === 200 && Array.isArray(suggestions.data)) {
    log(
      'pass',
      'suggestions',
      `${(suggestions.data as unknown[]).length} restock suggestion(s)`,
    );
  } else {
    log('fail', 'suggestions', `Status ${suggestions.status}`);
  }

  if (vendorId && itemId) {
    const poFromSuggest = await apiJson<{ poNumber: string }>(
      token,
      'POST',
      '/v1/inventory/suggestions/create-po',
      {
        vendorId,
        itemIds: [itemId],
      },
    );
    if (poFromSuggest.status === 200 || poFromSuggest.status === 201) {
      log(
        'pass',
        'suggestions',
        `PO ${(poFromSuggest.data as { poNumber: string }).poNumber} from suggestions`,
      );
    } else {
      log('fail', 'suggestions', `Create PO status ${poFromSuggest.status}`);
    }
  }

  let reqId = '';
  if (itemId) {
    const req = await apiJson<{ id: string; requisitionNo: string }>(
      token,
      'POST',
      '/v1/inventory/requisitions',
      {
        department: 'Admin Office',
        requestedByName: 'Desk Staff',
        lines: [{ itemId, quantityRequested: 15 }],
      },
    );
    if (req.status === 200 || req.status === 201) {
      reqId = (req.data as { id: string }).id;
      log(
        'pass',
        'requisitions',
        `Created ${(req.data as { requisitionNo: string }).requisitionNo}`,
      );

      await apiJson(
        token,
        'POST',
        `/v1/inventory/requisitions/${reqId}/submit`,
      );
      const approve = await apiJson(
        token,
        'POST',
        `/v1/inventory/requisitions/${reqId}/approve`,
        {},
      );
      if (approve.status === 200 || approve.status === 201)
        log('pass', 'requisitions', 'Approved');

      if (vendorId) {
        const convert = await apiJson<{
          status: string;
          purchaseOrder?: { poNumber: string };
        }>(token, 'POST', `/v1/inventory/requisitions/${reqId}/convert-to-po`, {
          vendorId,
        });
        if (convert.status === 200 || convert.status === 201) {
          log(
            'pass',
            'requisitions',
            `Converted → ${convert.data.purchaseOrder?.poNumber ?? 'PO'}`,
          );
        } else {
          log('fail', 'requisitions', `Convert status ${convert.status}`);
        }
      }
    } else {
      log('fail', 'requisitions', `Create status ${req.status}`);
    }
  }

  if (barcode) {
    const issue = await apiJson(
      token,
      'POST',
      '/v1/inventory/transactions/issue',
      {
        barcode: `INV:${barcode}`,
        quantity: 1,
        department: 'Science Lab',
        issuedToName: 'Lab Assistant',
      },
    );
    if (issue.status === 200 || issue.status === 201)
      log('pass', 'barcode-desk', 'Issue by scanned QR payload');
    else log('fail', 'barcode-desk', `Issue status ${issue.status}`);
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
