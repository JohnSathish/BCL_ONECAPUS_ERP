'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Barcode, ClipboardList, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InventoryVendorPricesPanel } from '@/components/inventory/inventory-workspace-phase3';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createInventoryPurchaseOrder,
  createInventoryVendor,
  fetchInventoryItems,
  fetchInventoryLabels,
  fetchInventoryPurchaseOrder,
  fetchInventoryPurchaseOrders,
  fetchInventoryStores,
  fetchInventoryVendors,
  receiveInventoryPurchaseOrderLine,
  submitInventoryPurchaseOrder,
} from '@/services/inventory';
import { apiErrorMessage } from '@/utils/api-error';

export function InventoryVendorsSection() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [form, setForm] = useState({ code: '', name: '', contactName: '', mobile: '', email: '' });

  const vendors = useQuery({
    queryKey: ['inventory', 'vendors'],
    queryFn: () => fetchInventoryVendors(),
    enabled,
  });

  const mut = useMutation({
    mutationFn: () => createInventoryVendor(form),
    onSuccess: () => {
      setMessage('Vendor created');
      setForm({ code: '', name: '', contactName: '', mobile: '', email: '' });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Vendors</h1>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-6">
        <Input
          placeholder="Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          placeholder="Contact"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
        />
        <Input
          placeholder="Mobile"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
          Add Vendor
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Contact</th>
            <th className="p-2 text-left">POs</th>
          </tr>
        </thead>
        <tbody>
          {vendors.data?.map((v) => (
            <tr
              key={v.id}
              className={`border-t cursor-pointer ${selectedVendorId === v.id ? 'bg-muted/30' : ''}`}
              onClick={() => setSelectedVendorId(v.id)}
            >
              <td className="p-2 font-mono">{v.code}</td>
              <td className="p-2">{v.name}</td>
              <td className="p-2">{v.contactName ?? v.mobile ?? '—'}</td>
              <td className="p-2">{v._count?.purchaseOrders ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <InventoryVendorPricesPanel vendorId={selectedVendorId} />
    </div>
  );
}

export function InventoryPurchaseOrdersSection() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    vendorId: '',
    storeId: '',
    itemId: '',
    description: '',
    sku: '',
    quantityOrdered: 10,
    unitPrice: '',
  });

  const vendors = useQuery({
    queryKey: ['inventory', 'vendors'],
    queryFn: () => fetchInventoryVendors(),
    enabled,
  });
  const stores = useQuery({
    queryKey: ['inventory', 'stores'],
    queryFn: fetchInventoryStores,
    enabled,
  });
  const items = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => fetchInventoryItems(),
    enabled,
  });
  const orders = useQuery({
    queryKey: ['inventory', 'purchase-orders'],
    queryFn: () => fetchInventoryPurchaseOrders(),
    enabled,
  });
  const selectedPo = useQuery({
    queryKey: ['inventory', 'purchase-orders', selectedPoId],
    queryFn: () => fetchInventoryPurchaseOrder(selectedPoId),
    enabled: enabled && !!selectedPoId,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const item = items.data?.find((i) => i.id === form.itemId);
      return createInventoryPurchaseOrder({
        vendorId: form.vendorId,
        storeId: form.storeId || undefined,
        lines: [
          {
            itemId: form.itemId || undefined,
            description: form.description || item?.name || 'Item',
            sku: form.sku || item?.sku,
            quantityOrdered: Number(form.quantityOrdered),
            unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
          },
        ],
      });
    },
    onSuccess: (po) => {
      setMessage(`PO ${po.poNumber} created`);
      setSelectedPoId(po.id);
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitInventoryPurchaseOrder(id),
    onSuccess: () => {
      setMessage('PO submitted');
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const receiveMut = useMutation({
    mutationFn: ({ poId, lineId, quantity }: { poId: string; lineId: string; quantity: number }) =>
      receiveInventoryPurchaseOrderLine(poId, { lineId, quantity }),
    onSuccess: () => {
      setMessage('Stock received against PO');
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Purchase Orders</h1>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-4 lg:grid-cols-8">
        <select
          className="rounded border px-2 py-2 text-sm"
          value={form.vendorId}
          onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
        >
          <option value="">Vendor</option>
          {vendors.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} — {v.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={form.storeId}
          onChange={(e) => setForm({ ...form, storeId: e.target.value })}
        >
          <option value="">Store (optional)</option>
          {stores.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={form.itemId}
          onChange={(e) => setForm({ ...form, itemId: e.target.value })}
        >
          <option value="">Catalog item</option>
          {items.data?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} — {i.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Qty"
          value={form.quantityOrdered}
          onChange={(e) => setForm({ ...form, quantityOrdered: Number(e.target.value) })}
        />
        <Input
          placeholder="Unit price"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
        />
        <Button disabled={createMut.isPending || !form.vendorId} onClick={() => createMut.mutate()}>
          Create PO
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium">All POs</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">PO #</th>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.data?.map((po) => (
                <tr
                  key={po.id}
                  className={`border-t cursor-pointer ${selectedPoId === po.id ? 'bg-muted/30' : ''}`}
                  onClick={() => setSelectedPoId(po.id)}
                >
                  <td className="p-2 font-mono">{po.poNumber}</td>
                  <td className="p-2">{po.vendor?.name}</td>
                  <td className="p-2">{po.status}</td>
                  <td className="p-2">
                    {po.status === 'DRAFT' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          submitMut.mutate(po.id);
                        }}
                      >
                        Submit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">PO detail</h2>
          {!selectedPo.data ? (
            <p className="text-sm text-muted-foreground">Select a PO</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">{selectedPo.data.poNumber}</span> ·{' '}
                {selectedPo.data.status}
              </p>
              <ul className="space-y-2">
                {selectedPo.data.lines?.map((line) => (
                  <li key={line.id} className="rounded border p-2">
                    <p>
                      {line.description} ({line.quantityReceived}/{line.quantityOrdered})
                    </p>
                    {['SUBMITTED', 'PARTIAL'].includes(selectedPo.data!.status) &&
                    line.quantityReceived < line.quantityOrdered ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={line.quantityOrdered - line.quantityReceived}
                          className="h-8 w-20"
                          value={
                            receiveQty[line.id] ?? line.quantityOrdered - line.quantityReceived
                          }
                          onChange={(e) =>
                            setReceiveQty({ ...receiveQty, [line.id]: Number(e.target.value) })
                          }
                        />
                        <Button
                          size="sm"
                          disabled={receiveMut.isPending}
                          onClick={() =>
                            receiveMut.mutate({
                              poId: selectedPo.data!.id,
                              lineId: line.id,
                              quantity:
                                receiveQty[line.id] ?? line.quantityOrdered - line.quantityReceived,
                            })
                          }
                        >
                          Receive
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InventoryLabelsSection() {
  const enabled = useAuthQueryEnabled();
  const [storeFilter, setStoreFilter] = useState('');

  const stores = useQuery({
    queryKey: ['inventory', 'stores'],
    queryFn: fetchInventoryStores,
    enabled,
  });
  const labels = useQuery({
    queryKey: ['inventory', 'labels', storeFilter],
    queryFn: () => fetchInventoryLabels({ storeId: storeFilter || undefined, limit: 48 }),
    enabled,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Barcode Labels</h1>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
          >
            <option value="">All stores</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Code128 barcode + QR scan payload for store desk issue/receipt.
      </p>
      <div className="grid gap-3 print:grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {labels.data?.map((label) => (
          <div key={label.id} className="rounded-lg border bg-white p-3 print:break-inside-avoid">
            <p className="truncate text-xs font-semibold">{label.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {label.sku} · {label.storeCode}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={label.barcodeImageUrl}
              alt={label.barcode}
              className="mx-auto mt-2 h-12 w-full object-contain"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={label.qrImageUrl} alt="QR" className="mx-auto mt-1 h-16 w-16" />
            <p className="mt-1 text-center font-mono text-[9px]">{label.scanPayload}</p>
          </div>
        ))}
        {!labels.data?.length ? (
          <p className="text-sm text-muted-foreground">No items to label</p>
        ) : null}
      </div>
    </div>
  );
}
