import Link from 'next/link';
import type { OpacBookCard } from '@/services/opac';

export function BookCard({ book }: { book: OpacBookCard }) {
  const letter = book.title.trim().charAt(0).toUpperCase() || 'B';
  return (
    <Link
      href={`/opac/books/${book.id}`}
      className="flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {book.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverImageUrl} alt="" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center bg-sky-50 text-3xl font-bold text-sky-800">
          {letter}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-950">{book.title}</p>
        <p className="line-clamp-1 text-xs text-slate-500">
          {book.author || 'Author not recorded'}
        </p>
        <p className="mt-auto text-xs font-semibold text-sky-800">
          {book.available > 0
            ? `${book.available} available`
            : book.reference > 0
              ? 'Reference only'
              : 'No copy available'}
        </p>
      </div>
    </Link>
  );
}
