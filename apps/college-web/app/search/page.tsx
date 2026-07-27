import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { NewsSearchForm } from '@/components/news-search-form';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search news and events at Don Bosco College, Tura.',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  if (query) {
    redirect(`/news?q=${encodeURIComponent(query)}`);
  }

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Search</span>
          </div>
          <span className="eyebrow gold">Find campus updates</span>
          <h1>Search news</h1>
          <p>Look up college news, achievements, and campus events.</p>
          <NewsSearchForm id="site-news-search" />
        </div>
      </header>
      <section className="section shell">
        <p className="news-search-meta">
          Enter a keyword above to browse matching News &amp; Events, or{' '}
          <Link className="text-link" href="/news">
            view all news
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
