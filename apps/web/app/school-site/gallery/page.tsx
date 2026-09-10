import type { Metadata } from 'next';
import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { SchoolJsonLd } from '@/components/school-web/school-json-ld';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebGallery,
  schoolWebPath,
  schoolWebRequestHost,
} from '@/lib/school-web/public';
import {
  breadcrumbJsonLd,
  buildSchoolMetadata,
  crumbsFor,
  schoolPublicOrigin,
} from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return {};
  const origin = schoolPublicOrigin(extras(bundle), host);
  return buildSchoolMetadata({
    origin,
    path: '/gallery',
    siteName: bundle.site.displayName,
    title: 'Gallery | St. Luke’s Secondary School, Tura',
    description:
      'Photographs and albums from St. Luke’s Secondary School, Walbakgre, Tura, published by the school office.',
    logo: String(extras(bundle).logoUrl || '/school-sis/st-lukes-logo.png'),
  });
}

export default async function SchoolSiteGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; tagId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [bundle, host, gallery] = await Promise.all([
    fetchSchoolWebBundle(),
    schoolWebRequestHost(),
    fetchSchoolWebGallery({
      ...(params.q ? { q: params.q } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.tagId ? { tagId: params.tagId } : {}),
      ...(params.page ? { page: params.page } : {}),
    }),
  ]);
  const origin = bundle ? schoolPublicOrigin(extras(bundle), host) : '';
  const crumbs = crumbsFor('gallery', 'Gallery');
  const albums = gallery?.albums ?? [];
  const pages = gallery ? Math.max(1, Math.ceil(gallery.total / gallery.pageSize)) : 1;
  return (
    <div className="sls-page">
      {origin ? <SchoolJsonLd data={breadcrumbJsonLd(origin, crumbs)} /> : null}
      {bundle ? (
        <SchoolInteriorPage
          slug="gallery"
          kicker="GALLERY"
          title="From our school"
          lede="Photographs from school life, programmes and campus events, published by the school office."
          site={bundle.site}
          extrasJson={extras(bundle)}
          crumbs={crumbs}
          host={host}
        >
          <form className="sls-gallery-filters" method="get">
            <label>
              <span className="sls-sr-only">Search albums</span>
              <input name="q" defaultValue={params.q || ''} placeholder="Search albums" />
            </label>
            <label>
              <span className="sls-sr-only">Category</span>
              <select name="categoryId" defaultValue={params.categoryId || ''}>
                <option value="">All categories</option>
                {(gallery?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sls-sr-only">Tag</span>
              <select name="tagId" defaultValue={params.tagId || ''}>
                <option value="">All tags</option>
                {(gallery?.tags ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="sls-btn sls-btn-gold">
              Filter
            </button>
          </form>
          <div className="sls-grid sls-cards-3">
            {albums.map((album) => (
              <a
                key={album.id}
                href={schoolWebPath(`/gallery/${album.slug}`, host)}
                className="sls-card sls-album-card"
              >
                {album.cover?.card ? (
                  <img src={album.cover.card} alt="" loading="lazy" />
                ) : (
                  <div className="sls-album-placeholder" />
                )}
                <p className="sls-kicker">{album.category?.name || 'Album'}</p>
                <h3>{album.title}</h3>
                <p className="sls-muted">
                  {album.photoCount} photo{album.photoCount === 1 ? '' : 's'}
                  {album.eventDate
                    ? ` · ${new Date(album.eventDate).toLocaleDateString('en-IN')}`
                    : ''}
                </p>
                {album.description ? (
                  <p className="sls-muted">{album.description.slice(0, 140)}</p>
                ) : null}
              </a>
            ))}
          </div>
          {!albums.length ? (
            <p className="sls-muted">
              No published albums yet. Photographs appear here when the office publishes an album.
            </p>
          ) : null}
          {pages > 1 ? (
            <p className="sls-gallery-pages">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={schoolWebPath(
                    `/gallery?page=${n}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`,
                    host,
                  )}
                >
                  {n}
                </a>
              ))}
            </p>
          ) : null}
        </SchoolInteriorPage>
      ) : (
        <p className="sls-muted sls-wrap">
          Gallery is unavailable until the school website is loaded.
        </p>
      )}
    </div>
  );
}
