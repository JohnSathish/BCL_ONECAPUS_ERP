'use client';

import { SchoolWebAlbumsAdmin } from '@/components/school-sis/school-web-albums-admin';
import { SchoolWebCmsShell } from '@/components/school-sis/school-web-cms-shell';
import { CmsPageHeader } from '@/components/school-sis/school-web-cms-ui';

export default function SchoolWebAlbumsPage() {
  return (
    <SchoolWebCmsShell title="Gallery" crumbs={[{ label: 'Gallery' }]}>
      <CmsPageHeader
        title="Gallery"
        description="Albums and photographs shown on the public St. Luke’s website."
      />
      <SchoolWebAlbumsAdmin />
    </SchoolWebCmsShell>
  );
}
