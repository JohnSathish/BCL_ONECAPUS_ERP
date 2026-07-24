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
  return {
    title: item.seoTitle || item.title,
    description: item.seoDescription || item.excerpt,
    openGraph: {
      type: 'article',
      ...(hasNewsFeaturedImage(item.image) ? { images: [item.image] } : {}),
    },
  };
}

export default async function NewsDetail({ params }: Props) {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) notFound();
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
          </span>
          <h1>{item.title}</h1>
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
        <p>
          <Link className="text-link" href="/news">
            ← Back to news
          </Link>
        </p>
      </article>
    </main>
  );
}
