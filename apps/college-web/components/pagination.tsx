import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  label?: string;
};

function visiblePages(page: number, pageCount: number): Array<number | '…'> {
  if (pageCount <= 9) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }
  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  for (const entry of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === 'number' && entry - prev > 1) result.push('…');
    result.push(entry);
  }
  return result;
}

export function Pagination({ page, pageCount, hrefForPage, label = 'Pagination' }: Props) {
  if (pageCount <= 1) return null;

  const pages = visiblePages(page, pageCount);
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
        {pages.map((entry, index) =>
          entry === '…' ? (
            <li key={`ellipsis-${index}`}>
              <span className="site-pagination-page is-ellipsis" aria-hidden>
                …
              </span>
            </li>
          ) : (
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
          ),
        )}
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
