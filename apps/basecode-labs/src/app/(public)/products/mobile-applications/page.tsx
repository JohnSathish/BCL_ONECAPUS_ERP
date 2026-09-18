import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  Check,
  Church,
  GraduationCap,
  KeyRound,
  Smartphone,
  Store,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: { absolute: 'Mobile Applications | BaseCode Labs Pvt. Ltd.' },
  description:
    'Android, iOS and cross-platform apps from BaseCode Labs — campus parent and staff apps with BCL OneCampus, and custom organisation apps such as the Salesian Province of Guwahati Android application.',
  alternates: { canonical: '/products/mobile-applications' },
  openGraph: {
    title: 'Mobile Applications | BaseCode Labs Pvt. Ltd.',
    description:
      'Android, iOS and cross-platform applications for campuses, dioceses and businesses.',
  },
};

const KINDS = [
  {
    icon: GraduationCap,
    title: 'Campus apps',
    copy: 'Parent, student and staff apps where the institution licenses them with BCL OneCampus.',
  },
  {
    icon: Church,
    title: 'Organisation apps',
    copy: 'Dedicated applications for dioceses and organisations — alongside a website when that is the signed scope.',
  },
  {
    icon: Smartphone,
    title: 'Android, iOS, cross-platform',
    copy: 'Native or shared codebases as scoped. Published work includes an Android application for the Salesian Province of Guwahati.',
  },
  {
    icon: Bell,
    title: 'Push notifications',
    copy: 'Device notifications only when the institution or organisation enables them. SMS remains a separate channel.',
  },
  {
    icon: Store,
    title: 'Store publishing',
    copy: 'We can prepare listings for Google Play and the App Store. Review, fees and policies belong to those stores.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Brief & platforms',
    copy: 'Who the app is for, Android and/or iOS, and how it connects to a website or ERP.',
  },
  {
    n: '02',
    title: 'Design approval',
    copy: 'Screens are confirmed in writing. Work already approved is billable.',
  },
  {
    n: '03',
    title: 'Build & test',
    copy: 'Development against the signed scope, with test builds before a store or campus release.',
  },
  {
    n: '04',
    title: 'Publish & maintain',
    copy: 'Store submission, updates and hosting follow the quotation and those providers’ rules.',
  },
];

export default async function MobileApplicationsPage() {
  const [product, mobileProjects] = await Promise.all([
    prisma.product.findUnique({ where: { slug: 'mobile-applications' } }),
    prisma.portfolioProject.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { services: { contains: 'Android' } },
          { services: { contains: 'mobile' } },
          { technologies: { contains: 'Android' } },
        ],
      },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-20 top-8 h-56 w-56 rounded-full border border-violet-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
              {product.category}
              <span className="h-px w-10 bg-violet-500" />
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              {product.description}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              Custom apps are project work. OneCampus mobile apps follow the institution’s license.
              Store fees and review times are set by Google and Apple, not by this website.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Discuss an app
              </Link>
              <Link href="/case-studies" className="bcl-btn bcl-btn-secondary">
                Published case study
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Platform', product.platform ?? 'Android + iOS'],
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
              src="/images/products/mobile-phones.png"
              alt="Campus mobile apps on two phones"
              className="w-full object-contain drop-shadow-2xl"
            />
            <p className="absolute bottom-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-4 py-2 text-center text-[11px] font-semibold text-violet-800 shadow-lg">
              One app. Every connection.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
            What we build
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Apps for campuses and organisations
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KINDS.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
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
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-2 lg:px-6">
          <article className="rounded-[24px] border border-violet-100 bg-violet-50/60 p-7">
            <KeyRound className="h-6 w-6 text-violet-700" />
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Licensed with OneCampus</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Parent, student and staff apps ship with BCL OneCampus where the institution licenses
              them. Sign-in, modules and records stay under that campus’s tenant — not a separate
              public download unless the license says so.
            </p>
            <Link
              href="/products/bcl-onecampus-erp"
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-violet-800"
            >
              BCL OneCampus ERP <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-7">
            <Smartphone className="h-6 w-6 text-violet-700" />
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Custom project apps</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Standalone Android or iOS work is quoted as a project: advance, milestones, store
              accounts and maintenance. Ownership of custom code follows the signed agreement.
            </p>
            <Link
              href="/legal/refund-policy"
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-violet-800"
            >
              Refund &amp; cancellation <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
            How a project runs
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            From brief to store listing
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-[20px] border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-violet-600">{step.n}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-500">
            App-store fees, review outcomes and developer-account rules belong to Google Play and
            Apple. See the{' '}
            <Link href="/legal/refund-policy" className="font-semibold text-violet-700">
              refund policy
            </Link>{' '}
            and{' '}
            <Link href="/legal/third-party-services" className="font-semibold text-violet-700">
              third-party services
            </Link>
            .
          </p>
        </div>
      </section>

      {mobileProjects.length > 0 ? (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
              Published work
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Referenced mobile engagements
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Taken from published client references. We do not list store ratings or download
              counts here.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {mobileProjects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-6"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                    {project.industry}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {project.clientName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
                  <p className="mt-3 text-xs font-medium text-slate-500">{project.services}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-violet-800">
                    <Link href="/case-studies">Case study →</Link>
                    {project.websiteUrl ? (
                      <a href={project.websiteUrl} target="_blank" rel="noreferrer">
                        Related website →
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="bg-[#1b1030] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-3xl font-semibold">Devices, push and data</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-violet-100/85">
            Apps may register a device for push notifications and session control. License or
            security policy may limit concurrent devices. Institution records in OneCampus stay the
            institution’s; custom app data follows that project’s agreement.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              'Log out on shared or lost devices',
              'Tell the institution if a device is stolen',
              'Push only when the operator enables it',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/legal/institutional-data"
              className="rounded-full bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Institutional data
            </Link>
            <Link
              href="/legal/acceptable-use"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
            >
              Acceptable use
            </Link>
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
                className="rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900"
              >
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-violet-700">
            <Link href="/products">← All products</Link>
            <Link href="/products/web-solutions">Web solutions →</Link>
            <Link href="/products/bcl-onecampus-erp">BCL OneCampus ERP →</Link>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need an app for your campus or organisation?"
        description={`Tell ${COMPANY.shortName} whether you need OneCampus mobile access or a custom Android / iOS project.`}
      />
    </main>
  );
}
