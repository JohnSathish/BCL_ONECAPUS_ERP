import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  Cloud,
  Globe,
  GraduationCap,
  School,
  ShoppingBag,
  AppWindow,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: { absolute: 'Web Solutions | BaseCode Labs Pvt. Ltd.' },
  description:
    'School, college, diocese and corporate websites plus web applications from BaseCode Labs — designed, hosted and maintained. Published work includes live institution sites.',
  alternates: { canonical: '/products/web-solutions' },
  openGraph: {
    title: 'Web Solutions | BaseCode Labs Pvt. Ltd.',
    description:
      'Corporate, school and college websites plus web applications, with hosting and ongoing updates.',
  },
};

const KINDS = [
  {
    icon: School,
    title: 'School websites',
    copy: 'Public sites for parents and students — notices, admissions information and institution identity.',
  },
  {
    icon: GraduationCap,
    title: 'College websites',
    copy: 'Structured navigation for programmes, faculty, examinations and campus news.',
  },
  {
    icon: Building2,
    title: 'Corporate & diocese sites',
    copy: 'Organisation and province websites with a companion app when the engagement includes one.',
  },
  {
    icon: AppWindow,
    title: 'Web applications',
    copy: 'Purpose-built web apps when a brochure site is not enough.',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    copy: 'Catalogue and storefront sites where that is the signed scope.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Brief & structure',
    copy: 'Content, navigation and required pages before design starts.',
  },
  {
    n: '02',
    title: 'Design approval',
    copy: 'Layout is confirmed in writing. Work already approved is billable.',
  },
  {
    n: '03',
    title: 'Build & go live',
    copy: 'Development, hosting setup and domain registration as scoped.',
  },
  {
    n: '04',
    title: 'Host & maintain',
    copy: 'Renewals, updates and content changes follow the hosting term.',
  },
];

export default async function WebSolutionsPage() {
  const [product, projects] = await Promise.all([
    prisma.product.findUnique({ where: { slug: 'web-solutions' } }),
    prisma.portfolioProject.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full border border-emerald-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              {product.category}
              <span className="h-px w-10 bg-emerald-500" />
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              {product.description}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Sites below are taken from published client references. Hosting, domains and
              third-party plugins follow those providers’ rules and the quotation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Start a website project
              </Link>
              <Link href="/portfolio" className="bcl-btn bcl-btn-secondary">
                See published sites
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Platform', product.platform ?? 'Web'],
                ['Published sites', String(projects.length)],
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
              src="/images/products/web-devices.png"
              alt="Institution website on desktop and mobile"
              className="w-full object-contain drop-shadow-2xl"
            />
            <p className="absolute bottom-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-4 py-2 text-center text-[11px] font-semibold text-emerald-800 shadow-lg">
              Beautiful. Responsive. Results driven.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            What we build
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Websites that institutions can keep using
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KINDS.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            How a project runs
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Design, build, host, maintain
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                <span className="text-sm font-bold text-emerald-600">{step.n}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-500">
            Domain registration, premium plugins and cloud usage are third-party charges. See the{' '}
            <Link href="/legal/refund-policy" className="font-semibold text-emerald-700">
              refund &amp; cancellation policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Published work
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                Live sites referenced by our clients
              </h2>
            </div>
            <Link href="/portfolio" className="text-sm font-semibold text-emerald-700">
              Full portfolio →
            </Link>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id} className="rounded-[20px] border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  {project.industry}
                </p>
                <h3 className="mt-2 font-semibold text-slate-900">{project.clientName}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
                {project.websiteUrl ? (
                  <a
                    href={project.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"
                  >
                    {project.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#06281f] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-2 lg:px-6">
          <div>
            <Cloud className="h-6 w-6 text-emerald-300" />
            <h2 className="mt-3 text-3xl font-semibold">Hosting and updates</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/80">
              Hosting is typically prepaid per term. Cancellation should be requested before the
              renewal date on the invoice or BaseCode Central record. After renewal, host and
              registrar charges are usually non-refundable.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-emerald-50">
              {[
                'SSL and hosting as scoped',
                'Content updates under maintenance',
                'Domain billed at registrar rates',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Globe className="h-6 w-6 text-emerald-300" />
            <h2 className="mt-3 text-3xl font-semibold">Content and copyright</h2>
            <p className="mt-4 text-sm leading-7 text-emerald-50/80">
              Clients retain rights in logos, photographs and documents they supply. Page templates
              and our tooling stay with BaseCode Labs unless the signed project agreement assigns
              custom code.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/legal/website-usage"
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Website usage policy
              </Link>
              <Link
                href="/legal/intellectual-property"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
              >
                Intellectual property
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
                className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
              >
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-emerald-700">
            <Link href="/products">← All products</Link>
            <Link href="/products/mobile-applications">Mobile applications →</Link>
            <Link href="/products/bcl-onecampus-erp">BCL OneCampus ERP →</Link>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need a website for your institution?"
        description={`Tell ${COMPANY.shortName} about the site you need. Design, hosting and domains are confirmed in the quotation.`}
      />
    </main>
  );
}
