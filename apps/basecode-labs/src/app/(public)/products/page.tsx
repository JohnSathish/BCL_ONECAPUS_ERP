import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, KeyRound, Shield, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { EmptyState, SiteCta } from '@/components/ui/page-shell';
import { ProductsSection } from '@/components/public/products-section';
import { COMPANY } from '@/lib/company';
import { GST_BILLING_URL } from '@/lib/products-display';

export const metadata: Metadata = {
  title: { absolute: 'Products | BaseCode Labs Pvt. Ltd.' },
  description:
    'BCL OneCampus ERP, BCL GST Billing, websites, mobile apps and custom software from BaseCode Labs — licensed products and project work for schools, colleges and businesses.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: 'Products | BaseCode Labs Pvt. Ltd.',
    description:
      'Technology built for real-world organisations: ERP, GST billing, websites, apps and custom software.',
  },
};

const JUMP = [
  { href: '#bcl-onecampus-erp', label: 'ERP' },
  { href: '#web-solutions', label: 'Website' },
  { href: '#mobile-applications', label: 'Mobile' },
  { href: '#gst-billing', label: 'GST Billing' },
  { href: '#custom-software', label: 'Custom' },
];

const AUDIENCE = [
  {
    title: 'Schools',
    copy: 'Administration, fees, attendance, parent apps and school websites.',
    href: '/industries#schools',
  },
  {
    title: 'Colleges',
    copy: 'Academic operations, examinations, staff portals and college sites.',
    href: '/industries#colleges',
  },
  {
    title: 'Businesses',
    copy: 'GST invoicing, inventory, payments and corporate web applications.',
    href: '/industries#businesses',
  },
  {
    title: 'Dioceses',
    copy: 'Province websites and companion mobile applications.',
    href: '/industries#dioceses',
  },
];

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
  });

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full border border-sky-100" />
        <div className="pointer-events-none absolute right-40 top-24 h-20 w-20 rotate-12 rounded-3xl border border-cyan-100" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
            Our products
            <span className="h-px w-10 bg-blue-500" />
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
            Technology built for <span className="text-blue-600">real-world organisations</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
            Licensed ERP for campuses, GST billing for businesses, websites, institutional apps and
            custom software. Product records are published from BaseCode Central — the signed
            agreement still governs each engagement.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/contact" className="bcl-btn bcl-btn-primary gap-2">
              Discuss a product
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={GST_BILLING_URL}
              target="_blank"
              rel="noreferrer"
              className="bcl-btn bcl-btn-secondary"
            >
              Open BCL GST Billing
            </a>
          </div>
          <nav aria-label="Product sections" className="mt-8 flex flex-wrap gap-2">
            {JUMP.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {products.length ? (
        <ProductsSection products={products} heading={false} />
      ) : (
        <div className="bcl-container py-12">
          <EmptyState
            title="No products published"
            description="Published products from BaseCode Central will appear here."
          />
        </div>
      )}

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Who it is for
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Built around the organisations we already serve
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE.map((item) => (
              <Link key={item.title} href={item.href} className="bcl-card p-5">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                  Industry notes <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-3 lg:px-6">
          <article className="bcl-card p-6">
            <KeyRound className="h-5 w-5 text-blue-700" />
            <h2 className="mt-3 text-lg font-semibold">How licensing works</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              BCL OneCampus and other licensed products are activated with a license key,
              institution identity and subscription period in BaseCode Central. Software is
              licensed, not sold, unless a signed contract says otherwise.
            </p>
            <Link
              href="/legal/software-license"
              className="mt-4 inline-flex text-sm font-semibold text-blue-700"
            >
              Software License →
            </Link>
          </article>
          <article className="bcl-card p-6">
            <Shield className="h-5 w-5 text-cyan-700" />
            <h2 className="mt-3 text-lg font-semibold">GST billing as SaaS</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {COMPANY.gstBilling.name} runs as a web application at finance.basecodelabs.com.
              Subscription, modules and data handling follow the SaaS policy and the live tenant
              agreement.
            </p>
            <Link
              href="/legal/saas-policy"
              className="mt-4 inline-flex text-sm font-semibold text-blue-700"
            >
              SaaS policy →
            </Link>
          </article>
          <article className="bcl-card p-6">
            <Users className="h-5 w-5 text-violet-700" />
            <h2 className="mt-3 text-lg font-semibold">Websites and custom work</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Web, mobile and custom software are typically scoped as projects — advance, milestones
              and hosting as written in the quotation. Ownership of custom code follows that signed
              agreement.
            </p>
            <Link
              href="/legal/refund-policy"
              className="mt-4 inline-flex text-sm font-semibold text-blue-700"
            >
              Refund &amp; cancellation →
            </Link>
          </article>
        </div>
      </section>

      <SiteCta
        title="Need a product for your campus or business?"
        description="Tell us whether you need ERP, GST billing, a website or a custom application. We typically respond within 24 hours."
      />
    </main>
  );
}
