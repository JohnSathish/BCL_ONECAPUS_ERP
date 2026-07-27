import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewsFeaturedMedia } from '@/components/news-featured-media';
import { getPublicNews, getPublicNewsBySlug } from '@/lib/news';
import { hasNewsFeaturedImage } from '@/lib/news-media';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPublicNews()).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) return {};
  const ogImage = item.ogImage || item.image;
  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.excerpt,
    keywords: item.seoKeywords || undefined,
    openGraph: {
      type: 'article',
      title: item.seoTitle || item.title,
      description: item.seoDescription || item.excerpt,
      ...(hasNewsFeaturedImage(ogImage) ? { images: [ogImage] } : {}),
    },
  };
}

export default async function NewsDetail({ params }: Props) {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) notFound();
  const allNews = await getPublicNews();
  const related = (item.relatedSlugs ?? [])
    .map((relatedSlug) => allNews.find((row) => row.slug === relatedSlug))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / <Link href="/news">News</Link> / {item.category}
          </div>
          <span className="eyebrow gold">
            {item.category} ·{' '}
            {new Date(item.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            {item.author ? ` · ${item.author}` : ''}
          </span>
          <h1>{item.title}</h1>
          {item.tags?.length ? (
            <p className="news-detail-tags">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </p>
          ) : null}
        </div>
      </header>
      <article className="prose shell section" style={{ maxWidth: 900 }}>
        <div className="news-detail-image">
          <NewsFeaturedMedia
            image={item.image}
            title={item.title}
            slug={item.slug}
            category={item.category}
            sizes="900px"
            priority
          />
        </div>
        <p className="lead">{item.excerpt}</p>
        {item.bodyHtml ? (
          <div className="news-article-body" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
        ) : (
          item.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        )}

        {item.gallery?.length ? (
          <section className="news-detail-gallery" aria-label="Photo gallery">
            <h2>Gallery</h2>
            <div className="news-detail-gallery-grid">
              {item.gallery.map((photo) => (
                <figure key={photo.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src} alt={photo.alt || item.title} />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {item.attachments?.length ? (
          <section className="news-detail-attachments" aria-label="Downloads">
            <h2>Downloads</h2>
            <ul>
              {item.attachments.map((file) => (
                <li key={file.url}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length ? (
          <section className="news-detail-related" aria-label="Related news">
            <h2>Related news</h2>
            <ul>
              {related.map((row) => (
                <li key={row.slug}>
                  <Link href={`/news/${row.slug}`}>{row.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p>
          <Link className="text-link" href="/news">
            ← Back to news
          </Link>
        </p>
      </article>
    </main>
  );
}
