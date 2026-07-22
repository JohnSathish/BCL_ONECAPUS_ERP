import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { getCollegeContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'News & Events',
  description: 'Latest news, achievements and campus events from Don Bosco College, Tura.',
};

const PAGE_SIZE = 4;

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const content = await getCollegeContent();
  const items = [...content.news].sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const requested = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>News &amp; Events</span>
          </div>
          <span className="eyebrow gold">Stay updated</span>
          <h1>News &amp; Events</h1>
          <p>
            Discover the latest happenings, achievements, and activities at Don Bosco College, Tura.
          </p>
        </div>
      </header>

      <section className="section shell">
        <div className="news-index-grid">
          {pageItems.map((item) => (
            <article className="news-index-card" key={item.slug}>
              <Link href={`/news/${item.slug}`} className="news-index-media">
                <Image src={item.image} alt="" fill sizes="(max-width: 760px) 100vw, 360px" />
              </Link>
              <div className="news-index-body">
                <span className="eyebrow">
                  {item.category} ·{' '}
                  {new Date(item.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <h2>
                  <Link href={`/news/${item.slug}`}>{item.title}</Link>
                </h2>
                <p>{item.excerpt}</p>
                <Link className="text-link" href={`/news/${item.slug}`}>
                  Read more <ArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <Pagination
          page={page}
          pageCount={pageCount}
          hrefForPage={(nextPage) => (nextPage <= 1 ? '/news' : `/news?page=${nextPage}`)}
          label="News pages"
        />
      </section>
    </main>
  );
}
