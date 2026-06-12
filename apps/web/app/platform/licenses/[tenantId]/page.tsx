'use client';

import { use } from 'react';
import { PlatformLicenseDetailView } from '@/components/platform/platform-license-detail-view';

export default function PlatformLicenseDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  return <PlatformLicenseDetailView tenantId={tenantId} />;
}
