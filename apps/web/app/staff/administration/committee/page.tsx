'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommitteeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/governance');
  }, [router]);

  return null;
}
