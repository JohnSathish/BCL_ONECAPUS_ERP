import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IqacMembersPanel } from '@/components/iqac-members-panel';
import { IqacShell } from '@/components/iqac-shell';
import { getCmsPage } from '@/lib/content';
import { getPublicCommitteeMembers } from '@/lib/iqac-members';
import { IQAC_BASE, IQAC_NAV, iqacItemForSlug } from '@/lib/iqac-nav';

type Props = { params: Promise<{ slug?: string[] }> };

function breadcrumbsFor(title: string, slug?: string | null) {
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
    { label: 'IQAC', href: slug ? IQAC_BASE : undefined },
  ];
  if (slug) crumbs.push({ label: title });
  return crumbs;
}

export function generateStaticParams() {
  return [
    { slug: [] },
    ...IQAC_NAV.filter((item) => item.slug).map((item) => ({ slug: [item.slug!] })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const part = slug?.[0] ?? null;
  if (slug && slug.length > 1) return { title: 'Not Found' };
  const item = iqacItemForSlug(part);
  if (part && !item?.slug) return { title: 'Not Found' };

  const path = item?.href ?? IQAC_BASE;
  const cms = await getCmsPage(path);
  const title = cms?.seoTitle || cms?.title || item?.label || 'IQAC';

  return {
    title,
    description:
      cms?.seoDescription ||
      cms?.excerpt ||
      item?.description ||
      'Internal Quality Assurance Cell at Don Bosco College, Tura.',
    keywords: cms?.seoKeywords,
    alternates: { canonical: path },
  };
}

export default async function IqacPage({ params }: Props) {
  const { slug } = await params;
  const part = slug?.[0] ?? null;

  if (slug && slug.length > 1) notFound();
  const item = iqacItemForSlug(part);
  if (part && !item?.slug) notFound();

  const path = item?.href ?? IQAC_BASE;
  const cms = await getCmsPage(path);
  const title = cms?.title || item?.label || 'IQAC';
  const lead =
    cms?.excerpt ||
    item?.description ||
    'Internal Quality Assurance Cell — quality initiatives at Don Bosco College, Tura.';

  const isMembers = part === 'members';
  const membersPayload = isMembers ? await getPublicCommitteeMembers('IQAC') : null;

  return (
    <IqacShell
      title={title}
      breadcrumbs={breadcrumbsFor(title, part)}
      lead={lead}
      currentHref={path}
    >
      {cms?.bodyHtml ? (
        <div dangerouslySetInnerHTML={{ __html: cms.bodyHtml }} />
      ) : !isMembers ? (
        <>
          <h2>{title}</h2>
          <p>{item?.description}</p>
          <p>
            Publish content for this section in Website CMS (Website SMD → Pages → path{' '}
            <code>{path}</code>). Each IQAC section is managed independently.
          </p>
        </>
      ) : null}

      {isMembers ? (
        <IqacMembersPanel
          committeeName={membersPayload?.name}
          members={membersPayload?.members ?? []}
        />
      ) : null}
    </IqacShell>
  );
}
