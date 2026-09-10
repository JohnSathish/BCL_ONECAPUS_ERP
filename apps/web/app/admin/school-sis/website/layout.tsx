import { Suspense } from 'react';

export default function SchoolWebCmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading website CMS…</p>}>
      {children}
    </Suspense>
  );
}
