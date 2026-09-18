import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero, SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = {
  title: 'Industries we serve',
  description:
    'School, college, university, hospital, diocese, parish, NGO and business software from BaseCode Labs in Tamil Nadu and Meghalaya.',
};

const INDUSTRIES = [
  {
    slug: 'schools',
    title: 'Schools',
    copy: 'Websites, parent apps, ID cards and BCL OneCampus for school administration.',
  },
  {
    slug: 'colleges',
    title: 'Colleges',
    copy: 'College sites, ERP, examination and staff portals.',
  },
  {
    slug: 'universities',
    title: 'Universities',
    copy: 'Multi-campus software, websites and reporting.',
  },
  {
    slug: 'hospitals',
    title: 'Hospitals',
    copy: 'Custom software, websites and operational systems.',
  },
  {
    slug: 'dioceses',
    title: 'Dioceses',
    copy: 'Province and diocese websites plus companion mobile apps.',
  },
  {
    slug: 'churches',
    title: 'Churches / Parishes',
    copy: 'Parish communication sites and mobile presence.',
  },
  { slug: 'ngos', title: 'NGOs', copy: 'Public websites and programme software.' },
  {
    slug: 'businesses',
    title: 'Businesses',
    copy: 'Corporate sites, SaaS and custom applications.',
  },
  { slug: 'retail', title: 'Retail', copy: 'E-commerce and catalogue sites.' },
  {
    slug: 'professional-services',
    title: 'Professional services',
    copy: 'Firm websites and client portals.',
  },
];

export default function IndustriesPage() {
  return (
    <main>
      <PageHero
        eyebrow="Industries"
        title="Built for the sectors we already serve"
        description="Relevant solutions for each sector. Product details stay in the CMS so this page never hard-codes a frozen catalogue."
      />
      <div className="bcl-container grid gap-4 py-12 md:grid-cols-2">
        {INDUSTRIES.map((item) => (
          <article key={item.slug} id={item.slug} className="bcl-card p-6">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-[15px] leading-7 text-slate-600">{item.copy}</p>
            <Link href="/contact" className="mt-4 inline-flex text-sm font-semibold text-blue-700">
              Start a project
            </Link>
          </article>
        ))}
      </div>
      <SiteCta />
    </main>
  );
}
