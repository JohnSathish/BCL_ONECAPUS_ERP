'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { CampusAccessKiosk } from '@/components/campus-access/campus-access-kiosk';

export default function KioskPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  return <CampusAccessKiosk code={code} token={token} />;
}
