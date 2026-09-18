import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, Cloud, FileSignature, Link2, Network, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: { absolute: 'Business Solutions | BaseCode Labs Pvt. Ltd.' },
  description:
    'SaaS, CRM, APIs and purpose-built software from BaseCode Labs when a catalogue product is not enough. Scoped as a project; ownership follows the signed agreement.',
  alternates: { canonical: '/products/custom-software' },
  openGraph: {
    title: 'Business Solutions | BaseCode Labs Pvt. Ltd.',
    description:
      'SaaS, CRM, APIs and integrations for organisations that need more than a template product.',
  },
};

const KINDS = [
  {
    icon: Cloud,
    title: 'SaaS',
    copy: 'Multi-tenant or subscription products when you need your own application, not only a BCL catalogue tenant.',
  },
  {
    icon: Users,
    title: 'CRM',
    copy: 'Lead-to-client records for offices that need one place for enquiries, follow-ups and pipeline.',
  },
  {
    icon: Network,
    title: 'APIs',
    copy: 'Authenticated interfaces so other systems can read or write what the signed scope allows.',
  },
  {
    icon: Link2,
    title: 'Integrations',
    copy: 'Connect billing, campus, website or third-party tools where those providers and the quotation allow it.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Discovery',
    copy: 'What should exist, who uses it, and whether a catalogue product already covers it.',
  },
  {
    n: '02',
    title: 'Scope in writing',
    copy: 'Modules, milestones and hosts are confirmed before build. Approved work is billable.',
  },
  {
    n: '03',
    title: 'Build',
    copy: 'Development against that scope, with reviews at the milestones in the quotation.',
  },
  {
    n: '04',
    title: 'Support',
    copy: 'Hosting, fixes and change requests follow the support term — not an implied lifetime SLA.',
  },
];

const CHOOSE = [
  {
    title: 'Start with a BCL product',
    copy: 'Campus operations belong in OneCampus. GST invoices belong in BCL GST Billing. Websites and apps have their own families.',
  },
  {
    title: 'Commission custom work',
    copy: 'Use this family when the workflow is yours: a CRM, a SaaS you will operate, or APIs that no template product exposes.',
  },
];

export default async function CustomSoftwarePage() {
  const product = await prisma.product.findUnique({ where: { slug: 'custom-software' } });
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full border border-orange-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange-600">
              {product.category}
              <span className="h-px w-10 bg-orange-400" />
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              {product.description}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Custom software is project work: advance, milestones and hosting as written in the
              quotation. This page does not list invented products or unnamed enterprise clients.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Discuss a custom build
              </Link>
              <Link href="/products" className="bcl-btn bcl-btn-secondary">
                See catalogue products
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Platform', product.platform ?? 'Custom'],
                ['Code', product.code],
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
          <div className="relative">
            <img
              src="/images/products/custom-desktop.png"
              alt="Custom business software on a desktop"
              className="w-full object-contain drop-shadow-2xl"
            />
            <p className="absolute bottom-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-4 py-2 text-center text-[11px] font-semibold text-orange-800 shadow-lg">
              Illustrative mockup — not a live client dashboard
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
            What we build
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            When a template product is not enough
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {KINDS.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
            Catalogue or custom
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Choose the smaller honest path
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {CHOOSE.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-6"
              >
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-orange-700">
            <Link href="/products/bcl-onecampus-erp">BCL OneCampus ERP →</Link>
            <Link href="/products/gst-billing">BCL GST Billing →</Link>
            <Link href="/services">Services →</Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">
            How a project runs
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Discovery, scope, build, support
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-[20px] border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-orange-500">{step.n}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-500">
            Cloud usage, SMS, payment gateways and similar charges follow those providers. See the{' '}
            <Link href="/legal/refund-policy" className="font-semibold text-orange-700">
              refund &amp; cancellation policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-[#3d2410] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-2 lg:px-6">
          <div>
            <FileSignature className="h-6 w-6 text-orange-300" />
            <h2 className="mt-3 text-3xl font-semibold">Code and IP follow the contract</h2>
            <p className="mt-4 text-sm leading-7 text-orange-50/85">
              Ownership or license of custom source code follows the signed project agreement. This
              website does not claim that all custom code always belongs to the client or always
              belongs to BaseCode Labs.
            </p>
            <Link
              href="/legal/intellectual-property"
              className="mt-6 inline-flex rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Intellectual property
            </Link>
          </div>
          <div>
            <Cloud className="h-6 w-6 text-orange-300" />
            <h2 className="mt-3 text-3xl font-semibold">APIs and acceptable use</h2>
            <p className="mt-4 text-sm leading-7 text-orange-50/85">
              Authenticated APIs, where we build them, are not a licence to scan, overload or
              reverse-engineer systems. Third-party processors (hosting, mail, payments) keep their
              own terms.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/legal/acceptable-use"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
              >
                Acceptable use
              </Link>
              <Link
                href="/legal/third-party-services"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
              >
                Third-party services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-xl font-semibold text-slate-900">Published capability list</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900"
              >
                <Check className="h-4 w-4 text-orange-500" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-orange-700">
            <Link href="/products">← All products</Link>
            <Link href="/products/gst-billing">BCL GST Billing →</Link>
            <Link href="/products/web-solutions">Web solutions →</Link>
            <Link href="/products/mobile-applications" className="inline-flex items-center gap-1">
              Mobile applications <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need software that is not in the catalogue?"
        description={`Tell ${COMPANY.shortName} what should exist. Discovery and a written quotation come first.`}
      />
    </main>
  );
}
