import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SchoolGalleryAlbumView } from '@/components/school-web/school-gallery-album-view';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebAlbum,
  fetchSchoolWebBundle,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  asSeo,
  breadcrumbJsonLd,
  buildSchoolMetadata,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [album, bundle, host] = await Promise.all([
    fetchSchoolWebAlbum(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!album || !bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  const seo = asSeo(album.seo);
  const cover = album.cover?.card || album.items?.[0]?.urls.card;
  return buildSchoolMetadata({
    origin,
    path: `/gallery/${slug}`,
    siteName: bundle.site.displayName,
    title: seo.title || `${album.title} | St. Luke’s Secondary School, Tura`,
    description:
      seo.description ||
      album.description ||
      `Photographs from ${album.title} at St. Luke’s Secondary School, Tura.`,
    seo,
    ogImage: cover,
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [album, bundle, host] = await Promise.all([
    fetchSchoolWebAlbum(slug),
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
  ]);
  if (!album || !bundle) notFound();
  const origin = schoolPublicOrigin(extras(bundle), host);
  const crumbs = [
    { href: '/', label: 'Home' },
    { href: '/gallery', label: 'Gallery' },
    { href: `/gallery/${slug}`, label: asSeo(album.seo).breadcrumbTitle || album.title },
  ];
  const shareUrl = `${origin}/gallery/${slug}`;
  return (
    <article className="sls-page">
      <SchoolJsonLd
        data={[
          breadcrumbJsonLd(origin, crumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'ImageGallery',
            name: album.title,
            description: album.description,
            url: shareUrl,
          },
        ]}
      />
      <SchoolInteriorPage
        slug="gallery"
        kicker={album.category?.name || 'GALLERY'}
        title={album.title}
        lede={[
          `${album.photoCount} photographs`,
          album.eventDate ? new Date(album.eventDate).toLocaleDateString('en-IN') : '',
          album.location || '',
        ]
          .filter(Boolean)
          .join(' · ')}
        site={bundle.site}
        extrasJson={extras(bundle)}
        seoJson={album.seo}
        crumbs={crumbs}
        backgroundImage={album.cover?.original || album.cover?.card || undefined}
        host={host}
      >
        {album.description ? <p className="sls-muted">{album.description}</p> : null}
        <SchoolGalleryAlbumView
          title={album.title}
          items={album.items ?? []}
          allowDownload={album.allowDownload}
          shareUrl={shareUrl}
        />
      </SchoolInteriorPage>
    </article>
  );
}
