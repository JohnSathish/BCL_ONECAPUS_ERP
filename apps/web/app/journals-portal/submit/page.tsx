'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy /submit URL → in-portal author submission (Google Form discontinued). */
export default function SubmitPaperPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/journals-portal/author/submissions/new');
  }, [router]);
  return (
    <div className="p-8 text-sm text-[#0A2342]/70">Redirecting to Author Desk submission…</div>
  );
}
