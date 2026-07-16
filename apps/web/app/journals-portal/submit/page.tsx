'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubmitPaperPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/journals-portal/author');
  }, [router]);
  return <div className="p-8 text-sm text-[#0A2342]/70">Redirecting to author portal…</div>;
}
