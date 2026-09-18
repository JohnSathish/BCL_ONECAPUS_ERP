import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Cloud,
  GraduationCap,
  Handshake,
  Headset,
  MapPin,
  Receipt,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { prisma } from '@/lib/prisma';
import { SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = {
  title: { absolute: 'About BaseCode Labs | BaseCode Labs Pvt. Ltd.' },
  description:
    'BaseCode Labs Pvt. Ltd. builds ERP, GST billing, websites and mobile apps for schools, colleges and businesses, with offices in Bhuvanagiri, Tamil Nadu and Tura, Meghalaya.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About BaseCode Labs | BaseCode Labs Pvt. Ltd.',
    description:
      'Technology, innovation and partnership for institutions in Tamil Nadu and Meghalaya.',
  },
};

const VALUES = [
  {
    icon: Shield,
    title: 'Reliable technology',
    copy: 'Software institutions can actually run, host and support — including BCL OneCampus ERP and BCL GST Billing.',
  },
  {
    icon: Workflow,
    title: 'Practical solutions',
    copy: 'We start from the workflow on the ground, not from a frozen template catalogue.',
  },
  {
    icon: Handshake,
    title: 'Transparent partnership',
    copy: 'Clear communication, written licenses and honest reporting. Signed agreements prevail.',
  },
  {
    icon: Headset,
    title: 'Long-term support',
    copy: 'Hosting, updates and licensing through BaseCode Central, with published email and phone support.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Listen & plan',
    copy: 'We start with research, your process and a written scope.',
  },
  {
    n: '02',
    title: 'Design & build',
    copy: 'Customised websites, ERP, GST billing or apps — not a one-size demo.',
  },
  { n: '03', title: 'Go live', copy: 'Hosting, licenses, training and a clear handover.' },
  {
    n: '04',
    title: 'Stay with you',
    copy: 'Updates, support and renewals through BaseCode Central.',
  },
];

const BUILD = [
  {
    href: '/products/bcl-onecampus-erp',
    icon: GraduationCap,
    title: 'BCL OneCampus ERP',
    copy: 'School and college operations — students, fees, exams, attendance and more.',
  },
  {
    href: '/products/gst-billing',
    icon: Receipt,
    title: 'BCL GST Billing',
    copy: 'GST invoices, inventory, payments and reports for growing businesses.',
  },
  {
    href: '/products/web-solutions',
    icon: Building2,
    title: 'Web solutions',
    copy: 'Corporate, school and college websites plus web applications.',
  },
  {
    href: '/products/mobile-applications',
    icon: Smartphone,
    title: 'Mobile applications',
    copy: 'Android and iOS apps for campuses, parents, staff and field teams.',
  },
  {
    href: '/products/custom-software',
    icon: Cloud,
    title: 'Custom software',
    copy: 'SaaS, CRM, APIs and integrations when a product catalogue is not enough.',
  },
];

const SERVE = [
  {
    href: '/industries#schools',
    title: 'Schools',
    copy: 'Administration, parent communication and campus websites.',
  },
  {
    href: '/industries#colleges',
    title: 'Colleges',
    copy: 'Academic operations, examinations and public sites.',
  },
  {
    href: '/industries#dioceses',
    title: 'Dioceses & provinces',
    copy: 'Province websites and companion mobile apps.',
  },
  {
    href: '/industries#businesses',
    title: 'Businesses',
    copy: 'GST billing, corporate sites and custom software.',
  },
];

export default async function AboutPage() {
  const logos = await prisma.clientLogo.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
  });

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full border border-sky-100" />
        <div className="pointer-events-none absolute right-32 top-20 h-24 w-24 rotate-12 rounded-3xl border border-indigo-100" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-6 lg:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
              About BaseCode Labs
              <span className="h-px w-10 bg-blue-500" />
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Technology. Innovation. <span className="text-blue-600">Partnership.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-600">
              {COMPANY.aboutBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="bcl-btn bcl-btn-primary gap-2">
                Start a project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/products" className="bcl-btn bcl-btn-secondary">
                View products
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COMPANY.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <dt className="text-xl font-bold text-slate-900">{stat.value}</dt>
                  <dd className="text-[11px] leading-snug text-slate-500">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              <img
                src="/images/about/hero-5.jpg"
                alt="BaseCode Labs team collaborating"
                className="h-52 w-full rounded-[22px] object-cover shadow-md sm:h-64"
              />
              <img
                src="/images/about/hero-2.jpg"
                alt="Software development workstation"
                className="mt-8 h-52 w-full rounded-[22px] object-cover shadow-md sm:h-64"
              />
            </div>
            <div className="absolute -bottom-4 left-6 rounded-2xl bg-[#0b3a6e] px-4 py-3 text-white shadow-lg">
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                {COMPANY.tagline}
              </p>
              <p className="text-sm font-semibold">Tamil Nadu · Meghalaya</p>
            </div>
          </div>
        </div>
      </section>

      {logos.length ? (
        <section className="border-b border-slate-200 bg-white py-8">
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Institutions that have published references
          </p>
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 px-4">
            {logos.map((logo) => (
              <a
                key={logo.id}
                href={logo.website ?? '/testimonials'}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                {logo.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section id="story" className="scroll-mt-24 py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Who we are
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              A technology partner institutions can run with
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              {COMPANY.legalName} is a private limited company with a registered office in
              Bhuvanagiri, Tamil Nadu and an operational office in Tura, Meghalaya. We build and
              support websites, licensed ERP, GST billing, mobile applications and hosting for
              schools, colleges, dioceses and businesses.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              The work is delivered as products and projects — BCL OneCampus ERP for campuses, BCL
              GST Billing for businesses, and custom websites or apps when that is the right fit.
              Licenses and client records live in BaseCode Central.
            </p>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <img
              src="/images/about/campus.jpg"
              alt="Development workspace"
              className="h-72 w-full object-cover"
            />
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Mission</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{COMPANY.mission}</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                  How we work
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{COMPANY.howWeWork}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            What we build
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            Products and services in one company
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BUILD.map((item) => (
              <Link key={item.href} href={item.href} className="bcl-card group flex flex-col p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.copy}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                  Learn more{' '}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Engagement
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            From first conversation to ongoing support
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-[20px] border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-cyan-600">{step.n}</span>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">Why organisations work with us</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((item) => (
              <article
                key={item.title}
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Who we serve
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                Sectors we already work in
              </h2>
            </div>
            <Link href="/industries" className="text-sm font-semibold text-blue-700">
              All industries →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVE.map((item) => (
              <Link key={item.href} href={item.href} className="bcl-card p-5">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1b33] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Where we work
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Two offices. One company.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            BaseCode Labs is a software company in Tamil Nadu and a technology partner in Meghalaya
            — school ERP, college websites, GST billing, Android apps, hosting and support.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-[20px] border border-white/10 bg-white/5 p-6">
              <MapPin className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-cyan-200">
                {COMPANY.registeredOffice.name}
              </p>
              <p className="mt-2 text-lg font-semibold">Bhuvanagiri, Tamil Nadu</p>
              <p className="mt-1 text-sm text-slate-300">
                {COMPANY.registeredOffice.line1}
                <br />
                {COMPANY.registeredOffice.line2}
              </p>
            </article>
            <article className="rounded-[20px] border border-white/10 bg-white/5 p-6">
              <Building2 className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-cyan-200">
                {COMPANY.operationalOffice.name}
              </p>
              <p className="mt-2 text-lg font-semibold">Tura, Meghalaya</p>
              <p className="mt-1 text-sm text-slate-300">
                {COMPANY.operationalOffice.line1}
                <br />
                {COMPANY.operationalOffice.line2}
              </p>
            </article>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
            <a className="hover:text-white" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            <span>{COMPANY.phoneDisplay} / +91 87784 63459</span>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center lg:px-6">
          <div className="flex items-start gap-3">
            <Users className="mt-1 h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Published client stories</h2>
              <p className="mt-1 text-sm text-slate-600">
                {COMPANY.stats[2].value} named testimonials are on this website — we do not invent
                extra awards or client counts.
              </p>
            </div>
          </div>
          <Link href="/testimonials" className="bcl-btn bcl-btn-primary gap-2">
            Read client stories
            <Sparkles className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteCta />
    </main>
  );
}
