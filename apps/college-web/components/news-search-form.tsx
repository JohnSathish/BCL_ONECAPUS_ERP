import { Search } from 'lucide-react';

export function NewsSearchForm({
  query = '',
  id = 'news-search',
  className = 'news-search',
}: {
  query?: string;
  id?: string;
  className?: string;
}) {
  return (
    <form className={className} action="/news" method="get" role="search">
      <label className="sr-only" htmlFor={id}>
        Search news
      </label>
      <Search aria-hidden />
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search news & events…"
        autoComplete="off"
      />
      <button type="submit">Search</button>
    </form>
  );
}
