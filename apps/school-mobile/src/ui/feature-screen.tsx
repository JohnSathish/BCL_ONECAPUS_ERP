import { EmptyState, Screen } from '@/ui/kit';

export default function FeatureScreen({ title, body }: { title: string; body: string }) {
  return (
    <Screen title={title} onBack>
      <EmptyState title={title} body={body} />
    </Screen>
  );
}
