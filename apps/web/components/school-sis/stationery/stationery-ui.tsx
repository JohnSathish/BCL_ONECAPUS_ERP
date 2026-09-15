'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Boxes,
  ClipboardList,
  FileBarChart2,
  Package,
  Settings2,
  ShoppingBag,
  Store,
  Truck,
  Undo2,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin/school-sis/stationery', label: 'POS / Billing', exact: true, icon: ShoppingBag },
  { href: '/admin/school-sis/stationery/products', label: 'Products', icon: Package },
  { href: '/admin/school-sis/stationery/categories', label: 'Categories', icon: Boxes },
  { href: '/admin/school-sis/stationery/stock', label: 'Stock', icon: Warehouse },
  { href: '/admin/school-sis/stationery/purchases', label: 'Receiving', icon: ClipboardList },
  { href: '/admin/school-sis/stationery/adjustments', label: 'Adjustment', icon: Store },
  { href: '/admin/school-sis/stationery/returns', label: 'Returns', icon: Undo2 },
  { href: '/admin/school-sis/stationery/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/admin/school-sis/stationery/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/admin/school-sis/stationery/settings', label: 'Settings', icon: Settings2 },
];

export function StationerySubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
              active
                ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StationeryShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5 bg-[#f4f7fb] p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billing</p>
        <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
      </div>
      <StationerySubnav />
      {children}
    </div>
  );
}

export function rs(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockBadge(status: string) {
  if (status === 'OUT') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status === 'LOW') return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    PAID: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    PARTIALLY_PAID: 'bg-amber-50 text-amber-800 ring-amber-200',
    PENDING_PAYMENT: 'bg-orange-50 text-orange-800 ring-orange-200',
    DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
    CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
    RETURNED: 'bg-violet-50 text-violet-800 ring-violet-200',
    PARTIALLY_RETURNED: 'bg-sky-50 text-sky-800 ring-sky-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none ring-[#2563eb]/20 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-4';

export { inputClass };

export function printStationeryReceipt(sale: any, schoolName = "St. Luke's Secondary School") {
  const items = (sale.items ?? [])
    .map(
      (i: any) =>
        `<tr><td>${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''}</td><td>${Number(i.qty)}</td><td>${rs(i.rate)}</td><td>${rs(i.discountAmt)}</td><td>${rs(i.lineTotal)}</td></tr>`,
    )
    .join('');
  const student = sale.student
    ? `<p><strong>${sale.student.fullName}</strong> · ${sale.student.admissionNumber}</p>`
    : `<p><strong>${sale.walkInName || 'Walk-in'}</strong> ${sale.walkInMobile || ''}</p>`;
  const html = `<!doctype html><html><head><title>${sale.invoiceNo}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;padding:16px}
      h1{font-size:16px;margin:0}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
      th,td{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left}
      .tot{text-align:right;margin-top:12px}
      @page{size:A5;margin:10mm}
    </style></head><body>
    <h1>${schoolName}</h1>
    <p style="margin:4px 0 12px;font-size:12px;color:#64748b">Stationery Invoice ${sale.invoiceNo}<br/>${new Date(sale.completedAt || sale.createdAt).toLocaleString('en-IN')}</p>
    ${student}
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table>
    <div class="tot">
      <p>Subtotal ${rs(sale.subtotal)}</p>
      <p>Discount ${rs((sale.itemDiscount || 0) + (sale.billDiscount || 0))}</p>
      <p>Tax ${rs(sale.taxAmount)}</p>
      <p><strong>Grand Total ${rs(sale.grandTotal)}</strong></p>
      <p>Paid ${rs(sale.amountPaid)} · Balance ${rs(sale.balanceDue)}</p>
      <p>Payment: ${(sale.payments || []).map((p: any) => `${p.method} ${rs(p.amount)}`).join(', ') || '—'}</p>
      <p>Cashier: ${sale.cashierName || ''}</p>
    </div>
    <p style="margin-top:24px;text-align:center">Thank you</p>
    <script>window.print()</script></body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
