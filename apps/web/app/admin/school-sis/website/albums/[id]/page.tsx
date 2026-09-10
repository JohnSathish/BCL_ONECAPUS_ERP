import { SchoolWebAlbumManager } from '@/components/school-sis/school-web-album-manager';
import { SchoolWebCmsShell } from '@/components/school-sis/school-web-cms-shell';
import { CmsPageHeader } from '@/components/school-sis/school-web-cms-ui';

export default async function SchoolWebAlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <SchoolWebCmsShell
      title="Gallery album"
      crumbs={[{ label: 'Gallery', href: '/admin/school-sis/website/albums' }, { label: 'Album' }]}
    >
      <CmsPageHeader
        title="Album"
        description="Add, caption and arrange photographs for this album."
      />
      <SchoolWebAlbumManager albumId={id} />
    </SchoolWebCmsShell>
  );
}
