'use client';

import { use } from 'react';
import { PrincipalSection } from '@/components/school-sis/portal/principal-pages';

export default function PrincipalPortalSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  return <PrincipalSection section={section} />;
}
