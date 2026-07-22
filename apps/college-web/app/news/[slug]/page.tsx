import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollegeContent } from '@/lib/content';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCollegeContent()).news.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = (await getCollegeContent()).news.find((news) => news.slug === slug);
  return item
    ? {
        title: item.title,
        description: item.excerpt,
        openGraph: { images: [item.image], type: 'article' },
      }
    : {};
}

export default async function NewsDetail({ params }: Props) {
  const { slug } = await params;
  const item = (await getCollegeContent()).news.find((news) => news.slug === slug);
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
          <Image src={item.image} alt="" fill sizes="900px" priority />
        </div>
        <p className="lead">{item.excerpt}</p>
        {item.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>
          <Link className="text-link" href="/news">
            ← Back to news
          </Link>
        </p>
      </article>
    </main>
  );
}
