import { Suspense } from 'react';
import { OpacSearch } from '@/components/opac/opac-search';

export default function OpacSearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading search…</p>}>
      <OpacSearch />
    </Suspense>
  );
}
