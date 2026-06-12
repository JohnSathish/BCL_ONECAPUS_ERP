'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Package, Warehouse } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createInventoryItem,
  createInventoryStore,
  fetchInventoryDashboard,
  fetchInventoryItems,
  fetchInventoryStores,
  fetchInventoryTransactions,
  issueInventoryStock,
  lookupInventoryItem,
  receiptInventoryStock,
  returnInventoryStock,
} from '@/services/inventory';
import { apiErrorMessage } from '@/utils/api-error';

type Page = 'dashboard' | 'stores' | 'items' | 'transactions';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function InventoryWorkspace({ page = 'dashboard' }: { page?: Page }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const dashboard = useQuery({
    queryKey: ['inventory', 'dashboard'],
    queryFn: fetchInventoryDashboard,
    enabled,
  });
  const stores = useQuery({
    queryKey: ['inventory', 'stores'],
    queryFn: fetchInventoryStores,
    enabled: enabled && (page === 'stores' || page === 'items' || page === 'transactions'),
  });
  const items = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => fetchInventoryItems(),
    enabled: enabled && (page === 'items' || page === 'transactions'),
  });
  const transactions = useQuery({
    queryKey: ['inventory', 'transactions'],
    queryFn: () => fetchInventoryTransactions(),
    enabled: enabled && page === 'transactions',
  });

  const [storeForm, setStoreForm] = useState({ code: '', name: '', location: '' });
  const [itemForm, setItemForm] = useState({
    storeId: '',
    sku: '',
    name: '',
    category: '',
    unit: 'PCS',
    quantityOnHand: 0,
    reorderLevel: 5,
  });
  const [moveForm, setMoveForm] = useState({
    itemId: '',
    barcode: '',
    quantity: 1,
    department: '',
    issuedToName: '',
    notes: '',
    type: 'issue' as 'issue' | 'return' | 'receipt',
  });
  const [scanPreview, setScanPreview] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['inventory'] });

  const storeMut = useMutation({
    mutationFn: () => createInventoryStore(storeForm),
    onSuccess: () => {
      setMessage('Store created');
      setStoreForm({ code: '', name: '', location: '' });
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const itemMut = useMutation({
    mutationFn: () =>
      createInventoryItem({
        ...itemForm,
        quantityOnHand: Number(itemForm.quantityOnHand),
        reorderLevel: Number(itemForm.reorderLevel),
      }),
    onSuccess: () => {
      setMessage('Item added');
      setItemForm({
        storeId: '',
        sku: '',
        name: '',
        category: '',
        unit: 'PCS',
        quantityOnHand: 0,
        reorderLevel: 5,
      });
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const moveMut = useMutation({
    mutationFn: () => {
      const payload = {
        itemId: moveForm.itemId || undefined,
        barcode: moveForm.barcode || undefined,
        quantity: Number(moveForm.quantity),
        department: moveForm.department || undefined,
        issuedToName: moveForm.issuedToName || undefined,
        notes: moveForm.notes || undefined,
      };
      if (moveForm.type === 'issue') return issueInventoryStock(payload);
      if (moveForm.type === 'return') return returnInventoryStock(payload);
      return receiptInventoryStock(payload);
    },
    onSuccess: () => {
      setMessage(`Stock ${moveForm.type} recorded`);
      setMoveForm({
        itemId: '',
        barcode: '',
        quantity: 1,
        department: '',
        issuedToName: '',
        notes: '',
        type: moveForm.type,
      });
      setScanPreview('');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const resolveBarcode = async () => {
    if (!moveForm.barcode.trim()) return;
    try {
      const item = await lookupInventoryItem(moveForm.barcode.trim());
      setMoveForm((f) => ({ ...f, itemId: item.id }));
      setScanPreview(`${item.sku} — ${item.name} (${item.quantityOnHand} ${item.unit})`);
    } catch (e) {
      setScanPreview(apiErrorMessage(e));
    }
  };

  if (page === 'dashboard') {
    const d = dashboard.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Inventory</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Stores" value={d?.activeStores ?? '—'} />
          <Kpi label="Active Items" value={d?.activeItems ?? '—'} />
          <Kpi label="Vendors" value={d?.activeVendors ?? '—'} />
          <Kpi label="Open POs" value={d?.openPurchaseOrders ?? '—'} />
          <Kpi label="Pending Reqs" value={d?.pendingRequisitions ?? '—'} />
          <Kpi label="Restock Alerts" value={d?.restockSuggestionCount ?? '—'} />
          <Kpi label="Low Stock" value={d?.lowStockCount ?? '—'} />
          <Kpi label="Issues (7 days)" value={d?.issuesLast7Days ?? '—'} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">Low stock items</h2>
            <ul className="space-y-2 text-sm">
              {d?.lowStockItems.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.sku} — {i.name}
                  </span>
                  <span className="text-destructive">
                    {i.quantityOnHand}/{i.reorderLevel}
                  </span>
                </li>
              ))}
              {!d?.lowStockItems.length ? (
                <li className="text-muted-foreground">No alerts</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">By category</h2>
            <ul className="space-y-2 text-sm">
              {d?.categoryBreakdown.map((c) => (
                <li key={c.category} className="flex justify-between">
                  <span>{c.category}</span>
                  <span>
                    {c.itemCount} items · {c.totalUnits} units
                  </span>
                </li>
              ))}
              {!d?.categoryBreakdown.length ? (
                <li className="text-muted-foreground">No items yet</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'stores') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Stores</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-4">
          <Input
            placeholder="Code"
            value={storeForm.code}
            onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
          />
          <Input
            placeholder="Name"
            value={storeForm.name}
            onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
          />
          <Input
            placeholder="Location"
            value={storeForm.location}
            onChange={(e) => setStoreForm({ ...storeForm, location: e.target.value })}
          />
          <Button disabled={storeMut.isPending} onClick={() => storeMut.mutate()}>
            Add Store
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Location</th>
              <th className="p-2 text-left">Items</th>
            </tr>
          </thead>
          <tbody>
            {stores.data?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-mono">{s.code}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.location ?? '—'}</td>
                <td className="p-2">{s._count?.items ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (page === 'items') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Items & Stock</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-4 lg:grid-cols-8">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={itemForm.storeId}
            onChange={(e) => setItemForm({ ...itemForm, storeId: e.target.value })}
          >
            <option value="">Store</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <Input
            placeholder="SKU"
            value={itemForm.sku}
            onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
          />
          <Input
            placeholder="Name"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
          />
          <Input
            placeholder="Category"
            value={itemForm.category}
            onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
          />
          <Input
            placeholder="Unit"
            value={itemForm.unit}
            onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Qty"
            value={itemForm.quantityOnHand}
            onChange={(e) => setItemForm({ ...itemForm, quantityOnHand: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Reorder"
            value={itemForm.reorderLevel}
            onChange={(e) => setItemForm({ ...itemForm, reorderLevel: Number(e.target.value) })}
          />
          <Button
            disabled={itemMut.isPending || !itemForm.storeId}
            onClick={() => itemMut.mutate()}
          >
            Add Item
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Barcode</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Store</th>
              <th className="p-2 text-left">On Hand</th>
              <th className="p-2 text-left">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {items.data?.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2 font-mono">{i.sku}</td>
                <td className="p-2 font-mono text-xs">{i.barcode}</td>
                <td className="p-2">{i.name}</td>
                <td className="p-2">{i.store?.code ?? '—'}</td>
                <td
                  className={`p-2 ${i.reorderLevel > 0 && i.quantityOnHand <= i.reorderLevel ? 'text-destructive font-medium' : ''}`}
                >
                  {i.quantityOnHand} {i.unit}
                </td>
                <td className="p-2">{i.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (page === 'transactions') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Issue & Return</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-2 text-sm font-medium">Barcode / QR scan desk</p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md font-mono"
              placeholder="Scan barcode or INV:… QR payload"
              value={moveForm.barcode}
              onChange={(e) => setMoveForm({ ...moveForm, barcode: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void resolveBarcode();
              }}
            />
            <Button variant="outline" onClick={() => void resolveBarcode()}>
              Lookup
            </Button>
          </div>
          {scanPreview ? <p className="mt-2 text-sm text-muted-foreground">{scanPreview}</p> : null}
        </div>
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-3 lg:grid-cols-7">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={moveForm.type}
            onChange={(e) =>
              setMoveForm({ ...moveForm, type: e.target.value as 'issue' | 'return' | 'receipt' })
            }
          >
            <option value="issue">Issue</option>
            <option value="return">Return</option>
            <option value="receipt">Receipt</option>
          </select>
          <select
            className="rounded border px-2 py-2 text-sm md:col-span-2"
            value={moveForm.itemId}
            onChange={(e) => setMoveForm({ ...moveForm, itemId: e.target.value })}
          >
            <option value="">Select item</option>
            {items.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} — {i.name} ({i.quantityOnHand} {i.unit})
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="Qty"
            value={moveForm.quantity}
            onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
          />
          <Input
            placeholder="Department"
            value={moveForm.department}
            onChange={(e) => setMoveForm({ ...moveForm, department: e.target.value })}
          />
          <Input
            placeholder="Issued to"
            value={moveForm.issuedToName}
            onChange={(e) => setMoveForm({ ...moveForm, issuedToName: e.target.value })}
          />
          <Button
            disabled={moveMut.isPending || (!moveForm.itemId && !moveForm.barcode)}
            onClick={() => moveMut.mutate()}
          >
            Submit
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-left">Qty</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Recipient</th>
              <th className="p-2 text-left">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.data?.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.transactionType}</td>
                <td className="p-2">
                  {t.item?.sku} — {t.item?.name}
                </td>
                <td className="p-2">{t.quantity}</td>
                <td className="p-2">{t.department ?? '—'}</td>
                <td className="p-2">{t.issuedToName ?? '—'}</td>
                <td className="p-2">{t.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
