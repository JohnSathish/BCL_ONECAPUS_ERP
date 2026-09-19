import Link from 'next/link';
import { AboutSection } from '@/components/public/about-section';
import { COMPANY } from '@/lib/company';
import { prisma } from '@/lib/prisma';
import { ProductsSection } from '@/components/public/products-section';
import { ServicesSection } from '@/components/public/services-section';
import { FeaturedProjectsSection } from '@/components/public/featured-projects-section';
import { TestimonialsSection } from '@/components/public/testimonials-section';
import { Ecosystem } from '@/components/public/ecosystem';
import { SiteCta } from '@/components/ui/page-shell';
import { FALLBACK_PROJECTS, FALLBACK_SERVICES } from '@/lib/published-catalog';
import { ensureCatalog, fallbackProducts, fallbackTestimonials } from '@/lib/catalog';

async function publishedOr<T>(
  load: () => Promise<T[]>,
  fallback: readonly unknown[],
): Promise<T[]> {
  try {
    const rows = await load();
    return rows.length ? rows : (fallback as T[]);
  } catch {
    return fallback as T[];
  }
}

export default async function HomePage() {
  await ensureCatalog();
  const [products, testimonials, logos, services, projects] = await Promise.all([
    publishedOr(
      () =>
        prisma.product.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { displayOrder: 'asc' },
        }),
      fallbackProducts(),
    ),
    publishedOr(
      () =>
        prisma.testimonial.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { displayOrder: 'asc' },
        }),
      fallbackTestimonials(),
    ),
    prisma.clientLogo
      .findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { displayOrder: 'asc' },
      })
      .catch(() => []),
    publishedOr(
      () =>
        prisma.serviceItem.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { displayOrder: 'asc' },
        }),
      FALLBACK_SERVICES,
    ),
    publishedOr(
      () =>
        prisma.portfolioProject.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { displayOrder: 'asc' },
        }),
      FALLBACK_PROJECTS,
    ),
  ]);

  return (
    <main>
      <section className="relative overflow-hidden bg-[#050d1c] text-white">
        <div className="aurora pointer-events-none absolute inset-0" />
        <div className="grid-glow pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Innovative solutions. Real impact.
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              {COMPANY.headline}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">{COMPANY.subheading}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="rounded-full bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-400 px-6 py-3 text-sm font-semibold shadow-[0_0_28px_rgba(34,211,238,0.35)]"
              >
                Explore Our Products
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold backdrop-blur"
              >
                Start a Project
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COMPANY.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                >
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-[11px] text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <Ecosystem />
        </div>
      </section>

      <AboutSection logos={logos} />

      <ProductsSection products={products} />

      <ServicesSection services={services} />

      <TestimonialsSection items={testimonials} logos={logos} />

      <FeaturedProjectsSection projects={projects} />

      <SiteCta />
    </main>
  );
}
