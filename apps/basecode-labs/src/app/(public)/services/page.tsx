import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  Database,
  Globe,
  KeyRound,
  Shield,
  Smartphone,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { EmptyState, SiteCta } from '@/components/ui/page-shell';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: { absolute: 'Services | BaseCode Labs Pvt. Ltd.' },
  description:
    'Software, websites, mobile apps, hosting and digital programmes from BaseCode Labs — for schools, colleges, dioceses and businesses in Tamil Nadu, Meghalaya and across India.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Services | BaseCode Labs Pvt. Ltd.',
    description:
      'End-to-end technology services: software, web, mobile, infrastructure and digital.',
  },
};

const ORDER = ['Software Development', 'Web', 'Mobile', 'Infrastructure', 'Digital'] as const;

const THEMES: Record<
  string,
  { accent: string; iconWrap: string; check: string; icon: typeof Code2; blurb: string }
> = {
  'Software Development': {
    accent: 'text-blue-600',
    iconWrap: 'bg-sky-50 text-sky-700',
    check: 'text-sky-600',
    icon: Code2,
    blurb: 'Licensed ERP and purpose-built software when a catalogue product is not enough.',
  },
  Web: {
    accent: 'text-emerald-700',
    iconWrap: 'bg-emerald-50 text-emerald-700',
    check: 'text-emerald-600',
    icon: Globe,
    blurb: 'School, college, corporate and organisation websites, plus web applications.',
  },
  Mobile: {
    accent: 'text-violet-700',
    iconWrap: 'bg-violet-50 text-violet-700',
    check: 'text-violet-600',
    icon: Smartphone,
    blurb: 'Android, iOS and cross-platform apps, including campus apps licensed with OneCampus.',
  },
  Infrastructure: {
    accent: 'text-orange-600',
    iconWrap: 'bg-orange-50 text-orange-600',
    check: 'text-orange-500',
    icon: Database,
    blurb: 'Hosting, cloud, servers and security as scoped — renewals follow the invoice term.',
  },
  Digital: {
    accent: 'text-green-700',
    iconWrap: 'bg-green-50 text-green-700',
    check: 'text-green-600',
    icon: BarChart3,
    blurb: 'SEO, maintenance retainers and moving paper processes onto licensed software.',
  },
};

const RELATED: Record<string, { href: string; label: string }> = {
  erp: { href: '/products/bcl-onecampus-erp', label: 'BCL OneCampus ERP' },
  crm: { href: '/products/custom-software', label: 'Business Solutions' },
  'custom-software-svc': { href: '/products/custom-software', label: 'Business Solutions' },
  saas: { href: '/products/custom-software', label: 'Business Solutions' },
  'corporate-websites': { href: '/products/web-solutions', label: 'Web Solutions' },
  'school-websites': { href: '/products/web-solutions', label: 'Web Solutions' },
  'college-websites': { href: '/products/web-solutions', label: 'Web Solutions' },
  ecommerce: { href: '/products/web-solutions', label: 'Web Solutions' },
  'web-apps': { href: '/products/web-solutions', label: 'Web Solutions' },
  android: { href: '/products/mobile-applications', label: 'Mobile Applications' },
  ios: { href: '/products/mobile-applications', label: 'Mobile Applications' },
  'cross-platform': { href: '/products/mobile-applications', label: 'Mobile Applications' },
};

function categoryId(category: string) {
  return category.toLowerCase().replace(/\s+/g, '-');
}

export default async function ServicesPage() {
  const services = await prisma.serviceItem.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
  });
  const grouped = services.reduce<Record<string, typeof services>>((acc, s) => {
    acc[s.category] = acc[s.category] ?? [];
    acc[s.category].push(s);
    return acc;
  }, {});
  const categories = [
    ...ORDER.filter((c) => grouped[c]?.length),
    ...Object.keys(grouped).filter((c) => !ORDER.includes(c as (typeof ORDER)[number])),
  ];

  return (
    <main className="overflow-hidden bg-[#eef3f9]">
      <section className="relative border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full border border-sky-100" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 lg:px-6 lg:py-16">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
            Our services
            <span className="h-px w-10 bg-blue-500" />
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
            End-to-end <span className="text-blue-600">technology services</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
            Software, websites, mobile apps, hosting and digital programmes for schools, colleges,
            dioceses and businesses. Work is quoted in writing. Licensed products stay licensed;
            websites and custom builds are typically projects.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/contact" className="bcl-btn bcl-btn-primary gap-2">
              Discuss a service
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/products" className="bcl-btn bcl-btn-secondary">
              View products
            </Link>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COMPANY.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <dt className="text-lg font-semibold text-slate-900">{stat.value}</dt>
                <dd className="text-[11px] uppercase tracking-wide text-slate-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
          {categories.length ? (
            <nav aria-label="Service sections" className="mt-8 flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category}
                  href={`#${categoryId(category)}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                >
                  {category}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      {categories.length ? (
        categories.map((category) => {
          const theme = THEMES[category] ?? THEMES.Digital;
          const Icon = theme.icon;
          const items = grouped[category] ?? [];
          return (
            <section key={category} id={categoryId(category)} className="scroll-mt-28 py-14">
              <div className="mx-auto max-w-7xl px-4 lg:px-6">
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                      theme.iconWrap,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-[0.22em]',
                        theme.accent,
                      )}
                    >
                      {category}
                    </p>
                    <h2 className="mt-1 text-3xl font-semibold text-slate-900">{category}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{theme.blurb}</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {items.map((item) => {
                    const features = JSON.parse(item.featuresJson) as string[];
                    const related = RELATED[item.slug];
                    return (
                      <article
                        key={item.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-6"
                      >
                        <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                        {features.length ? (
                          <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                            {features.map((f) => (
                              <li key={f} className="flex items-center gap-2">
                                <Check className={cn('h-4 w-4 shrink-0', theme.check)} />
                                {f}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {item.technologies ? (
                          <p className="mt-3 text-xs text-slate-500">Tech: {item.technologies}</p>
                        ) : null}
                        {item.industries ? (
                          <p className="text-xs text-slate-500">Industries: {item.industries}</p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                          {related ? (
                            <Link href={related.href} className={theme.accent}>
                              {related.label} →
                            </Link>
                          ) : null}
                          <Link href="/contact" className="text-slate-600">
                            Discuss this service
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })
      ) : (
        <div className="bcl-container py-12">
          <EmptyState
            title="No services published"
            description="Published service items from BaseCode Central will appear here."
          />
        </div>
      )}

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            How we engage
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">
            License, project or hosting term
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Licensed products</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                BCL OneCampus and other licensed software are activated per institution. Software is
                licensed, not sold, unless a signed contract says otherwise.
              </p>
              <Link
                href="/legal/software-license"
                className="mt-4 inline-flex text-sm font-semibold text-blue-700"
              >
                Software license →
              </Link>
            </article>
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
              <Code2 className="h-5 w-5 text-orange-600" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Project work</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Websites, custom software and most apps are quoted with advance and milestones.
                Ownership of custom code follows that agreement.
              </p>
              <Link
                href="/legal/refund-policy"
                className="mt-4 inline-flex text-sm font-semibold text-orange-700"
              >
                Refund &amp; cancellation →
              </Link>
            </article>
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
              <Shield className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Hosting and support</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Hosting is typically prepaid per term. We do not invent SLA minutes on this page.
                Availability follows the service agreement and the{' '}
                <Link href="/legal/service-level" className="font-semibold text-emerald-800">
                  service level policy
                </Link>
                .
              </p>
            </article>
          </div>
        </div>
      </section>

      <SiteCta
        title="Need a service for your institution?"
        description={`Tell ${COMPANY.shortName} whether you need ERP, a website, an app, hosting or custom software.`}
      />
    </main>
  );
}
