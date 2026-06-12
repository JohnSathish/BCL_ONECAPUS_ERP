'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, IndianRupee } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  approveInventoryRequisition,
  convertRequisitionToPo,
  createInventoryRequisition,
  createPoFromRestockSuggestions,
  fetchInventoryItems,
  fetchInventoryRequisition,
  fetchInventoryRequisitions,
  fetchInventoryVendors,
  fetchRestockSuggestions,
  rejectInventoryRequisition,
  submitInventoryRequisition,
  upsertVendorPrice,
  fetchVendorPrices,
} from '@/services/inventory';
import { apiErrorMessage } from '@/utils/api-error';

export function InventoryRequisitionsSection() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [convertVendorId, setConvertVendorId] = useState('');
  const [form, setForm] = useState({
    department: '',
    requestedByName: '',
    itemId: '',
    quantity: 1,
  });

  const requisitions = useQuery({
    queryKey: ['inventory', 'requisitions'],
    queryFn: () => fetchInventoryRequisitions(),
    enabled,
  });
  const items = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => fetchInventoryItems(),
    enabled,
  });
  const vendors = useQuery({
    queryKey: ['inventory', 'vendors'],
    queryFn: () => fetchInventoryVendors(),
    enabled,
  });
  const detail = useQuery({
    queryKey: ['inventory', 'requisitions', selectedId],
    queryFn: () => fetchInventoryRequisition(selectedId),
    enabled: enabled && !!selectedId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createInventoryRequisition({
        department: form.department,
        requestedByName: form.requestedByName || undefined,
        lines: [{ itemId: form.itemId, quantityRequested: Number(form.quantity) }],
      }),
    onSuccess: (r) => {
      setMessage(`Requisition ${r.requisitionNo} created`);
      setSelectedId(r.id);
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const convertMut = useMutation({
    mutationFn: () => convertRequisitionToPo(selectedId, { vendorId: convertVendorId }),
    onSuccess: () => {
      setMessage('Converted to purchase order');
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Department Requisitions</h1>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-5">
        <Input
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <Input
          placeholder="Requested by"
          value={form.requestedByName}
          onChange={(e) => setForm({ ...form, requestedByName: e.target.value })}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={form.itemId}
          onChange={(e) => setForm({ ...form, itemId: e.target.value })}
        >
          <option value="">Item</option>
          {items.data?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} — {i.name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
        />
        <Button
          disabled={createMut.isPending || !form.department || !form.itemId}
          onClick={() => createMut.mutate()}
        >
          Create
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Req #</th>
              <th className="p-2 text-left">Dept</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.data?.map((r) => (
              <tr
                key={r.id}
                className={`border-t cursor-pointer ${selectedId === r.id ? 'bg-muted/30' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <td className="p-2 font-mono">{r.requisitionNo}</td>
                <td className="p-2">{r.department}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">
                  {r.status === 'DRAFT' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await submitInventoryRequisition(r.id);
                        void qc.invalidateQueries({ queryKey: ['inventory'] });
                      }}
                    >
                      Submit
                    </Button>
                  ) : null}
                  {r.status === 'SUBMITTED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await approveInventoryRequisition(r.id);
                        void qc.invalidateQueries({ queryKey: ['inventory'] });
                      }}
                    >
                      Approve
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rounded-lg border p-4 text-sm">
          {!detail.data ? (
            <p className="text-muted-foreground">Select a requisition</p>
          ) : (
            <>
              <p className="font-medium">
                {detail.data.requisitionNo} · {detail.data.status}
              </p>
              <ul className="mt-2 space-y-1">
                {detail.data.lines?.map((l) => (
                  <li key={l.id}>
                    {l.item.sku} — {l.item.name}: {l.quantityApproved ?? l.quantityRequested}{' '}
                    {l.item.unit}
                  </li>
                ))}
              </ul>
              {detail.data.status === 'APPROVED' && !detail.data.purchaseOrder ? (
                <div className="mt-3 flex gap-2">
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={convertVendorId}
                    onChange={(e) => setConvertVendorId(e.target.value)}
                  >
                    <option value="">Vendor for PO</option>
                    {vendors.data?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!convertVendorId || convertMut.isPending}
                    onClick={() => convertMut.mutate()}
                  >
                    Convert to PO
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await rejectInventoryRequisition(detail.data!.id);
                      void qc.invalidateQueries({ queryKey: ['inventory'] });
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
              {detail.data.purchaseOrder ? (
                <p className="mt-2 text-muted-foreground">
                  PO: {detail.data.purchaseOrder.poNumber} ({detail.data.purchaseOrder.status})
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function InventoryRestockSection() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState('');

  const suggestions = useQuery({
    queryKey: ['inventory', 'restock'],
    queryFn: fetchRestockSuggestions,
    enabled,
  });
  const vendors = useQuery({
    queryKey: ['inventory', 'vendors'],
    queryFn: () => fetchInventoryVendors(),
    enabled,
  });

  const createPoMut = useMutation({
    mutationFn: () => createPoFromRestockSuggestions({ vendorId, itemIds: selected }),
    onSuccess: (po) => {
      setMessage(`Draft PO ${po.poNumber} created from suggestions`);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Low-Stock Restock Suggestions</h1>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border px-2 py-2 text-sm"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Select vendor</option>
          {vendors.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} — {v.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!vendorId || !selected.length || createPoMut.isPending}
          onClick={() => createPoMut.mutate()}
        >
          Create PO ({selected.length} items)
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2" />
            <th className="p-2 text-left">Item</th>
            <th className="p-2 text-left">On hand</th>
            <th className="p-2 text-left">Suggest order</th>
            <th className="p-2 text-left">Best vendor</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.data?.map((s) => (
            <tr key={s.itemId} className="border-t">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selected.includes(s.itemId)}
                  onChange={() => toggle(s.itemId)}
                />
              </td>
              <td className="p-2">
                {s.sku} — {s.name}
              </td>
              <td className="p-2 text-destructive">
                {s.quantityOnHand}/{s.reorderLevel}
              </td>
              <td className="p-2">
                {s.suggestedOrderQty} {s.unit}
              </td>
              <td className="p-2">
                {s.preferredVendor
                  ? `${s.preferredVendor.code} @ ₹${s.preferredVendor.unitPrice}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InventoryVendorPricesPanel({ vendorId }: { vendorId: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [form, setForm] = useState({ itemId: '', unitPrice: '', minOrderQty: 1 });

  const prices = useQuery({
    queryKey: ['inventory', 'vendor-prices', vendorId],
    queryFn: () => fetchVendorPrices(vendorId),
    enabled: enabled && !!vendorId,
  });
  const items = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => fetchInventoryItems(),
    enabled,
  });

  const mut = useMutation({
    mutationFn: () =>
      upsertVendorPrice(vendorId, {
        itemId: form.itemId,
        unitPrice: Number(form.unitPrice),
        minOrderQty: Number(form.minOrderQty),
      }),
    onSuccess: () => {
      setForm({ itemId: '', unitPrice: '', minOrderQty: 1 });
      void qc.invalidateQueries({ queryKey: ['inventory', 'vendor-prices', vendorId] });
    },
  });

  if (!vendorId) return null;

  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <IndianRupee className="h-4 w-4" /> Price list
      </div>
      <div className="mb-2 grid gap-2 md:grid-cols-4">
        <select
          className="rounded border px-2 py-1 text-sm"
          value={form.itemId}
          onChange={(e) => setForm({ ...form, itemId: e.target.value })}
        >
          <option value="">Item</option>
          {items.data?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku}
            </option>
          ))}
        </select>
        <Input
          className="h-9"
          placeholder="Unit price"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
        />
        <Input
          className="h-9"
          type="number"
          placeholder="Min qty"
          value={form.minOrderQty}
          onChange={(e) => setForm({ ...form, minOrderQty: Number(e.target.value) })}
        />
        <Button size="sm" disabled={!form.itemId || !form.unitPrice} onClick={() => mut.mutate()}>
          Save price
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {prices.data?.map((p) => (
          <li key={p.id}>
            {p.item?.sku} — ₹{p.unitPrice} (min {p.minOrderQty})
          </li>
        ))}
      </ul>
    </div>
  );
}
