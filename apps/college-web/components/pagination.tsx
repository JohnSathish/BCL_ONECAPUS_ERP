import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  label?: string;
};

export function Pagination({ page, pageCount, hrefForPage, label = 'Pagination' }: Props) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const previous = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;

  return (
    <nav className="site-pagination" aria-label={label}>
      {previous ? (
        <Link className="site-pagination-btn" href={hrefForPage(previous)} rel="prev">
          <ChevronLeft aria-hidden /> Previous
        </Link>
      ) : (
        <span className="site-pagination-btn is-disabled" aria-disabled="true">
          <ChevronLeft aria-hidden /> Previous
        </span>
      )}

      <ol className="site-pagination-pages">
        {pages.map((entry) => (
          <li key={entry}>
            {entry === page ? (
              <span className="site-pagination-page is-current" aria-current="page">
                {entry}
              </span>
            ) : (
              <Link className="site-pagination-page" href={hrefForPage(entry)}>
                {entry}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {next ? (
        <Link className="site-pagination-btn" href={hrefForPage(next)} rel="next">
          Next <ChevronRight aria-hidden />
        </Link>
      ) : (
        <span className="site-pagination-btn is-disabled" aria-disabled="true">
          Next <ChevronRight aria-hidden />
        </span>
      )}
    </nav>
  );
}
