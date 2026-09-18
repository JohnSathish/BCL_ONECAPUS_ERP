import Link from 'next/link';
import {
  Check,
  Globe,
  GraduationCap,
  IndianRupee,
  Monitor,
  Play,
  Receipt,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { GST_BILLING_URL } from '@/lib/products-display';
import { COMPANY } from '@/lib/company';

type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  featuresJson: string;
};

const THEMES: Record<
  string,
  {
    wrap: string;
    iconWrap: string;
    check: string;
    btn: string;
    ghost: string;
    pill: string;
    badge?: string;
    visual: 'erp' | 'web' | 'mobile' | 'desktop' | 'gst';
    caption: string;
    secondary: string;
  }
> = {
  'bcl-onecampus-erp': {
    wrap: 'border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50',
    iconWrap: 'bg-sky-600 text-white',
    check: 'text-sky-600',
    btn: 'bg-sky-600 text-white hover:bg-sky-700',
    ghost: 'border-sky-200 text-sky-800',
    pill: 'bg-white text-sky-800',
    badge: 'Most Popular',
    visual: 'erp',
    caption: 'All-in-one solution for modern institutions',
    secondary: 'Watch Video',
  },
  'web-solutions': {
    wrap: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50',
    iconWrap: 'bg-emerald-600 text-white',
    check: 'text-emerald-600',
    btn: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'border-emerald-200 text-emerald-800',
    pill: 'bg-white text-emerald-800',
    visual: 'web',
    caption: 'Beautiful. Responsive. Results Driven.',
    secondary: 'See sites',
  },
  'mobile-applications': {
    wrap: 'border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50',
    iconWrap: 'bg-violet-600 text-white',
    check: 'text-violet-600',
    btn: 'bg-violet-600 text-white hover:bg-violet-700',
    ghost: 'border-violet-200 text-violet-800',
    pill: 'bg-white text-violet-800',
    visual: 'mobile',
    caption: 'One App. Every Connection.',
    secondary: 'Watch Demo',
  },
  'gst-billing': {
    wrap: 'border-cyan-200 bg-gradient-to-br from-[#f4fbff] via-white to-sky-50 ring-1 ring-cyan-100',
    iconWrap: 'bg-[#0b3a6e] text-cyan-200',
    check: 'text-cyan-600',
    btn: 'bg-[#0b5ea8] text-white hover:bg-[#094a86]',
    ghost: 'border-cyan-200 text-[#0b3a6e]',
    pill: 'bg-[#0b3a6e] text-cyan-100',
    badge: 'GST Ready',
    visual: 'gst',
    caption: 'Tax invoices. Clear GST. One ledger.',
    secondary: 'Open product',
  },
  'custom-software': {
    wrap: 'border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50',
    iconWrap: 'bg-orange-500 text-white',
    check: 'text-orange-500',
    btn: 'bg-orange-500 text-white hover:bg-orange-600',
    ghost: 'border-orange-200 text-orange-800',
    pill: 'bg-white text-orange-800',
    visual: 'desktop',
    caption: 'Tailored Solutions for Your Growth',
    secondary: 'Discuss',
  },
};

const FALLBACK = {
  wrap: 'border-slate-200 bg-white',
  iconWrap: 'bg-slate-800 text-white',
  check: 'text-blue-600',
  btn: 'bg-blue-600 text-white',
  ghost: 'border-slate-200 text-slate-800',
  pill: 'bg-white text-slate-700',
  visual: 'desktop' as const,
  caption: 'Built around your workflow',
  secondary: 'Learn more',
};

const PRODUCT_SHOTS: Record<'erp' | 'web' | 'mobile' | 'desktop', { src: string; alt: string }> = {
  erp: { src: '/images/products/erp-laptop.png', alt: 'BCL OneCampus ERP on a laptop' },
  web: {
    src: '/images/products/web-devices.png',
    alt: 'Institution website on desktop and mobile',
  },
  mobile: { src: '/images/products/mobile-phones.png', alt: 'OneCampus mobile apps on two phones' },
  desktop: {
    src: '/images/products/custom-desktop.png',
    alt: 'Custom business software on a desktop',
  },
};

function GstInvoiceVisual() {
  return (
    <div className="relative mx-auto mb-8 w-[min(100%,280px)]">
      <div className="absolute -left-3 top-6 h-16 w-16 rounded-2xl bg-cyan-400/20 blur-xl" />
      <div className="relative rotate-[-2deg] rounded-[22px] border border-cyan-200 bg-white p-4 shadow-[0_18px_40px_rgba(8,47,73,0.16)]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#0b3a6e]">
            <Receipt className="h-3.5 w-3.5 text-cyan-600" />
            TAX INVOICE
          </span>
          <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white">
            GST
          </span>
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-400">
          Invoice # BCL-1048
        </p>
        <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
          <div className="flex justify-between">
            <span>Taxable value</span>
            <span>₹ 15,000</span>
          </div>
          <div className="flex justify-between text-cyan-700">
            <span>CGST 9% + SGST 9%</span>
            <span>₹ 2,700</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 font-semibold text-[#0b3a6e]">
            <span>Total</span>
            <span className="inline-flex items-center gap-0.5">
              <IndianRupee className="h-3 w-3" />
              17,700
            </span>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-sky-50 px-2 py-1 text-center text-[10px] font-semibold text-[#0b5ea8]">
          HSN / SAC ready · PDF invoice
        </p>
      </div>
    </div>
  );
}

function ProductVisual({ kind }: { kind: 'erp' | 'web' | 'mobile' | 'desktop' | 'gst' }) {
  if (kind === 'gst') return <GstInvoiceVisual />;
  const shot = PRODUCT_SHOTS[kind];
  return (
    <div className="relative mx-auto mb-8 w-[min(100%,300px)]">
      <img
        src={shot.src}
        alt={shot.alt}
        className="h-[210px] w-full object-contain drop-shadow-xl"
      />
    </div>
  );
}

export function ProductsSection({
  products,
  heading = true,
}: {
  products: Product[];
  heading?: boolean;
}) {
  return (
    <section
      id="products"
      className={
        heading
          ? 'relative overflow-hidden bg-white py-16 lg:py-20'
          : 'relative overflow-hidden py-10 lg:py-12'
      }
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {heading ? (
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Our products
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Powerful products for a <span className="text-blue-600">smarter tomorrow</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Modern solutions to digitize, streamline and empower educational institutions and
                businesses.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              View all products →
            </Link>
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          {products.map((product) => {
            const theme = THEMES[product.slug] ?? FALLBACK;
            const features = JSON.parse(product.featuresJson) as string[];
            const Icon = product.slug.includes('gst')
              ? Receipt
              : product.slug.includes('mobile')
                ? Smartphone
                : product.slug.includes('web')
                  ? Globe
                  : product.slug.includes('custom')
                    ? Monitor
                    : GraduationCap;
            return (
              <article
                id={product.slug}
                key={product.id}
                className={cn(
                  'relative scroll-mt-28 overflow-hidden rounded-[28px] border p-6 shadow-sm sm:p-7',
                  theme.wrap,
                )}
              >
                {'badge' in theme && theme.badge ? (
                  <span
                    className={cn(
                      'absolute right-5 top-5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white',
                      product.slug === 'gst-billing'
                        ? 'bg-[#0b3a6e] text-cyan-200 ring-1 ring-cyan-300/60'
                        : 'bg-sky-600',
                    )}
                  >
                    {theme.badge}
                  </span>
                ) : null}
                <div className="grid items-center gap-6 md:grid-cols-[1.15fr_0.95fr]">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-2xl shadow-md',
                          theme.iconWrap,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          {product.category}
                        </p>
                        <h3 className="text-xl font-semibold text-slate-900">{product.name}</h3>
                        {product.slug === 'gst-billing' ? (
                          <p className="text-xs font-medium text-cyan-800">
                            {COMPANY.gstBilling.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>
                    <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-slate-700">
                      {features.slice(0, 10).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', theme.check)} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        className={cn('rounded-full px-4 py-2 text-sm font-semibold', theme.btn)}
                      >
                        Learn more →
                      </Link>
                      <Link
                        href={
                          product.slug === 'gst-billing'
                            ? GST_BILLING_URL
                            : `/products/${product.slug}`
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold',
                          theme.ghost,
                        )}
                        {...(product.slug === 'gst-billing'
                          ? { target: '_blank', rel: 'noreferrer' }
                          : {})}
                      >
                        {product.slug === 'gst-billing' ? (
                          <IndianRupee className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        {theme.secondary}
                      </Link>
                    </div>
                  </div>
                  <div className="relative">
                    <ProductVisual kind={theme.visual} />
                    <div
                      className={cn(
                        'absolute -bottom-1 left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded-2xl px-3 py-2 text-center text-[11px] font-semibold shadow-lg',
                        theme.pill,
                      )}
                    >
                      {theme.caption}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
