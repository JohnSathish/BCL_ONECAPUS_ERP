import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NewsFeaturedMedia } from '@/components/news-featured-media';
import { NewsSearchForm } from '@/components/news-search-form';
import { Pagination } from '@/components/pagination';
import { getCollegeContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'News & Events',
  description: 'Latest news, achievements and campus events from Don Bosco College, Tura.',
};

const PAGE_SIZE = 9;

function matchesQuery(
  item: { title: string; excerpt: string; category: string; slug: string },
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${item.title} ${item.excerpt} ${item.category} ${item.slug}`.toLowerCase();
  return haystack.includes(q);
}

export default async function NewsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const content = await getCollegeContent();
  const items = [...content.news]
    .filter((item) => matchesQuery(item, query))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const requested = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  const hrefForPage = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (nextPage > 1) qs.set('page', String(nextPage));
    const raw = qs.toString();
    return raw ? `/news?${raw}` : '/news';
  };

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
          <NewsSearchForm query={query} />
        </div>
      </header>

      <section className="section shell">
        {query ? (
          <p className="news-search-meta" role="status">
            {items.length
              ? `Showing ${items.length} result${items.length === 1 ? '' : 's'} for “${query}”.`
              : `No news matched “${query}”.`}{' '}
            {items.length ? null : (
              <Link href="/news" className="text-link">
                Clear search
              </Link>
            )}
          </p>
        ) : null}

        <div className="news-index-grid">
          {pageItems.map((item) => (
            <article className="news-index-card" key={item.slug}>
              <Link href={`/news/${item.slug}`} className="news-index-media">
                <NewsFeaturedMedia
                  image={item.image}
                  title={item.title}
                  slug={item.slug}
                  category={item.category}
                  sizes="(max-width: 760px) 100vw, 360px"
                />
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

        {!pageItems.length && !query ? (
          <p className="news-search-meta">No news articles published yet.</p>
        ) : null}

        <Pagination
          page={page}
          pageCount={pageCount}
          hrefForPage={hrefForPage}
          label="News pages"
        />
      </section>
    </main>
  );
}
