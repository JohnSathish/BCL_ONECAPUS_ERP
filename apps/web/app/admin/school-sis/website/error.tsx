'use client';

export default function SchoolWebCmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6 text-center">
      <h1 className="text-lg font-semibold text-[#1a365d]">Website CMS hit an error</h1>
      <p className="mt-2 text-sm text-slate-600">
        {error.message ||
          'The page could not be shown. Your other school ERP screens are unchanged.'}
      </p>
      <button
        type="button"
        className="mt-4 rounded-xl bg-[#163a6b] px-4 py-2 text-sm font-semibold text-white"
        onClick={reset}
      >
        Reload Website CMS
      </button>
    </div>
  );
}
