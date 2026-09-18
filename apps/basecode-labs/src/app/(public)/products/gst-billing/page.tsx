import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ClipboardList,
  IndianRupee,
  Package,
  Receipt,
  Shield,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';
import { GST_BILLING_URL } from '@/lib/products-display';

export const metadata: Metadata = {
  title: { absolute: 'BCL GST Billing | BaseCode Labs Pvt. Ltd.' },
  description:
    'GST-compliant invoicing, inventory, payments and reports for shops, service providers and growing businesses. Live web app at finance.basecodelabs.com.',
  alternates: { canonical: '/products/gst-billing' },
  openGraph: {
    title: 'BCL GST Billing | BaseCode Labs Pvt. Ltd.',
    description: COMPANY.gstBilling.subtitle,
  },
};

const GROUPS = [
  {
    icon: Receipt,
    title: 'Invoices and GST',
    items: [
      'GST-compliant invoice generation',
      'HSN/SAC codes',
      'GST rates and tax calculations',
      'CGST / SGST / IGST',
      'Invoice numbering',
      'Quotations & estimates',
      'Credit & debit notes',
      'Printable & PDF invoices',
    ],
  },
  {
    icon: Users,
    title: 'Customers and catalogue',
    items: ['Customer management', 'Product & service management'],
  },
  {
    icon: Wallet,
    title: 'Sales, stock and money',
    items: [
      'Purchase management',
      'Sales management',
      'Payment tracking',
      'Outstanding / receivables',
      'Stock / inventory management',
      'Expense tracking',
    ],
  },
  {
    icon: ClipboardList,
    title: 'Reports and access',
    items: [
      'GST reports',
      'Sales reports',
      'Customer statements',
      'Business dashboard',
      'User roles & permissions',
      'Backup & data security',
    ],
  },
];

const AUDIENCE = [
  {
    icon: Store,
    title: 'Shops and traders',
    copy: 'Day-to-day GST invoices, stock and receivables in one web app.',
  },
  {
    icon: Package,
    title: 'Service providers',
    copy: 'SAC-coded invoices, estimates and payment tracking for billed work.',
  },
  {
    icon: IndianRupee,
    title: 'Growing businesses',
    copy: 'Roles, reports and a dashboard as the team and ledger get larger.',
  },
];

function InvoiceHero() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -right-6 top-8 h-24 w-24 rounded-full bg-cyan-400/25 blur-2xl" />
      <div className="relative rotate-[-1.5deg] rounded-[28px] border border-cyan-200 bg-white p-6 shadow-[0_24px_50px_rgba(8,47,73,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-[#0b3a6e]">
            <Receipt className="h-5 w-5 text-cyan-600" />
            TAX INVOICE
          </span>
          <span className="rounded-full bg-cyan-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
            GST IN
          </span>
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">
          Invoice # BCL-1048
        </p>
        <dl className="mt-3 space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <dt>Taxable value</dt>
            <dd>₹ 15,000</dd>
          </div>
          <div className="flex justify-between text-cyan-800">
            <dt>CGST 9% + SGST 9%</dt>
            <dd>₹ 2,700</dd>
          </div>
          <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 font-semibold text-[#0b3a6e]">
            <dt className="inline-flex items-center gap-1">
              <IndianRupee className="h-4 w-4" /> Total
            </dt>
            <dd>₹ 17,700</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-center text-xs font-semibold text-[#0b5ea8]">
          HSN / SAC ready · PDF invoice
        </p>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Illustrative layout only — not a live invoice.
        </p>
      </div>
    </div>
  );
}

export default async function GstBillingPage() {
  const product = await prisma.product.findUnique({ where: { slug: 'gst-billing' } });
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full border border-cyan-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#0b5ea8]">
              {product.category}
              <span className="h-px w-10 bg-cyan-500" />
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                {product.name}
              </h1>
              <span className="rounded-full bg-[#0b3a6e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200 ring-1 ring-cyan-300/50">
                GST Ready
              </span>
            </div>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              {COMPANY.gstBilling.subtitle}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Runs as a web application at finance.basecodelabs.com. Subscription, modules and
              tenant data follow the SaaS policy and the live agreement.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={GST_BILLING_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#0b5ea8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#094a86]"
              >
                Open BCL GST Billing
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/contact" className="bcl-btn bcl-btn-secondary">
                Discuss this product
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Platform', product.platform ?? 'Web (SaaS)'],
                ['License', product.licenseType ?? 'SaaS'],
                ['Pricing', product.pricingModel ?? 'Subscription'],
                ['Family', 'BCL'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <InvoiceHero />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0b5ea8]">
            Who it is for
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Billing for businesses that need a GST invoice
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{product.description}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {AUDIENCE.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-[#0b5ea8]">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0b5ea8]">
            Capabilities
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            What the published product includes
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Grouped from the BaseCode Central product record. Extra modules are only those enabled
            on your tenant.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <article
                key={group.title}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0b5ea8] shadow-sm">
                  <group.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{group.title}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-cyan-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-2 lg:px-6">
          <article className="rounded-[24px] border border-cyan-100 bg-white p-7">
            <Shield className="h-6 w-6 text-[#0b5ea8]" />
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              SaaS, not a desktop install
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You sign in at{' '}
              <a
                className="font-semibold text-[#0b5ea8]"
                href={GST_BILLING_URL}
                target="_blank"
                rel="noreferrer"
              >
                finance.basecodelabs.com
              </a>
              . Hosting, backups described on the product, and support follow the subscription and
              signed terms. Software is licensed, not sold, unless a contract says otherwise.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-[#0b5ea8]">
              <Link href="/legal/saas-policy">SaaS policy →</Link>
              <Link href="/legal/software-license">Software license →</Link>
            </div>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-7">
            <Receipt className="h-6 w-6 text-[#0b5ea8]" />
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              GST reports, not GSTN filing
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The product generates GST-compliant invoices and GST reports from your books. This
              page does not claim automatic filing on the GST portal, e-invoice IRN, or awards from
              any other website. Your chartered accountant and GSTN remain the filing authorities.
            </p>
            <Link
              href="/legal/disclaimer"
              className="mt-5 inline-flex text-sm font-semibold text-[#0b5ea8]"
            >
              Disclaimer →
            </Link>
          </article>
        </div>
      </section>

      <section className="bg-[#06243a] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-3xl font-semibold">Your tenant, your ledger</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-50/85">
            Invoice, customer and stock records belong to the business that holds the subscription.
            BaseCode Labs operates the application. We do not publish other tenants’ invoices on
            this marketing site.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              'Roles and permissions on the tenant',
              'Backup as described for the product',
              'Contact via email and phone support',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                {item}
              </li>
            ))}
          </ul>
          {product.supportPlan ? (
            <p className="mt-6 text-sm text-cyan-100/80">
              Support on the product record: {product.supportPlan}.
            </p>
          ) : null}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-xl font-semibold text-slate-900">Full published capability list</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {features.map((f) => (
              <li
                key={f}
                className="rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-medium text-[#0b3a6e]"
              >
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-[#0b5ea8]">
            <Link href="/products">← All products</Link>
            <Link href="/products/custom-software">Business Solutions →</Link>
            <Link href="/products/bcl-onecampus-erp">BCL OneCampus ERP →</Link>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need GST billing for your business?"
        description={`Open the live app or tell ${COMPANY.shortName} about your shop, service or enterprise.`}
      />
    </main>
  );
}
