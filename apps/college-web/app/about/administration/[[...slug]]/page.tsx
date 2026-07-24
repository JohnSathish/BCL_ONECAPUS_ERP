import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  AdministrationOverviewCards,
  AdministrationShell,
} from '@/components/administration-shell';
import {
  ADMINISTRATION_BASE,
  ADMINISTRATION_NAV,
  administrationItemForSlug,
} from '@/lib/administration-nav';
import { getCmsPage } from '@/lib/content';

type Props = { params: Promise<{ slug?: string[] }> };

function breadcrumbsFor(title: string, slug?: string) {
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
    { label: 'About Us', href: '/about' },
    {
      label: 'Administration',
      href: slug ? ADMINISTRATION_BASE : undefined,
    },
  ];
  if (slug) crumbs.push({ label: title });
  return crumbs;
}

export function generateStaticParams() {
  return [{ slug: [] }, ...ADMINISTRATION_NAV.map((item) => ({ slug: [item.slug!] }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const part = slug?.[0];
  if (slug && slug.length > 1) return { title: 'Not Found' };
  if (part && !administrationItemForSlug(part)) return { title: 'Not Found' };

  const path = part ? `${ADMINISTRATION_BASE}/${part}` : ADMINISTRATION_BASE;
  const item = part ? administrationItemForSlug(part) : null;
  const cms = await getCmsPage(path);
  const title = cms?.title || item?.label || 'Administration';

  return {
    title,
    description:
      cms?.seoDescription ||
      cms?.excerpt ||
      item?.description ||
      'Administration, governance and institutional cells at Don Bosco College Tura.',
    keywords: cms?.seoKeywords,
  };
}

export default async function AdministrationPage({ params }: Props) {
  const { slug } = await params;
  const part = slug?.[0];

  if (slug && (slug.length > 1 || !administrationItemForSlug(part))) notFound();

  const item = part ? administrationItemForSlug(part) : null;
  const path = item?.href ?? ADMINISTRATION_BASE;
  const cms = await getCmsPage(path);
  const title = cms?.title || item?.label || 'Administration';
  const lead =
    cms?.excerpt ||
    item?.description ||
    'Governance, quality assurance and institutional administration.';

  return (
    <AdministrationShell
      title={title}
      breadcrumbs={breadcrumbsFor(title, part)}
      lead={lead}
      currentHref={path}
    >
      {!item ? (
        <AdministrationOverviewCards />
      ) : cms?.bodyHtml ? (
        <div dangerouslySetInnerHTML={{ __html: cms.bodyHtml }} />
      ) : (
        <>
          <h2>{title}</h2>
          <p>{item.description}</p>
          <p>
            This section is ready for published CMS content from the college website manager. Until
            detailed content is available, the Administration menu keeps every institutional page
            discoverable and easy to navigate.
          </p>
          <ul>
            <li>Official notices and documents</li>
            <li>Committee and cell information</li>
            <li>Quality and accreditation updates</li>
            <li>Governance and planning resources</li>
          </ul>
        </>
      )}
    </AdministrationShell>
  );
}
