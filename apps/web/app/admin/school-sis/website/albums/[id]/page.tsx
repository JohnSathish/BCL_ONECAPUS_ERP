import { SchoolWebAlbumManager } from '@/components/school-sis/school-web-album-manager';

export default async function SchoolWebAlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SchoolWebAlbumManager albumId={id} />;
}
