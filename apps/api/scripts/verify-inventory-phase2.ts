/**
 * Inventory Phase 2 — vendors, purchase orders, barcodes, PO receive.
 *
 *   npm run verify:inventory-phase2 -w api
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
  console.log('\n=== Inventory Phase 2 Verification ===\n');

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

  const dash = await apiJson<{ activeVendors: number }>(
    token,
    'GET',
    '/v1/inventory/dashboard',
  );
  if (
    dash.status === 200 &&
    typeof (dash.data as { activeVendors?: number }).activeVendors === 'number'
  ) {
    log('pass', 'dashboard', 'Phase 2 KPIs present');
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
  }

  const stamp = Date.now();
  const vendor = await apiJson<{ id: string; code: string }>(
    token,
    'POST',
    '/v1/inventory/vendors',
    {
      code: `V${String(stamp).slice(-4)}`,
      name: `Stationery Supplier ${stamp}`,
      contactName: 'Procurement Desk',
      mobile: '9876500000',
    },
  );
  let vendorId = '';
  if (vendor.status === 200 || vendor.status === 201) {
    vendorId = (vendor.data as { id: string }).id;
    log('pass', 'vendors', `Created ${(vendor.data as { code: string }).code}`);
  } else {
    log('fail', 'vendors', `Create status ${vendor.status}`);
  }

  let storeId = '';
  const storeList = await apiJson<{ id: string }[]>(
    token,
    'GET',
    '/v1/inventory/stores',
  );
  if (storeList.status === 200 && (storeList.data as { id: string }[]).length) {
    storeId = (storeList.data as { id: string }[])[0].id;
  } else {
    const store = await apiJson<{ id: string }>(
      token,
      'POST',
      '/v1/inventory/stores',
      {
        code: `S2${String(stamp).slice(-3)}`,
        name: 'PO Test Store',
      },
    );
    if (store.status === 200 || store.status === 201)
      storeId = (store.data as { id: string }).id;
  }

  let itemId = '';
  let barcode = '';
  if (storeId) {
    const item = await apiJson<{ id: string; sku: string; barcode: string }>(
      token,
      'POST',
      '/v1/inventory/items',
      {
        storeId,
        sku: `PO${String(stamp).slice(-5)}`,
        name: 'Whiteboard Marker',
        category: 'Stationery',
        quantityOnHand: 0,
        reorderLevel: 10,
      },
    );
    if (item.status === 200 || item.status === 201) {
      itemId = (item.data as { id: string }).id;
      barcode = (item.data as { barcode: string }).barcode;
      log('pass', 'items', `Item with barcode ${barcode}`);
    } else {
      log('fail', 'items', `Create status ${item.status}`);
    }
  }

  if (barcode) {
    const lookup = await apiJson(
      token,
      'GET',
      `/v1/inventory/items/lookup/${encodeURIComponent(barcode)}`,
    );
    if (lookup.status === 200) log('pass', 'labels', 'Barcode lookup');
    else log('fail', 'labels', `Lookup status ${lookup.status}`);

    const labels = await apiJson<{ barcodeImageUrl: string }[]>(
      token,
      'POST',
      '/v1/inventory/labels/batch',
      {
        itemIds: itemId ? [itemId] : undefined,
      },
    );
    if (
      (labels.status === 200 || labels.status === 201) &&
      (labels.data as unknown[]).length > 0
    )
      log('pass', 'labels', 'Label batch');
    else log('fail', 'labels', `Batch status ${labels.status}`);
  }

  if (vendorId && storeId && itemId) {
    const po = await apiJson<{
      id: string;
      poNumber: string;
      lines: { id: string }[];
    }>(token, 'POST', '/v1/inventory/purchase-orders', {
      vendorId,
      storeId,
      lines: [
        {
          itemId,
          description: 'Whiteboard Marker',
          quantityOrdered: 25,
          unitPrice: 35,
        },
      ],
    });
    if (po.status === 200 || po.status === 201) {
      const poData = po.data as {
        id: string;
        poNumber: string;
        lines: { id: string }[];
      };
      log('pass', 'purchase-orders', `Created ${poData.poNumber}`);

      const submit = await apiJson(
        token,
        'POST',
        `/v1/inventory/purchase-orders/${poData.id}/submit`,
      );
      if (submit.status === 200 || submit.status === 201)
        log('pass', 'purchase-orders', 'PO submitted');
      else log('fail', 'purchase-orders', `Submit status ${submit.status}`);

      const lineId = poData.lines?.[0]?.id;
      if (lineId) {
        const receive = await apiJson(
          token,
          'POST',
          `/v1/inventory/purchase-orders/${poData.id}/receive`,
          {
            lineId,
            quantity: 25,
          },
        );
        if (receive.status === 200 || receive.status === 201) {
          log('pass', 'purchase-orders', 'PO received into stock');
          const updated = receive.data as { status: string };
          if (updated.status === 'RECEIVED')
            log('pass', 'purchase-orders', 'PO marked RECEIVED');
          else log('warn', 'purchase-orders', `PO status ${updated.status}`);
        } else {
          log('fail', 'purchase-orders', `Receive status ${receive.status}`);
        }
      }
    } else {
      log('fail', 'purchase-orders', `Create status ${po.status}`);
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
