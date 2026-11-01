import { Suspense } from 'react';
import { OpacDigital } from '@/components/opac/opac-digital';

export default function OpacDigitalPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading digital resources…</p>}>
      <OpacDigital />
    </Suspense>
  );
}
