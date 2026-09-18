import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        We couldn’t find that page. It may have moved, or the link may be incorrect.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="bcl-btn bcl-btn-primary">
          Back to home
        </Link>
        <Link href="/contact" className="bcl-btn bcl-btn-secondary">
          Contact us
        </Link>
      </div>
    </main>
  );
}
