import { OpacBook } from '@/components/opac/opac-book';

export default async function OpacBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpacBook id={id} />;
}
