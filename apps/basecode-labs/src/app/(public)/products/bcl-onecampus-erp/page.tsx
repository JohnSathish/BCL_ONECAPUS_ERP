import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  KeyRound,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';

export const metadata: Metadata = {
  title: { absolute: 'BCL OneCampus ERP | BaseCode Labs Pvt. Ltd.' },
  description:
    'Institution management for schools and colleges — students, staff, admissions, academics, attendance, fees, examinations, library, portals and mobile apps. Licensed by BaseCode Labs.',
  alternates: { canonical: '/products/bcl-onecampus-erp' },
  openGraph: {
    title: 'BCL OneCampus ERP | BaseCode Labs Pvt. Ltd.',
    description:
      'Complete campus operations platform for schools and colleges, licensed through BaseCode Central.',
  },
};

const MODULES = [
  {
    icon: Users,
    title: 'People & admissions',
    items: ['Student management', 'Staff management', 'Admissions'],
  },
  {
    icon: BookOpen,
    title: 'Academics',
    items: ['Academics', 'Attendance', 'Examination', 'Certificates', 'Reports'],
  },
  {
    icon: Wallet,
    title: 'Campus operations',
    items: ['Fees', 'Library', 'Accounts', 'HR'],
  },
  {
    icon: Smartphone,
    title: 'Access & communication',
    items: [
      'Parent portal',
      'Student portal',
      'Staff portal',
      'Mobile applications',
      'SMS',
      'Notifications',
    ],
  },
];

const ROLES = [
  {
    title: 'The institution',
    copy: 'Controls student, parent, staff, fee and examination records. Decides who may sign in and which modules are used.',
  },
  {
    title: 'BaseCode Labs',
    copy: 'Provides and operates the licensed platform, hosting and support under the service agreement. We do not replace the institution as data steward.',
  },
  {
    title: 'Students, parents and staff',
    copy: 'Use the institution’s tenant through portals and apps. Information they see is managed by the campus, not by this public website.',
  },
];

export default async function OneCampusPage() {
  const product = await prisma.product.findUnique({ where: { slug: 'bcl-onecampus-erp' } });
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full border border-sky-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
              {product.category}
              <span className="h-px w-10 bg-blue-500" />
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                {product.name}
              </h1>
              <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                Most popular
              </span>
            </div>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
              {product.description}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500">
              OneCampus is licensed per institution. Exact modules, user bands and campuses follow
              the license record in BaseCode Central and the signed agreement.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="bcl-btn bcl-btn-primary gap-2">
                Discuss this product
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/legal/software-license" className="bcl-btn bcl-btn-secondary">
                Software license
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Platform', product.platform ?? 'Web + Android + iOS'],
                ['License', product.licenseType ?? 'Annual'],
                ['Version', product.version],
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
              src="/images/products/erp-laptop.png"
              alt="BCL OneCampus ERP on a laptop"
              className="relative z-10 w-full object-contain drop-shadow-2xl"
            />
            <p className="absolute bottom-4 left-1/2 z-20 w-max max-w-[90%] -translate-x-1/2 rounded-2xl bg-white px-4 py-2 text-center text-[11px] font-semibold text-sky-800 shadow-lg">
              All-in-one operations for modern institutions
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Modules</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Campus operations in one licensed platform
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Institutions enable the modules they need. The catalogue below matches the published
            OneCampus capability list — extra modules are only those sold on the license.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {MODULES.map((group) => (
              <article
                key={group.title}
                className="rounded-[22px] border border-slate-200 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <group.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{group.title}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-sky-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Portals and apps
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              The campus, parents and staff on one stack
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              OneCampus includes parent, student and staff portals plus mobile applications where
              the institution licenses them. Push notifications and SMS are used only when the
              campus enables those channels.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {['Parent Portal', 'Student Portal', 'Staff Portal', 'Mobile Applications'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <Link
              href="/products/mobile-applications"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            >
              Related: Mobile applications <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <img
            src="/images/products/mobile-phones.png"
            alt="OneCampus mobile apps on two phones"
            className="w-full max-w-md justify-self-center object-contain drop-shadow-xl"
          />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Who controls the data
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Institution records stay the institution’s
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ROLES.map((item) => (
              <article
                key={item.title}
                className="rounded-[20px] border border-slate-200 bg-white p-5"
              >
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-blue-700">
            <Link href="/legal/institutional-data">Institutional Data &amp; ERP Privacy →</Link>
            <Link href="/legal/privacy-policy">Privacy Policy →</Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1b33] py-16 text-white">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Licensing
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Licensed, not sold</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Activation uses a license key, institution identifier, subscription period and
              remaining activation capacity. Heartbeats and device or session limits may apply as
              configured for that campus. Renewal extends the period on the license record.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              {[
                'Annual license unless the quotation says otherwise',
                'Limits for students, users, campuses and modules as sold',
                'Suspension for expiry, non-payment or contract violation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/legal/software-license"
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Software License Agreement
              </Link>
              <Link
                href="/legal/saas-policy"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold"
              >
                SaaS &amp; subscription
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-4">
            <img
              src="/images/products/erp-dashboard.png"
              alt="OneCampus operations dashboard"
              className="w-full rounded-2xl object-cover"
            />
            <p className="mt-3 text-xs text-slate-400">
              Product interface illustration from the BaseCode Labs catalogue.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-xl font-semibold text-slate-900">Published capability list</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="text-sm font-semibold text-blue-700">
              ← All products
            </Link>
            <Link href="/products/gst-billing" className="text-sm font-semibold text-blue-700">
              BCL GST Billing →
            </Link>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need OneCampus for your campus?"
        description={`Tell ${COMPANY.shortName} about your school or college. Licensing and modules are confirmed in writing.`}
      />
    </main>
  );
}
